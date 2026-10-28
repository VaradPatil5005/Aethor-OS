"""W1 — controlled VRAM spill workload using the CUDA *driver* API via ctypes.

No PyTorch needed: nvcuda.dll ships with every NVIDIA driver. The script
allocates fixed-size blocks on a timed schedule, touches each one, and logs
an exact timestamp per allocation, so SpillGuard's detection latency can be
measured against a known onset.

It also measures memset bandwidth per block after the ramp. Blocks that the
driver placed in system memory (sysmem fallback) are several times slower to
write than blocks in VRAM, which gives a residency label per block and the
E1 cost-of-spill number without any extra tooling.

Ground-truth oracle: with "CUDA - Sysmem Fallback Policy" = Prefer No Sysmem
Fallback for python.exe, cuMemAlloc fails with CUDA_ERROR_OUT_OF_MEMORY (2)
once VRAM is full; with fallback ON (driver default) it succeeds and spills.

Usage:
  python spillstress.py --block-mb 256 --interval 2 --max-mb 7168 --hold 10 --log w1.jsonl
"""
from __future__ import annotations

import argparse
import ctypes
import json
import os
import sys
import time

CUDA_SUCCESS = 0
CUDA_ERROR_OUT_OF_MEMORY = 2
MB = 2**20


class Cuda:
    def __init__(self) -> None:
        self.lib = ctypes.WinDLL("nvcuda") if sys.platform == "win32" else ctypes.CDLL("libcuda.so.1")
        self._chk(self.lib.cuInit(0), "cuInit")
        dev = ctypes.c_int()
        self._chk(self.lib.cuDeviceGet(ctypes.byref(dev), 0), "cuDeviceGet")
        name = ctypes.create_string_buffer(256)
        self.lib.cuDeviceGetName(name, 256, dev)
        self.name = name.value.decode()
        self.ctx = ctypes.c_void_p()
        self._chk(self.lib.cuCtxCreate_v2(ctypes.byref(self.ctx), 0, dev), "cuCtxCreate")
        self.lib.cuMemAlloc_v2.argtypes = [ctypes.POINTER(ctypes.c_uint64), ctypes.c_size_t]
        self.lib.cuMemFree_v2.argtypes = [ctypes.c_uint64]
        self.lib.cuMemsetD32_v2.argtypes = [ctypes.c_uint64, ctypes.c_uint, ctypes.c_size_t]
        self.lib.cuMemGetInfo_v2.argtypes = [ctypes.POINTER(ctypes.c_size_t), ctypes.POINTER(ctypes.c_size_t)]

    @staticmethod
    def _chk(rc: int, what: str) -> None:
        if rc != CUDA_SUCCESS:
            raise RuntimeError(f"{what} failed with CUresult {rc}")

    def alloc(self, nbytes: int) -> tuple[int, int]:
        ptr = ctypes.c_uint64()
        rc = self.lib.cuMemAlloc_v2(ctypes.byref(ptr), nbytes)
        return rc, ptr.value

    def free(self, ptr: int) -> None:
        self.lib.cuMemFree_v2(ptr)

    def memset_gbps(self, ptr: int, nbytes: int, reps: int = 3) -> float:
        """Write bandwidth (GB/s) for one block: memset is a pure device write, so it is
        bounded by VRAM bandwidth if resident and by PCIe if the block lives in sysmem."""
        n32 = nbytes // 4
        self.lib.cuMemsetD32_v2(ptr, 0, n32)
        self.lib.cuCtxSynchronize()
        t0 = time.perf_counter()
        for i in range(reps):
            self.lib.cuMemsetD32_v2(ptr, i + 1, n32)
        self.lib.cuCtxSynchronize()
        dt = time.perf_counter() - t0
        return reps * nbytes / dt / 1e9

    def mem_info(self) -> tuple[int, int]:
        free, total = ctypes.c_size_t(), ctypes.c_size_t()
        self.lib.cuMemGetInfo_v2(ctypes.byref(free), ctypes.byref(total))
        return free.value // MB, total.value // MB


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--block-mb", type=int, default=256)
    ap.add_argument("--interval", type=float, default=2.0, help="seconds between allocations")
    ap.add_argument("--max-mb", type=int, default=7168, help="stop allocating at this total")
    ap.add_argument("--hold", type=float, default=10.0, help="seconds to hold peak before freeing")
    ap.add_argument("--log", default=None, help="JSONL ground-truth log path")
    ap.add_argument("--no-bandwidth", action="store_true", help="skip per-block bandwidth probe")
    args = ap.parse_args()

    log = open(args.log, "w", encoding="utf-8") if args.log else None

    def emit(ev: str, **kw) -> None:
        rec = {"t": round(time.time(), 3), "ev": ev, "pid": os.getpid(), **kw}
        print(json.dumps(rec), flush=True)
        if log:
            log.write(json.dumps(rec) + "\n")
            log.flush()

    cu = Cuda()
    free0, total = cu.mem_info()
    emit("START", device=cu.name, cuda_free_mb=free0, cuda_total_mb=total,
         block_mb=args.block_mb, interval=args.interval, max_mb=args.max_mb)

    blocks: list[int] = []
    nbytes = args.block_mb * MB
    oom = False
    try:
        while len(blocks) * args.block_mb < args.max_mb:
            rc, ptr = cu.alloc(nbytes)
            if rc == CUDA_ERROR_OUT_OF_MEMORY:
                emit("OOM", allocated_mb=len(blocks) * args.block_mb)
                oom = True
                break
            if rc != CUDA_SUCCESS:
                emit("ERROR", rc=rc)
                break
            blocks.append(ptr)
            # First-touch bandwidth: informative for spilled blocks but confounded by GPU P-state,
            # so the residency label comes from the warmed BANDWIDTH pass below, not from this.
            gbps = cu.memset_gbps(ptr, nbytes, reps=1) if not args.no_bandwidth else None
            free, _ = cu.mem_info()
            emit("ALLOC", idx=len(blocks) - 1, allocated_mb=len(blocks) * args.block_mb,
                 cuda_free_mb=free, gbps=round(gbps, 1) if gbps else None)
            time.sleep(args.interval)

        if not args.no_bandwidth and blocks:
            # The GPU idles in P8 between allocations, where the memory clock is ~15x lower.
            # Warm it to full clocks first, or the first block measured looks "spilled".
            warm_until = time.perf_counter() + 1.0
            while time.perf_counter() < warm_until:
                cu.memset_gbps(blocks[-1], nbytes, reps=1)
            per_block = [round(max(cu.memset_gbps(p, nbytes) for _ in range(2)), 1) for p in blocks]
            emit("BANDWIDTH", per_block_gbps=per_block)

        emit("HOLD", allocated_mb=len(blocks) * args.block_mb, seconds=args.hold)
        time.sleep(args.hold)
    finally:
        for p in reversed(blocks):
            cu.free(p)
        emit("FREED", oom=oom)
        if log:
            log.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())

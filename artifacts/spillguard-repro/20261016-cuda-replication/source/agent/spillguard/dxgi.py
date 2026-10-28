"""DXGI adapter enumeration and video-memory budget, via ctypes COM vtables.

Replaces the planned C++/Rust helper: we only need a handful of calls
(CreateDXGIFactory1 -> EnumAdapters1 -> GetDesc1, and
IDXGIAdapter3::QueryVideoMemoryInfo), which are easy to reach by vtable index.

Note: QueryVideoMemoryInfo reports budget/usage *for the calling process*
(Microsoft docs). We use it for adapter capacity and the OS budget only;
per-process usage comes from PDH.
"""
from __future__ import annotations

import ctypes
import sys
from ctypes import wintypes
from dataclasses import dataclass, asdict

HRESULT = ctypes.c_long


class GUID(ctypes.Structure):
    _fields_ = [("Data1", wintypes.DWORD), ("Data2", wintypes.WORD),
                ("Data3", wintypes.WORD), ("Data4", ctypes.c_ubyte * 8)]

    @classmethod
    def parse(cls, s: str) -> "GUID":
        s = s.strip("{}")
        p = s.split("-")
        tail = bytes.fromhex(p[3] + p[4])
        return cls(int(p[0], 16), int(p[1], 16), int(p[2], 16), (ctypes.c_ubyte * 8)(*tail))


class LUID(ctypes.Structure):
    _fields_ = [("LowPart", wintypes.DWORD), ("HighPart", wintypes.LONG)]


class DXGI_ADAPTER_DESC1(ctypes.Structure):
    _fields_ = [("Description", wintypes.WCHAR * 128), ("VendorId", wintypes.UINT),
                ("DeviceId", wintypes.UINT), ("SubSysId", wintypes.UINT),
                ("Revision", wintypes.UINT), ("DedicatedVideoMemory", ctypes.c_size_t),
                ("DedicatedSystemMemory", ctypes.c_size_t), ("SharedSystemMemory", ctypes.c_size_t),
                ("AdapterLuid", LUID), ("Flags", wintypes.UINT)]


class DXGI_QUERY_VIDEO_MEMORY_INFO(ctypes.Structure):
    _fields_ = [("Budget", ctypes.c_uint64), ("CurrentUsage", ctypes.c_uint64),
                ("AvailableForReservation", ctypes.c_uint64), ("CurrentReservation", ctypes.c_uint64)]


IID_IDXGIFactory1 = GUID.parse("770aae78-f26f-4dba-a829-253c83d1b387")
IID_IDXGIAdapter3 = GUID.parse("645967a4-1392-4310-a798-8053ce3e93fd")

DXGI_ADAPTER_FLAG_SOFTWARE = 2
DXGI_MEMORY_SEGMENT_GROUP_LOCAL = 0
DXGI_MEMORY_SEGMENT_GROUP_NON_LOCAL = 1
DXGI_ERROR_NOT_FOUND = -2005270526  # 0x887A0002

VENDORS = {0x10DE: "NVIDIA", 0x1002: "AMD", 0x8086: "Intel", 0x1414: "Microsoft"}


def luid_to_pdh(low: int, high: int) -> str:
    """Format a LUID the way PDH instance names do: luid_0xHHHHHHHH_0xLLLLLLLL."""
    return f"luid_0x{high & 0xFFFFFFFF:08x}_0x{low & 0xFFFFFFFF:08x}"


@dataclass
class Adapter:
    luid: str            # PDH style, e.g. luid_0x00000000_0x00018056
    name: str
    vendor: str
    vendor_id: int
    dedicated_vram_mb: int
    shared_system_mb: int
    software: bool
    budget_local_mb: int | None = None
    usage_local_mb: int | None = None
    budget_nonlocal_mb: int | None = None

    def to_dict(self) -> dict:
        return asdict(self)


def _vcall(obj: ctypes.c_void_p, index: int, restype, *argtypes):
    """Return a bound callable for vtable slot `index` of COM object `obj`."""
    vtbl = ctypes.cast(obj, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    proto = ctypes.WINFUNCTYPE(restype, ctypes.c_void_p, *argtypes)
    fn = proto(vtbl[index])
    return lambda *a: fn(obj, *a)


def _release(obj: ctypes.c_void_p) -> None:
    if obj:
        _vcall(obj, 2, wintypes.ULONG)()


# Vtable slots. IUnknown: 0 QI, 1 AddRef, 2 Release. IDXGIObject adds 3..6.
# IDXGIFactory: 7 EnumAdapters ... IDXGIFactory1: 12 EnumAdapters1.
# IDXGIAdapter: 7 EnumOutputs, 8 GetDesc, 9 CheckInterfaceSupport. IDXGIAdapter1: 10 GetDesc1.
# IDXGIAdapter2: 11 GetDesc2. IDXGIAdapter3: 12 RegisterHardwareContentProtectionTeardownStatusEvent,
# 13 Unregister..., 14 QueryVideoMemoryInfo.
_SLOT_ENUM_ADAPTERS1 = 12
_SLOT_GET_DESC1 = 10
_SLOT_QUERY_VIDEO_MEMORY_INFO = 14


def enumerate_adapters(query_budget: bool = True) -> list[Adapter]:
    if sys.platform != "win32":
        return []
    dxgi = ctypes.WinDLL("dxgi")
    factory = ctypes.c_void_p()
    hr = dxgi.CreateDXGIFactory1(ctypes.byref(IID_IDXGIFactory1), ctypes.byref(factory))
    if hr < 0:
        raise OSError(f"CreateDXGIFactory1 failed: 0x{hr & 0xFFFFFFFF:08x}")
    out: list[Adapter] = []
    try:
        enum = _vcall(factory, _SLOT_ENUM_ADAPTERS1, HRESULT, wintypes.UINT, ctypes.POINTER(ctypes.c_void_p))
        i = 0
        while True:
            adapter = ctypes.c_void_p()
            hr = enum(i, ctypes.byref(adapter))
            if hr == DXGI_ERROR_NOT_FOUND:
                break
            if hr < 0:
                raise OSError(f"EnumAdapters1({i}) failed: 0x{hr & 0xFFFFFFFF:08x}")
            try:
                desc = DXGI_ADAPTER_DESC1()
                _vcall(adapter, _SLOT_GET_DESC1, HRESULT, ctypes.POINTER(DXGI_ADAPTER_DESC1))(ctypes.byref(desc))
                a = Adapter(
                    luid=luid_to_pdh(desc.AdapterLuid.LowPart, desc.AdapterLuid.HighPart),
                    name=desc.Description,
                    vendor=VENDORS.get(desc.VendorId, hex(desc.VendorId)),
                    vendor_id=desc.VendorId,
                    dedicated_vram_mb=desc.DedicatedVideoMemory // 2**20,
                    shared_system_mb=desc.SharedSystemMemory // 2**20,
                    software=bool(desc.Flags & DXGI_ADAPTER_FLAG_SOFTWARE),
                )
                if query_budget:
                    _query_budget(adapter, a)
                out.append(a)
            finally:
                _release(adapter)
            i += 1
    finally:
        _release(factory)
    return out


def _query_budget(adapter: ctypes.c_void_p, a: Adapter) -> None:
    a3 = ctypes.c_void_p()
    qi = _vcall(adapter, 0, HRESULT, ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p))
    if qi(ctypes.byref(IID_IDXGIAdapter3), ctypes.byref(a3)) < 0:
        return
    try:
        q = _vcall(a3, _SLOT_QUERY_VIDEO_MEMORY_INFO, HRESULT, wintypes.UINT, wintypes.UINT,
                   ctypes.POINTER(DXGI_QUERY_VIDEO_MEMORY_INFO))
        info = DXGI_QUERY_VIDEO_MEMORY_INFO()
        if q(0, DXGI_MEMORY_SEGMENT_GROUP_LOCAL, ctypes.byref(info)) >= 0:
            a.budget_local_mb = info.Budget // 2**20
            a.usage_local_mb = info.CurrentUsage // 2**20
        info2 = DXGI_QUERY_VIDEO_MEMORY_INFO()
        if q(0, DXGI_MEMORY_SEGMENT_GROUP_NON_LOCAL, ctypes.byref(info2)) >= 0:
            a.budget_nonlocal_mb = info2.Budget // 2**20
    finally:
        _release(a3)


def pick_primary(adapters: list[Adapter]) -> Adapter | None:
    """The adapter SpillGuard watches by default: the non-software one with most VRAM,
    preferring NVIDIA (CUDA sysmem fallback is the main spill source)."""
    hw = [a for a in adapters if not a.software]
    if not hw:
        return None
    return max(hw, key=lambda a: (a.vendor_id == 0x10DE, a.dedicated_vram_mb))


if __name__ == "__main__":
    for a in enumerate_adapters():
        print(a)

"""Small-output arithmetic-load control. It also changes clocks/power, not pure isolation.

Bounded PTX loop; launch size and rounds are fixed in source, with explicit duty
sleep in the owned pressure worker. No external compiler or downloaded kernels.
"""
import ctypes
import time

PTX = b"""
.version 6.4
.target sm_50
.address_size 64
.visible .entry burn(.param .u64 destination) {
 .reg .u64 %out, %offset, %address;
 .reg .u32 %lane, %block, %index, %round;
 .reg .f32 %value;
 .reg .pred %again;
 ld.param.u64 %out, [destination];
 mov.u32 %lane, %tid.x;
 mov.u32 %block, %ctaid.x;
 mad.lo.u32 %index, %block, 256, %lane;
 cvt.rn.f32.u32 %value, %index;
 mov.u32 %round, 0;
loop:
 fma.rn.f32 %value, %value, 0f3F800001, 0f3DCCCCCD;
 add.u32 %round, %round, 1;
 setp.lt.u32 %again, %round, 10000;
 @%again bra loop;
 mul.wide.u32 %offset, %index, 4;
 add.u64 %address, %out, %offset;
 st.global.f32 [%address], %value;
 ret;
}
"""


class ArithmeticControl:
    def __init__(self, cuda):
        self.cu = cuda
        self.module, self.function = ctypes.c_void_p(), ctypes.c_void_p()
        lib = cuda.lib
        lib.cuModuleLoadDataEx.argtypes = [ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p, ctypes.c_uint,
                                         ctypes.POINTER(ctypes.c_int), ctypes.POINTER(ctypes.c_void_p)]
        lib.cuModuleGetFunction.argtypes = [ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p, ctypes.c_char_p]
        lib.cuLaunchKernel.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_uint, ctypes.c_uint,
                                     ctypes.c_uint, ctypes.c_uint, ctypes.c_uint, ctypes.c_uint,
                                     ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p), ctypes.c_void_p]
        source = ctypes.create_string_buffer(PTX)
        error_log = ctypes.create_string_buffer(4096)
        options = (ctypes.c_int * 2)(5, 6)  # CU_JIT_ERROR_LOG_BUFFER / SIZE_BYTES
        values = (ctypes.c_void_p * 2)(ctypes.cast(error_log, ctypes.c_void_p), ctypes.c_void_p(len(error_log)))
        result = lib.cuModuleLoadDataEx(ctypes.byref(self.module), source, 2, options, values)
        if result:
            raise RuntimeError(f"arithmetic PTX compilation failed ({result}): {error_log.value.decode(errors='replace')}")
        cuda._chk(lib.cuModuleGetFunction(ctypes.byref(self.function), self.module, b"burn"), "get arithmetic kernel")

    def run(self, destination):
        pointer = ctypes.c_uint64(destination)
        params = (ctypes.c_void_p * 1)(ctypes.cast(ctypes.byref(pointer), ctypes.c_void_p))
        start = time.perf_counter()
        self.cu._chk(self.cu.lib.cuLaunchKernel(self.function, 128, 1, 1, 256, 1, 1, 0, None, params, None), "arithmetic launch")
        self.cu._chk(self.cu.lib.cuCtxSynchronize(), "arithmetic synchronize")
        return time.perf_counter() - start

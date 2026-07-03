import zlib

FLAGS_COMPRESSED = 0x01

def compress(payload: bytes, threshold: int = 1024) -> tuple[bytes, bool]:
    """
    Compresses payload with zlib if it exceeds the threshold.
    """
    if len(payload) >= threshold:
        try:
            compressed = zlib.compress(payload, level=6)
            if len(compressed) < len(payload):
                return compressed, True
        except Exception:
            pass
    return payload, False

def decompress(payload: bytes) -> bytes:
    """
    Decompresses payload with zlib.
    """
    return zlib.decompress(payload)

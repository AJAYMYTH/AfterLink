import msgpack

def serialize(data):
    """
    Serializes Python data structure to MessagePack bytes.
    """
    return msgpack.packb(data, use_bin_type=True)

def deserialize(data):
    """
    Deserializes MessagePack bytes back to Python objects.
    """
    return msgpack.unpackb(data, raw=False)

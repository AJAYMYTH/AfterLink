import struct

V1_HEADER_SIZE = 10
V2_HEADER_SIZE = 16
MAX_PAYLOAD_SIZE = 16 * 1024 * 1024
MAX_ROUTING_KEY = 255

# Frame Types
REQUEST = 0x01
RESPONSE = 0x02
STREAM_START = 0x03
STREAM_DATA = 0x04
STREAM_END = 0x05
ERROR = 0x06
PING = 0x07
PONG = 0x08
BROADCAST = 0x09
SUBSCRIBE = 0x0A
UNSUBSCRIBE = 0x0B
PUBLISH = 0x0C
CLOSE = 0x0D
CLOSE_ACK = 0x0E
HELLO = 0x0F
HELLO_ACK = 0x10
SERVER_CLOSING = 0x11
ROUTE_REQUEST = 0x12
PRIORITY_ACK = 0x13

# Flags
FLAGS_COMPRESSED = 0x01
FLAGS_ENCRYPTED = 0x02
FLAGS_PRIORITY_SET = 0x04
FLAGS_HAS_ROUTING_KEY = 0x08

def encode_v1(frame_type: int, flags: int, message_id: int, payload_bytes: bytes) -> bytes:
    if len(payload_bytes) > MAX_PAYLOAD_SIZE:
        raise ValueError(f"Payload size {len(payload_bytes)} exceeds maximum {MAX_PAYLOAD_SIZE}")
    header = struct.pack('!BBII', frame_type, flags & 0xFF, message_id, len(payload_bytes))
    return header + payload_bytes

def decode_v1(buffer: bytes) -> dict | None:
    if len(buffer) < V1_HEADER_SIZE:
        return None
    frame_type, flags, message_id, payload_len = struct.unpack('!BBII', buffer[:V1_HEADER_SIZE])
    if payload_len > MAX_PAYLOAD_SIZE:
        raise ValueError(f"Payload size {payload_len} exceeds maximum {MAX_PAYLOAD_SIZE}")
    total_size = V1_HEADER_SIZE + payload_len
    if len(buffer) < total_size:
        return None
    return {
        "type": frame_type,
        "flags": flags,
        "messageId": message_id,
        "payload": buffer[V1_HEADER_SIZE:total_size],
        "totalSize": total_size
    }

def encode_v2(frame_type: int, flags: int, message_id: int, payload_bytes: bytes, priority: int = 3, routing_key: str = '') -> bytes:
    if len(payload_bytes) > MAX_PAYLOAD_SIZE:
        raise ValueError(f"Payload size {len(payload_bytes)} exceeds maximum {MAX_PAYLOAD_SIZE}")
    
    routing_key_bytes = routing_key.encode('utf-8')
    if len(routing_key_bytes) > MAX_ROUTING_KEY:
        raise ValueError(f"Routing key length {len(routing_key_bytes)} exceeds maximum {MAX_ROUTING_KEY}")

    final_flags = flags & 0xFF
    if priority != 3:
        final_flags |= FLAGS_PRIORITY_SET
    if len(routing_key_bytes) > 0:
        final_flags |= FLAGS_HAS_ROUTING_KEY

    header = struct.pack(
        '!BBBBIHII',
        frame_type,
        final_flags,
        0x02,  # version
        priority,
        message_id,
        len(routing_key_bytes),
        len(payload_bytes),
        0  # reserved
    )
    return header + routing_key_bytes + payload_bytes

def decode_v2(buffer: bytes) -> dict | None:
    if len(buffer) < V2_HEADER_SIZE:
        return None
    
    frame_type, flags, version, priority, message_id, routing_key_len, payload_len, _ = struct.unpack(
        '!BBBBIHII',
        buffer[:V2_HEADER_SIZE]
    )

    if payload_len > MAX_PAYLOAD_SIZE:
        raise ValueError(f"Payload size {payload_len} exceeds maximum {MAX_PAYLOAD_SIZE}")
    if routing_key_len > MAX_ROUTING_KEY:
        raise ValueError(f"Routing key length {routing_key_len} exceeds maximum {MAX_ROUTING_KEY}")

    total_size = V2_HEADER_SIZE + routing_key_len + payload_len
    if len(buffer) < total_size:
        return None

    routing_key = buffer[V2_HEADER_SIZE:V2_HEADER_SIZE + routing_key_len].decode('utf-8')
    payload = buffer[V2_HEADER_SIZE + routing_key_len:total_size]

    return {
        "type": frame_type,
        "flags": flags,
        "version": version,
        "priority": priority,
        "messageId": message_id,
        "routingKeyLen": routing_key_len,
        "routingKey": routing_key,
        "payload": payload,
        "totalSize": total_size
    }

def encode(version: int = 1, **kwargs) -> bytes:
    if version == 2:
        return encode_v2(**kwargs)
    return encode_v1(**kwargs)

def decode(buffer: bytes, version: int = 1) -> dict | None:
    if version == 2:
        return decode_v2(buffer)
    return decode_v1(buffer)

def decode_auto(buffer: bytes) -> dict | None:
    if len(buffer) < 3:
        return None
    # Offset 2 is version byte in V2
    if buffer[2] == 0x02:
        return decode_v2(buffer)
    return decode_v1(buffer)

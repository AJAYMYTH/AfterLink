import os
import json
from afterlink.protocol import frame

def test_v1_encode_decode():
    payload = b"hello"
    encoded = frame.encode_v1(1, 0, 42, payload)
    decoded = frame.decode_v1(encoded)
    
    assert decoded is not None
    assert decoded["type"] == 1
    assert decoded["flags"] == 0
    assert decoded["messageId"] == 42
    assert decoded["payload"] == payload

def test_v2_encode_decode():
    payload = b"hello"
    encoded = frame.encode_v2(1, 0, 42, payload, priority=5, routing_key="route")
    decoded = frame.decode_v2(encoded)
    
    assert decoded is not None
    assert decoded["type"] == 1
    assert decoded["flags"] == 12 
    assert decoded["version"] == 2
    assert decoded["priority"] == 5
    assert decoded["messageId"] == 42
    assert decoded["routingKey"] == "route"
    assert decoded["payload"] == payload

def test_vectors():
    vectors_path = os.path.join(os.path.dirname(__file__), "../../test/protocol-vectors.json")
    with open(vectors_path, "r") as f:
        data = json.load(f)
        
    for vec in data["vectors"]:
        payload = bytes.fromhex(vec["payloadHex"])
        expected = bytes.fromhex(vec["expectedHex"])
        
        if vec["version"] == 1:
            encoded = frame.encode(
                version=1,
                frame_type=vec["type"],
                flags=vec["flags"],
                message_id=vec["messageId"],
                payload_bytes=payload
            )
        else:
            encoded = frame.encode(
                version=2,
                frame_type=vec["type"],
                flags=vec["flags"],
                message_id=vec["messageId"],
                payload_bytes=payload,
                priority=vec.get("priority", 3),
                routing_key=vec.get("routingKey", "")
            )
            
        assert encoded == expected
        
        decoded = frame.decode_auto(expected)
        assert decoded is not None
        assert decoded["type"] == vec["type"]
        assert decoded["flags"] == vec["flags"]
        assert decoded["messageId"] == vec["messageId"]
        
        if vec["version"] == 2:
            assert decoded["version"] == 2
            assert decoded["priority"] == vec.get("priority", 3)
            assert decoded["routingKey"] == vec.get("routingKey", "")

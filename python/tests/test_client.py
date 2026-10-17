import pytest
import asyncio
from afterlink import Server, Client

@pytest.mark.asyncio
async def test_client_server_integration():
    server = Server(port=5005)
    
    @server.on("users/get")
    async def get_user(req):
        return {"id": 42, "username": "python-test"}
        
    server_task = asyncio.create_task(server.listen())
    await asyncio.sleep(0.1) 
    
    client = Client("tcp://localhost:5005")
    try:
        await client.connect()
        assert client.version == 2, f"expected AL/2 negotiation, got v{client.version}"
        res = await client.request("users/get")
        assert res["id"] == 42
        assert res["username"] == "python-test"
    finally:
        await client.disconnect()
        await server.close()
        server_task.cancel()
        try:
            await server_task
        except asyncio.CancelledError:
            pass


@pytest.mark.asyncio
async def test_pubsub_roundtrip():
    server = Server(port=5006)
    server_task = asyncio.create_task(server.listen())
    await asyncio.sleep(0.1)

    subscriber = Client("tcp://localhost:5006")
    publisher = Client("tcp://localhost:5006")
    try:
        await subscriber.connect()
        await publisher.connect()

        received = []
        unsub = await subscriber.subscribe("test.chat", lambda msg: received.append(msg))

        await publisher.publish("test.chat", {"text": "hello"})
        for _ in range(100):
            if received:
                break
            await asyncio.sleep(0.05)
        assert received == [{"text": "hello"}], f"unexpected messages: {received}"

        # The publisher must not receive its own message.
        assert received == [{"text": "hello"}]

        await unsub()
    finally:
        await subscriber.disconnect()
        await publisher.disconnect()
        await server.close()
        server_task.cancel()
        try:
            await server_task
        except asyncio.CancelledError:
            pass

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

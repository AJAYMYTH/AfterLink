# AfterLink Python SDK

Python Client and Server SDK for the binary AfterLink protocol.

## Installation

```bash
pip install afterlink
```

## Usage

### Server

```python
import asyncio
from afterlink import Server

server = Server(port=4000)

@server.on("users/get")
async def get_user(req):
    return {"id": 1, "username": "ajay"}

asyncio.run(server.listen())
```

### Client

```python
import asyncio
from afterlink import Client

async def main():
    client = Client("tcp://localhost:4000")
    await client.connect()
    res = await client.request("users/get")
    print(res)
    await client.disconnect()

asyncio.run(main())
```

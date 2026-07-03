import asyncio
from typing import Any

from .client import Client

class SyncClient:
    """
    Synchronous wrapper around the async AfterLink Client.
    """
    def __init__(self, url: str, options: dict = None):
        self._loop = asyncio.new_event_loop()
        self._client = Client(url, options)

    def connect(self):
        self._loop.run_until_complete(self._client.connect())

    def request(self, route: str, body: Any = None) -> Any:
        return self._loop.run_until_complete(self._client.request(route, body))

    def disconnect(self):
        self._loop.run_until_complete(self._client.disconnect())
        self._loop.close()

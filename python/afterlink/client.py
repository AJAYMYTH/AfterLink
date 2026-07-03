import asyncio
import logging
import random
from typing import Callable, Any, AsyncGenerator

from .errors import AfterLinkError
from .protocol import frame, codec, compression

logger = logging.getLogger("afterlink.client")

class Client:
    def __init__(self, url: str, options: dict = None):
        self.url = url
        self.options = options or {}
        
        self.host = self.options.get("host", "localhost")
        self.port = self.options.get("port", 4000)
        self.auto_reconnect = self.options.get("auto_reconnect", True)
        self.reconnect_attempts = self.options.get("reconnect_attempts", 5)
        self.reconnect_delay = self.options.get("reconnect_delay", 1.0)
        self.timeout = self.options.get("timeout", 10.0)
        self.auth_token = self.options.get("auth")
        self.protocol_version = self.options.get("protocol", 2) 

        self.reader = None
        self.writer = None
        self.connected = False
        self.session_id = None
        self.version = 1 

        self._message_id = 0
        self._pending_requests = {}
        self._subscriptions = {}
        self._read_task = None
        self._is_closing = False
        
        if "://" in url:
            parts = url.split("://")[1].split(":")
            self.host = parts[0]
            if len(parts) > 1:
                self.port = int(parts[1])

    async def connect(self):
        self._is_closing = False
        logger.info(f"Connecting to AfterLink server at {self.host}:{self.port}")
        
        self.reader, self.writer = await asyncio.open_connection(self.host, self.port)
        self._read_task = asyncio.create_task(self._read_loop())
        
        await self._handshake()
        self.connected = True
        logger.info(f"Connected successfully. Session ID: {self.session_id}, Protocol: v{self.version}")

    async def _handshake(self):
        hello_payload = {
            "version": f"AL/{self.protocol_version}",
            "capabilities": ["json", "msgpack"],
            "auth": self.auth_token
        }
        
        msg_id = self._next_message_id()
        payload_bytes = codec.serialize(hello_payload)
        
        frame_bytes = frame.encode_v1(frame.HELLO, 0, msg_id, payload_bytes)
        self.writer.write(frame_bytes)
        await self.writer.drain()
        
        fut = asyncio.get_running_loop().create_future()
        self._pending_requests[msg_id] = fut
        
        try:
            ack_frame = await asyncio.wait_for(fut, timeout=self.timeout)
            ack_data = codec.deserialize(ack_frame["payload"])
            
            if ack_frame["type"] == frame.ERROR:
                raise AfterLinkError(ack_data.get("code", 1), ack_data.get("message", "Handshake failed"))
                
            self.session_id = ack_data.get("session_id")
            accepted_proto = ack_data.get("accepted_protocol", "v1")
            self.version = 2 if accepted_proto == "v2" else 1
        except asyncio.TimeoutError:
            raise AfterLinkError(AfterLinkError.CONNECTION_TIMEOUT, "Handshake timed out")
        finally:
            self._pending_requests.pop(msg_id, None)

    def _next_message_id(self) -> int:
        self._message_id = (self._message_id + 1) & 0xFFFFFFFF
        return self._message_id

    async def request(self, route: str, body: Any = None, *, routing_key: str = None, priority: int = None) -> Any:
        if not self.connected:
            raise AfterLinkError(AfterLinkError.CONNECTION_CLOSED, "Client not connected")
            
        req_payload = {
            "route": route,
            "body": body or {}
        }
        
        msg_id = self._next_message_id()
        payload_bytes = codec.serialize(req_payload)
        
        payload_bytes, compressed = compression.compress(payload_bytes)
        flags = compression.FLAGS_COMPRESSED if compressed else 0
        
        if self.version == 2:
            frame_bytes = frame.encode_v2(
                frame.REQUEST, flags, msg_id, payload_bytes,
                priority=priority if priority is not None else 3,
                routing_key=routing_key or ''
            )
        else:
            frame_bytes = frame.encode_v1(frame.REQUEST, flags, msg_id, payload_bytes)
            
        self.writer.write(frame_bytes)
        await self.writer.drain()
        
        fut = asyncio.get_running_loop().create_future()
        self._pending_requests[msg_id] = fut
        
        try:
            res_frame = await asyncio.wait_for(fut, timeout=self.timeout)
            
            res_flags = res_frame["flags"]
            res_payload = res_frame["payload"]
            
            if res_flags & compression.FLAGS_COMPRESSED:
                res_payload = compression.decompress(res_payload)
                
            res_data = codec.deserialize(res_payload)
            
            if res_frame["type"] == frame.ERROR:
                raise AfterLinkError(
                    res_data.get("code", 10),
                    res_data.get("message", "Request failed"),
                    details=res_data.get("details"),
                    retry_after=res_data.get("retry_after"),
                    meta=res_data.get("meta")
                )
                
            return res_data.get("body")
        finally:
            self._pending_requests.pop(msg_id, None)

    async def subscribe(self, topic: str, callback: Callable[[Any], None]) -> Callable[[], None]:
        if not self.connected:
            raise AfterLinkError(AfterLinkError.CONNECTION_CLOSED, "Client not connected")
            
        await self.request("pubsub/subscribe", {"topic": topic})
        
        if topic not in self._subscriptions:
            self._subscriptions[topic] = set()
        self._subscriptions[topic].add(callback)
        
        async def unsubscribe():
            if topic in self._subscriptions:
                self._subscriptions[topic].discard(callback)
                if len(self._subscriptions[topic]) == 0:
                    del self._subscriptions[topic]
                    try:
                        await self.request("pubsub/unsubscribe", {"topic": topic})
                    except Exception:
                        pass
        return unsubscribe

    async def publish(self, topic: str, data: Any):
        if not self.connected:
            raise AfterLinkError(AfterLinkError.CONNECTION_CLOSED, "Client not connected")
        await self.request("pubsub/publish", {"topic": topic, "data": data})

    async def stream(self, route: str, body: Any = None) -> AsyncGenerator[Any, None]:
        if not self.connected:
            raise AfterLinkError(AfterLinkError.CONNECTION_CLOSED, "Client not connected")
        
        req_payload = {
            "route": route,
            "body": body or {}
        }
        msg_id = self._next_message_id()
        payload_bytes = codec.serialize(req_payload)
        
        # STREAM_START
        start_frame = frame.encode(
            version=self.version,
            frame_type=frame.STREAM_START,
            flags=0,
            message_id=msg_id,
            payload_bytes=payload_bytes
        )
        self.writer.write(start_frame)
        await self.writer.drain()
        
        queue = asyncio.Queue()
        self._pending_requests[msg_id] = queue
        
        try:
            while True:
                item = await asyncio.wait_for(queue.get(), timeout=self.timeout)
                if isinstance(item, Exception):
                    raise item
                
                ftype = item["type"]
                flags = item["flags"]
                payload = item["payload"]
                
                if flags & compression.FLAGS_COMPRESSED:
                    payload = compression.decompress(payload)
                
                data = codec.deserialize(payload)
                
                if ftype == frame.STREAM_DATA:
                    yield data.get("body")
                elif ftype == frame.STREAM_END:
                    break
                elif ftype == frame.ERROR:
                    raise AfterLinkError(data.get("code", 10), data.get("message", "Stream error"))
        finally:
            self._pending_requests.pop(msg_id, None)

    async def _read_loop(self):
        buffer = bytearray()
        try:
            while not self._is_closing:
                chunk = await self.reader.read(4096)
                if not chunk:
                    break
                buffer.extend(chunk)
                
                while True:
                    decoded = frame.decode_auto(bytes(buffer))
                    if decoded is None:
                        break
                    
                    del buffer[:decoded["totalSize"]]
                    self._process_incoming_frame(decoded)
        except asyncio.CancelledError:
            pass
        except Exception as err:
            logger.error(f"Error in client read loop: {err}")
        finally:
            self.connected = False
            self._cleanup_pending()
            if not self._is_closing and self.auto_reconnect:
                asyncio.create_task(self._reconnect_loop())

    def _process_incoming_frame(self, f: dict):
        ftype = f["type"]
        msg_id = f["messageId"]
        
        if ftype in (frame.RESPONSE, frame.ERROR, frame.STREAM_DATA, frame.STREAM_END):
            dest = self._pending_requests.get(msg_id)
            if dest:
                if isinstance(dest, asyncio.Future):
                    if not dest.done():
                        dest.set_result(f)
                elif isinstance(dest, asyncio.Queue):
                    dest.put_nowait(f)
        elif ftype == frame.PING:
            pong_bytes = frame.encode(version=self.version, frame_type=frame.PONG, flags=0, message_id=msg_id, payload_bytes=b'')
            self.writer.write(pong_bytes)
            asyncio.create_task(self.writer.drain())
        elif ftype in (frame.PUBLISH, frame.BROADCAST):
            try:
                payload = f["payload"]
                if f["flags"] & compression.FLAGS_COMPRESSED:
                    payload = compression.decompress(payload)
                data = codec.deserialize(payload)
                topic = data.get("topic")
                msg_data = data.get("data")
                
                if topic in self._subscriptions:
                    for cb in self._subscriptions[topic]:
                        try:
                            cb(msg_data)
                        except Exception as e:
                            logger.error(f"Error in subscriber callback: {e}")
            except Exception as err:
                logger.error(f"Failed to process pubsub broadcast: {err}")

    def _cleanup_pending(self):
        for dest in list(self._pending_requests.values()):
            if isinstance(dest, asyncio.Future) and not dest.done():
                dest.set_exception(AfterLinkError(AfterLinkError.CONNECTION_CLOSED, "Connection closed"))
            elif isinstance(dest, asyncio.Queue):
                dest.put_nowait(AfterLinkError(AfterLinkError.CONNECTION_CLOSED, "Connection closed"))
        self._pending_requests.clear()

    async def _reconnect_loop(self):
        attempt = 0
        while not self._is_closing and not self.connected:
            attempt += 1
            if attempt > self.reconnect_attempts:
                logger.error("Max reconnect attempts reached. Giving up.")
                break
            
            delay = self.reconnect_delay * (2 ** attempt) + random.uniform(0, 0.5)
            logger.info(f"Reconnecting in {delay:.2f} seconds (attempt {attempt})...")
            await asyncio.sleep(delay)
            
            try:
                await self.connect()
                for topic in list(self._subscriptions.keys()):
                    await self.request("pubsub/subscribe", {"topic": topic})
                logger.info("Reconnection successful.")
                break
            except Exception as err:
                logger.error(f"Reconnection attempt failed: {err}")

    async def disconnect(self):
        self._is_closing = True
        self.connected = False
        
        if self._read_task:
            self._read_task.cancel()
            
        if self.writer:
            self.writer.close()
            try:
                await self.writer.wait_closed()
            except Exception:
                pass
                
        self._cleanup_pending()
        logger.info("Client disconnected.")

    async def reconnect(self, **kwargs):
        await self.disconnect()
        await self.connect()

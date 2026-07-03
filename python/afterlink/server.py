import asyncio
import logging
from typing import Callable, Any

from .errors import AfterLinkError
from .protocol import frame, codec, compression

logger = logging.getLogger("afterlink.server")

class Server:
    def __init__(self, port: int = 4000, options: dict = None):
        self.port = port
        self.options = options or {}
        self.host = self.options.get("host", "0.0.0.0")
        
        self.routes = {}
        self.middlewares = []
        self.connections = set()
        
        self._server = None
        self._is_closing = False

    def on(self, route: str, handler: Callable = None, *, schema: Any = None):
        """
        Decorator or direct method to register a route handler.
        """
        def decorator(f):
            self.routes[route] = {"handler": f, "schema": schema}
            return f
        if handler is None:
            return decorator
        self.routes[route] = {"handler": handler, "schema": schema}
        return handler

    def use(self, middleware: Callable):
        """
        Register a middleware function.
        """
        self.middlewares.append(middleware)
        return middleware

    async def listen(self):
        logger.info(f"Starting AfterLink server on {self.host}:{self.port}...")
        self._server = await asyncio.start_server(
            self._handle_incoming_connection,
            self.host,
            self.port
        )
        async with self._server:
            await self._server.serve_forever()

    async def _handle_incoming_connection(self, reader, writer):
        addr = writer.get_extra_info('peername')
        logger.info(f"New connection from {addr}")
        
        conn = ServerConnection(self, reader, writer)
        self.connections.add(conn)
        
        try:
            await conn.handle()
        except Exception as err:
            logger.error(f"Error handling connection from {addr}: {err}")
        finally:
            self.connections.discard(conn)
            logger.info(f"Connection from {addr} closed")

    async def close(self):
        self._is_closing = True
        if self._server:
            self._server.close()
            await self._server.wait_closed()
            
        for conn in list(self.connections):
            await conn.close()


class ServerConnection:
    def __init__(self, server: Server, reader, writer):
        self.server = server
        self.reader = reader
        self.writer = writer
        self.session_id = f"sess_{id(self)}"
        self.version = 1
        self.authenticated = False

    async def handle(self):
        buffer = bytearray()
        try:
            while not self.server._is_closing:
                chunk = await self.reader.read(4096)
                if not chunk:
                    break
                buffer.extend(chunk)
                
                while True:
                    decoded = frame.decode_auto(bytes(buffer))
                    if decoded is None:
                        break
                    
                    del buffer[:decoded["totalSize"]]
                    await self._process_frame(decoded)
        finally:
            self.writer.close()
            try:
                await self.writer.wait_closed()
            except Exception:
                pass

    async def _process_frame(self, f: dict):
        ftype = f["type"]
        msg_id = f["messageId"]
        
        if ftype == frame.HELLO:
            hello_data = codec.deserialize(f["payload"])
            requested_ver = hello_data.get("version", "AL/1")
            
            self.version = 2 if "AL/2" in requested_ver else 1
            
            ack_payload = {
                "session_id": self.session_id,
                "server_version": "2.0.0",
                "accepted_protocol": "v2" if self.version == 2 else "v1"
            }
            payload_bytes = codec.serialize(ack_payload)
            ack_bytes = frame.encode(version=1, frame_type=frame.HELLO_ACK, flags=0, message_id=msg_id, payload_bytes=payload_bytes)
            self.writer.write(ack_bytes)
            await self.writer.drain()
            self.authenticated = True
            
        elif ftype == frame.REQUEST:
            if not self.authenticated:
                self.send_error(AfterLinkError.AUTH_REQUIRED, "Authentication required", msg_id)
                return
                
            try:
                payload = f["payload"]
                if f["flags"] & compression.FLAGS_COMPRESSED:
                    payload = compression.decompress(payload)
                data = codec.deserialize(payload)
            except Exception:
                self.send_error(AfterLinkError.MALFORMED_PAYLOAD, "Malformed request payload", msg_id)
                return
                
            route = data.get("route")
            body = data.get("body", {})
            
            route_config = self.server.routes.get(route)
            if not route_config:
                self.send_error(AfterLinkError.ROUTE_NOT_FOUND, f"Route '{route}' not found", msg_id)
                return
                
            if route_config["schema"]:
                from .schema import validate_with_pydantic
                try:
                    validate_with_pydantic(route_config["schema"], body)
                except AfterLinkError as err:
                    self.send_error(err.code, err.message, msg_id, details=err.details)
                    return
            
            req = {"body": body, "route": route, "connection": self}
            
            async def run_handler():
                return await route_config["handler"](req)
                
            try:
                result = await self._run_middlewares(req, run_handler)
                
                res_payload = {"status": "ok", "body": result}
                payload_bytes = codec.serialize(res_payload)
                
                payload_bytes, compressed = compression.compress(payload_bytes)
                flags = compression.FLAGS_COMPRESSED if compressed else 0
                
                res_bytes = frame.encode(version=self.version, frame_type=frame.RESPONSE, flags=flags, message_id=msg_id, payload_bytes=payload_bytes)
                self.writer.write(res_bytes)
                await self.writer.drain()
            except AfterLinkError as err:
                self.send_error(err.code, err.message, msg_id, details=err.details)
            except Exception as err:
                self.send_error(AfterLinkError.INTERNAL_SERVER_ERROR, str(err), msg_id)

    async def _run_middlewares(self, req: dict, final_handler: Callable):
        index = 0
        async def run():
            nonlocal index
            if index >= len(self.server.middlewares):
                return await final_handler()
            m = self.server.middlewares[index]
            index += 1
            return await m(req, run)
        return await run()

    def send_error(self, code: int, message: str, message_id: int, details=None):
        err_payload = {"code": code, "message": message}
        if details is not None:
            err_payload["details"] = details
        payload_bytes = codec.serialize(err_payload)
        err_bytes = frame.encode(version=self.version, frame_type=frame.ERROR, flags=0, message_id=message_id, payload_bytes=payload_bytes)
        self.writer.write(err_bytes)
        asyncio.create_task(self.writer.drain())

    async def close(self):
        self.writer.close()
        try:
            await self.writer.wait_closed()
        except Exception:
            pass

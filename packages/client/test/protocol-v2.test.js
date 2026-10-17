import { describe, it, expect } from 'vitest';
import net from 'net';
import { Frame, FrameTypes, Serializer } from '@ajaymyth/core';
import FrameV2 from '../../core/src/protocol/frame-v2.js';
import { Client } from '../src/index.js';

/**
 * Raw TCP test servers that script exact wire bytes, so we can assert precisely
 * which frame version the client negotiates and emits.
 */

function startRawServer(onConnection) {
  const server = net.createServer(onConnection);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

/** Incrementally decode frames from a socket; resolves { frame, raw } per frame. */
function frameStream(socket) {
  let buffer = Buffer.alloc(0);
  const waiting = [];
  socket.on('data', (d) => {
    buffer = Buffer.concat([buffer, d]);
    pump();
  });
  function pump() {
    while (waiting.length > 0) {
      const frame = Frame.decodeAuto(buffer); // sniffs byte 2 (0x02 => v2)
      if (!frame) return;
      const raw = buffer.slice(0, frame.totalSize);
      buffer = buffer.slice(frame.totalSize);
      waiting.shift()({ frame, raw });
    }
  }
  return () => new Promise((resolve) => { waiting.push(resolve); pump(); });
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

describe('Client — protocol v2 negotiation', () => {
  it('requests AL/2 and sends v2 (16-byte header) requests after a v2 ACK', async () => {
    let helloRaw, helloPayload, reqRaw, reqFrame, reqBody;

    const server = await startRawServer((socket) => {
      const next = frameStream(socket);
      (async () => {
        const hello = await next();
        helloRaw = hello.raw;
        helloPayload = Serializer.decode(hello.frame.payload);

        // v2-capable server (Node.js style): v2-framed ACK with accepted_protocol
        const ack = Serializer.encode({
          session_id: 'raw-v2',
          server_version: 'AL/2',
          accepted_protocol: 'v2',
          compression: 'none',
        });
        socket.write(FrameV2.encode(FrameTypes.HELLO_ACK, 0, hello.frame.messageId, ack));

        const req = await next();
        reqRaw = req.raw;
        reqFrame = req.frame;
        reqBody = Serializer.decode(req.frame.payload);
        socket.write(FrameV2.encode(
          FrameTypes.RESPONSE,
          0,
          req.frame.messageId,
          Serializer.encode({ status: 'ok', body: { negotiated: true } })
        ));

        const close = await next();
        socket.write(FrameV2.encode(FrameTypes.CLOSE_ACK, 0, close.frame.messageId, Buffer.alloc(0)));
        socket.end();
      })().catch(() => {});
    });

    const client = new Client(`tcp://127.0.0.1:${server.address().port}`, { autoReconnect: false });
    await client.connect();

    expect(client.getProtocolVersion()).toBe(2);
    // HELLO itself is v1-framed (10-byte header) for backward compatibility...
    expect(helloRaw[2]).toBe(0x00);
    // ...but requests v2 in the payload.
    expect(helloPayload.version).toBe('AL/2');

    const res = await client.request('echo', { n: 1 });
    expect(res).toEqual({ negotiated: true });

    // The REQUEST must be v2-framed: version byte at offset 2, 16-byte header.
    expect(reqRaw[2]).toBe(0x02);
    expect(reqFrame.version).toBe(2);
    expect(reqRaw.length).toBe(16 + reqRaw.readUInt32BE(10));
    expect(reqBody.route).toBe('echo');

    await client.disconnect();
    server.close();
  });

  it('falls back to v1 when the server ACKs without v2 support', async () => {
    let helloPayload, reqRaw, reqFrame;

    const server = await startRawServer((socket) => {
      const next = frameStream(socket);
      (async () => {
        const hello = await next();
        helloPayload = Serializer.decode(hello.frame.payload);

        // Legacy server: v1-framed ACK, no accepted_protocol field
        socket.write(Frame.encode(
          FrameTypes.HELLO_ACK,
          0,
          hello.frame.messageId,
          Serializer.encode({ session_id: 'raw-v1', compression: 'none' })
        ));

        const req = await next();
        reqRaw = req.raw;
        reqFrame = req.frame;
        socket.write(Frame.encode(
          FrameTypes.RESPONSE,
          0,
          req.frame.messageId,
          Serializer.encode({ status: 'ok', body: { v1: true } })
        ));

        const close = await next();
        socket.write(Frame.encode(FrameTypes.CLOSE_ACK, 0, close.frame.messageId, Buffer.alloc(0)));
        socket.end();
      })().catch(() => {});
    });

    const client = new Client(`tcp://127.0.0.1:${server.address().port}`, { autoReconnect: false });
    await client.connect();

    // Client asked for v2, server ignored it => session runs on v1.
    expect(helloPayload.version).toBe('AL/2');
    expect(client.getProtocolVersion()).toBe(1);

    const res = await client.request('echo', {});
    expect(res).toEqual({ v1: true });

    // The REQUEST must be v1-framed (10-byte header, no version field).
    expect(reqFrame.version).toBeUndefined();
    expect(reqRaw.length).toBe(10 + reqRaw.readUInt32BE(6));

    await client.disconnect();
    server.close();
  });

  it('upgrades to v2 when a v1-framed ACK declares accepted_protocol: v2 (Python server style)', async () => {
    let reqRaw, reqFrame;

    const server = await startRawServer((socket) => {
      const next = frameStream(socket);
      (async () => {
        const hello = await next();

        // Python server style: ACK arrives v1-framed but declares v2 support
        socket.write(Frame.encode(
          FrameTypes.HELLO_ACK,
          0,
          hello.frame.messageId,
          Serializer.encode({ session_id: 'py-style', accepted_protocol: 'v2', compression: 'none' })
        ));

        const req = await next();
        reqRaw = req.raw;
        reqFrame = req.frame;
        socket.write(FrameV2.encode(
          FrameTypes.RESPONSE,
          0,
          req.frame.messageId,
          Serializer.encode({ status: 'ok', body: { upgraded: true } })
        ));

        const close = await next();
        socket.write(FrameV2.encode(FrameTypes.CLOSE_ACK, 0, close.frame.messageId, Buffer.alloc(0)));
        socket.end();
      })().catch(() => {});
    });

    const client = new Client(`tcp://127.0.0.1:${server.address().port}`, { autoReconnect: false });
    await client.connect();

    expect(client.getProtocolVersion()).toBe(2);

    const res = await client.request('echo', {});
    expect(res).toEqual({ upgraded: true });

    expect(reqRaw[2]).toBe(0x02);
    expect(reqFrame.version).toBe(2);

    await client.disconnect();
    server.close();
  });

  it('protocolVersion: 1 pins the session to v1 even if the server offers v2', async () => {
    let helloPayload, reqRaw, reqFrame;

    const server = await startRawServer((socket) => {
      const next = frameStream(socket);
      (async () => {
        const hello = await next();
        helloPayload = Serializer.decode(hello.frame.payload);

        // Server offers v2 anyway — a pinned v1 client must ignore it.
        socket.write(FrameV2.encode(
          FrameTypes.HELLO_ACK,
          0,
          hello.frame.messageId,
          Serializer.encode({ session_id: 'pinned-v1', accepted_protocol: 'v2', compression: 'none' })
        ));

        const req = await next();
        reqRaw = req.raw;
        reqFrame = req.frame;
        socket.write(Frame.encode(
          FrameTypes.RESPONSE,
          0,
          req.frame.messageId,
          Serializer.encode({ status: 'ok', body: { pinned: true } })
        ));

        const close = await next();
        socket.write(Frame.encode(FrameTypes.CLOSE_ACK, 0, close.frame.messageId, Buffer.alloc(0)));
        socket.end();
      })().catch(() => {});
    });

    const client = new Client(`tcp://127.0.0.1:${server.address().port}`, {
      autoReconnect: false,
      protocolVersion: 1,
    });
    await client.connect();

    expect(helloPayload.version).toBe('AL/1.1');
    expect(client.getProtocolVersion()).toBe(1);

    const res = await client.request('echo', {});
    expect(res).toEqual({ pinned: true });

    expect(reqFrame.version).toBeUndefined();
    expect(reqRaw.length).toBe(10 + reqRaw.readUInt32BE(6));

    await client.disconnect();
    server.close();
  });

  it('reconnects negotiate again and can still fall back to v1', async () => {
    let connections = 0;

    const server = await startRawServer((socket) => {
      connections++;
      const next = frameStream(socket);
      (async () => {
        const hello = await next();
        if (connections === 1) {
          // First connection: old server => v1
          socket.write(Frame.encode(
            FrameTypes.HELLO_ACK,
            0,
            hello.frame.messageId,
            Serializer.encode({ session_id: 'conn-1', compression: 'none' })
          ));
          const close = await next();
          socket.write(Frame.encode(FrameTypes.CLOSE_ACK, 0, close.frame.messageId, Buffer.alloc(0)));
          socket.end();
        } else {
          // Second connection: upgraded server => v2
          socket.write(FrameV2.encode(
            FrameTypes.HELLO_ACK,
            0,
            hello.frame.messageId,
            Serializer.encode({ session_id: 'conn-2', accepted_protocol: 'v2', compression: 'none' })
          ));
          const close = await next();
          socket.write(FrameV2.encode(FrameTypes.CLOSE_ACK, 0, close.frame.messageId, Buffer.alloc(0)));
          socket.end();
        }
      })().catch(() => {});
    });

    const url = `tcp://127.0.0.1:${server.address().port}`;
    const client = new Client(url, { autoReconnect: false });

    await client.connect();
    expect(client.getProtocolVersion()).toBe(1);
    await client.disconnect();

    await delay(20);
    await client.connect();
    expect(client.getProtocolVersion()).toBe(2);
    await client.disconnect();

    expect(connections).toBe(2);
    server.close();
  });
});

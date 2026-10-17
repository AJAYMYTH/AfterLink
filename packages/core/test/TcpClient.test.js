import { describe, it, expect } from 'vitest';
import net from 'net';
import TcpClient from '../src/TcpClient.js';
import Frame from '../src/Frame.js';
import FrameV2 from '../src/protocol/frame-v2.js';
import { HELLO_ACK, RESPONSE, REQUEST } from '../src/FrameTypes.js';
import Serializer from '../src/Serializer.js';

function startRawServer(onConnection) {
  const server = net.createServer(onConnection);
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function frameStream(socket) {
  let buffer = Buffer.alloc(0);
  const waiting = [];
  socket.on('data', (d) => {
    buffer = Buffer.concat([buffer, d]);
    pump();
  });
  function pump() {
    while (waiting.length > 0) {
      const frame = Frame.decodeAuto(buffer);
      if (!frame) return;
      const raw = buffer.slice(0, frame.totalSize);
      buffer = buffer.slice(frame.totalSize);
      waiting.shift()({ frame, raw });
    }
  }
  return () => new Promise((resolve) => { waiting.push(resolve); pump(); });
}

describe('TcpClient — protocol negotiation', () => {
  it('negotiates v2 by default and sends v2-framed requests', async () => {
    let helloPayload, reqRaw, reqFrame, reqBody;

    const server = await startRawServer((socket) => {
      const next = frameStream(socket);
      (async () => {
        const hello = await next();
        helloPayload = Serializer.decode(hello.frame.payload);

        socket.write(FrameV2.encode(
          HELLO_ACK,
          0,
          hello.frame.messageId,
          Serializer.encode({ session_id: 'core-v2', accepted_protocol: 'v2', compression: 'none' })
        ));

        const req = await next();
        reqRaw = req.raw;
        reqFrame = req.frame;
        reqBody = Serializer.decode(req.frame.payload);
        socket.write(FrameV2.encode(
          RESPONSE,
          0,
          req.frame.messageId,
          Serializer.encode({ status: 'ok', body: { core: true } })
        ));

        socket.end();
      })().catch(() => {});
    });

    const client = new TcpClient({ host: '127.0.0.1', port: server.address().port });
    await client.connect();

    expect(client.protocolVersion).toBe(2);
    // HELLO requests v2 while staying v1-framed for compatibility
    expect(helloPayload.version).toBe('AL/2');

    const res = await client.request('echo', { x: 1 });
    expect(res).toEqual({ status: 'ok', body: { core: true } });
    expect(reqFrame.type).toBe(REQUEST);

    // REQUEST must be v2-framed: 16-byte header, version byte 0x02
    expect(reqRaw[2]).toBe(0x02);
    expect(reqFrame.version).toBe(2);
    expect(reqRaw.length).toBe(16 + reqRaw.readUInt32BE(10));
    expect(reqBody.route).toBe('echo');

    client.disconnect();
    server.close();
  });

  it('falls back to v1 against servers that ACK without v2 support', async () => {
    let reqRaw, reqFrame;

    const server = await startRawServer((socket) => {
      const next = frameStream(socket);
      (async () => {
        const hello = await next();

        // Legacy server: v1-framed ACK, no accepted_protocol
        socket.write(Frame.encode(
          HELLO_ACK,
          0,
          hello.frame.messageId,
          Serializer.encode({ session_id: 'core-v1', compression: 'none' })
        ));

        const req = await next();
        reqRaw = req.raw;
        reqFrame = req.frame;
        socket.write(Frame.encode(
          RESPONSE,
          0,
          req.frame.messageId,
          Serializer.encode({ status: 'ok', body: { legacy: true } })
        ));

        socket.end();
      })().catch(() => {});
    });

    const client = new TcpClient({ host: '127.0.0.1', port: server.address().port });
    await client.connect();

    expect(client.protocolVersion).toBe(1);

    const res = await client.request('echo', {});
    expect(res).toEqual({ status: 'ok', body: { legacy: true } });

    expect(reqFrame.version).toBeUndefined();
    expect(reqRaw.length).toBe(10 + reqRaw.readUInt32BE(6));

    client.disconnect();
    server.close();
  });

  it('honors an explicit AL/1.1 helloData.version override', async () => {
    let helloPayload;

    const server = await startRawServer((socket) => {
      const next = frameStream(socket);
      (async () => {
        const hello = await next();
        helloPayload = Serializer.decode(hello.frame.payload);
        socket.write(Frame.encode(
          HELLO_ACK,
          0,
          hello.frame.messageId,
          Serializer.encode({ session_id: 'core-pinned', compression: 'none' })
        ));
        socket.end();
      })().catch(() => {});
    });

    const client = new TcpClient({ host: '127.0.0.1', port: server.address().port });
    await client.connect({ version: 'AL/1.1' });

    expect(helloPayload.version).toBe('AL/1.1');
    expect(client.protocolVersion).toBe(1);

    client.disconnect();
    server.close();
  });
});

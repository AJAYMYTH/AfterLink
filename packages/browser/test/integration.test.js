import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Server } from '@ajaymyth/server';
import { Frame, FrameTypes, Serializer } from '@ajaymyth/core';
import WebSocket from 'ws';

// Polyfill global WebSocket for the browser client
globalThis.WebSocket = WebSocket;

const { Client } = require('../src/client');

let server;
let serverPort = 4100;
let wsBridgePort = 4101;

beforeAll(async () => {
  server = new Server({
    port: serverPort,
    health: { enabled: true },
    browser: { enabled: true, port: wsBridgePort, cors: { origins: '*' } },
  });

  server.on('echo', async (req, res) => {
    res.send({ echoed: req.body });
  });

  server.on('greet', async (req, res) => {
    const name = req.body.name || 'World';
    res.send({ message: `Hello, ${name}!` });
  });

  server.on('add', async (req, res) => {
    const { a, b } = req.body;
    res.send({ result: a + b });
  });

  await server.listen();
});

afterAll(async () => {
  if (server) {
    await server.close({ force: true });
  }
});

describe('Browser Client Integration Tests', () => {
  describe('WebSocket connection & handshake', () => {
    it('connects to the WS bridge and completes handshake', async () => {
      const client = new Client(`ws://localhost:${wsBridgePort}/ws`, {
        autoReconnect: false,
        protocols: [],
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
      expect(client.getSessionId()).toBeDefined();
      expect(client.getSessionId()).toMatch(/^(session_|ws_)/);

      await client.disconnect();
      expect(client.isConnected()).toBe(false);
    });

    it('rejects connection to invalid port', async () => {
      const client = new Client('ws://localhost:59999/ws', {
        autoReconnect: false,
        timeout: 1000,
      });

      await expect(client.connect()).rejects.toThrow();
    });
  });

  describe('Request/Response via WebSocket', () => {
    let client;

    beforeAll(async () => {
      client = new Client(`ws://localhost:${wsBridgePort}/ws`, {
        autoReconnect: false,
        protocols: [],
      });
      await client.connect();
    });

    afterAll(async () => {
      if (client) await client.disconnect();
    });

    it('sends a request and receives a response', async () => {
      const result = await client.request('echo', { hello: 'world' });
      expect(result).toEqual({ echoed: { hello: 'world' } });
    });

    it('handles route with custom logic', async () => {
      const result = await client.request('greet', { name: 'AfterLink' });
      expect(result).toEqual({ message: 'Hello, AfterLink!' });
    });

    it('handles numeric operations', async () => {
      const result = await client.request('add', { a: 10, b: 25 });
      expect(result).toEqual({ result: 35 });
    });

    it('receives ROUTE_NOT_FOUND for unknown routes', async () => {
      await expect(client.request('nonexistent')).rejects.toThrow();
    });
  });

  describe('Pub/Sub via WebSocket', () => {
    let client1, client2;
    const receivedMessages = [];

    beforeAll(async () => {
      client1 = new Client(`ws://localhost:${wsBridgePort}/ws`, { autoReconnect: false, protocols: [] });
      client2 = new Client(`ws://localhost:${wsBridgePort}/ws`, { autoReconnect: false, protocols: [] });
      await client1.connect();
      await client2.connect();
    });

    afterAll(async () => {
      if (client1) await client1.disconnect();
      if (client2) await client2.disconnect();
    });

    it('subscribes to a topic and receives published messages', async () => {
      const msgPromise = new Promise((resolve) => {
        client2.on('message', (msg) => {
          receivedMessages.push(msg);
          resolve(msg);
        });
      });

      await client2.subscribe('chat', () => {});
      // Give subscription time to propagate
      await new Promise((r) => setTimeout(r, 100));

      client1.publish('chat', { user: 'alice', text: 'Hello!' });

      const msg = await msgPromise;
      expect(msg.topic).toBe('chat');
      expect(msg.data).toEqual({ user: 'alice', text: 'Hello!' });
    });
  });

  describe('Raw WebSocket frame exchange', () => {
    it('sends HELLO and receives HELLO_ACK via raw WS', async () => {
      const ws = new WebSocket(`ws://localhost:${wsBridgePort}/ws`, {
        headers: { Origin: 'http://localhost:3000' },
      });

      const ackPromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        ws.on('message', (data) => {
          const buffer = Buffer.from(data);
          const frame = Frame.decode(buffer);
          if (frame && frame.type === FrameTypes.HELLO_ACK) {
            clearTimeout(timeout);
            const payload = Serializer.decode(frame.payload);
            resolve(payload);
          }
        });
      });

      ws.on('open', () => {
        const payload = Serializer.encode({
          version: 'AL/1.1',
          capabilities: ['streaming'],
          compression: 'none',
        });
        const frame = Frame.encode(FrameTypes.HELLO, 0, 1, payload);
        ws.send(frame);
      });

      const ack = await ackPromise;
      expect(ack.session_id).toBeDefined();
      expect(ack.server_version).toBe('AL/1.1');

      ws.close();
    });

    it('sends REQUEST and receives RESPONSE via raw WS', async () => {
      const ws = new WebSocket(`ws://localhost:${wsBridgePort}/ws`, {
        headers: { Origin: 'http://localhost:3000' },
      });

      const responsePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        ws.on('message', (data) => {
          const buffer = Buffer.from(data);
          const frame = Frame.decode(buffer);
          if (!frame) return;

          if (frame.type === FrameTypes.HELLO_ACK) {
            // Send REQUEST after handshake
            const reqPayload = Serializer.encode({ route: 'echo', body: { test: true } });
            const reqFrame = Frame.encode(FrameTypes.REQUEST, 0, 42, reqPayload);
            ws.send(reqFrame);
          } else if (frame.type === FrameTypes.RESPONSE && frame.messageId === 42) {
            clearTimeout(timeout);
            const payload = Serializer.decode(frame.payload);
            resolve(payload);
          } else if (frame.type === FrameTypes.ERROR && frame.messageId === 42) {
            clearTimeout(timeout);
            reject(new Error('Server returned error'));
          }
        });
      });

      ws.on('open', () => {
        const helloPayload = Serializer.encode({
          version: 'AL/1.1',
          capabilities: [],
          compression: 'none',
        });
        const helloFrame = Frame.encode(FrameTypes.HELLO, 0, 1, helloPayload);
        ws.send(helloFrame);
      });

      const response = await responsePromise;
      expect(response.status).toBe('ok');
      expect(response.body).toEqual({ echoed: { test: true } });

      ws.close();
    });
  });
});

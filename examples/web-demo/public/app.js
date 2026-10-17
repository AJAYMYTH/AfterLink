/**
 * AfterLink interactive web demo — page logic.
 *
 * Everything here talks to a real AfterLink server through the WebSocket
 * bridge using the bundled SDK (public/sdk.js, built from workspace sources).
 * The Live Playground section is a genuine messaging app: two browser
 * clients, request/response routes, pub/sub fan-out, typed errors.
 */
(function () {
  'use strict';

  var SDK = window.AfterLinkDemo;
  var CONFIG = window.AFTERLINK_DEMO_CONFIG || {};

  var $ = function (id) { return document.getElementById(id); };

  if (!SDK || !SDK.Client || !SDK.Core) {
    var hint = $('offline-hint');
    if (hint) {
      hint.hidden = false;
      hint.textContent =
        'The AfterLink SDK bundle failed to load. Serve this page through the demo server: ' +
        'node examples/web-demo/server.js → http://localhost:8080';
    }
    return;
  }

  var Client = SDK.Client;
  var Core = SDK.Core;
  var Frame = Core.Frame;
  var FrameTypes = Core.FrameTypes;
  var Serializer = Core.Serializer;

  var WS_URL = CONFIG.wsUrl || ('ws://' + location.hostname + ':4401/ws');

  // ──────────────────────────────────────────────────────────────────────────
  // small helpers
  // ──────────────────────────────────────────────────────────────────────────
  function fmtMs(v) {
    if (v >= 100) return v.toFixed(0) + ' ms';
    if (v >= 10) return v.toFixed(1) + ' ms';
    return v.toFixed(2) + ' ms';
  }
  function fmtTime(ts) {
    return new Date(ts == null ? Date.now() : ts).toLocaleTimeString('en-GB', { hour12: false });
  }
  function fmtNum(n) {
    return typeof n === 'number' ? n.toLocaleString('en-US') : String(n);
  }
  function fmtUptime(s) {
    s = Math.floor(s || 0);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h) return h + 'h ' + m + 'm';
    if (m) return m + 'm ' + sec + 's';
    return sec + 's';
  }
  function truncate(s, n) {
    s = String(s == null ? '' : s);
    return s.length > n ? s.slice(0, n - 1) + '…' : s;
  }
  function who(u) { return u === 'alice' ? 'Alice' : u === 'bob' ? 'Bob' : u; }
  function waitFor(fn, ms, label) {
    return new Promise(function (resolve, reject) {
      var t0 = Date.now();
      var iv = setInterval(function () {
        var v = false;
        try { v = fn(); } catch (e) { /* keep waiting */ }
        if (v) { clearInterval(iv); resolve(v); }
        else if (Date.now() - t0 > ms) { clearInterval(iv); reject(new Error('timeout: ' + label)); }
      }, 120);
    });
  }
  function payloadBytes(obj) {
    try { return Serializer.encode(obj).length; } catch (e) { return 0; }
  }
  function frameDesc(payloadObj, client) {
    var v = client && client.getProtocolVersion ? client.getProtocolVersion() : 2;
    var header = v === 2 ? 16 : 10;
    var p = payloadBytes(payloadObj);
    return (header + p) + ' B frame (' + header + ' B header + ' + p + ' B payload)';
  }
  function fmtSession(id) {
    return id ? String(id) : '—';
  }

  // ──────────────────────────────────────────────────────────────────────────
  // nav chrome: scroll progress, reveal, scrollspy
  // ──────────────────────────────────────────────────────────────────────────
  (function navChrome() {
    var progress = $('scroll-progress');
    function onScroll() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      if (progress) progress.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + '%';
    }
    document.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    if ('IntersectionObserver' in window) {
      var reveal = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) { en.target.classList.add('in'); reveal.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

      document.querySelectorAll('.card, .panel, .stat, .story, .code-wrap, .table-wrap').forEach(function (n) {
        n.classList.add('reveal');
        reveal.observe(n);
      });

      var links = Array.prototype.slice.call(document.querySelectorAll('.nav-links a'));
      var byId = {};
      links.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });

      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          var link = byId[en.target.id];
          if (link && en.isIntersecting) {
            links.forEach(function (a) { a.classList.remove('active'); });
            link.classList.add('active');
          }
        });
      }, { rootMargin: '-42% 0px -52% 0px' });

      ['why', 'what', 'how', 'playground', 'impact', 'challenges', 'usecases'].forEach(function (id) {
        var sec = document.getElementById(id);
        if (sec) spy.observe(sec);
      });

      // Safety net: if an element never intersects (print, automation,
      // unusual embeds), reveal it anyway after a few seconds.
      setTimeout(function () {
        document.querySelectorAll('.reveal:not(.in)').forEach(function (n) { n.classList.add('in'); });
      }, 6000);
    }
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // nav status chip
  // ──────────────────────────────────────────────────────────────────────────
  function setNavStatus(mode, text) {
    var chip = $('nav-status');
    var txt = $('nav-status-text');
    if (!chip) return;
    chip.className = 'nav-status ' + mode;
    if (txt) txt.textContent = text || mode;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // handshake stepper
  // ──────────────────────────────────────────────────────────────────────────
  var HS = [
    {
      dir: 'both', dtag: 'connect',
      t: 'Open the transport',
      d: 'The client opens a TCP connection — or a WebSocket to the browser bridge. No AfterLink frames yet: the transport is just a pipe.',
      body: 'Nothing is negotiated on the transport itself. TCP, TLS or WebSocket does what it always does; AfterLink starts at the first frame.'
    },
    {
      dir: 'tx', dtag: 'client → server',
      t: 'HELLO — announce capabilities',
      d: 'The client sends HELLO with version "AL/2", its capabilities and optional auth. The HELLO frame is always v1-framed (10-byte header).',
      body: 'Payload: { version: "AL/2", auth: null, capabilities: ["streaming", "pubsub"], compression: "none" } — every other server ever shipped can still parse this frame.'
    },
    {
      dir: 'rx', dtag: 'server (internal)',
      t: 'Sniff the dialect',
      d: 'The server reads byte 2 of the frame. 0x02 → AL/2; the payload version field confirms it. The session is pinned to 16-byte v2 framing.',
      body: 'One byte decides everything. A v1-only server simply never takes this step — no renegotiation, no second handshake, no broken decoders.'
    },
    {
      dir: 'rx', dtag: 'server → client',
      t: 'HELLO_ACK — confirm the session',
      d: 'The server answers with accepted_protocol "v2", server_version "AL/2" and the session id — framed with the new 16-byte header.',
      body: 'If the server had left accepted_protocol out, the client would silently stay on v1. That fallback is covered by tests (legacy ACK, v1-framed stub, pinned v1).'
    },
    {
      dir: 'both', dtag: 'session ready',
      t: 'Ready — real traffic',
      d: 'REQUEST/RESPONSE routes, SUBSCRIBE/PUBLISH topics and PING/PONG keep-alives flow — each session framed exactly as negotiated.',
      body: 'The playground below is doing this right now. The Live wire log shows the exact HELLO / HELLO_ACK / SUBSCRIBE frames from this page’s own sessions.'
    }
  ];
  var hsIndex = -1;
  var hsTimer = null;

  function hsRender() {
    var wrap = $('hs-steps');
    if (!wrap) return;
    wrap.innerHTML = '';
    HS.forEach(function (step, i) {
      var row = document.createElement('div');
      row.className = 'hs-step' + (i === hsIndex ? ' active' : '') + (i < hsIndex ? ' done' : '');
      var idx = document.createElement('span');
      idx.className = 'idx';
      idx.textContent = String(i + 1);
      var box = document.createElement('div');
      var t = document.createElement('div'); t.className = 't'; t.textContent = step.t;
      var d = document.createElement('div'); d.className = 'd'; d.textContent = step.d;
      box.appendChild(t); box.appendChild(d);
      row.appendChild(idx); row.appendChild(box);
      row.addEventListener('click', function () { hsStop(); hsSet(i); });
      wrap.appendChild(row);
    });

    var dir = $('hs-dir'), title = $('hs-title'), body = $('hs-body');
    if (!dir || !title || !body) return;
    if (hsIndex < 0) {
      dir.textContent = '—'; dir.className = 'hs-dir';
      title.textContent = 'Press play to step through the handshake';
      body.textContent = 'Five steps take a fresh connection from “raw socket” to “AL/2 session”: HELLO → sniff → HELLO_ACK → ready. The clients in the playground below did exactly this when this page loaded.';
      return;
    }
    var step = HS[hsIndex];
    dir.textContent = step.dtag;
    dir.className = 'hs-dir' + (step.dir === 'both' ? ' both' : step.dir === 'tx' ? ' tx' : ' rx');
    title.textContent = step.t;
    body.textContent = step.body;
  }
  function hsSet(i) {
    hsIndex = Math.max(0, Math.min(HS.length - 1, i));
    hsRender();
  }
  function hsStop() {
    if (hsTimer) { clearInterval(hsTimer); hsTimer = null; }
    var btn = $('hs-play');
    if (btn) btn.textContent = '▶ Play';
  }
  function hsPlay() {
    if (hsTimer) { hsStop(); return; }
    if (hsIndex >= HS.length - 1) hsIndex = -1;
    var btn = $('hs-play');
    if (btn) btn.textContent = '⏸ Pause';
    hsSet(hsIndex + 1);
    hsTimer = setInterval(function () {
      if (hsIndex >= HS.length - 1) { hsStop(); return; }
      hsSet(hsIndex + 1);
    }, 1900);
  }
  (function initHandshake() {
    if (!$('hs-steps')) return;
    hsRender();
    $('hs-play').addEventListener('click', hsPlay);
    $('hs-next').addEventListener('click', function () { hsStop(); hsSet(hsIndex + 1); });
    $('hs-prev').addEventListener('click', function () { hsStop(); hsSet(hsIndex - 1); });
    $('hs-reset').addEventListener('click', function () { hsStop(); hsIndex = -1; hsRender(); });
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // frame explorer
  // ──────────────────────────────────────────────────────────────────────────
  var FIELDS = {
    1: [
      { key: 'type', name: 'type', start: 0, size: 1, color: '#00d4ff', desc: 'Frame type — 0x01 REQUEST, 0x02 RESPONSE, 0x0C PUBLISH, 0x0F HELLO… The first byte every decoder reads.' },
      { key: 'flags', name: 'flags', start: 1, size: 1, color: '#f59e0b', desc: 'Bit flags — 0x01 compressed, 0x02 encrypted, 0x04 streaming. Zero means a plain frame.' },
      { key: 'msgid', name: 'messageId', start: 2, size: 4, color: '#10b981', desc: 'uint32 correlation id — a RESPONSE or typed error carries the same id as its REQUEST.' },
      { key: 'plen', name: 'payloadLength', start: 6, size: 4, color: '#fb923c', desc: 'uint32 length of the MessagePack payload that follows the header.' }
    ],
    2: [
      { key: 'type', name: 'type', start: 0, size: 1, color: '#00d4ff', desc: 'Frame type — 0x01 REQUEST, 0x02 RESPONSE, 0x0C PUBLISH, 0x0F HELLO… Same as v1, so the first byte never changes meaning.' },
      { key: 'flags', name: 'flags', start: 1, size: 1, color: '#f59e0b', desc: 'Bit flags — 0x01 compressed, 0x02 encrypted, 0x04 streaming. Zero means a plain frame.' },
      { key: 'version', name: 'version', start: 2, size: 1, color: '#a78bfa', desc: 'Protocol version marker: 0x02 declares an AL/2 frame. This is the byte servers sniff during HELLO to pick a dialect.' },
      { key: 'priority', name: 'priority', start: 3, size: 1, color: '#f472b6', desc: 'uint8 priority — 0 highest … 7 lowest, default 3. Brokers and schedulers can order delivery without decoding the payload.' },
      { key: 'msgid', name: 'messageId', start: 4, size: 4, color: '#10b981', desc: 'uint32 correlation id — a RESPONSE or typed error carries the same id as its REQUEST.' },
      { key: 'rkey', name: 'routingKeyLength', start: 8, size: 2, color: '#60a5fa', desc: 'uint16 length of the routing key that precedes the payload; 0 = no key. Keys let brokers shard or target frames without decoding them.' },
      { key: 'plen', name: 'payloadLength', start: 10, size: 4, color: '#fb923c', desc: 'uint32 length of the MessagePack payload that follows the header (and routing key, if any).' },
      { key: 'reserved', name: 'reserved', start: 14, size: 2, color: '#64798c', desc: 'Reserved, must be zero — headroom so future flags never need to change the header size again.' }
    ]
  };

  var TYPE_NAMES = {};
  TYPE_NAMES[FrameTypes.REQUEST] = 'REQUEST';
  TYPE_NAMES[FrameTypes.RESPONSE] = 'RESPONSE';
  TYPE_NAMES[FrameTypes.PUBLISH] = 'PUBLISH';
  TYPE_NAMES[FrameTypes.SUBSCRIBE] = 'SUBSCRIBE';
  TYPE_NAMES[FrameTypes.HELLO] = 'HELLO';
  TYPE_NAMES[FrameTypes.HELLO_ACK] = 'HELLO_ACK';

  var fxState = { version: 2, preset: 'request', selectedField: null };
  var fxLast = null;

  var FX_PRESETS = {
    request: {
      label: 'REQUEST',
      type: FrameTypes.REQUEST,
      payload: function () {
        var route = $('fx-route').value.trim() || 'demo.echo';
        var bodyText = $('fx-body').value.trim() || '{}';
        var body = JSON.parse(bodyText);
        return { route: route, body: body };
      }
    },
    response: {
      label: 'RESPONSE',
      type: FrameTypes.RESPONSE,
      payload: function () {
        return { status: 'ok', body: { delivered: true, messageId: 'msg_1757000000000_12' } };
      }
    },
    publish: {
      label: 'PUBLISH',
      type: FrameTypes.PUBLISH,
      payload: function () {
        return { topic: 'chat.lobby', data: { user: 'alice', text: 'hey!', sentAt: 1757000000000 } };
      }
    },
    hello: {
      label: 'HELLO',
      type: FrameTypes.HELLO,
      forcedV1: true,
      payload: function () {
        return { version: 'AL/2', auth: null, capabilities: ['streaming', 'pubsub'], compression: 'none' };
      }
    }
  };

  function byteHex(frame, i) {
    return frame[i].toString(16).toUpperCase().padStart(2, '0');
  }

  function fieldValueText(frame, field) {
    if (field.size === 1) {
      var b = frame[field.start];
      return '0x' + b.toString(16).toUpperCase().padStart(2, '0') + ' (' + b + ')' +
        (field.key === 'type' && TYPE_NAMES[b] ? '  →  ' + TYPE_NAMES[b] : '');
    }
    if (field.size === 2) return '0x' + frame.readUInt16BE(field.start).toString(16).toUpperCase().padStart(4, '0') + ' (' + frame.readUInt16BE(field.start) + ')';
    if (field.size === 4) return '0x' + frame.readUInt32BE(field.start).toString(16).toUpperCase().padStart(8, '0') + ' (' + frame.readUInt32BE(field.start) + ')';
    return '0x' + Array.prototype.map.call(frame.slice(field.start, field.start + field.size), function (b) {
      return b.toString(16).toUpperCase().padStart(2, '0');
    }).join(' ');
  }

  function fxFieldAt(version, index) {
    var defs = FIELDS[version];
    for (var i = 0; i < defs.length; i++) {
      if (index >= defs[i].start && index < defs[i].start + defs[i].size) return defs[i];
    }
    return null;
  }

  function fxSelectField(key) {
    if (!fxLast) return;
    fxState.selectedField = key;
    var version = fxLast.version;
    var defs = FIELDS[version];
    var field = null;
    for (var i = 0; i < defs.length; i++) if (defs[i].key === key) field = defs[i];
    if (!field) return;

    document.querySelectorAll('#fx-hex .byte').forEach(function (cell) {
      cell.classList.toggle('sel', cell.dataset.field === key);
    });
    document.querySelectorAll('#fx-legend .l-chip').forEach(function (chip) {
      chip.classList.toggle('on', chip.dataset.field === key);
    });

    var detail = $('fx-detail');
    detail.innerHTML = '';
    var h = document.createElement('h4');
    h.textContent = field.name;
    var meta = document.createElement('div');
    meta.className = 'fd-meta';
    meta.textContent = 'byte' + (field.size > 1 ? 's ' : ' ') + field.start + (field.size > 1 ? '–' + (field.start + field.size - 1) : '') +
      ' · ' + field.size + ' B · value ' + fieldValueText(fxLast.frame, field);
    var p = document.createElement('p');
    p.textContent = field.desc;
    detail.appendChild(h); detail.appendChild(meta); detail.appendChild(p);
  }

  function fxShowError(message) {
    var sum = $('fx-summary');
    if (!sum) return;
    sum.innerHTML = '';
    var e = document.createElement('div');
    e.className = 'fx-error';
    e.textContent = '⚠ ' + message;
    sum.appendChild(e);
  }

  function fxRenderHex(frame, version) {
    var hex = $('fx-hex');
    hex.innerHTML = '';
    for (var i = 0; i < frame.length; i++) {
      var field = fxFieldAt(version, i);
      var cell = document.createElement('div');
      cell.className = 'byte f-' + (field ? field.key : 'reserved');
      cell.dataset.field = field ? field.key : 'reserved';
      cell.dataset.index = String(i);
      cell.title = (field ? field.name : 'payload') + ' · byte ' + i;
      var h = document.createElement('div'); h.className = 'h'; h.textContent = byteHex(frame, i);
      var o = document.createElement('span'); o.className = 'o'; o.textContent = String(i);
      cell.appendChild(h); cell.appendChild(o);
      cell.addEventListener('click', function (ev) {
        var k = ev.currentTarget.dataset.field;
        if (k && k !== 'reserved-payload') fxSelectField(k);
      });
      hex.appendChild(cell);
    }
  }

  function fxRenderLegend(version) {
    var legend = $('fx-legend');
    legend.innerHTML = '';
    FIELDS[version].forEach(function (field) {
      var chip = document.createElement('span');
      chip.className = 'l-chip' + (fxState.selectedField === field.key ? ' on' : '');
      chip.dataset.field = field.key;
      var sw = document.createElement('span');
      sw.className = 'swatch';
      sw.style.background = field.color;
      chip.appendChild(sw);
      chip.appendChild(document.createTextNode(field.name + ' · ' + field.size + ' B'));
      chip.addEventListener('click', function () { fxSelectField(field.key); });
      legend.appendChild(chip);
    });
  }

  function fxRenderSummary(frame, payload, payloadObj, version, preset) {
    var sum = $('fx-summary');
    sum.innerHTML = '';

    function row(k, v) {
      var r = document.createElement('div');
      r.className = 'fs-row';
      var kk = document.createElement('span'); kk.className = 'k'; kk.textContent = k;
      var vv = document.createElement('span'); vv.className = 'v'; vv.textContent = v;
      r.appendChild(kk); r.appendChild(vv);
      sum.appendChild(r);
    }

    var decoded = null;
    try { decoded = Frame.decodeAuto(frame); } catch (e) { /* ignore */ }

    var v1Frame = Frame.encode(preset.type, 0, 1, payload);
    var v2Frame = Frame.encode(preset.type, 0, 1, payload, { version: 2 });

    row('type', (TYPE_NAMES[preset.type] || '0x' + preset.type.toString(16)) + ' · id 1');
    row('wire size', frame.length + ' B  (' + (version === 2 ? 16 : 10) + ' B header + ' + payload.length + ' B payload)');
    if (version === 2) row('priority', String(frame[3]) + ' (default)');
    row('same payload, other version', 'v1 ' + v1Frame.length + ' B · v2 ' + v2Frame.length + ' B' + (version === 2 ? ' — the AL/2 header costs +6 B' : ''));
    row('round-trip check', decoded && decoded.type === preset.type ? '✓ decoded back to ' + (TYPE_NAMES[decoded.type] || decoded.type) : 'decode mismatch');

    var pre = document.createElement('pre');
    pre.textContent = JSON.stringify(payloadObj, null, 2);
    sum.appendChild(pre);
  }

  function fxApplyVersionUI(preset) {
    var v1 = $('fx-seg-v1'), v2 = $('fx-seg-v2');
    var version = preset.forcedV1 ? 1 : fxState.version;
    v1.classList.toggle('on', version === 1);
    v2.classList.toggle('on', version === 2);
    v1.disabled = !!preset.forcedV1;
    v2.disabled = !!preset.forcedV1;
    var route = $('fx-route'), body = $('fx-body');
    var editable = fxState.preset === 'request';
    route.disabled = !editable;
    body.disabled = !editable;
  }

  function fxRender() {
    if (!$('fx-hex')) return;
    var preset = FX_PRESETS[fxState.preset];
    fxApplyVersionUI(preset);
    var version = preset.forcedV1 ? 1 : fxState.version;

    var payloadObj;
    try { payloadObj = preset.payload(); }
    catch (err) { fxShowError('body must be valid JSON — ' + err.message); return; }

    var payload, frame;
    try {
      payload = Serializer.encode(payloadObj);
      frame = Frame.encode(preset.type, 0, 1, payload, version === 2 ? { version: 2 } : {});
    } catch (err) { fxShowError('encode failed: ' + err.message); return; }

    fxLast = { frame: frame, payload: payload, version: version };
    fxRenderHex(frame, version);
    fxRenderLegend(version);
    fxRenderSummary(frame, payload, payloadObj, version, preset);
    if (fxState.selectedField && fxFieldAt(version, (FIELDS[version].find(function (f) { return f.key === fxState.selectedField; }) || { start: -1 }).start)) {
      fxSelectField(fxState.selectedField);
    }
  }

  (function initExplorer() {
    if (!$('fx-hex')) return;
    $('fx-seg-v1').addEventListener('click', function () { fxState.version = 1; fxRender(); });
    $('fx-seg-v2').addEventListener('click', function () { fxState.version = 2; fxRender(); });
    document.querySelectorAll('#fx-presets .chip-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#fx-presets .chip-btn').forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        fxState.preset = btn.dataset.preset;
        fxState.selectedField = null;
        fxRender();
      });
    });
    var debounce = null;
    function onInput() { clearTimeout(debounce); debounce = setTimeout(fxRender, 250); }
    $('fx-route').addEventListener('input', onInput);
    $('fx-body').addEventListener('input', onInput);
    fxRender();
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // LIVE PLAYGROUND
  // ──────────────────────────────────────────────────────────────────────────
  var users = {
    alice: { sent: 0, lastRtt: null, client: null, handlers: null },
    bob: { sent: 0, lastRtt: null, client: null, handlers: null }
  };
  var state = { received: 0, rtts: [] };
  var seenIds = new Set();
  var newsSeen = new Set();
  var pendingMeta = new Map();

  function avgRtt() {
    if (!state.rtts.length) return null;
    return state.rtts.reduce(function (a, b) { return a + b; }, 0) / state.rtts.length;
  }
  function pushRtt(v) {
    state.rtts.push(v);
    if (state.rtts.length > 50) state.rtts.shift();
  }

  // ── wire log ──────────────────────────────────────────────────────────────
  function log(dir, tag, text) {
    var w = $('log-window');
    if (!w) return;
    var e = document.createElement('div');
    e.className = 'log-entry ' + dir;
    var t = document.createElement('span'); t.className = 't'; t.textContent = fmtTime().slice(0, 8);
    var tg = document.createElement('span'); tg.className = 'tag'; tg.textContent = tag;
    var tx = document.createElement('span'); tx.className = 'txt'; tx.textContent = text;
    e.appendChild(t); e.appendChild(tg); e.appendChild(tx);
    var nearBottom = w.scrollTop + w.clientHeight >= w.scrollHeight - 40;
    w.appendChild(e);
    while (w.children.length > 140) w.removeChild(w.firstChild);
    if (nearBottom) w.scrollTop = w.scrollHeight;
  }

  // ── chat bubbles ──────────────────────────────────────────────────────────
  function addMsg(opts) {
    if (opts.id) {
      if (seenIds.has(opts.id)) return null;
      seenIds.add(opts.id);
    }
    var w = $('chat-window');
    if (!w) return null;
    var e = document.createElement('div');
    e.className = 'msg ' + (opts.kind || 'sys');
    var meta = document.createElement('div');
    meta.className = 'meta';
    if (opts.user) {
      var wspan = document.createElement('span');
      wspan.className = 'who';
      wspan.textContent = opts.user;
      meta.appendChild(wspan);
    }
    var time = document.createElement('span');
    time.textContent = fmtTime();
    meta.appendChild(time);
    var body = document.createElement('div');
    body.className = 'body';
    body.textContent = opts.text;
    e.appendChild(meta); e.appendChild(body);
    if (opts.foot) {
      var f = document.createElement('div');
      f.className = 'foot';
      f.textContent = opts.foot;
      e.appendChild(f);
    }
    var nearBottom = w.scrollTop + w.clientHeight >= w.scrollHeight - 60;
    w.appendChild(e);
    while (w.children.length > 120) w.removeChild(w.firstChild);
    if (nearBottom) w.scrollTop = w.scrollHeight;
    return e;
  }
  function msgSys(text) { return addMsg({ kind: 'sys', text: text }); }
  function msgErr(text) { return addMsg({ kind: 'err', user: 'protocol', text: text }); }

  // ── UI state helpers ──────────────────────────────────────────────────────
  function setStatus(user, mode, text) {
    var el = $('status-' + user);
    if (!el) return;
    el.className = 'status ' + mode;
    var txt = el.querySelector('.txt');
    if (txt) txt.textContent = text || mode;
  }
  function setProto(user, version) {
    var el = $('proto-' + user);
    if (!el) return;
    if (!version) { el.textContent = '…'; el.className = 'proto-badge'; return; }
    el.textContent = version === 2 ? 'AL/2 · 16 B frames' : 'AL/1 · 10 B frames';
    el.className = 'proto-badge ' + (version === 2 ? 'v2' : 'v1');
  }
  function setSession(user, id) {
    var el = $('session-' + user);
    if (el) { el.textContent = fmtSession(id); el.title = id || ''; }
  }
  function updateClientStats(user) {
    var el = $('stats-' + user);
    if (!el) return;
    var u = users[user];
    el.textContent = 'sent ' + u.sent + ' · last RTT ' + (u.lastRtt != null ? fmtMs(u.lastRtt) : '—');
  }
  function updatePageMetrics() {
    var connected = ['alice', 'bob'].filter(function (u) {
      return users[u].client && users[u].client.isConnected();
    });
    var hs = $('hero-sessions'); if (hs) hs.textContent = String(connected.length);
    var ms = $('met-sessions'); if (ms) ms.textContent = String(connected.length);
    var mt = $('met-sent'); if (mt) mt.textContent = String(users.alice.sent + users.bob.sent);
    var mr = $('met-recv'); if (mr) mr.textContent = String(state.received);
    var a = avgRtt();
    var mrt = $('met-rtt'); if (mrt) mrt.textContent = a == null ? '—' : fmtMs(a);
    if (connected.length) {
      var hp = $('hero-protocol');
      if (hp) hp.textContent = 'AL/' + users[connected[0]].client.getProtocolVersion();
    }
    if (connected.length) setNavStatus('online', 'server online');
  }

  // ── message handlers ──────────────────────────────────────────────────────
  function handleChatMessage(receiver, msg) {
    if (!msg) return;
    state.received++;
    updatePageMetrics();
    var meta = msg.id ? pendingMeta.get(msg.id) : null;
    if (meta) pendingMeta.delete(msg.id);
    var kind = msg.user === 'alice' ? 'alice' : msg.user === 'bob' ? 'bob' : 'sys';
    addMsg({
      kind: kind,
      user: msg.user,
      text: msg.text,
      id: msg.id,
      foot: meta
        ? 'delivered via chat.send (RTT ' + fmtMs(meta.rtt) + ') → fanned out by the server · ' + frameDesc({ topic: 'chat.lobby', data: msg }, users[receiver].client)
        : 'received on chat.lobby · ' + frameDesc({ topic: 'chat.lobby', data: msg }, users[receiver].client)
    });
    log('rx', 'PUBLISH', who(receiver) + ' ← chat.lobby · ' + truncate(msg.user + ': "' + msg.text + '"', 64));
  }

  function handleNews(receiver, data) {
    if (!data || (data.id && newsSeen.has(data.id))) return;
    if (data.id) newsSeen.add(data.id);
    addMsg({
      kind: 'news',
      user: 'server push',
      text: '📣 ' + (data.headline || JSON.stringify(data)),
      foot: 'topic demo.news · pushed by the server, no request involved'
    });
    log('rx', 'PUBLISH', who(receiver) + ' ← demo.news · server-initiated push');
  }

  // ── client lifecycle ──────────────────────────────────────────────────────
  function ensureClient(user) {
    var u = users[user];
    if (u.client) return u.client;

    u.handlers = {
      chat: function (msg) { handleChatMessage(user, msg); },
      news: function (data) { handleNews(user, data); }
    };

    var client = new Client(WS_URL, {
      autoReconnect: true,
      reconnectDelay: 500,
      maxReconnectAttempts: 20,
      pingInterval: 20000,
      protocolVersion: 2
    });

    client.on('connected', function () { /* enables the PING keep-alive interval */ });

    client.on('disconnected', function (info) {
      setStatus(user, 'offline', 'offline');
      updatePageMetrics();
      log('sys', 'CLOSE', who(user) + ' disconnected (code ' + info.code + (info.reason ? ', ' + info.reason : '') + ')');
      msgSys('⚠️ ' + who(user) + ' lost the connection (code ' + info.code + ')');
    });

    client.on('reconnecting', function (info) {
      setStatus(user, 'connecting', 'reconnecting…');
      log('sys', 'RETRY', who(user) + ' reconnecting — attempt ' + info.attempt + ' in ~' + Math.round(info.delay) + ' ms');
    });

    client.on('reconnected', function () {
      setStatus(user, 'online', 'online');
      setProto(user, client.getProtocolVersion());
      setSession(user, client.getSessionId());
      updatePageMetrics();
      log('rx', 'RECONNECTED', who(user) + ' is back · new session ' + fmtSession(client.getSessionId()) + ' · AL/' + client.getProtocolVersion());
      msgSys('🔄 ' + who(user) + ' reconnected with backoff — re-subscribing to chat.lobby…');
      subscribeTopics(user).catch(function (err) {
        log('err', 'RESUB', 're-subscribe failed: ' + err.message);
      });
    });

    client.on('server-closing', function () {
      log('err', 'CLOSING', 'Server announced a graceful shutdown (typed CLOSE frame)');
      msgErr('Server is shutting down — clients receive a typed CLOSE with a reason, then drain.');
    });

    u.client = client;
    return client;
  }

  function subscribeTopics(user) {
    var u = users[user];
    var c = u.client;
    if (!c || !c.isConnected()) return Promise.resolve();

    var p1 = c.subscribe('chat.lobby', u.handlers.chat);
    log('tx', 'SUBSCRIBE', who(user) + ' → chat.lobby · ' + frameDesc({ topic: 'chat.lobby' }, c));
    return p1.then(function () {
      log('rx', 'SUB_ACK', who(user) + ' subscribed to chat.lobby');
      var p2 = c.subscribe('demo.news', u.handlers.news);
      log('tx', 'SUBSCRIBE', who(user) + ' → demo.news');
      return p2;
    }).then(function () {
      log('rx', 'SUB_ACK', who(user) + ' subscribed to demo.news');
    });
  }

  function connectClient(user) {
    var u = users[user];
    if (u.client && (u.client.isConnected() || u.client._connecting)) return Promise.resolve();

    var c = ensureClient(user);
    setStatus(user, 'connecting', 'connecting…');
    setProto(user, null);
    log('sys', 'HELLO', who(user) + ' connecting → HELLO requests AL/2 (v1-framed for compatibility)');

    var t0 = performance.now();
    return c.connect().then(function () {
      var took = performance.now() - t0;
      var v = c.getProtocolVersion();
      setStatus(user, 'online', 'online');
      setProto(user, v);
      setSession(user, c.getSessionId());
      updatePageMetrics();
      log('rx', 'HELLO_ACK', 'accepted_protocol=' + (v === 2 ? 'v2' : 'v1') + ' · server_version AL/2 · session ' + fmtSession(c.getSessionId()) + ' · handshake ' + fmtMs(took));
      msgSys('✅ ' + who(user) + ' connected — negotiated AL/' + v + ' (' + (v === 2 ? '16' : '10') + '-byte frames), session ' + fmtSession(c.getSessionId()));
      return subscribeTopics(user);
    }).catch(function (err) {
      setStatus(user, 'offline', 'offline');
      log('err', 'FAIL', who(user) + ' could not connect: ' + err.message);
      var hint = $('offline-hint');
      if (hint) hint.hidden = false;
      setNavStatus('offline', 'server offline');
      throw err;
    });
  }

  // ── send / tools ──────────────────────────────────────────────────────────
  function sendMessage(user, text) {
    var u = users[user];
    var c = u.client;
    if (!text || !String(text).trim()) return;
    if (!c || !c.isConnected()) {
      msgSys('⚠️ ' + who(user) + ' is not connected — start the demo server and reload.');
      return;
    }
    var body = { user: user, text: String(text).slice(0, 500), room: 'lobby' };
    log('tx', 'REQUEST', who(user) + ' → chat.send · ' + frameDesc({ route: 'chat.send', body: body }, c));
    var t0 = performance.now();
    c.request('chat.send', body).then(function (ack) {
      var rtt = performance.now() - t0;
      u.sent++;
      u.lastRtt = rtt;
      pushRtt(rtt);
      if (ack && ack.messageId) pendingMeta.set(ack.messageId, { rtt: rtt });
      updateClientStats(user);
      updatePageMetrics();
      log('rx', 'RESPONSE', 'ACK ← delivered (' + fmtMs(rtt) + ') · messageId ' + (ack.messageId || '?'));
    }).catch(function (err) {
      log('err', err.code || 'ERROR', who(user) + ' chat.send failed — ' + err.message);
      msgErr('chat.send failed — ' + (err.code || 'ERROR') + ': ' + err.message);
    });
  }

  var HI_LINES = {
    alice: [
      'Hey Bob! 👋 this message went through a real AL/2 request → pub/sub round trip',
      'Hi from Alice — encoded, framed, fanned out, and rendered.'
    ],
    bob: [
      'Hey Alice! Got it — this came back over the chat.lobby topic 📬',
      'Hi from Bob 👋 tiny frames, instant delivery.'
    ]
  };
  function sayHi(user) {
    var lines = HI_LINES[user];
    sendMessage(user, lines[Math.floor(Math.random() * lines.length)]);
  }

  var REPLIES = [
    'Nice — that round trip felt instant.',
    'Confirmed ✅ nothing but bytes and a good protocol.',
    'This is Bob, replying over chat.send.',
    '10/16-byte headers beat dragging HTTP everywhere 😄'
  ];
  function simulateReply() {
    var c = users.bob.client;
    if (!c || !c.isConnected()) { msgSys('⚠️ Bob must be connected first.'); return; }
    msgSys('🤖 Bob is typing…');
    setTimeout(function () {
      sendMessage('bob', REPLIES[Math.floor(Math.random() * REPLIES.length)]);
    }, 900);
  }

  function serverPush() {
    var c = users.alice.client;
    if (!c || !c.isConnected()) { msgSys('⚠️ Connect first — the server must be running.'); return; }
    log('tx', 'REQUEST', 'Alice → demo.trigger · ' + frameDesc({ route: 'demo.trigger', body: {} }, c));
    c.request('demo.trigger', { headline: 'AL/2 negotiation just shipped in AfterLink 2.0.3 🎉' }).then(function (ack) {
      log('rx', 'RESPONSE', 'scheduled · server will publish to demo.news in ~' + ack.publishInMs + ' ms');
      msgSys('📣 Scheduled — the server will push to demo.news in ~' + (ack.publishInMs / 1000).toFixed(1) + ' s. Watch both clients receive it.');
    }).catch(function (err) {
      log('err', err.code || 'ERROR', 'demo.trigger failed — ' + err.message);
    });
  }

  function burst() {
    var c = users.alice.client;
    if (!c || !c.isConnected()) { msgSys('⚠️ Connect first — the server must be running.'); return; }
    var n = 10;
    log('sys', 'BURST', n + ' parallel demo.echo requests…');
    var t0 = performance.now();
    Promise.allSettled(Array.prototype.map.call(new Array(n), function (_x, i) {
      return c.request('demo.echo', { i: i, payload: 'x'.repeat(24) });
    })).then(function (results) {
      var ok = results.filter(function (r) { return r.status === 'fulfilled'; }).length;
      var ms = performance.now() - t0;
      msgSys('⚡ ' + ok + '/' + n + ' parallel echo requests completed in ' + fmtMs(ms) + ' → ' + Math.round(n / (ms / 1000)) + ' msg/s wall-clock');
      log('rx', 'BURST', ok + '/' + n + ' responses · ' + fmtMs(ms) + ' total (parallel)');
    });
  }

  function schemaBreak() {
    var c = users.alice.client;
    if (!c || !c.isConnected()) { msgSys('⚠️ Connect first — the server must be running.'); return; }
    log('tx', 'REQUEST', 'Alice → chat.send with text:"" (intentionally invalid)');
    c.request('chat.send', { user: 'alice', text: '' }).then(function () {
      msgSys('Unexpected: the server accepted an invalid payload.');
    }).catch(function (err) {
      msgErr('🧪 ' + (err.code || 'ERROR') + ' — ' + err.message);
      log('rx', 'ERROR', (err.code || 'ERROR') + ': ' + err.message + ' · rejected before the handler ran (zod schema)');
    });
  }

  function boomRoute() {
    var c = users.alice.client;
    if (!c || !c.isConnected()) { msgSys('⚠️ Connect first — the server must be running.'); return; }
    log('tx', 'REQUEST', 'Alice → demo.boom (this route always throws)');
    c.request('demo.boom', {}).then(function () {
      msgSys('Unexpected: demo.boom did not fail.');
    }).catch(function (err) {
      msgErr('💥 ' + (err.code || 'ERROR') + ' — ' + err.message);
      log('rx', 'ERROR', (err.code || 'ERROR') + ' returned instead of a crash · uncaught handler errors become typed frames');
    });
  }

  function dropSocket(user) {
    var c = users[user].client;
    if (!c || !c.ws) { msgSys('⚠️ ' + who(user) + ' has no live socket to drop.'); return; }
    try {
      log('sys', 'DROP', who(user) + ' socket force-closed locally — simulating a flaky network');
      msgSys('🔌 ' + who(user) + '’s socket was force-closed. Watch the auto-reconnect with exponential backoff…');
      c.ws.close(4001, 'demo drop');
    } catch (err) {
      log('err', 'DROP', err.message);
    }
  }

  // ── server stats polling ──────────────────────────────────────────────────
  function pickConnected() {
    if (users.alice.client && users.alice.client.isConnected()) return users.alice.client;
    if (users.bob.client && users.bob.client.isConnected()) return users.bob.client;
    return null;
  }
  function renderServerStats(s) {
    // `demo` counters cover TCP + WebSocket traffic; the library's own
    // counters are attached per TCP connection and stay 0 for bridge traffic.
    var demo = s.demo || {};
    var reqs = demo.requests != null ? demo.requests : s.totalRequests;
    var avgMs = demo.avgHandlerMs != null ? demo.avgHandlerMs : (s.avgLatencyMs || 0);
    var rps = demo.requestsPerSec != null ? demo.requestsPerSec : (s.requestsPerSec || 0);

    var hr = $('hero-requests'); if (hr) hr.textContent = fmtNum(reqs);
    var hl = $('hero-latency'); if (hl) hl.textContent = avgMs.toFixed(2) + ' ms';
    var hu = $('hero-uptime'); if (hu) hu.textContent = fmtUptime(s.uptime);
    var a = $('met-srv-reqs'); if (a) a.textContent = fmtNum(reqs);
    var b = $('met-srv-rps'); if (b) b.textContent = rps.toFixed(1) + '/s';
    var c = $('met-srv-lat'); if (c) c.textContent = avgMs.toFixed(2) + ' ms';
    var d = $('met-srv-tcp'); if (d) d.textContent = fmtNum(s.connections);
    var e = $('met-protocol');
    if (e) {
      var cc = pickConnected();
      if (cc) {
        var v = cc.getProtocolVersion();
        e.textContent = 'AL/' + v + (v === 2 ? ' · 16 B' : ' · 10 B');
      }
    }
    var f = $('met-srv-uptime'); if (f) f.textContent = fmtUptime(s.uptime);
    setNavStatus('online', 'server online');
  }
  function pollStats() {
    var c = pickConnected();
    if (!c) { updatePageMetrics(); return; }
    c.request('demo.stats', {}).then(renderServerStats).catch(function () { /* ignore */ });
  }

  // ── wiring ────────────────────────────────────────────────────────────────
  (function initPlayground() {
    if (!$('chat-window')) return;

    ['alice', 'bob'].forEach(function (user) {
      $('send-' + user).addEventListener('click', function () {
        var input = $('input-' + user);
        sendMessage(user, input.value);
        input.value = '';
      });
      $('input-' + user).addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') {
          sendMessage(user, ev.currentTarget.value);
          ev.currentTarget.value = '';
        }
      });
    });
    document.querySelectorAll('[data-hi]').forEach(function (btn) {
      btn.addEventListener('click', function () { sayHi(btn.dataset.hi); });
    });
    document.querySelectorAll('[data-drop]').forEach(function (btn) {
      btn.addEventListener('click', function () { dropSocket(btn.dataset.drop); });
    });

    $('btn-reply').addEventListener('click', simulateReply);
    $('btn-push').addEventListener('click', serverPush);
    $('btn-burst').addEventListener('click', burst);
    $('btn-validate').addEventListener('click', schemaBreak);
    $('btn-boom').addEventListener('click', boomRoute);
    $('btn-clear-log').addEventListener('click', function () {
      var w = $('log-window');
      if (w) w.innerHTML = '';
    });

    msgSys('Welcome! Connecting Alice and Bob to ' + WS_URL + ' …');

    setTimeout(function () {
      connectClient('alice').catch(function () {});
      connectClient('bob').catch(function () {});
    }, 250);

    setInterval(pollStats, 3000);
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // benchmark
  // ──────────────────────────────────────────────────────────────────────────
  (function initBenchmark() {
    var btn = $('bench-run');
    if (!btn) return;

    btn.addEventListener('click', function () {
      var c = users.alice.client;
      if (!c || !c.isConnected()) {
        var note = $('bench-note');
        if (note) note.textContent = 'Alice is not connected yet — she must hold a live session for the benchmark.';
        return;
      }
      var N = 200;
      btn.disabled = true;
      var bar = $('bench-bar');
      var lat = [];
      var t0 = performance.now();
      if (bar) bar.style.width = '0%';

      function step(i) {
        if (i >= N) return Promise.resolve();
        var s = performance.now();
        return c.request('demo.echo', { i: i, payload: 'x'.repeat(32) }).then(function () {
          lat.push(performance.now() - s);
          if (bar) bar.style.width = Math.round(((i + 1) / N) * 100) + '%';
          return step(i + 1);
        });
      }

      step(0).then(function () {
        var total = performance.now() - t0;
        var sorted = lat.slice().sort(function (a, b) { return a - b; });
        var avg = lat.reduce(function (a, b) { return a + b; }, 0) / lat.length;
        var p50 = sorted[Math.floor(lat.length * 0.5)];
        var p95 = sorted[Math.floor(lat.length * 0.95)];
        var tput = Math.round(N / (total / 1000));

        $('bench-avg').textContent = avg.toFixed(3) + ' ms';
        $('bench-p50').textContent = p50.toFixed(3) + ' ms';
        $('bench-p95').textContent = p95.toFixed(3) + ' ms';
        $('bench-tput').textContent = fmtNum(tput) + ' msg/s';

        $('bench-note').textContent =
          'Measured live: ' + N + ' sequential demo.echo requests in ' + fmtMs(total) + ' — ' +
          'browser → WebSocket bridge → router → handler → back. Localhost flatters every protocol; ' +
          'the interesting part is the shape: a fixed 16-byte header and zero per-message JSON overhead.';

        log('sys', 'BENCH', N + ' sequential echo → ' + fmtNum(tput) + ' msg/s · avg ' + avg.toFixed(3) + ' ms · p95 ' + p95.toFixed(3) + ' ms');
        msgSys('📊 Benchmark finished: ' + fmtNum(tput) + ' msg/s · avg ' + avg.toFixed(3) + ' ms · p50 ' + p50.toFixed(3) + ' ms · p95 ' + p95.toFixed(3) + ' ms');
        btn.disabled = false;
      }).catch(function (err) {
        btn.disabled = false;
        var note = $('bench-note');
        if (note) note.textContent = 'Benchmark aborted: ' + err.message;
      });
    });
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // code tabs
  // ──────────────────────────────────────────────────────────────────────────
  (function initTabs() {
    var tabs = $('code-tabs');
    if (!tabs) return;
    tabs.querySelectorAll('.tab-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        tabs.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('on'); });
        btn.classList.add('on');
        document.querySelectorAll('.code-wrap[data-code]').forEach(function (w) {
          w.hidden = w.dataset.code !== btn.dataset.tab;
        });
      });
    });
  })();

  // ──────────────────────────────────────────────────────────────────────────
  // smoke mode: ?smoke=1 → drive a scripted round trip, publish the result
  // into #smoke so a headless browser can assert on it.
  // ──────────────────────────────────────────────────────────────────────────
  (function initSmoke() {
    if (!new URLSearchParams(location.search).has('smoke')) return;
    var smoke = $('smoke');
    if (smoke) smoke.hidden = false;

    function report(ok, msg) {
      var text = (ok ? 'SMOKE_PASS ' : 'SMOKE_FAIL ') + msg;
      if (smoke) { smoke.textContent = text; smoke.dataset.status = ok ? 'pass' : 'fail'; }
      log(ok ? 'rx' : 'err', 'SMOKE', text);
    }

    async function run() {
      try {
        await waitFor(function () {
          return users.alice.client && users.alice.client.isConnected() &&
                 users.bob.client && users.bob.client.isConnected();
        }, 12000, 'both clients connected');

        var alice = users.alice.client;
        var bob = users.bob.client;

        var t0 = performance.now();
        var echo = await alice.request('demo.echo', { smoke: true });
        var rtt = performance.now() - t0;
        if (!echo || !echo.echoed || echo.echoed.smoke !== true) throw new Error('demo.echo payload mismatch');

        var marker = 'smoke-' + Date.now();
        var delivered = false;
        await bob.subscribe('chat.lobby', function (m) {
          if (m && m.text === marker) delivered = true;
        });
        await alice.request('chat.send', { user: 'alice', text: marker });
        await waitFor(function () { return delivered; }, 8000, 'chat.lobby delivery to Bob');

        report(true,
          'alice=v' + alice.getProtocolVersion() +
          ' bob=v' + bob.getProtocolVersion() +
          ' rtt=' + rtt.toFixed(2) + 'ms chat_delivered=true');
      } catch (err) {
        report(false, err.message);
      }
    }

    setTimeout(run, 600);
  })();
})();

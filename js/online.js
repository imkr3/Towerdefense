/* =======================================================================
 *  막대 왕국 전쟁 - 온라인 2인 (5.21): 대전 · 협동
 *
 *  서버 없이 공개 MQTT 중계(WebSocket)에서 방 코드로 만나고, 두 기기가 같은 씨앗 ·
 *  같은 입력으로 같은 판을 돌린다(락스텝). 오가는 것은 '몇 번째 턴에 누가 무엇을 냈나' 뿐이다.
 *  가끔 기기마다 소수점 끝자리가 달라 판이 어긋나면 방을 연 쪽(호스트)의 판을 통째로 보내 다시 맞춘다.
 *
 *   1. 씨앗 난수 · 락스텝 (MpLock)
 *   2. 판 사진 (MpSnap) — 다시 맞출 때
 *   3. MQTT 중계 (MpLink · MpNet)
 *   4. 대기실 · 전투 연결 (Online)
 * ======================================================================= */

const MP_TICK = 1 / 30, MP_TICKS = 3, MP_TURN = MP_TICK * MP_TICKS;   // 한 턴 = 3틱 = 0.1초
const MP_DELAY = 6;          // 낸 입력은 6턴(0.6초) 뒤에 들어간다 — 그동안 상대에게 건너간다
const MP_HASH_EVERY = 30;    // 3초마다 두 판의 지문을 견준다
const MP_KEEP = 600;         // 지난 입력을 이만큼(60초) 들고 있는다 — 다시 맞춘 판을 되감아 따라잡을 때
const MP_SEND_WINDOW = MP_DELAY * 2 + 2;   // 보낼 때마다 최근 입력을 이만큼 함께 (하나쯤 잃어도 다음 것에 실려 간다)

/* ---------------------------------------------------------------------
 * 1. 씨앗 난수 · 락스텝
 * ------------------------------------------------------------------- */
function mpRng(seed) {
  let a = seed >>> 0;
  const f = function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  f.get = () => a;
  f.set = v => { a = v | 0; };
  return f;
}
/* 엔진을 돌리는 동안만 Math.random 을 판의 난수로 (그리기 · 소리는 제 난수를 그대로 쓴다) */
function mpSeeded(rng, fn) {
  const keep = Math.random;
  Math.random = rng;
  try { return fn(); } finally { Math.random = keep; }
}
/* 입력 한 개가 멀쩡한가 (중계에서 온 것은 아무것도 믿지 않는다) */
function mpValidAct(a) {
  if (!a || typeof a !== 'object') return false;
  if (a.k === 'c' || a.k === 'q') return true;
  return (a.k === 'd' || a.k === 'h') && typeof a.id === 'string' && a.id.length < 40;
}

/* 두 기기가 같은 판을 같은 걸음으로: 턴마다 두 사람의 입력이 다 와야 그 턴을 돈다 */
class MpLock {
  constructor(battle, pl, seed, send) {
    this.b = battle;
    this.pl = pl;                  // 이 기기의 사람 (0 = 방을 연 쪽)
    this.rng = mpRng(seed);
    this.send = send || (() => {});
    this.turn = 0;                 // 다음에 돌 턴
    this.acc = 0;
    this.ins = [new Map(), new Map()];
    for (let t = 0; t < MP_DELAY; t++) { this.ins[0].set(t, []); this.ins[1].set(t, []); }
    this.mine = this.ins[pl];
    this.queue = [];               // 이번에 낸 것 (다음에 닫는 턴에 실린다)
    this.closed = MP_DELAY - 1;    // 내 입력을 정해 둔 마지막 턴
    this.hashes = [new Map(), new Map()];
    this.stall = 0;                // 상대 입력을 기다린 시간
    this.heard = 0;                // 상대 소식이 끊긴 시간
    this.desync = 0;               // 어긋남을 본 횟수
    this.adopted = 0;              // 판 사진으로 다시 맞춘 횟수
    this.onDesync = null;
    this.ended = false;
  }
  /* 버튼 · 자동 출진이 내는 것 */
  input(a) { if (mpValidAct(a) && this.queue.length < 12) this.queue.push(a); }
  pendingOf(k, id) { return this.queue.some(a => a.k === k && a.id === id); }
  /* 상대에게서 온 것 */
  receive(m) {
    this.heard = 0;
    const r = 1 - this.pl;
    if (m.t === 'in' && Number.isInteger(m.s) && Array.isArray(m.a)) {
      for (let i = 0; i < m.a.length && i < 40; i++) {
        const t = m.s + i, list = m.a[i];
        if (t < this.turn - MP_KEEP || this.ins[r].has(t) || !Array.isArray(list)) continue;
        this.ins[r].set(t, list.filter(mpValidAct).slice(0, 12));
      }
    } else if (m.t === 'h' && Number.isInteger(m.n)) {
      this.hashes[r].set(m.n, m.h >>> 0);
      this.checkHash(m.n);
    }
  }
  /* 화면 한 프레임: 쌓인 시간만큼 턴을 돈다 (뒤처졌으면 몇 턴씩 따라잡는다) */
  frame(dt) {
    if (this.ended) return;
    this.heard += dt;
    this.acc = Math.min(this.acc + dt, MP_TURN * 12);
    let n = 0, waited = false;
    while (this.acc >= MP_TURN && n < 10) {
      const a0 = this.ins[0].get(this.turn), a1 = this.ins[1].get(this.turn);
      if (!a0 || !a1) { waited = true; break; }
      this.step(a0, a1);
      this.acc -= MP_TURN; n++;
      if (this.b.state !== 'play') { this.ended = true; break; }
    }
    this.stall = waited ? this.stall + dt : 0;
    // 기다리는 동안엔 내 입력을 0.25초마다 다시 보낸다 (중계가 하나 흘렸어도 서로 기다리기만 하지 않게)
    this.resendT = (this.resendT || 0) - dt;
    const force = waited && this.resendT <= 0;
    if (force) this.resendT = 0.25;
    this.closeMine(force);
  }
  step(a0, a1) {
    const b = this.b, t = this.turn;
    mpSeeded(this.rng, () => {
      for (const a of a0) b.mpAct(0, a);
      for (const a of a1) b.mpAct(1, a);
      for (let k = 0; k < MP_TICKS; k++) b.mpStep(MP_TICK);
    });
    if (this.trace) this.trace.push(b.mpHash());   // 시험용: 턴마다 지문
    if (t % MP_HASH_EVERY === 0 && t > 0) {
      const h = b.mpHash();
      this.hashes[this.pl].set(t, h);
      this.send({ t: 'h', n: t, h: h });
      this.checkHash(t);
    }
    this.turn = t + 1;
    this.ins[0].delete(t - MP_KEEP); this.ins[1].delete(t - MP_KEEP);
    this.hashes[0].delete(t - MP_KEEP); this.hashes[1].delete(t - MP_KEEP);
  }
  /* 내 입력은 지금 턴 + MP_DELAY 까지 정해 두고, 최근 것을 함께 보낸다 */
  closeMine(force) {
    const upto = this.turn + MP_DELAY - 1;
    let changed = false;
    while (this.closed < upto) {
      this.closed++;
      this.mine.set(this.closed, this.closed === upto ? this.queue.splice(0) : []);
      changed = true;
    }
    if (changed || force) {
      const s = Math.max(0, this.closed - MP_SEND_WINDOW + 1), a = [];
      for (let t = s; t <= this.closed; t++) a.push(this.mine.get(t) || []);
      this.send({ t: 'in', s: s, a: a });
    }
  }
  checkHash(n) {
    const a = this.hashes[0].get(n), b = this.hashes[1].get(n);
    if (a === undefined || b === undefined || a === b) return;
    this.desync++;
    if (this.onDesync) this.onDesync(n);
  }
  /* 호스트의 판 사진으로 갈아 끼운다 (그 뒤 입력은 들고 있으니 되감아 따라잡는다) */
  adopt(battle, turn, rngState) {
    this.b = battle;
    this.turn = turn;
    this.rng.set(rngState);
    this.ended = battle.state !== 'play';
    this.hashes[0].clear(); this.hashes[1].clear();
    this.acc = Math.min(this.acc, MP_TURN * 12);
    this.adopted++;
  }
}

/* ---------------------------------------------------------------------
 * 2. 판 사진: 판 전체(병사 · 탄 · 이펙트 · 지갑 · 난수)를 글로 옮겼다 되살린다.
 *    병종 · 적 · 전장 자료처럼 두 기기에 똑같이 있는 것은 이름(경로)만 적는다.
 * ------------------------------------------------------------------- */
const MpSnap = {
  _idx: null,
  roots() {
    return { U: UNIT_BY_ID, E: ENEMIES, S: STAGES, V: EVENT_STAGES, X: typeof EXPEDITIONS !== 'undefined' ? EXPEDITIONS : [],
             E1: EVOLUTIONS, E2: EVOLUTIONS2, E3: EVOLUTIONS3, C: COMMAND, M: MP };
  },
  index() {
    if (this._idx) return this._idx;
    const idx = new Map(), roots = this.roots();
    const walk = (o, p, d) => {
      if (!o || typeof o !== 'object' || idx.has(o) || d > 10) return;
      idx.set(o, p);
      for (const k of Object.keys(o)) walk(o[k], p + '|' + k, d + 1);
    };
    for (const r in roots) walk(roots[r], r, 0);
    return (this._idx = idx);
  },
  /* 병종 레벨 · 진화 형태별로 만들어 둔 능력치 (기기마다 생긴 때가 달라 사진을 찍을 때마다 새로 본다) */
  resolvedIndex(idx) {
    const m = new Map();
    for (const key of Object.keys(_resolved)) {
      const walk = (o, p, d) => {
        if (!o || typeof o !== 'object' || idx.has(o) || m.has(o) || d > 6) return;
        m.set(o, p);
        for (const k of Object.keys(o)) walk(o[k], p + '|' + k, d + 1);
      };
      walk(_resolved[key], 'R|' + key, 0);
    }
    return m;
  },
  at(path) {
    const parts = path.split('|');
    let o;
    if (parts[0] === 'R') {
      // R|id|레벨|형태|... — 이 기기에 아직 없으면 같은 규칙으로 만든다
      const key = parts[1] + '|' + parts[2] + '|' + parts[3];
      if (!_resolved[key] && UNIT_BY_ID[parts[1]]) { const f = +parts[3]; resolveUnit(UNIT_BY_ID[parts[1]], +parts[2], f === 3 ? 3 : f === 2 ? 2 : f === 1); }
      o = _resolved[key];
      for (let i = 4; i < parts.length && o; i++) o = o[parts[i]];
      return o;
    }
    o = this.roots()[parts[0]];
    for (let i = 1; i < parts.length && o; i++) o = o[parts[i]];
    return o;
  },
  encode(root) {
    const idx = this.index(), res = this.resolvedIndex(idx);
    const seen = new Map(), objs = [];
    const SKIP = { online: 1 };
    const enc = v => {
      if (v === null) return null;
      const t = typeof v;
      if (t === 'number') return Number.isFinite(v) ? (v === 0 && 1 / v < 0 ? { $: 'z' } : v) : { $: 'n', v: String(v) };
      if (t === 'string' || t === 'boolean') return v;
      if (t !== 'object') return { $: 'u' };
      const g = idx.get(v) || res.get(v);
      if (g !== undefined) return { $: 'g', p: g };
      let id = seen.get(v);
      if (id === undefined) {
        id = objs.length; seen.set(v, id); objs.push(null);
        let body;
        if (Array.isArray(v)) body = { a: v.map(enc) };
        else {
          const o = {};
          for (const k of Object.keys(v)) if (!SKIP[k]) o[k] = enc(v[k]);
          body = { o: o };
          if (v instanceof Fighter) body.c = 'F'; else if (v instanceof Castle) body.c = 'C'; else if (v instanceof Battle) body.c = 'B';
        }
        objs[id] = body;
      }
      return { $: 'r', i: id };
    };
    const r = enc(root);
    return { v: 1, root: r, objs: objs };
  },
  decode(data) {
    const shells = data.objs.map(b => b.a ? [] : b.c === 'F' ? Object.create(Fighter.prototype)
      : b.c === 'C' ? Object.create(Castle.prototype) : b.c === 'B' ? Object.create(Battle.prototype) : {});
    const dec = v => {
      if (v === null || typeof v !== 'object') return v;
      if (v.$ === 'r') return shells[v.i];
      if (v.$ === 'g') return this.at(v.p);
      if (v.$ === 'n') return Number(v.v);
      if (v.$ === 'z') return -0;
      return undefined;
    };
    data.objs.forEach((b, i) => {
      const s = shells[i];
      if (b.a) for (let j = 0; j < b.a.length; j++) s[j] = dec(b.a[j]);
      else for (const k in b.o) s[k] = dec(b.o[k]);
    });
    return dec(data.root);
  }
};

/* 판을 새로 만든다 (두 기기가 똑같이) */
function mpMakeBattle(cfg) {
  const pvp = cfg.mode === 'pvp';
  const s0 = mpSave(cfg.p[0], pvp), s1 = mpSave(cfg.p[1], pvp);
  const rng = mpRng(cfg.seed ^ 0x5bd1e995);
  return mpSeeded(rng, () => pvp
    ? new Battle(0, s0, pvpStage(cfg.look), { mp: { mode: 'pvp', save2: s1 } })
    : new Battle(cfg.stage | 0, s0, null, { mp: { mode: 'coop', save2: s1 } }));
}

/* ---------------------------------------------------------------------
 * 3. MQTT 중계: 공개 브로커 여럿에 WebSocket 으로 붙어 같은 방 이름(토픽)으로 주고받는다.
 *    붙을 수 있는 브로커 모두에 보내고, 먼저 온 것을 쓴다 (같은 것은 번호로 걸러 낸다).
 *    MQTT 3.1.1 의 꼭 필요한 부분만: CONNECT · SUBSCRIBE · PUBLISH(QoS 0) · PING.
 * ------------------------------------------------------------------- */
const MP_BROKERS = [
  'wss://broker.emqx.io:8084/mqtt',
  'wss://broker.hivemq.com:8884/mqtt',
  'wss://test.mosquitto.org:8081/mqtt'
];
const MP_TOPIC = 'stickkingdomwar/v1/';
function mpBrokers() {
  try { const o = JSON.parse(localStorage.getItem('stick-kingdom-mp-brokers') || 'null'); if (Array.isArray(o) && o.length) return o; } catch (e) { /* 기본 */ }
  return MP_BROKERS;
}
const _mpEnc = typeof TextEncoder !== 'undefined' ? new TextEncoder() : null;
const _mpDec = typeof TextDecoder !== 'undefined' ? new TextDecoder() : null;
function mqStr(s) { const b = _mpEnc.encode(s); return [b.length >> 8, b.length & 255, ...b]; }
function mqPacket(head, body) {
  const len = []; let n = body.length;
  do { let d = n % 128; n = Math.floor(n / 128); if (n > 0) d |= 128; len.push(d); } while (n > 0);
  return new Uint8Array([head, ...len, ...body]);
}
class MpLink {
  constructor(url, onMsg, onState) {
    this.url = url; this.onMsg = onMsg; this.onState = onState;
    this.ok = false; this.closed = false; this.subs = []; this.pid = 1; this.buf = new Uint8Array(0);
    this.id = 'skw' + Math.random().toString(36).slice(2, 12);
    this.open();
  }
  open() {
    if (this.closed) return;
    let ws;
    try { ws = new WebSocket(this.url, ['mqtt']); } catch (e) { this.fail(); return; }
    this.ws = ws; ws.binaryType = 'arraybuffer';
    this.timer = setTimeout(() => { if (!this.ok) { try { ws.close(); } catch (e) { /* 이미 닫힘 */ } } }, 8000);
    ws.onopen = () => {
      const body = [...mqStr('MQTT'), 4, 0x02, 0, 45, ...mqStr(this.id)];     // 깨끗한 세션 · 45초 유지
      this.raw(mqPacket(0x10, body));
    };
    ws.onmessage = ev => this.feed(new Uint8Array(ev.data));
    ws.onclose = ws.onerror = () => this.fail();
  }
  fail() {
    const was = this.ok;
    this.ok = false; clearTimeout(this.timer); clearInterval(this.ping);
    if (this.ws) { this.ws.onclose = this.ws.onerror = this.ws.onmessage = null; try { this.ws.close(); } catch (e) { /* 이미 닫힘 */ } this.ws = null; }
    if (was && this.onState) this.onState(this);
    if (!this.closed) { clearTimeout(this.retry); this.retry = setTimeout(() => this.open(), 3000 + Math.random() * 2000); }
  }
  raw(bytes) { if (this.ws && this.ws.readyState === 1) this.ws.send(bytes); }
  feed(chunk) {
    const b = new Uint8Array(this.buf.length + chunk.length); b.set(this.buf); b.set(chunk, this.buf.length);
    let p = 0;
    for (;;) {
      if (b.length - p < 2) break;
      let len = 0, mul = 1, q = p + 1, d;
      do { if (q >= b.length) { q = -1; break; } d = b[q++]; len += (d & 127) * mul; mul *= 128; } while (d & 128);
      if (q < 0 || q + len > b.length) break;
      this.packet(b[p], b.subarray(q, q + len));
      p = q + len;
    }
    this.buf = b.slice(p);
  }
  packet(head, body) {
    const type = head >> 4;
    if (type === 2) {                                   // CONNACK
      if (body[1] !== 0) { this.fail(); return; }
      this.ok = true; clearTimeout(this.timer);
      this.ping = setInterval(() => this.raw(new Uint8Array([0xC0, 0])), 20000);
      for (const t of this.subs) this.sendSub(t);
      if (this.onState) this.onState(this);
    } else if (type === 3) {                            // PUBLISH
      const tl = (body[0] << 8) | body[1], topic = _mpDec.decode(body.subarray(2, 2 + tl));
      let o = 2 + tl;
      if ((head >> 1) & 3) o += 2;                      // QoS 1/2 면 번호가 붙는다 (우리는 0 만 구독)
      this.onMsg(topic, _mpDec.decode(body.subarray(o)));
    }
  }
  sendSub(topic) { const id = this.pid++ & 0xffff || 1; this.raw(mqPacket(0x82, [id >> 8, id & 255, ...mqStr(topic), 0])); }
  subscribe(topic) { if (!this.subs.includes(topic)) this.subs.push(topic); if (this.ok) this.sendSub(topic); }
  publish(topic, text) { if (this.ok) this.raw(mqPacket(0x30, [...mqStr(topic), ..._mpEnc.encode(text)])); }
  close() {
    this.closed = true; clearTimeout(this.retry);
    if (this.ok) this.raw(new Uint8Array([0xE0, 0]));
    this.fail();
  }
}
/* 방 하나: 내 우편함(inbox)을 구독하고 상대 우편함으로 보낸다 */
class MpNet {
  constructor(room, me, peer, onMsg, onState) {
    this.inbox = MP_TOPIC + room + '/' + me; this.outbox = MP_TOPIC + room + '/' + peer;
    this.onMsg = onMsg; this.onState = onState || (() => {});
    this.sid = Math.random().toString(36).slice(2, 10); this.seq = 0;
    this.seen = new Map();                              // 보낸이 → 받은 번호들 (여러 중계에서 같은 것이 온다)
    this.links = mpBrokers().map(u => new MpLink(u, (t, s) => this.got(t, s), () => this.onState(this.live())));
    for (const l of this.links) l.subscribe(this.inbox);
  }
  live() { return this.links.filter(l => l.ok).length; }
  send(m) {
    const text = JSON.stringify({ f: this.sid, q: ++this.seq, m: m });
    for (const l of this.links) l.publish(this.outbox, text);
  }
  got(topic, text) {
    if (topic !== this.inbox || text.length > 300000) return;
    let o; try { o = JSON.parse(text); } catch (e) { return; }
    if (!o || typeof o.f !== 'string' || !Number.isInteger(o.q) || !o.m || typeof o.m !== 'object') return;
    let s = this.seen.get(o.f);
    if (!s) { s = new Set(); this.seen.set(o.f, s); if (this.seen.size > 8) this.seen.delete(this.seen.keys().next().value); }
    if (s.has(o.q)) return;
    s.add(o.q); if (s.size > 4000) { const it = s.values(); for (let i = 0; i < 2000; i++) s.delete(it.next().value); }
    this.onMsg(o.m, o.f);
  }
  close() { for (const l of this.links) l.close(); }
}

/* ---------------------------------------------------------------------
 * 4. 대기실 · 전투 연결
 * ------------------------------------------------------------------- */
const MP_CODE_ABC = 'ACDEFHJKLMNPRTUVWXY3479';     // 헷갈리는 글자(0 O 1 I B 8 S 5 G 6 2 Z Q)는 뺐다
const MP_LOOKS = ['meadow', 'wheat', 'river', 'forest', 'hills', 'desert', 'snow', 'fortress', 'canyon', 'shore'];
const MP_PVP_REWARD = { win: 200, lose: 60, draw: 100, minTime: 60 };   // 1분 안에 끝난 판은 금화 없음

/* 내 편성 · 진행 (상대에게 보낸다) */
function mpInfo(s, name) {
  const deck = (s.loadout || []).slice(0, LOADOUT_MAX);
  const pick = o => { const r = {}; for (const id of deck) if (o && typeof o[id] === 'boolean') r[id] = o[id]; return r; };
  const lv = {}; for (const id of deck) lv[id] = (s.levels && s.levels[id]) || 1;
  return { name: String(name || '').slice(0, 12), cleared: s.cleared | 0, loadout: deck, levels: lv, upgrades: Object.assign({}, s.upgrades || {}),
           evo: pick(s.evo), evo2: pick(s.evo2), evo3: pick(s.evo3) };
}
function mpCleanInfo(o) {
  if (!o || typeof o !== 'object') return null;
  const deck = [...new Set(Array.isArray(o.loadout) ? o.loadout : [])].filter(id => typeof id === 'string' && UNIT_BY_ID[id]).slice(0, LOADOUT_MAX);
  if (!deck.length) return null;
  return Object.assign({}, o, { name: String(o.name || '상대').replace(/[<>&]/g, '').slice(0, 12) || '상대', loadout: deck });
}

const Online = {
  state: 'idle',        // idle · wait(방 열고 기다림) · join(들어가는 중) · room · battle · over
  role: 0, code: '', net: null, peer: null, peerSid: null, cfg: null, lock: null,
  mode: 'pvp', stage: 0, links: 0, err: '',

  name() {
    let n = '';
    try { n = localStorage.getItem('stick-kingdom-mp-name') || ''; } catch (e) { /* 없음 */ }
    return n || (t('기사') + (100 + Math.floor(Math.random() * 900)));
  },
  setName(n) { try { localStorage.setItem('stick-kingdom-mp-name', String(n).slice(0, 12)); } catch (e) { /* 저장 못 함 */ } },
  me() { return mpInfo(save, $('#mp-name').value.trim() || this.name()); },

  open() {
    if (!$('#mp-name').value) $('#mp-name').value = this.name();
    this.render();
    $('#modal-online').classList.add('show');
  },
  /* 방 만들기 */
  host() {
    if (!this.checkDeck()) return;
    this.setName($('#mp-name').value.trim() || this.name());
    this.close(true);
    this.role = 0;
    this.code = Array.from({ length: 5 }, () => MP_CODE_ABC[Math.floor(Math.random() * MP_CODE_ABC.length)]).join('');
    this.state = 'wait'; this.peer = null; this.err = '';
    this.net = new MpNet(this.code, 'h', 'g', (m, from) => this.onMsg(m, from), n => { this.links = n; this.render(); });
    this.render();
  },
  /* 방 들어가기 */
  join(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 5) { toast('방 코드 다섯 글자를 넣어 주세요'); return; }
    if (!this.checkDeck()) return;
    this.setName($('#mp-name').value.trim() || this.name());
    this.close(true);
    this.role = 1; this.code = code; this.state = 'join'; this.peer = null; this.err = '';
    this.net = new MpNet(code, 'g', 'h', (m, from) => this.onMsg(m, from), n => { this.links = n; this.render(); });
    let tries = 0;
    clearInterval(this.helloT);
    this.helloT = setInterval(() => {
      if (this.state !== 'join') { clearInterval(this.helloT); return; }
      if (++tries > 25) { clearInterval(this.helloT); this.fail('방을 찾지 못했습니다. 코드를 확인하거나 방을 연 쪽이 기다리고 있는지 보세요.'); return; }
      this.net.send({ t: 'hello', v: APP_VERSION, me: this.me() });
    }, 1200);
    this.render();
  },
  checkDeck() {
    if (!save.loadout || !save.loadout.length) { toast('편성에 병종이 없습니다'); return false; }
    return true;
  },
  fail(msg) { this.err = msg; this.close(true); this.state = 'idle'; this.render(); toast(msg, 3000); },
  /* 연결을 닫는다 (quiet: 상대에게 알리지 않음) */
  close(quiet) {
    clearInterval(this.helloT);
    if (this.net) { if (!quiet) this.net.send({ t: 'bye' }); const n = this.net; setTimeout(() => n.close(), 300); }
    this.net = null; this.lock = null; this.peer = null; this.peerSid = null;
  },
  leave() {
    const inBattle = this.state === 'battle' || this.state === 'over';
    this.close(false);
    this.state = 'idle';
    this.render();
    if (inBattle && battle && battle.online) { battle.online = null; show('scr-title'); }
  },
  cfgFor() {
    return { mode: this.mode, stage: this.stage, look: this.look || 'meadow' };
  },

  onMsg(m, from) {
    const t = m.t;
    if (this.role === 0) {
      if (t === 'hello') {
        if (m.v !== APP_VERSION) { this.net.send({ t: 'bad', why: '판이 달라 함께할 수 없습니다 (방: ' + APP_VERSION + ' · 나: ' + String(m.v).slice(0, 12) + '). 같은 버전으로 맞춰 주세요.' }); return; }
        if (this.peerSid && this.peerSid !== from && this.state !== 'wait') { this.net.send({ t: 'full' }); return; }
        const info = mpCleanInfo(m.me);
        if (!info) return;
        const fresh = !this.peer;
        this.peer = info; this.peerSid = from;
        if (this.state === 'wait') this.state = 'room';
        this.net.send({ t: 'welcome', me: this.me(), room: this.cfgFor() });
        if (fresh) { toast(info.name + ' 님이 들어왔습니다'); SFX.ui(); }
        this.render();
        return;
      }
      if (t === 'bye' && from === this.peerSid) { this.peerLeft(); return; }
    } else {
      if (t === 'welcome' && (this.state === 'join' || this.state === 'room')) {
        const info = mpCleanInfo(m.me);
        if (!info) return;
        this.peer = info; this.peerSid = from;
        if (m.room) { this.mode = m.room.mode === 'coop' ? 'coop' : 'pvp'; this.stage = Math.max(0, Math.min(STAGES.length - 1, m.room.stage | 0)); }
        if (this.state === 'join') { this.state = 'room'; clearInterval(this.helloT); toast('방에 들어왔습니다'); SFX.ui(); }
        this.render();
        return;
      }
      if (t === 'room' && this.state === 'room' && m.room) { this.mode = m.room.mode === 'coop' ? 'coop' : 'pvp'; this.stage = Math.max(0, Math.min(STAGES.length - 1, m.room.stage | 0)); this.render(); return; }
      if (t === 'bad') { this.fail(String(m.why || '들어갈 수 없습니다').slice(0, 200)); return; }
      if (t === 'full') { this.fail('이미 두 사람이 있는 방입니다'); return; }
      if (t === 'go' && m.cfg && (this.state === 'room' || this.state === 'over')) { this.begin(m.cfg); return; }
      if (t === 'bye' && from === this.peerSid) { this.peerLeft(); return; }
      if (t === 'snap' && this.lock) { this.snapPart(m); return; }
    }
    if ((t === 'in' || t === 'h') && this.lock && from === this.peerSid) this.lock.receive(m);
    if (t === 'room-back' && this.state === 'over') { this.state = 'room'; this.render(); }
  },
  peerLeft() {
    toast((this.peer ? this.peer.name : '상대') + ' 님이 나갔습니다', 2600);
    if (this.state === 'battle') { this.endBattle('gone'); }
    this.peer = null; this.peerSid = null;
    if (this.state === 'room' || this.state === 'over') this.state = this.role === 0 ? 'wait' : 'idle';
    if (this.role === 1) this.close(true);
    this.render();
  },
  /* 호스트가 판 규칙을 바꿨다 */
  changed() {
    this.mode = $('#mp-mode .on') ? $('#mp-mode .on').dataset.v : this.mode;
    this.stage = +$('#mp-stage').value || 0;
    if (this.role === 0 && this.net && this.state === 'room') this.net.send({ t: 'room', room: this.cfgFor() });
    this.render();
  },
  /* 시작 (호스트) */
  start() {
    if (this.role !== 0 || !this.peer || (this.state !== 'room' && this.state !== 'over')) return;
    const cfg = { mode: this.mode, seed: (Math.random() * 0x7fffffff) | 0, stage: this.stage,
                  look: MP_LOOKS[Math.floor(Math.random() * MP_LOOKS.length)], p: [this.me(), this.peer] };
    this.net.send({ t: 'go', cfg: cfg });
    this.begin(cfg);
  },
  begin(cfg) {
    const p0 = mpCleanInfo(cfg.p && cfg.p[0]), p1 = mpCleanInfo(cfg.p && cfg.p[1]);
    if (!p0 || !p1) { toast('판을 열지 못했습니다'); return; }
    cfg = { mode: cfg.mode === 'coop' ? 'coop' : 'pvp', seed: cfg.seed | 0, stage: Math.max(0, Math.min(STAGES.length - 1, cfg.stage | 0)),
            look: MP_LOOKS.includes(cfg.look) ? cfg.look : 'meadow', p: [p0, p1] };
    this.cfg = cfg;
    let b;
    try { b = mpMakeBattle(cfg); } catch (e) { toast('판을 열지 못했습니다: ' + e.message, 3000); return; }
    this.lock = new MpLock(b, this.role, cfg.seed, m => this.net && this.net.send(m));
    this.lock.onDesync = n => this.onDesync(n);
    this.state = 'battle'; this.snapAt = 0; this.snapBuf = null; this.rewarded = false;
    $('#modal-online').classList.remove('show');
    b.online = this;
    battle = b;
    beginOnlineBattle(b, cfg, this.role, cfg.p[1 - this.role].name);
  },
  /* 화면 한 프레임 */
  frame(dt) {
    const L = this.lock;
    if (!L || this.state !== 'battle') return;
    L.frame(dt);
    if (L.b !== battle) { battle = L.b; battle.online = this; }
    if (L.heard > 20) { this.endBattle('lost'); return; }
    if (L.ended && battle.state !== 'play') this.endBattle(battle.state);
  },
  input(a) { if (this.lock && this.state === 'battle') this.lock.input(a); },
  pending(k, id) { return !!(this.lock && this.lock.pendingOf(k, id)); },
  status() {
    const L = this.lock;
    if (!L) return '';
    const who = this.peer ? this.peer.name : '상대';
    if (L.stall > 0.6) return '🌐 ' + who + ' 님을 기다리는 중… ' + Math.ceil(L.stall) + '초';
    return '🌐 ' + (this.cfg.mode === 'pvp' ? '대전 · vs ' : '협동 · 함께 ') + who + (this.links ? '' : ' · 중계 끊김');
  },
  /* 판이 어긋났다: 호스트의 판을 사진으로 보내 다시 맞춘다 */
  onDesync(n) {
    if (this.role !== 0 || !this.net || this.lock.snapsOff) return;
    const now = performance.now();
    if (now - (this.snapAt || 0) < 8000) return;
    this.snapAt = now;
    const L = this.lock;
    const text = JSON.stringify({ turn: L.turn, rng: L.rng.get(), snap: MpSnap.encode(L.b) });
    const id = Math.random().toString(36).slice(2, 8), size = 40000, n2 = Math.ceil(text.length / size);
    for (let i = 0; i < n2; i++) this.net.send({ t: 'snap', id: id, i: i, n: n2, d: text.slice(i * size, (i + 1) * size) });
  },
  snapPart(m) {
    if (!Number.isInteger(m.i) || !Number.isInteger(m.n) || m.n > 200 || typeof m.d !== 'string') return;
    if (!this.snapBuf || this.snapBuf.id !== m.id) this.snapBuf = { id: m.id, parts: new Array(m.n), got: 0 };
    const B = this.snapBuf;
    if (B.parts[m.i] !== undefined) return;
    B.parts[m.i] = m.d; B.got++;
    if (B.got < m.n) return;
    this.snapBuf = null;
    try {
      const o = JSON.parse(B.parts.join(''));
      const nb = MpSnap.decode(o.snap);
      nb.online = this;
      this.lock.adopt(nb, o.turn | 0, o.rng | 0);
      battle = nb;
      toast('판을 다시 맞췄습니다', 1400);
    } catch (e) { /* 다음 사진을 기다린다 */ }
  },
  /* 판이 끝났다: 보상 · 결과 */
  endBattle(kind) {
    if (this.state !== 'battle') return;
    this.state = 'over';
    const b = battle, pvp = this.cfg.mode === 'pvp', me = this.role;
    // 결과는 왼쪽(0번) 기준이다. 대전의 오른쪽 사람에겐 뒤집어 읽는다
    let res = kind === 'gone' || kind === 'lost' ? kind : b.state;
    if (pvp && me === 1 && (res === 'win' || res === 'lose')) res = res === 'win' ? 'lose' : 'win';
    let coins = 0;
    if (res === 'gone' && pvp && b.time > 20) res = 'win';            // 대전 중 상대가 나가면 이긴 것으로
    if (pvp) {
      coins = res === 'win' ? MP_PVP_REWARD.win : res === 'lose' ? MP_PVP_REWARD.lose : res === 'draw' ? MP_PVP_REWARD.draw : 0;
      if (b.time < MP_PVP_REWARD.minTime) coins = 0;                // 바로 항복해 주고받는 판으로 금화를 쌓지 못하게
    // 협동: 전장은 왼쪽 사람 자리에서 돌아 처치 금화가 0번 지갑에 함께 쌓인다 — 둘 다 그만큼 받는다
    } else if (res === 'win') coins = b.stage.reward + b.walletOf(0).coins;
    else if (res === 'lose') coins = Math.floor(b.walletOf(0).coins / 2);
    if (!this.rewarded) {
      this.rewarded = true;
      const st = save.stats;
      if (pvp) { st.pvpGames = (st.pvpGames || 0) + 1; if (res === 'win') st.pvpWins = (st.pvpWins || 0) + 1; }
      else { st.coopGames = (st.coopGames || 0) + 1; if (res === 'win') st.coopWins = (st.coopWins || 0) + 1; }
      save.coins += coins;
      saveGame(save);
    }
    this.result = { res: res, coins: coins };
    const ended = battle, peer = this.peer ? this.peer.name : '상대';
    setTimeout(() => { if (battle === ended && $('#scr-battle').classList.contains('active')) showOnlineResult(this.result, this.cfg, peer); }, kind === 'gone' || kind === 'lost' ? 200 : 900);
  },
  /* 결과 화면에서 '대기실로' */
  backToRoom() {
    if (!this.net || !this.peer) { this.leave(); show('scr-title'); return; }
    this.lock = null;
    this.state = 'room';
    this.net.send({ t: 'room-back' });
    show('scr-title');
    this.open();
  },

  /* ---------- 대기실 그리기 ---------- */
  render() {
    const home = $('#mp-home'), room = $('#mp-room');
    if (!home) return;
    const inRoom = this.state === 'wait' || this.state === 'join' || this.state === 'room' || this.state === 'over';
    home.hidden = inRoom; room.hidden = !inRoom;
    $$('#mp-mode button').forEach(b => b.classList.toggle('on', b.dataset.v === this.mode));
    $('#mp-stage-row').hidden = this.mode !== 'coop';
    const rule = this.mode === 'pvp'
      ? '⚔ 대전: 왼쪽이 나, 오른쪽이 상대 요새. 레벨은 모두 ' + MP.pvp.level + ' · 강화는 빼고 겨룹니다 (진화 형태는 내가 가진 대로). 성채 궁수 · 범위/공성 피해 감소 · ' + Math.round(MP.pvp.overtime / 60) + '분 뒤엔 두 성채가 함께 무너집니다.'
      : '🤝 협동: 둘이 같은 성채를 지킵니다. 군자금 · 카드 · 왕명은 따로. 적이 ×' + MP.coop.enemyMul + ' 단단하고 요새가 ×' + MP.coop.fortMul + ' 두껍습니다. 내 레벨 · 강화 그대로.';
    $('#mp-rule').textContent = rule;
    $('#mp-room-rule').textContent = rule + (this.mode === 'coop' ? ' 전장: ' + (this.stage + 1) + '. ' + STAGES[this.stage].name : '');
    if (!inRoom) return;
    $('#mp-code-show').textContent = this.code;
    const live = this.links, nb = mpBrokers().length;
    const st = this.state === 'wait' ? '상대를 기다리는 중 · 방 코드를 알려 주세요'
      : this.state === 'join' ? '방을 찾는 중…'
      : this.state === 'over' ? '대기실'
      : this.role === 0 ? '준비 완료 · 시작을 누르세요' : '방을 연 쪽이 시작하길 기다리는 중';
    $('#mp-status').textContent = st + ' · 중계 ' + live + '/' + nb + (live ? '' : ' (연결 중)');
    const me = this.me(), card = (p, tag) => {
      if (!p) return '<div class="mp-pl empty"><b>빈 자리</b><span>' + tag + '</span></div>';
      const heroes = p.loadout.filter(id => isHeroUnit(UNIT_BY_ID[id])).map(id => UNIT_BY_ID[id].name);
      return '<div class="mp-pl"><b></b><span>' + tag + ' · 병종 ' + p.loadout.length + '</span><em>' + (heroes.length ? '★ ' + heroes.join(' · ') : '영웅 없음') + '</em></div>';
    };
    const box = $('#mp-players');
    const left = this.role === 0 ? me : this.peer, right = this.role === 0 ? this.peer : me;
    box.innerHTML = card(left, this.mode === 'pvp' ? '왼쪽 · 방장' : '방장') + '<div class="mp-vs">' + (this.mode === 'pvp' ? 'VS' : '&') + '</div>' + card(right, this.mode === 'pvp' ? '오른쪽' : '손님');
    const names = box.querySelectorAll('.mp-pl b');
    if (left && names[0]) names[0].textContent = left.name;
    if (right && names[names.length - 1] && right) names[names.length - 1].textContent = right.name;
    $('#mp-start').hidden = this.role !== 0;
    $('#mp-start').disabled = !this.peer;
    $('#mp-room-mode').hidden = this.role !== 0;
  }
};

/* 대기실 단추 */
function initOnline() {
  if (!$('#modal-online')) return;
  $('#btn-online').addEventListener('click', () => { SFX.ui(); Online.open(); });
  $$('#mp-mode button').forEach(b => b.addEventListener('click', () => { $$('#mp-mode button').forEach(x => x.classList.toggle('on', x === b)); Online.changed(); SFX.ui(); }));
  $$('#mp-room-mode button').forEach(b => b.addEventListener('click', () => {
    if (Online.role !== 0) return;
    Online.mode = b.dataset.v; $$('#mp-mode button').forEach(x => x.classList.toggle('on', x.dataset.v === Online.mode)); Online.changed(); SFX.ui();
  }));
  const sel = $('#mp-stage');
  sel.innerHTML = '';
  const fill = () => {
    sel.innerHTML = '';
    const top = Math.min(STAGES.length - 1, save.cleared);
    for (let i = 0; i <= top; i++) { const o = document.createElement('option'); o.value = i; o.textContent = (i + 1) + '. ' + STAGES[i].name; sel.appendChild(o); }
    sel.value = Math.min(Online.stage, top);
  };
  fill();
  $('#btn-online').addEventListener('click', fill);
  sel.addEventListener('change', () => Online.changed());
  $('#mp-host').addEventListener('click', () => { SFX.ui(); Online.host(); });
  $('#mp-join').addEventListener('click', () => { SFX.ui(); Online.join($('#mp-code').value); });
  $('#mp-code').addEventListener('keydown', e => { if (e.key === 'Enter') Online.join($('#mp-code').value); });
  $('#mp-leave').addEventListener('click', () => { SFX.ui(); Online.leave(); });
  $('#mp-start').addEventListener('click', () => { SFX.ui(); Online.start(); });
  $('#mp-copy').addEventListener('click', () => {
    const c = Online.code;
    try { navigator.clipboard.writeText(c).then(() => toast('방 코드 ' + c + ' 를 복사했습니다'), () => toast('방 코드: ' + c)); } catch (e) { toast('방 코드: ' + c); }
  });
}

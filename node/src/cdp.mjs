// Cliente CDP minimo sobre --remote-debugging-pipe: Chrome lee comandos por
// su fd 3 y escribe respuestas/eventos por su fd 4, como mensajes JSON UTF-8
// delimitados por un byte NUL. Sin WebSocket ni HTTP ni puerto TCP. Cero deps.
const CALL_TIMEOUT_MS = 30000;

export class CdpPipe {
  constructor(proc) {
    this.proc = proc;
    this._id = 0;
    this.pending = new Map();
    this._buf = Buffer.alloc(0);
    this.closed = false;
    this.in = proc.stdio[3];  // writable: comandos hacia Chrome
    this.out = proc.stdio[4]; // readable: respuestas y eventos desde Chrome
    this.in.on('error', () => {}); // el navegador muerto ya se reporta por 'exit'
    this.out.on('data', (chunk) => this._onData(chunk));
    this.out.on('error', () => this._fail(new Error('pipe CDP roto')));
    this.out.on('end', () => this._fail(new Error('pipe CDP cerrado')));
    proc.on('exit', () => this._fail(new Error('el navegador murio')));
  }

  _onData(chunk) {
    this._buf = Buffer.concat([this._buf, chunk]);
    for (let i; (i = this._buf.indexOf(0)) !== -1;) {
      const raw = this._buf.subarray(0, i).toString('utf8');
      this._buf = this._buf.subarray(i + 1);
      let d;
      try { d = JSON.parse(raw); } catch { continue; }
      const p = d.id && this.pending.get(d.id);
      if (p) { this.pending.delete(d.id); clearTimeout(p.timer); p.resolve(d); }
    }
  }

  _fail(err) {
    if (this.closed) return;
    this.closed = true;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(err); }
    this.pending.clear();
  }

  send(method, params = {}, sessionId = null, timeoutMs = CALL_TIMEOUT_MS) {
    if (this.closed) return Promise.reject(new Error('pipe CDP cerrado'));
    const id = ++this._id;
    const msg = { id, method, params };
    if (sessionId) msg.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.in.write(JSON.stringify(msg) + '\0');
    }).then((res) => {
      if (res.error) throw new Error(`CDP ${method}: ${res.error.message}`);
      return res;
    });
  }

  close() {
    this._fail(new Error('pipe CDP cerrado'));
    try { this.in.destroy(); } catch {}
    try { this.out.destroy(); } catch {}
  }
}

// Readiness: el navegador tarda un momento en atender el pipe; se reintenta
// Browser.getVersion hasta que responda o se agote el plazo.
export async function waitReady(pipe, ms = 10000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { await pipe.send('Browser.getVersion', {}, null, 1500); return true; } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

// Abre una pestaña y la adjunta aplanada: desde entonces los comandos de
// pagina viajan con el sessionId de nivel superior por el mismo pipe.
export async function openPage(pipe, url) {
  const { result: { targetId } } = await pipe.send('Target.createTarget', { url });
  const { result: { sessionId } } = await pipe.send('Target.attachToTarget', { targetId, flatten: true });
  return {
    send(method, params = {}) { return pipe.send(method, params, sessionId); },
    async eval(expression) {
      const res = await pipe.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }, sessionId);
      if (res.result?.exceptionDetails) throw new Error('JS fallo: ' + (res.result.exceptionDetails?.exception?.description || '').slice(0, 200));
      return res.result?.result?.value;
    },
    async close() { try { await pipe.send('Target.closeTarget', { targetId }); } catch {} },
  };
}

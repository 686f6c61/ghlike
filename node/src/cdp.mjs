// Cliente CDP minimo sobre el WebSocket nativo de Node (>=22). Cero dependencias.
import net from 'node:net';

export function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    srv.on('error', reject);
  });
}

export async function waitForCdp(port, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return true; }
    catch {}
    await new Promise(r => setTimeout(r, 300));
  }
  return false;
}

export async function openTab(port, url) {
  const r = await fetch(`http://127.0.0.1:${port}/json/new?${url}`, { method: 'PUT' });
  const t = await r.json();
  if (!t.webSocketDebuggerUrl) throw new Error('el navegador no devolvio websocket para la pestana');
  return t;
}

export class Tab {
  constructor(target) {
    this.ws = new WebSocket(target.webSocketDebuggerUrl);
    this._id = 0;
    this.pending = new Map();
    this.ready = new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (m) => {
      const d = JSON.parse(m.data);
      if (d.id && this.pending.has(d.id)) { this.pending.get(d.id)(d); this.pending.delete(d.id); }
    };
  }

  async send(method, params = {}) {
    await this.ready;
    return new Promise((resolve) => {
      const id = ++this._id;
      this.pending.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (res.error) throw new Error(`${method}: ${res.error.message}`);
    if (res.result?.exceptionDetails) throw new Error('JS fallo: ' + (res.result.exceptionDetails?.exception?.description || '').slice(0, 200));
    return res.result?.result?.value;
  }

  close() { try { this.ws.close(); } catch {} }
}

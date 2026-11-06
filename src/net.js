export class Net {
  constructor() {
    this.handlers = new Map();
    this.queue = [];
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    this.ws = new WebSocket(`${proto}://${location.host}/ws`);
    this.ws.onopen = () => {
      for (const m of this.queue) this.ws.send(m);
      this.queue = [];
      this.#emit('open', {});
    };
    this.ws.onclose = () => this.#emit('close', {});
    this.ws.onmessage = (ev) => {
      let m;
      try { m = JSON.parse(ev.data); } catch { return; }
      this.#emit(m.t, m);
    };
  }

  on(type, fn) {
    if (!this.handlers.has(type)) this.handlers.set(type, []);
    this.handlers.get(type).push(fn);
  }

  #emit(type, m) {
    for (const fn of this.handlers.get(type) || []) fn(m);
  }

  send(obj) {
    const data = JSON.stringify(obj);
    if (this.ws.readyState === 1) this.ws.send(data);
    else if (this.ws.readyState === 0) this.queue.push(data);
  }
}

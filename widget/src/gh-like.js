// ghlike widget: <gh-like repo="owner/repo" variant="..."></gh-like>
// Boton de "me gusta" para repos de GitHub, embebible en cualquier web.
//
// - SIN extension ni daemon: el click abre el repo en una pestana nueva
//   (fallback clasico, el widget nunca queda roto).
// - CON extension ghlike: la extension marca este elemento con
//   data-ghlike-ext="1" y ejecuta el star con la sesion de github.com del
//   visitante.
// - CON daemon local (ghlike daemon, 127.0.0.1:8469): el widget llama
//   directamente al daemon.
// - El contador de stars viene de la API publica de GitHub (CORS ok).
//
// Estilos: 5 variantes predefinidas via atributo `variant`
//   classic (por defecto) | pill | outline | glass | block
// y personalizacion total con variables CSS (--ghlike-*) y ::part().

(() => {
  const STYLE = `
    :host {
      display: inline-block;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      font-size: var(--ghlike-font-size, 14px);
    }
    button {
      display: inline-flex; align-items: center; justify-content: center;
      gap: var(--ghlike-gap, 7px);
      padding: var(--ghlike-padding, 5px 14px);
      border-radius: var(--ghlike-radius, 6px);
      font: inherit; font-size: var(--ghlike-font-size, 14px);
      cursor: pointer;
      border: 1px solid var(--ghlike-border, #d0d7de);
      background: var(--ghlike-bg, #f6f8fa);
      color: var(--ghlike-fg, #24292f);
      transition: background .15s, border-color .15s, transform .05s;
    }
    button:hover { background: var(--ghlike-bg-hover, #eef1f4); }
    button:active { transform: scale(.97); }
    button:focus-visible { outline: 2px solid #0969da; outline-offset: 1px; }
    svg { width: var(--ghlike-icon, 15px); height: var(--ghlike-icon, 15px); flex: none; }
    .star path { fill: var(--ghlike-star, #9a6700); }
    .count { opacity: .75; font-variant-numeric: tabular-nums; }
    .count.loading::after { content: "…"; }
    :host([data-busy="1"]) button { opacity: .6; pointer-events: none; }

    /* estado "ya dado" (todas las variantes) */
    :host([data-starred="1"]) button {
      background: var(--ghlike-on-bg, #fff8c5);
      border-color: var(--ghlike-on-border, #d4a72c);
      color: var(--ghlike-on-fg, #24292f);
    }
    :host([data-starred="1"]) .star path { fill: var(--ghlike-star-on, #eac54f); }

    .hint { display: none; margin-top: 5px; font-size: 11.5px; opacity: .7; }
    .hint a { color: inherit; }
    :host(:not([data-ghlike-ext]):not(.ghlike-live)) .hint { display: block; }
    .err { display: none; margin-top: 5px; font-size: 11.5px; color: #cf222e; }
    :host([data-error]) .err { display: block; }

    /* ---- variante: pill ---- */
    :host([variant="pill"]) {
      --ghlike-radius: 999px;
      --ghlike-padding: 7px 18px;
      --ghlike-bg: #24292f; --ghlike-bg-hover: #32383f;
      --ghlike-fg: #ffffff; --ghlike-border: #24292f;
      --ghlike-star: #eac54f;
      --ghlike-on-bg: #eac54f; --ghlike-on-border: #d4a72c; --ghlike-on-fg: #1f2328;
      --ghlike-star-on: #1f2328;
    }

    /* ---- variante: outline ---- */
    :host([variant="outline"]) {
      --ghlike-bg: transparent; --ghlike-bg-hover: #ddf4ff;
      --ghlike-fg: #0969da; --ghlike-border: #0969da;
      --ghlike-star: #0969da;
      --ghlike-on-bg: #0969da; --ghlike-on-border: #0969da; --ghlike-on-fg: #ffffff;
      --ghlike-star-on: #ffffff;
    }

    /* ---- variante: glass ---- */
    :host([variant="glass"]) {
      --ghlike-bg: rgba(255,255,255,.14); --ghlike-bg-hover: rgba(255,255,255,.24);
      --ghlike-fg: #ffffff; --ghlike-border: rgba(255,255,255,.4);
      --ghlike-star: #ffd84d;
      --ghlike-on-bg: rgba(255,216,77,.28); --ghlike-on-border: rgba(255,216,77,.7);
      --ghlike-on-fg: #ffffff; --ghlike-star-on: #ffe27a;
    }
    :host([variant="glass"]) button { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }

    /* ---- variante: block ---- */
    :host([variant="block"]) { display: block; }
    :host([variant="block"]) button {
      min-width: var(--ghlike-min-width, 220px);
      padding: var(--ghlike-padding, 10px 20px);
      font-weight: 600;
      --ghlike-bg: #1f883d; --ghlike-bg-hover: #1a7f37;
      --ghlike-fg: #ffffff; --ghlike-border: rgba(31,136,61,0);
      --ghlike-star: #ffffff;
      --ghlike-on-bg: #eac54f; --ghlike-on-border: #d4a72c; --ghlike-on-fg: #1f2328;
      --ghlike-star-on: #1f2328;
    }

    /* modo oscuro: solo ajusta los defaults de classic. Las variantes
       (:host([variant=...]) tiene mas especificidad) mantienen su paleta, y
       los estilos del documento del usuario siempre ganan sobre :host. */
    @media (prefers-color-scheme: dark) {
      :host {
        --ghlike-bg: #21262d; --ghlike-bg-hover: #262c36;
        --ghlike-border: #3d444d; --ghlike-fg: #e6edf3;
        --ghlike-star: #d29922;
      }
    }
  `;
  const STAR_SVG = `<svg class="star" viewBox="0 0 16 16" aria-hidden="true">
    <path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>`;

  const fmt = (n) =>
    n == null ? "" : n >= 1e6 ? (n / 1e6).toFixed(1).replace(".0", "") + "M"
    : n >= 1e3 ? (n / 1e3).toFixed(1).replace(".0", "") + "k" : String(n);

  // Contador de stars: cache en localStorage (TTL 1h) + deduplicacion de
  // peticiones en vuelo. La API publica anonima solo da 60 req/h por IP;
  // sin esto, una pagina con N widgets gastaria N por carga.
  const CACHE_PREFIX = "ghlike:count:";
  const CACHE_TTL = 3600e3;
  const inflight = new Map();

  function fetchStars(repo) {
    if (!inflight.has(repo)) {
      inflight.set(repo, (async () => {
        try {
          const c = JSON.parse(localStorage.getItem(CACHE_PREFIX + repo) || "null");
          if (c && typeof c.n === "number" && Date.now() - c.t < CACHE_TTL) return c.n;
        } catch (e) { /* localStorage lleno o bloqueado */ }
        try {
          const res = await fetch(`https://api.github.com/repos/${repo}`, {
            headers: { Accept: "application/vnd.github+json" },
          });
          if (!res.ok) return null;
          const n = (await res.json()).stargazers_count;
          try { localStorage.setItem(CACHE_PREFIX + repo, JSON.stringify({ t: Date.now(), n })); } catch (e) {}
          return n;
        } catch (e) {
          return null;
        }
      })());
    }
    return inflight.get(repo);
  }

  class GhLike extends HTMLElement {
    static get observedAttributes() {
      return ["repo", "data-starred", "data-busy", "data-error", "data-ghlike-ext"];
    }

    connectedCallback() {
      if (this._root) return;
      this._root = this.attachShadow({ mode: "open" });
      this._root.innerHTML = `<style>${STYLE}</style>
        <button part="button" type="button" aria-live="polite"></button>
        <div class="hint" part="hint"></div>
        <div class="err" part="error"></div>`;
      this._btn = this._root.querySelector("button");
      this._stars = null;
      this._daemon = null; // null = sin sondear todavia, true/false tras /ping

      this._btn.addEventListener("click", () => this._onClick());
      this._render();
      this._fetchCount();
      this._probeDaemon();
    }

    attributeChangedCallback(name) {
      // `repo` es reactivo: cambiarlo a mitad de pagina re-apunta el boton,
      // refresca el contador y limpia el estado anterior.
      if (name === "repo" && this._btn) {
        this.removeAttribute("data-starred");
        this.removeAttribute("data-error");
        this._stars = null;
        this._render();
        this._fetchCount();
        this._probeDaemon();
      }
      this._render();
    }

    get repo() {
      let v = (this.getAttribute("repo") || "").trim().replace(/\/+$/, "");
      const m = /github\.com\/([\w.\-]+)\/([\w.\-]+)/.exec(v);
      if (m) return `${m[1]}/${m[2]}`;
      return /^[\w.\-]+\/[\w.\-]+$/.test(v) ? v : null;
    }

    _onClick() {
      // 1) extension presente: su bridge intercepta en captura y esto no corre.
      if (this.hasAttribute("data-ghlike-ext")) return;
      // 2) daemon local presente: star en sitio con la sesion del navegador.
      if (this._daemon) return this._daemonToggle();
      // 3) nada instalado: fallback clasico (abrir el repo).
      if (this.repo) window.open(`https://github.com/${this.repo}`, "_blank", "noopener");
    }

    async _probeDaemon() {
      if (this._daemon !== null || !this.repo) return;
      this._daemon = false;
      const base = this.getAttribute("daemon-url") || "http://127.0.0.1:8469";
      try {
        const ctl = new AbortController();
        const t = setTimeout(() => ctl.abort(), 1200);
        const res = await fetch(`${base}/ping`, { signal: ctl.signal });
        clearTimeout(t);
        if (res.ok) {
          const info = await res.json();
          if (info && info.service === "ghlike-daemon") {
            this._daemon = true;
            this.classList.add("ghlike-live");
            this._render(); // oculta la pista de la extension
          }
        }
      } catch (e) {
        /* sin daemon: queda el fallback */
      }
    }

    async _daemonToggle() {
      const repo = this.repo;
      if (!repo || this.getAttribute("data-busy") === "1") return;
      const base = this.getAttribute("daemon-url") || "http://127.0.0.1:8469";
      this.setAttribute("data-busy", "1");
      this.removeAttribute("data-error");
      try {
        const res = await fetch(`${base}/toggle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ repo }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          this.setAttribute("data-starred", data.starred ? "1" : "0");
        } else {
          this.setAttribute("data-error", data.error || "error");
        }
      } catch (e) {
        this.setAttribute("data-error", "daemon-unreachable");
      } finally {
        this.removeAttribute("data-busy");
      }
    }

    async _fetchCount() {
      this._fetched = this.repo;
      const repo = this.repo;
      if (!repo) return;
      const n = await fetchStars(repo);
      // si el target cambio mientras llegaba la respuesta, no aplicar
      if (this.repo !== repo || n == null) return;
      this._stars = n;
      this._render();
    }

    _render() {
      if (!this._btn) return;
      const starred = this.getAttribute("data-starred") === "1";
      const repo = this.repo;
      const label = starred ? "Liked" : "Like";
      this._btn.innerHTML =
        STAR_SVG +
        `<span part="label">${label}</span>` +
        (this._stars == null
          ? `<span class="count loading" part="count"></span>`
          : `<span class="count" part="count" title="GitHub stars">${fmt(this._stars)}</span>`);
      this._btn.setAttribute("aria-label", repo ? `${starred ? "Unstar" : "Star"} ${repo} on GitHub` : "ghlike");

      const hint = this._root && this._root.querySelector(".hint");
      if (hint) {
        if (this.hasAttribute("data-ghlike-ext") || this._daemon) {
          hint.innerHTML = "";
        } else {
          hint.innerHTML = `one-click with the <a href="https://github.com/686f6c61/ghlike#extension" target="_blank" rel="noopener">ghlike extension</a>`;
        }
      }
      const err = this._root && this._root.querySelector(".err");
      if (err) {
        const e = this.getAttribute("data-error");
        err.textContent =
          e === "no-session" ? "Log into github.com in this browser first"
          : e === "not-found" ? "Repo not found"
          : e === "timeout" ? "Timed out — try again"
          : e === "daemon-unreachable" ? "ghlike daemon not reachable"
          : e ? "Could not star right now"
          : !this.repo && (this.getAttribute("repo") || "").trim() ? "Invalid repo format"
          : "";
      }
    }
  }

  customElements.define("gh-like", GhLike);
})();

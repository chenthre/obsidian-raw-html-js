/*
 * Raw HTML+JS — a homemade Obsidian plugin.
 *
 * Registers a code-block processor for ```live-html fences that inserts the
 * HTML verbatim and re-creates <script> tags so they execute (innerHTML
 * alone never runs scripts). Inline on* attributes work as-is.
 * Plain ```html fences are NOT touched — they stay normal display-only code blocks.
 *
 * The `livehtml` helper (window.livehtml) drives scroll-linked content:
 *   livehtml.drive(el, update) — calls update(progress 0..0.999) as the
 *                                reader scrolls (bidirectional); returns a
 *                                dispose() handle
 *   livehtml.svgScene(mount, scene, addArrowDef?)
 *   livehtml.htmlScene(mount, scene)      — return { dispose }
 * The scene helpers mount objects with render(container) and
 * scrollUpdate(container, progress) — the common scrollytelling contract
 * (htmlScene accepts renderHtml/scrollUpdateHtml as aliases).
 *
 * Lifecycle: drivers live in a WeakMap keyed by their mount element —
 * independent scenes in one block get independent drivers; rebinding a
 * mount replaces its own driver only. All live listeners/timers are
 * registered with the plugin and disposed on unload. Obsidian re-runs the
 * block processor on the same el when the reading view re-renders — the
 * processor replaces the previous holder instead of appending a new one.
 *
 * Inside a block, scope your queries to avoid ID clashes between renders:
 *   const root = document.currentScript.closest('.raw-html-js');
 *
 * Security note: any ```live-html fence in this vault may now execute JS.
 * That is the point — remove this folder to undo.
 */
const { Plugin } = require("obsidian");

const DRIVERS = new WeakMap(); // mount element -> dispose()

function makeLivehtml(register) {
  const livehtml = {};

  livehtml.drive = (el, update) => {
    const root = (el && el.closest(".raw-html-js")) || el;
    if (!root || typeof update !== "function") return () => {};
    // Rebinding a mount replaces its previous driver (no stacked listeners);
    // other scenes in the same block keep theirs.
    const prev = DRIVERS.get(el);
    if (prev) prev();

    let raf = 0;
    let settleTimer = null;
    let dead = false;

    const dispose = () => {
      if (dead) return;
      dead = true;
      DRIVERS.delete(el);
      window.removeEventListener("scroll", run, true);
      window.removeEventListener("resize", run);
      if (settleTimer) clearTimeout(settleTimer);
      cancelAnimationFrame(raf);
    };
    DRIVERS.set(el, dispose);
    register(dispose); // plugin unload disposes every live driver

    const compute = () => {
      if (dead) return;
      // Resolve the scroller per event: at script-run time the block may
      // not be attached to its final container yet.
      const sc =
        root.closest(".markdown-preview-view") ||
        root.closest(".cm-scroller") ||
        window;
      const vh = sc === window ? window.innerHeight : sc.clientHeight;
      const base = sc === window ? 0 : sc.getBoundingClientRect().top;
      const top = root.getBoundingClientRect().top - base;
      // A scene starts developing once its anchor passes mid-viewport and
      // completes as it reaches the top; 0.999 (not 1) is the ceiling so
      // terminal-phase logic keyed on "< 1" never triggers on a live driver.
      const span = vh * 0.55;
      if (span <= 0) return;
      update(Math.max(0, Math.min(0.999, (span - top) / span)));
    };
    const run = () => {
      if (dead) return;
      // Chunked rendering detaches blocks temporarily — skip while
      // disconnected; the driver stays bound and resumes on remount.
      if (!root.isConnected) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    // Scroll does not bubble, but the capture phase passes through
    // window — one listener catches every scroller in the app. (Scrollers
    // are cheap to filter: one bounding-rect read per rAF.)
    window.addEventListener("scroll", run, { passive: true, capture: true });
    window.addEventListener("resize", run, { passive: true });
    // Settle polling: a freshly (re)mounted layout takes frames to
    // stabilize, and scroll events fired mid-remount never arrive.
    let polls = 12;
    const settle = () => {
      if (dead || polls-- <= 0) return;
      run();
      settleTimer = setTimeout(settle, 160);
    };
    requestAnimationFrame(() => requestAnimationFrame(() => settle()));

    return dispose;
  };

  livehtml.svgScene = (mountEl, scene, addArrowDef) => {
    const render = scene.render || scene.renderHtml;
    if (typeof render !== "function") return { dispose: () => {} };
    // Idempotent mount: a re-run replaces the previous scene (and its
    // driver) rather than appending a second one.
    mountEl.replaceChildren();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 500 500");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    mountEl.appendChild(svg);
    if (addArrowDef) addArrowDef(svg);
    render.call(scene, svg);
    const update =
      scene.scrollUpdate || scene.scrollUpdateHtml;
    const dispose = livehtml.drive(mountEl, (p) => {
      if (typeof update === "function") update.call(scene, svg, p);
    });
    return { dispose };
  };

  livehtml.htmlScene = (mountEl, scene) => {
    const render = scene.renderHtml || scene.render;
    if (typeof render !== "function") return { dispose: () => {} };
    // Idempotent mount — see svgScene.
    mountEl.replaceChildren();
    render.call(scene, mountEl);
    const update = scene.scrollUpdateHtml || scene.scrollUpdate;
    const dispose = livehtml.drive(mountEl, (p) => {
      if (typeof update === "function") update.call(scene, mountEl, p);
    });
    return { dispose };
  };

  return livehtml;
}

module.exports = class RawHtmlJsPlugin extends Plugin {
  onload() {
    this.disposers = new Set();
    window.livehtml = makeLivehtml((dispose) => {
      this.disposers.add(dispose);
    });
    this.registerMarkdownCodeBlockProcessor("live-html", (source, el) => {
      // A re-run on the same el (reading-view re-render, mode switch)
      // replaces the previous holder instead of appending a new one.
      for (const child of [...el.children]) {
        if (child.classList && child.classList.contains("raw-html-js")) {
          child.remove();
        }
      }
      const holder = document.createElement("div");
      holder.className = "raw-html-js";
      holder.innerHTML = source;
      holder.querySelectorAll("script").forEach((old) => {
        const type = old.getAttribute("type") || "";
        const isModule = type === "module";
        const isExecutable = !type || isModule || /javascript/i.test(type);
        const s = document.createElement("script");
        if (old.src) s.src = old.src;
        if (type) s.setAttribute("type", type);
        if (!isExecutable) {
          // Data blocks (application/json, importmap, …) are inert; keep
          // them verbatim — wrapping would corrupt their content.
          s.textContent = old.textContent;
        } else if (isModule) {
          s.textContent = old.textContent;
        } else {
          // Wrap in a bare block so const/let are block-scoped — otherwise
          // multiple renders of the same note collide in global scope.
          s.textContent = "{\n" + old.textContent + "\n}";
        }
        old.replaceWith(s);
      });
      el.appendChild(holder);
    });
  }

  onunload() {
    for (const dispose of this.disposers) {
      try { dispose(); } catch (e) { /* a scene's DOM may already be gone */ }
    }
    this.disposers.clear();
    delete window.livehtml;
  }
};

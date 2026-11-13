/*
 * Raw HTML+JS — a homemade Obsidian plugin.
 *
 * Registers a code-block processor for ```live-html fences that inserts the
 * HTML verbatim and re-creates <script> tags so they execute (innerHTML
 * alone never runs scripts). Inline on* attributes work as-is.
 * Plain ```html fences are NOT touched — they stay normal display-only code blocks.
 *
 * The `livehtml` helper (window.livehtml) drives scroll-linked content:
 *   livehtml.drive(el, update) — calls update(progress 0..1) as the reader
 *                                scrolls (bidirectional)
 *   livehtml.svgScene(mount, scene, addArrowDef?)
 *   livehtml.htmlScene(mount, scene)
 * The scene helpers mount objects with render(container) and
 * scrollUpdate(container, progress) — the common scrollytelling contract —
 * and wire them to the scroll driver. Mounts are idempotent: Obsidian
 * re-runs the processor on the same holder when the reading view re-renders
 * (mode switches, backlinks refresh), so a re-run replaces, never appends.
 *
 * Inside a block, scope your queries to avoid ID clashes between renders:
 *   const root = document.currentScript.closest('.raw-html-js');
 *
 * Security note: any ```live-html fence in this vault may now execute JS.
 * That is the point — remove this folder to undo.
 */
const { Plugin } = require("obsidian");

function makeLivehtml() {
  const livehtml = {};

  livehtml.drive = (el, update) => {
    const root = (el && el.closest(".raw-html-js")) || el;
    if (!root || typeof update !== "function") return;
    // Idempotent bind: a re-run replaces the previous driver instead of
    // stacking a second one (duplicate updates on every scroll).
    if (root.__livehtmlDrive) root.__livehtmlDrive();
    let raf = 0;
    const compute = () => {
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
      // completes as it reaches the top; the 0.999 ceiling avoids
      // re-triggering terminal-phase logic.
      const span = vh * 0.55;
      if (span <= 0) return;
      update(Math.max(0, Math.min(0.999, (span - top) / span)));
    };
    let gone = 0;
    const run = () => {
      // Obsidian's chunked rendering detaches blocks temporarily — skip
      // while disconnected. Only a long detachment (no remount, no settle)
      // means the block is truly gone: release the listener then.
      if (!root.isConnected) {
        if (!gone) gone = Date.now();
        if (Date.now() - gone > 30000) {
          window.removeEventListener("scroll", run, true);
        }
        return;
      }
      gone = 0;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(compute);
    };
    // Scroll does not bubble, but the capture phase passes through
    // window — one listener catches every scroller in the app.
    window.addEventListener("scroll", run, { passive: true, capture: true });
    // Settle polling: a freshly (re)mounted layout takes frames to
    // stabilize, and scroll events fired mid-remount never arrive.
    let polls = 12;
    const settle = () => {
      if (polls-- <= 0) return;
      run();
      setTimeout(settle, 160);
    };
    requestAnimationFrame(() => requestAnimationFrame(settle));
    // Cleanup handle for the idempotent-bind replacement above.
    root.__livehtmlDrive = () => {
      window.removeEventListener("scroll", run, true);
      cancelAnimationFrame(raf);
      root.__livehtmlDrive = null;
    };
  };

  livehtml.svgScene = (mountEl, scene, addArrowDef) => {
    // Idempotent mount: a re-run of the block's processor must not append
    // a second scene — clear the mount first.
    mountEl.replaceChildren();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 500 500");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    svg.style.width = "100%";
    mountEl.appendChild(svg);
    if (addArrowDef) addArrowDef(svg);
    scene.render(svg);
    livehtml.drive(mountEl, (p) => {
      if (scene.scrollUpdate) scene.scrollUpdate(svg, p);
    });
  };

  livehtml.htmlScene = (mountEl, scene) => {
    // Idempotent mount — see svgScene.
    mountEl.replaceChildren();
    scene.renderHtml(mountEl);
    livehtml.drive(mountEl, (p) => {
      if (scene.scrollUpdateHtml) scene.scrollUpdateHtml(mountEl, p);
    });
  };

  return livehtml;
}

module.exports = class RawHtmlJsPlugin extends Plugin {
  onload() {
    window.livehtml = makeLivehtml();
    this.registerMarkdownCodeBlockProcessor("live-html", (source, el) => {
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
    delete window.livehtml;
  }
};

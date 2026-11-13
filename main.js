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
 * Lifecycle: a render child is attached to every rendered block (ctx.addChild),
 * so closing a note or re-rendering a block deterministically disposes the
 * block's drivers — no reliance on a later scroll event. Drivers are also
 * keyed per mount element in a WeakMap: scenes in one block are independent,
 * rebinding a mount replaces only its own driver. Plugin unload is the final
 * fallback. Obsidian's temporary detach/remount (chunked rendering) stays a
 * skip, not a dispose.
 *
 * Inside a block, scope your queries to avoid ID clashes between renders:
 *   const root = document.currentScript.closest('.raw-html-js');
 *
 * Security note: any ```live-html fence in this vault may now execute JS.
 * That is the point — remove this folder to undo.
 */
const { Plugin, MarkdownRenderChild } = require("obsidian");

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
      if (DRIVERS.get(el) === dispose) DRIVERS.delete(el);
      unregister(dispose); // the registry holds only active drivers
      window.removeEventListener("scroll", run, true);
      window.removeEventListener("resize", run);
      if (settleTimer) clearTimeout(settleTimer);
      cancelAnimationFrame(raf);
    };
    DRIVERS.set(el, dispose);
    const unregister = register(dispose); // plugin unload is the fallback

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
    const update = scene.scrollUpdate || scene.scrollUpdateHtml;
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

// A render child per live-html block: when Obsidian destroys the rendered
// section (note closed, block re-rendered, view switched), every driver
// mounted inside this holder is disposed deterministically.
class LiveHtmlChild extends MarkdownRenderChild {
  constructor(holder) {
    super(holder);
  }
  onunload() {
    for (const mount of [...this.containerEl.querySelectorAll("*")]) {
      const dispose = DRIVERS.get(mount);
      if (dispose) dispose();
    }
    // The scene helpers bind to the holder's mounts; drive() may also have
    // been called with the holder itself.
    const own = DRIVERS.get(this.containerEl);
    if (own) own();
  }
}

module.exports = class RawHtmlJsPlugin extends Plugin {
  onload() {
    this.disposers = new Set(); // active drivers only — dispose() unregisters
    window.livehtml = makeLivehtml((dispose) => {
      this.disposers.add(dispose);
      return () => this.disposers.delete(dispose);
    });
    this.registerMarkdownCodeBlockProcessor(
      "live-html",
      (source, el, ctx) => {
        // A re-run on the same el (reading-view re-render, mode switch)
        // replaces the previous holder and disposes its drivers first.
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
        if (ctx && typeof ctx.addChild === "function") {
          ctx.addChild(new LiveHtmlChild(holder));
        }
      }
    );
  }

  onunload() {
    for (const dispose of [...this.disposers]) {
      try {
        dispose();
      } catch (e) {
        /* a scene's DOM may already be gone */
      }
    }
    this.disposers.clear();
    delete window.livehtml;
  }
};

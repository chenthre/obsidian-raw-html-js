/*
 * Raw HTML+JS — a 27-line homemade Obsidian plugin.
 *
 * Registers a code-block processor for ```live-html fences that inserts the
 * HTML verbatim and re-creates <script> tags so they execute (innerHTML
 * alone never runs scripts). Inline on* attributes work as-is.
 * Plain ```html fences are NOT touched — they stay normal display-only code blocks.
 *
 * Inside a block, scope your queries to avoid ID clashes between renders:
 *   const root = document.currentScript.closest('.raw-html-js');
 *
 * Security note: any ```live-html fence in this vault may now execute JS.
 * That is the point — remove this folder to undo.
 */
const { Plugin } = require("obsidian");

module.exports = class RawHtmlJsPlugin extends Plugin {
  onload() {
    this.registerMarkdownCodeBlockProcessor("live-html", (source, el) => {
      const holder = document.createElement("div");
      holder.className = "raw-html-js";
      holder.innerHTML = source;
      holder.querySelectorAll("script").forEach((old) => {
        const s = document.createElement("script");
        if (old.src) s.src = old.src;
        // Wrap in a bare block so const/let are block-scoped — otherwise
        // multiple renders of the same note collide in global scope.
        s.textContent = "{\n" + old.textContent + "\n}";
        old.replaceWith(s);
      });
      el.appendChild(holder);
    });
  }
};

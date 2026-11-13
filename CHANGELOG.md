# Changelog

## 1.1.0 — 2026-09-16

- **Breaking:** executable fences moved from ` ```html ` to the dedicated **` ```live-html `** tag. Plain ` ```html ` fences revert to Obsidian's stock behavior (display-only code blocks), so showing HTML source works as expected. Rename your executable fences when upgrading.
- Documented and fixed the multi-render global-scope collision: re-created scripts are wrapped in a bare block so `const`/`let` don't collide across Obsidian's coexisting live-preview and reading-view renders.
- Added examples and this changelog.

## 1.0.0 — 2026-09-16

- Initial release: `registerMarkdownCodeBlockProcessor` for ` ```html ` fences, `innerHTML` insertion, `<script>` revival via `createElement` + `replaceWith`, inline `on*` handler support.

## 1.2.0

(Revision 2, per review: `drive()` returns a dispose handle; drivers are per-mount (WeakMap) so scenes in one block are independent; the processor replaces previous holders on re-run — no duplicate containers; resize recalculates progress; the 0..0.999 progress contract is documented; unload disposes all listeners/rAFs/timers.)

- `window.livehtml` — a shared scroll-driver for scroll-linked (scrollytelling) content:
  - `livehtml.drive(el, update)` calls `update(progress)` 0→1 as the reader scrolls, bidirectionally.
  - `livehtml.svgScene(mount, scene, addArrowDef?)` / `livehtml.htmlScene(mount, scene)` mount scene objects following the `render` + `scrollUpdate(container, progress)` contract.
  - Handles Obsidian realities so scene code doesn't have to: capture-phase scroll binding (scroll doesn't bubble; blocks may be unattached at script-run time), listener survival across the chunked renderer's temporary detaches, settle polling after (re)mount, and idempotent mounts/binds (Obsidian re-runs the block processor on reading-view re-renders — a re-run replaces, never appends).
- `<script>` re-creation preserves the `type` attribute: module scripts keep module semantics, data blocks (`application/json`, importmaps, …) stay inert instead of being wrapped and executed.

# Changelog

## 1.1.0 — 2026-09-16

- **Breaking:** executable fences moved from ` ```html ` to the dedicated **` ```live-html `** tag. Plain ` ```html ` fences revert to Obsidian's stock behavior (display-only code blocks), so showing HTML source works as expected. Rename your executable fences when upgrading.
- Documented and fixed the multi-render global-scope collision: re-created scripts are wrapped in a bare block so `const`/`let` don't collide across Obsidian's coexisting live-preview and reading-view renders.
- Added examples and this changelog.

## 1.0.0 — 2026-09-16

- Initial release: `registerMarkdownCodeBlockProcessor` for ` ```html ` fences, `innerHTML` insertion, `<script>` revival via `createElement` + `replaceWith`, inline `on*` handler support.

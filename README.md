# Raw HTML+JS for Obsidian

> [!CAUTION]
> **This repository was generated entirely by an AI coding agent** — code, docs, and the prompt below — as a demonstration of agent-driven development. It was tested working in the author's vault at the time of writing, but is provided as-is, with no guarantee of correctness or maintenance. Review `main.js` (a single file, readable over one coffee) before enabling, and understand the security trade-off it deliberately makes.

A single-file, zero-dependency Obsidian plugin that makes ` ```live-html ` code fences run like real browser HTML — **`<script>` tags execute, vanilla DOM code just works**. Build sliders, calculators, live-weather cards, maps, mini-dashboards: all inside a plain markdown note.

```live-html
<div>
  <input id="sa" type="range" min="0" max="100" value="3">
  <input id="sb" type="range" min="0" max="100" value="7">
  <b id="res">3 + 7 = 10</b>
</div>
<script>
  const root = document.currentScript.closest(".raw-html-js");
  const $ = (id) => root.querySelector(id);
  const update = () => {
    $("#res").textContent = `${+$("#sa").value} + ${+$("#sb").value} = ${+$("#sa").value + +$("#sb").value}`;
  };
  $("#sa").addEventListener("input", update);
  $("#sb").addEventListener("input", update);
  update();
</script>
```

Drag either slider and the sum updates live. That's the whole pitch: **the fence is an HTML page.**

## Why

Obsidian's renderer strips `<script>` tags and `on*` event attributes from note bodies. This is hardcoded in the app's sanitizer — there is no setting to disable it, so raw JavaScript in a note can never run. What Obsidian *does* offer is a sanctioned extension point: **code-block processors**. This plugin registers one for the ` ```live-html ` fence, receives the raw source (which the sanitizer never touches), inserts it as real DOM, and re-creates `<script>` elements so the browser executes them.

Plain ` ```html ` fences are **not** touched — they stay ordinary display-only code blocks. Use those when you want to *show* HTML source.

## Install

**Option A — Manual**

1. Download `main.js` and `manifest.json` from [Releases](../../releases) (or this repo).
2. In your vault, create the folder `.obsidian/plugins/raw-html-js/`.
3. Put both files inside it.
4. Restart Obsidian, then: **Settings → Community plugins** → turn **off** Restricted mode if prompted → enable **Raw HTML+JS**.

**Option B — Git clone**

```bash
git clone https://github.com/<you>/obsidian-raw-html-js \
  "<your-vault>/.obsidian/plugins/raw-html-js"
```

Then restart Obsidian and enable the plugin as above.

**Option C — BRAT**

In the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin: *Add Beta plugin* → enter this repo's URL.

**Option D — ⚠️ Ask your AI agent to build it**

The plugin is small enough that any competent coding agent (pi, Claude Code, Codex, Cursor, …) can build it in your vault. Paste this, filling in your vault path.

> [!WARNING]
> ⚠️ Generative recursion: this prompt was **also written by an AI**. Neither layer — the code's origin nor the prompt's — can fully assure the final effect. Treat it as a strong starting point, then review what your agent produces against the acceptance tests below before trusting it.

````text
I want a new capability in my Obsidian vault, and I want you to build the
plugin that provides it.

The intention: my notes should be able to contain small living web pages. In
any note, I write a fenced block tagged `live-html` holding ordinary HTML —
markup, styles, scripts, event handlers. When the note opens, that block
comes alive: my markup renders, my script runs, my handlers fire, and it
stays interactive as I keep working. The model is a Jupyter cell or an
embedded browser page: if I can write it in an HTML file, it should work in
the fence. Vanilla web code only — no framework, and no custom API for me to
learn beyond what a web developer already knows.

Build, install, and enable this plugin for my vault at <ABSOLUTE PATH to the
folder containing .obsidian>. Standard Obsidian plugin layout (manifest +
main.js), CommonJS, no build step, no dependencies — I should be able to
read the entire thing over one coffee.

Judge yourself by these acceptance tests, not by the code looking right:

1. Smoke test: write a note with a live-html block containing two range
   inputs and a live "a + b" sum. Opening the note shows two working sliders
   — dragging either instantly updates the sum — not a code block.
2. It works in both of Obsidian's render modes at once: the note is rendered
   for live preview and for reading view simultaneously, and the widget must
   be alive in both, with no console errors. (Failures here are sneaky and
   silent: a widget that works in one mode but is dead in the other, or an
   "Identifier has already been declared" console error.)
3. Two or more live-html blocks in the same note coexist without cross-talk.
4. A plain ```html fence in any note keeps Obsidian's stock behavior —
   display-only syntax-highlighted source. This plugin must not touch it.
5. The plugin enables cleanly: discovered on restart or via CLI, survives
   plugin reloads, and uninstalling its folder restores stock behavior.
6. If my widget scripts need a convention to address elements within their
   own block, that convention must be tiny, documented in a comment inside
   main.js, and used in your smoke test.

Verify for real before declaring victory: if the `obsidian` CLI is available
on this machine, open the smoke-test note, force reading view, and confirm
the sliders exist and respond to synthetic input events — then show me the
evidence. Otherwise give me exact manual steps and what to look for.

One thing you must tell me when done, in plain words: enabling this plugin
means any live-html fence in my vault executes arbitrary JavaScript on
render. I accept that; say it anyway.
````

Deliberately, this prompt describes the **experience and its acceptance
tests**, not the implementation. The interesting engineering — how scripts
actually get executed, how coexisting renders stay isolated — is the agent's
job to discover; the tests decide whether it got there. An agent that passes
all six owns its design; an agent handed our constraints would just transcribe
them.

## Usage

Any ` ```live-html ` fence runs as if it were a standalone HTML page:

- **Vanilla DOM only.** No framework, no plugin API. What works in a browser `<body>` works here.
- **Inline handlers work too**: `<button onclick="...">` — not just `<script>` blocks.
- **Scoped DOM queries are the one convention.** Obsidian renders the same note in more than one place at once (live preview *and* reading view), so element IDs exist twice. Always start your script with:

  ```js
  const root = document.currentScript.closest(".raw-html-js");
  const $ = (id) => root.querySelector(id);
  ```

- Widgets are **ephemeral**: DOM state resets when the note reopens. Persist values via frontmatter (e.g. the [Meta Bind](https://github.com/mProjectsCode/obsidian-meta-bind-plugin) plugin) or read vault data at render time.

### Scroll-linked scenes (`window.livehtml`)

For scrollytelling content — scenes that develop as the reader scrolls — the plugin exposes a shared driver as `window.livehtml`, so a scene block needs no driver code of its own:

```js
const scene = {
  render(svg) { /* build the scene once (SVG elements, labels) */ },
  scrollUpdate(svg, progress) { /* flip opacities / phases by threshold */ },
};
livehtml.svgScene(mount, scene); // render + wire the scroll driving
```

- `livehtml.drive(el, update)` — calls `update(progress)` with `progress` from `0` up to `0.999` (the ceiling avoids re-triggering terminal-phase logic keyed on `< 1`) as the reader scrolls, **bidirectionally** — scrolling up rewinds. A scene starts developing once its anchor passes mid-viewport and completes as it reaches the top. Returns a `dispose()` handle.
- `livehtml.svgScene(mount, scene, addArrowDef?)` / `livehtml.htmlScene(mount, scene)` — mount a scene object following the `render` / `scrollUpdate(container, progress)` contract (`htmlScene` also accepts `renderHtml` / `scrollUpdateHtml`). Return `{ dispose }`. Mounts are idempotent: a re-render replaces, never appends. `svgScene` gives the mount a 500×500 viewBox SVG.
- Progress is **anchored to the individual mount element** you pass in, not the block root.
- Lifecycle is deterministic: closing the note, re-rendering the block, or plugin unload disposes the block's drivers (a `MarkdownRenderChild` is attached per rendered block; disposal also happens explicitly before a holder is replaced on re-render). Rebinding a mount replaces its own driver only — several scenes in one block are independent. Obsidian's chunked-render detach is a *skip*, not a dispose: a scene reattached without a fresh processor run resumes driving.

Every scroll event costs one rAF-coalesced bounding-rect read per driver, with early exit while a block is temporarily disconnected — scrolling a *different* pane is a cheap no-op for detached scenes.

### Ideas

Live weather (Open-Meteo is keyless and CORS-friendly), trip budget calculators, interactive flashcards, unit converters, canvas animations, unit-tested cheat sheets that compute instead of rot, embedded mini-games. If it fits in an HTML page, it fits in a note.

## How it works

```text
```live-html  ← fence in your note
   ↓  Obsidian matches the language → calls our processor with (source, container)
container ← div.raw-html-js; innerHTML = source   (DOM built, <script> tags INERT)
   ↓  for each inert script: create fresh <script> via createElement
replaceWith(live)  → script executes NOW, synchronously
   ↓
widget appended → interactive on screen
```

Two web-platform facts make this work: `innerHTML` never runs scripts (they're parsed as inert elements), while scripts created via `createElement` and inserted into the document execute immediately. Each re-created script's code is wrapped in a bare `{ … }` block so `const`/`let` stay block-scoped — otherwise the two coexisting renders of a note collide in global scope.

## ⚠️ Security

Enabling this plugin means **any ` ```live-html ` fence in your vault executes arbitrary JavaScript** whenever the note renders. That is the entire point of the plugin, and it is a real reduction of Obsidian's default safety:

- Only enable it in vaults you control.
- Be deliberate about pasting notes from other people — a ` ```live-html ` block in a shared note is code from a stranger.
- Uninstall = delete `.obsidian/plugins/raw-html-js/` (or toggle the plugin off) and the default protection is fully restored.

## Alternatives

| Plugin | Difference |
| --- | --- |
| [Dataview](https://github.com/blacksmithgu/obsidian-dataview) | Adds `dataviewjs` cells + a vault query API. Heavier; different query language. Pairs fine with this plugin. |
| [JS Engine](https://github.com/mnaoumov/obsidian-dev-tools) (and similar) | Full scripting environments with lifecycles and imports. More power, more machinery. |
| [Meta Bind](https://github.com/mProjectsCode/obsidian-meta-bind-plugin) | Purpose-built input widgets (sliders/buttons) bound to frontmatter — values *persist*. Great companion for this plugin. |

Raw HTML+JS is the zero-dependency option: if you can write a web page, you already know the API.

## FAQ

**Why not just allow raw `<script>` in the note body?**
Impossible — the sanitizer is hardcoded in the app with no opt-out, and the plugin API deliberately never exposes note-body injection. Code-block processors are the only sanctioned door.

**Why did v1.0.0 hijack ` ```html `?**
It did — v1.1.0 moved to the dedicated `live-html` tag after real-world use showed ` ```html ` should keep meaning "show HTML source". If you upgrade, rename your executable fences.

**Why do my globals collide?**
They don't anymore — the plugin wraps your code in a bare block. (In v1.0.0 this was a real bug worth documenting: two renders of one note share global scope.)

## Changelog

See [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)

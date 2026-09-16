# Raw HTML+JS for Obsidian

A 27-line Obsidian plugin that makes ` ```live-html ` code fences run like real browser HTML — **`<script>` tags execute, vanilla DOM code just works**. Build sliders, calculators, live-weather cards, maps, mini-dashboards: all inside a plain markdown note.

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

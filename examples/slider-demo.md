# Drop this file into your vault and open it to verify the plugin works.
# It exercises the scoping convention, event wiring, and initial paint.

---
title: raw-html-js smoke test
---

# 🧪 raw-html-js smoke test

If the plugin is enabled, this renders as two working sliders — not code:

```live-html
<div>
  <div style="display:flex; align-items:center; gap:12px; margin:10px 0;">
    <span style="min-width:5.5em;">a = <b id="va">3</b></span>
    <input id="sa" type="range" min="0" max="100" value="3" style="flex:1; accent-color: var(--interactive-accent);">
  </div>
  <div style="display:flex; align-items:center; gap:12px; margin:10px 0;">
    <span style="min-width:5.5em;">b = <b id="vb">7</b></span>
    <input id="sb" type="range" min="0" max="100" value="7" style="flex:1; accent-color: var(--interactive-accent);">
  </div>
  <div style="margin-top:10px; padding:10px 14px; border-radius:8px; background:var(--background-secondary); font-size:1.2em;">
    <b id="res">3 + 7 = 10</b>
  </div>
</div>
<script>
  const root = document.currentScript.closest(".raw-html-js");
  const $ = (id) => root.querySelector(id);
  const update = () => {
    const a = +$("#sa").value, b = +$("#sb").value;
    $("#va").textContent = a;
    $("#vb").textContent = b;
    $("#res").textContent = `${a} + ${b} = ${a + b}`;
  };
  $("#sa").addEventListener("input", update);
  $("#sb").addEventListener("input", update);
  update();
</script>
```

If you see raw code above instead of sliders: the plugin isn't installed or
enabled (Settings → Community plugins → Raw HTML+JS).

A plain ` ```html ` fence must stay display-only — this should look like code:

```html
<div>this is NOT executed — just displayed as source</div>
```

# Hero graphic — Webflow embeds

Homepage hero graphics packaged here (the steps are the same for each; swap the file name):

| Files | Variant |
|---|---|
| `hive-stack.*` | A · Hive Stack |
| `orbit.*` | C · Orbit |
| `orbit-launch.*` | C2 · Orbit Launch: hexagon assembles, numbers count up, cards spiral out |
| `orbit-full.*` | C3 · Orbit Full: Launch plus drifting logo hexagons and the icon's "b" |

All embeds share one script, `bh-init.js` (count-up, pause offscreen, cursor tilt); the build inlines it into each file.

Homepage hero graphic. No images, fonts or libraries; one inline SVG (etisalat logo).

## Option 1 — replace the current embed (recommended)

Same format as the current homepage embed (`<div class="bh-hero-vis">…`): one wrapper `<div>` holding the `<style>`, markup and `<script>`.

1. Open the existing Embed element in the hero's right-hand column.
2. Delete its contents and paste the whole of `hive-stack.html` (≈13,600 characters, readable). If Webflow rejects the length, paste `hive-stack.min.html` instead (≈11,900 characters, same code minified). Save and publish.

## Option 2 — split (each part under 7,000 characters)

Use this if the Embed element refuses the one-paste version, or to keep CSS in the page head.

1. **Page settings → Custom code → Inside `<head>` tag:** paste `hive-stack.head.html`.
2. **Embed element** in the hero's right-hand column: paste `hive-stack.body.html`.

## Settings

- **Dark header:** add `data-surface="dark"` to the opening `<section class="bh bh-a" …>` tag.
- **Size:** fills its column up to 560px wide and scales down to phone width. Give the column a sensible width (about 45–50% of the hero on desktop); on mobile it stacks under the CTA.
- **Colours:** Beehive red (`#C20700`) and navy (`#1B2152`), taken from the current homepage embed; tokens are at the top of the CSS.
- **Type:** Inter at light weights (200 numbers, 300 labels, 400–500 small caps), matching the current homepage graphic. Uses the Inter the site already loads; the embed loads no fonts itself.
- **Motion:** previews as static in the Designer; the script (tilt and offscreen pause) only runs on the published site. Visitors with reduced motion get a still version.

All paste-ready files are generated from `../index.html`.

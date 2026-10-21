# Hive Stack — Webflow embed

Homepage hero graphic, Variant A. No images, fonts or libraries; one inline SVG (etisalat logo).

## Option 1 — one paste (≈12,000 characters)

1. In the hero's right-hand column, add an **Embed** element.
2. Paste the whole of `hive-stack.min.html`. Save and publish.

## Option 2 — split (each part under 7,000 characters)

Use this if the Embed element refuses the one-paste version, or to keep CSS in the page head.

1. **Page settings → Custom code → Inside `<head>` tag:** paste `hive-stack.head.html`.
2. **Embed element** in the hero's right-hand column: paste `hive-stack.body.html`.

## Settings

- **Dark header:** add `data-surface="dark"` to the opening `<section class="bh bh-a" …>` tag.
- **Size:** fills its column up to 560px wide and scales down to phone width. Give the column a sensible width (about 45–50% of the hero on desktop); on mobile it stacks under the CTA.
- **Brand red:** `--bh-red`, `--bh-red-deep` and `--bh-red-rim` at the top of the CSS.
- **Type:** inherits the site font; uses weights 500, 600, 700 and 800.
- **Motion:** previews as static in the Designer; the script (tilt and offscreen pause) only runs on the published site. Visitors with reduced motion get a still version.

`hive-stack.html` is the readable source of the same code. The paste-ready files are generated from `../index.html`.

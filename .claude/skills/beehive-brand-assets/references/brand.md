# Beehive brand system

All tokens live in `kit/beehive.css`. Change them there, not in individual pages.

## Colour

| Token | Hex | Use |
|---|---|---|
| `--bh-red` | `#E00800` | Eyebrow line, highlighted column header, CTA band, product names |
| `--bh-red-tint` | `#FCEBEB` | Soft highlight, sparingly |
| `--bh-navy` | `#0F1430` | All headings and body text, strong rules under table headers |
| `--bh-navy-deep` | `#181F49` | Dark panels and the navy CTA |
| `--bh-slate` | `#626678` | Secondary text, table row labels |
| `--bh-mute` | `#9A9DAA` | Footnotes, logo placeholders |
| `--bh-rule` | `#E0E1E5` | Hairlines between rows |
| `--bh-surface` | `#F2F2F4` | Panels, the shaded column in `.table.versus` |
| `--bh-stripe` | `#F4F4F7` | Alternate table rows |
| `--bh-white` | `#FFFFFF` | Page background |

Rules:
- Navy carries the text. Red is for emphasis, not decoration.
- Use at most one solid red block per page (CTA band or statement panel) and at most one navy panel.
- On dark panels, use white text and the lighter red `#FF6B63` for small labels.

## Type

- Typeface: Inter, standing in for the licensed brand face. To swap it, change `--bh-font` and the `@import` in `beehive.css`.
- Weights: Light 300 for titles, key figures and column headlines. Regular 400 for body and section titles. Medium 500 for labels and highlighted values. SemiBold 600 for table group headings only.
- Scale (print, A4): display 26pt, section 13pt, card or column title 9.5pt, lede 10pt, body 8pt, small 7pt, legal 6pt, key figures 17pt.
- Sentence case everywhere. Uppercase only for the header document-type label (letter-spaced) and table group headings.
- Use tabular figures (`tnum`) only on key figures. In Inter, `tnum` adds space around hyphens.

## Page

- A4 (210 × 297 mm), margins of 17 mm at the sides, 12 mm at the top and 11 mm at the bottom. One page per document unless asked otherwise.
- Order, top to bottom:
  1. **Header:** the logo (`assets/beehive-logo.png`, 10.5 mm tall) on the left, and the document type on the right, e.g. `PRODUCT GUIDE / COMPARE`.
  2. **Title block:** a red eyebrow line, a Light title and a one or two sentence lede.
  3. **Body.**
  4. **CTA:** one per page, at the bottom.
  5. **Footer:** footnotes, the DFSA line, and `beehive.ae` with the reference, e.g. `BH-PG-01 · v1.1 · October 2026`.
- Reference codes: `BH-PG` product guide, `BH-WB` why Beehive, `BH-CP` company profile. Pick a new two-letter code for a new document type and record it in `facts.md`.

## Asset formats

Every format uses the same colours, type and voice. Only the size and the amount of content change. The less space there is, the less you say.

| Asset | Size | What goes on it |
|---|---|---|
| One-pager, product sheet, comparison, profile, fact sheet | A4 portrait, 210 × 297 mm | Full page structure (header, title block, body, CTA, footer). Built from `kit/templates/` |
| Flyer | A5 portrait, 148 × 210 mm | Logo, title, three facts at most, CTA, DFSA line |
| Presentation slide | 16:9, 1920 × 1080 px | One idea per slide. Logo bottom-left, light title top-left, a figure strip or a striped table for numbers. The DFSA line and rate footnote go on the closing slide, or on any slide showing a rate |
| Social tile | 1080 × 1080 px (square) or 1200 × 627 px (LinkedIn landscape) | Logo, one headline (8 words or fewer), one figure or one line of support, and the URL. White or navy background; red only for the figure or a thin accent bar. If a rate appears, the rate footnote goes on the tile |
| Email banner or signature | 600 px wide | Logo and one line. No tables |
| Web section | Content width ~1120 px | The same components at web sizes: title 40px, body 16px, figures 32px |

On navy backgrounds, use the white logo, white text and `#FF6B63` for small labels. Never place the red logo on red or navy.

## Components (classes in `beehive.css`)

| Class | Use |
|---|---|
| `.doc-header`, `.logo`, `.doc-type` | Header |
| `.eyebrow`, `.title`, `.lede` | Title block |
| `.h2`, `.h3` | Section and item titles |
| `.stats` (`--cols`) | Row of key figures between rules |
| `.table` | Default table, every other row shaded. `th.hl` makes a column header red; `td.hl` sets a value in Medium; `td.dim` mutes a value |
| `.table.compact` | Tighter rows |
| `.table.even-cols` | Label column plus equal value columns, so stacked tables line up |
| `.table.no-stripe` | Turns shading off. Only for one- or two-row tables |
| `.table.versus` | Head-to-head: the Beehive column is shaded with a red cap. Group rows with `<tr class="group">`. No row striping |
| `.col-title` (inside `th`) | Large Light column headline, e.g. "Bridge the wait" |
| `.steps` / `.step` | Numbered 01 / 02 / 03 process |
| `.summary` | Short blocks under a navy rule |
| `.cards` / `.card` | Grey boxes. Use sparingly, never for comparable items |
| `.panel`, `.panel-navy`, `.panel-red`, `.statement` | Panels. Count toward the one-red / one-navy limit |
| `.logo-strip` | Client or investor logos, greyscale |
| `.cta`, `.cta.navy` | Closing call to action, with the contact block on the right |
| `.doc-footer` | Legal footer |

## Choosing a layout

- Comparing two or more products: a `.table.even-cols` with `col-title` headlines (see `product-comparison.html`).
- Beehive against an alternative: a `.table.versus` with grouped rows (see `why-beehive.html`).
- Introducing the company: the title block, a credentials line, `.stats`, a product table, `.steps`, logos and a navy CTA (see `company-profile.html`).
- Anything else: start from `_starter.html` and favour tables and ruled lists over boxes.

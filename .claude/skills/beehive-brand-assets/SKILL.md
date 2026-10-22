---
name: beehive-brand-assets
description: Creates Beehive (beehive.ae) brand assets — one-pagers, product sheets, comparison sheets, company profiles, fact sheets, flyers, presentation slides, social graphics, email banners and web sections — in the house colours, typeface, layout and plain-English voice, so every asset looks like it came from the same place. Use whenever someone asks to create, design, build, redesign or update any Beehive-branded asset or collateral, to turn content into an on-brand Beehive asset, or to make an existing Beehive asset consistent with the rest. Works in chat, design and code.
---

# Beehive brand assets

This skill creates Beehive brand assets. Every asset, internal or external, should share one look and be readable by someone with no finance background.

Beehive is an SME financier, regulated by the DFSA and part of e&. This skill holds the house system: a stylesheet, logos, page templates, the approved facts and the writing rules. Build assets from them; don't design from scratch.

## What to read

| Need | Read |
|---|---|
| Colours, type, layout, components, asset formats | `references/brand.md` |
| The words on the asset | `references/plain-english.md` |
| Any figure, rate, product term or legal line | `references/facts.md` (never invent or round a figure) |
| Building a printed or PDF asset | `kit/templates/_starter.html` plus the closest example in `kit/templates/` |

Example templates (A4):
- `product-comparison.html`: two products compared, plus a documents checklist
- `why-beehive.html`: Beehive against banks, using the head-to-head `.table.versus` table
- `company-profile.html`: company intro, key figures, products, steps and logos

## Workflow

1. **Pin down the asset.** What type it is (see "Asset formats" in `brand.md`), who it's for (SME owners, partners, investors, staff), and where it will be used (print, PDF, email, social, screen).
2. **Get the facts from `references/facts.md`.** If a figure is needed but not listed, ask for it. Don't guess. If the person gives a figure that conflicts with the file, flag the conflict and use theirs.
3. **Write the copy** using `references/plain-english.md`. Keep one idea per sentence, use no jargon, and cut until it fits the format.
4. **Build the asset.** For print or PDF, start from the starter and the closest example. Keep the fixed parts (header, title block, CTA, footer). For other formats, apply the same tokens and rules at the sizes in `brand.md`.
5. **Check it** against the list at the bottom of this file, then hand over the asset and a short list of anything unconfirmed.

## By surface

**Code (repo or terminal with files).** Work inside `kit/`. Save a new A4 asset in `kit/templates/` linking `../beehive.css`. Render with `cd kit && npm install && node render.mjs templates/<name>.html`, which writes `out/<name>.pdf` and a PNG preview. Look at the PNG to confirm nothing is cut off. If it overflows, shorten the copy before you shrink the type. For other formats, set the page size in the asset's own `<style>` (e.g. `@page { size: 1080px 1080px }` and matching `.page` width and height) and render the same way.

**Chat.** Produce one self-contained HTML asset the person can view, print or share. Run `python3 scripts/build_standalone.py kit/templates/<name>.html out.html` to inline the stylesheet and logo. If you can't run code, paste `kit/beehive.css` into a `<style>` tag yourself. Give the finished asset, not a description of one.

**Design (canvas, slides, mock-ups, Figma-style specs).** Treat `references/brand.md` as the design system: colours, type scale, radius, spacing and the asset formats. The same layout rules apply: one red block per asset, navy text, tables with shaded rows or a shaded column, and the legal footer on anything customers see.

## Rules that never bend

- **Colour.** Navy `#0F1430` for text, red `#E00800` only as the accent. An asset has at most one solid red block and at most one navy panel.
- **Logo.** Use `kit/assets/beehive-logo.png` on light backgrounds and `beehive-logo-white.png` on navy or red. Never recolour, stretch or redraw it.
- **Type.** Titles are Light and in sentence case, and never bold. Only small labels are uppercase.
- **Structure.** Every asset shows the logo, a clear title, one call to action and, if customers will see it, the DFSA line.
- **Tables.** Rows must be easy to tell apart: shade every other row (the default `.table`) or one column (`.table.versus`). Never use both on the same table.
- **Fewer cards.** Prefer tables and ruled lists to rounded boxes. Use at most one row of cards, and only when the items aren't comparable.
- **Plain English.** Anyone should understand it at first read. Follow the swap list in `references/plain-english.md`.
- **Legal.** Mark every rate with `*` and keep the rate footnote on the same asset. Copy the DFSA line word for word. Any change to legal or footnote wording needs Compliance sign-off; say so when you hand over.
- **Spelling.** Write "Shariah" (Shariah-compliant), except the certifier's name: "Shariyah Review Bureau".

## Before handing over

- [ ] Every figure matches `references/facts.md`, or the conflict is flagged
- [ ] No term from the plain-English swap list is left unexplained
- [ ] Correct logo for the background, at most one red block, navy text, light titles
- [ ] Every table has shaded rows or a shaded column
- [ ] Rate footnote and DFSA line are present and word for word, where required
- [ ] It fits its format (one A4 page, one slide, or one square tile), checked by rendering when possible
- [ ] Anything left unconfirmed (new wording, placeholder logos or QR code) is listed in your reply

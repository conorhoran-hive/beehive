---
name: beehive-documents
description: Creates, rewrites and reviews Beehive (beehive.ae) branded documents and copy — one-pagers, product guides, comparisons, company profiles, fact sheets, internal briefs, slides and web sections — so they share one colour scheme, typeface, layout and plain-English voice. Use whenever someone asks for anything Beehive-branded or "on brand", asks to make a Beehive document consistent, professional or easier to read, mentions Beehive collateral, a one-pager, product sheet, comparison sheet or company profile, or pastes Beehive copy to simplify or check. Also use for reviewing a Beehive draft against brand and plain-English rules. Works in chat, design and code.
---

# Beehive documents

Beehive is a DFSA-regulated SME financier and an e& enterprise company. Every external or internal document should look like it came from the same place and be readable by someone with no finance background.

This skill holds the house system: a stylesheet, logos, four page templates, the approved facts and the writing rules. Use them instead of designing from scratch.

## What to read

| Need | Read |
|---|---|
| Colours, type, layout, components | `references/brand.md` |
| Writing or simplifying copy | `references/plain-english.md` |
| Any figure, rate, product term or legal line | `references/facts.md` (never invent or round a figure) |
| Building a page | `kit/templates/_starter.html` plus the closest example in `kit/templates/` |

Example templates:
- `product-comparison.html`: two products compared, plus a documents checklist
- `why-beehive.html`: Beehive against banks, using the head-to-head `.table.versus` table
- `company-profile.html`: company intro, key figures, products, steps and logos

## Workflow

1. **Work out the job.** Is it a new document, a rewrite of an existing one, or a review? Who reads it: SME owners, partners, investors or staff?
2. **Get the facts from `references/facts.md`.** If a figure is needed but not listed, ask for it. Don't guess. If the person gives a figure that conflicts with the file, flag the conflict and use theirs.
3. **Write the copy first** using `references/plain-english.md`. Keep one idea per sentence and turn jargon into plain words.
4. **Build the page** from the starter and the closest example. Keep the fixed parts (header, title block, CTA, footer) and choose body components to suit the content.
5. **Check it** against the list at the bottom of this file before handing it over.

## By surface

**Code (repo or terminal with files).** Copy `kit/` or work inside it. Write the new page in `kit/templates/` and link `../beehive.css`. Render with `cd kit && npm install && node render.mjs templates/<name>.html`, which writes `out/<name>.pdf` and a PNG. Look at the PNG to confirm the page fits on one A4 page with nothing cut off. If it overflows, shorten the copy before you shrink the type.

**Chat (no project files, or the person wants something to view or share).** Write one self-contained HTML page. Run `python3 scripts/build_standalone.py kit/templates/<name>.html out.html` to inline the stylesheet and logo into a single file. If you can't run code, paste the contents of `kit/beehive.css` into a `<style>` tag yourself. For a copy-only request (an email, a LinkedIn post, a rewrite), skip the layout and apply only `references/plain-english.md` and `references/facts.md`.

**Design (canvas, slides, Figma-style specs, web sections).** Use the tokens in `references/brand.md` as the design system: colours, type scale, radius and spacing. The layout rules still apply: one red block per page, navy text, tables with shaded rows or a shaded column, and the legal footer on anything customers see. For slides, use one idea per slide, a light title, a figure strip for numbers, and the legal line on the closing slide.

## Rules that never bend

- **Colour.** Navy `#0F1430` for text, red `#E00800` only as the accent. A page has at most one solid red block and at most one navy panel.
- **Type.** Titles are Light and in sentence case, and never bold. Only the document-type label in the header is uppercase.
- **Structure.** Every page has a header (logo plus document type), an eyebrow, title and lede, one call to action, and a footer with the regulatory line, reference and date.
- **Tables.** Rows must be easy to tell apart: shade every other row (the default `.table`) or one column (`.table.versus`). Never use both on the same table.
- **Fewer cards.** Prefer tables and ruled lists to rounded boxes. Use at most one row of cards, and only when the items aren't comparable.
- **Plain English.** Anyone should understand it at first read. Follow the swap list in `references/plain-english.md`.
- **Legal.** Mark every rate with `*` and keep the rate footnote on the page. Copy the DFSA line word for word. Any change to legal or footnote wording needs Compliance sign-off; say so when you hand over.
- **Spelling.** Write "Shariah" (Shariah-compliant), except the certifier's name: "Shariyah Review Bureau".

## Before handing over

- [ ] Every figure matches `references/facts.md`, or the conflict is flagged
- [ ] No term from the plain-English swap list is left unexplained
- [ ] One red block at most, navy text, light titles
- [ ] Every table has shaded rows or a shaded column
- [ ] Rate footnote and DFSA line are present and word for word
- [ ] It fits the format (one A4 page, if printed), checked by rendering when possible
- [ ] Anything left unconfirmed (new wording, placeholder logos or QR code) is listed in your reply

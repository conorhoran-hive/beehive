# Beehive document templates

One design system for every printed or PDF collateral piece: product guides, comparisons, company profiles, fact sheets and internal briefs. Every document is a single A4 page (or several) built from the same stylesheet, so the colour, type and layout stay consistent.

```
beehive.css            Tokens and components (the single source of truth)
assets/                Logo (red on white, and white for dark panels)
templates/_starter.html   Blank page: copy this for a new document
templates/*.html       Finished examples
render.mjs             Exports every template to out/*.pdf and out/*.png
```

## Make a new document

1. Copy `templates/_starter.html` and rename it, for example `templates/islamic-window.html`.
2. Set the document type in the header and a reference in the footer (`BH-XX-00 · v1.0 · Month YYYY`).
3. Keep the header, title block, CTA and footer. Pick body components from the list below.
4. Export it with `npm install && npm run render`. You can also open the HTML in Chrome and print to PDF (A4, margins *None*, *Background graphics* on).

## Brand rules

**Colour.** Navy carries the text. Red is the accent: use it for emphasis, not for decoration.

| Token | Hex | Use |
|---|---|---|
| `--bh-red` | `#E00800` | Eyebrow, highlighted column, CTA band, product names |
| `--bh-navy` | `#0F1430` | All headings and body text, strong rules |
| `--bh-navy-deep` | `#181F49` | Dark panels and the navy CTA |
| `--bh-slate` | `#626678` | Secondary text, table row labels |
| `--bh-mute` | `#9A9DAA` | Footnotes, logo placeholders |
| `--bh-rule` | `#E0E1E5` | Hairlines between rows |
| `--bh-surface` | `#F2F2F4` | Cards and product panels |
| `--bh-red-tint` | `#FCEBEB` | Soft highlight, sparingly |

A page has at most **one** solid red block (the CTA band or the statement panel) and at most one navy panel.

**Type.** Inter is a stand-in for the brand typeface. To swap it, change `--bh-font` and the `@import` line in `beehive.css`.
- Titles are Light (300) in sentence case. Headings are never bold.
- Labels and highlighted values are Medium (500). Body text is Regular (400).
- Uppercase is only used for the document-type label in the header.

**Voice.** Write in a confident, plain, factual voice.
- Lead with the figure and say what it means: "Funds within 48 hours of approval".
- Write "~11% per year", not "only 11%!". Avoid exclamation marks and superlatives.
- Mark every rate with `*` and keep the rate footnote on the page. Rates are profit rates, not interest.
- Keep money in one format: `AED 500K – 2.5M`, `AED 5.4bn+`.
- Spell it "Shariah" (Shariah-compliant, Shariah Supervisory Board). The one exception is the certifier's proper name: "Shariyah Review Bureau".
- Track record is counted from 2014 (12 years in 2026). Update it each January.

**Plain English.** Write for someone who has never borrowed for a business. If a word needs a finance background, swap it or explain it in brackets the first time.
- Short sentences, one idea each. Talk to the reader as "you" and about Beehive as "we".
- Spell out abbreviations once per document: small and medium-sized businesses (SMEs), Dubai Financial Services Authority (DFSA).
- Never shorten or reword the DFSA regulatory line. Any change to the rate footnote must be approved by Compliance first.

| Instead of | Write |
|---|---|
| Facility size | How much |
| Tenor | Time to repay |
| Eligibility | Who can apply |
| Annual revenue | Yearly sales |
| Collateral / security / unsecured | Property or other assets / No property or other assets needed |
| Cash margin | Cash deposit |
| Assignment of invoices | Signing your invoices over to us |
| Early settlement charges | A fee to repay early |
| Disbursement / funds transferred | Money in your account |
| Credit decision / assessment | An answer / we review your business |
| Ageing reports | Lists of money owed to you and money you owe (ageing reports) |
| Management accounts | Accounts signed by your management |
| MoA | Company founding document (MoA) |
| Tenancy contract | Office lease |
| Non-performing financing | Funding not repaid as agreed |
| B2B | Other businesses |
| Since inception | Since 2014 |

**Tables.** Every table needs something that separates its rows. `.table` shades every other row automatically. A head-to-head comparison uses `.table.versus` instead, which shades the Beehive column and groups rows under small headings. Use only one of the two on a table, never both.

**Always on the page:** the logo, the document-type label, the DFSA regulatory line, the reference and date.

## Components

| Class | What it is |
|---|---|
| `.hero` + `.panel-red.statement` | Title with the brand statement panel |
| `.stats` | Row of key figures (set `style="--cols:3"` for three) |
| `.cards` | Grey benefit cards |
| `.table` / `.table.compact` | Table with every other row shaded; `th.hl` / `td.hl` highlight a column, `td.dim` mutes one. Add `.even-cols` to line up stacked tables, or `.no-stripe` to turn shading off |
| `.table.versus` | Head-to-head table: tinted Beehive column with a red cap, rows grouped with `tr.group` (see `why-beehive.html`) |
| `.summary` | Product summaries under a navy rule |
| `.product` | Product card with pricing and eligibility |
| `.steps` | Numbered 01 / 02 / 03 process |
| `.panel-navy` + `.stat-stack` | Dark sidebar with stacked proof points |
| `.logo-strip` | Client or investor logos (greyscale) |
| `.cta` / `.cta.navy` | Closing call to action |

## Keep figures in one place

Headline figures (years, SMEs funded, AED provided, NPL rate) and the regulatory line appear on several documents. When they change, update every template in the same commit.

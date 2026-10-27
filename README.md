# Beehive eligibility form

| File | Characters | What it is |
|---|---|---|
| `legacy/original.html` | 106,022 | The original iframe page, kept as the reference for the parity test |
| `dist/webflow-embed.html` | ~37,300 | **Paste into a Webflow Code Embed** (limit is 50,000) |
| `dist/index.html` | ~38,300 | Drop-in replacement for the current GitHub-hosted iframe page |

Edit `src/form.jsx` and `src/form.css`, then run `npm run build`. Never edit `dist/` by hand.
`npm test` builds the form and runs `test/parity.mjs`.

## How the size was cut (design and DOM unchanged)

- **Pre-compiled JSX.** Babel no longer runs in the browser, and the code is minified at build time.
  This also drops a ~3 MB Babel download, and React now loads as production builds with SRI hashes.
- **Removed the "Tweaks" design panel** (~14k characters). It was a prototyping tool that never shows on the live site.
- **Removed dead code**: 14 unused icons, the logo, MultiOptionGroup/Segmented, the unused
  currency/FX helpers, and the dark theme and stepper styles (the live form only uses the light theme and the bar).
- **Removed unused CSS** (offer card, summary card, badges and others) and minified the rest.
- **Shortened the industry list.** It's now one string of labels per sector, and each HubSpot value is derived from its label
  (`"Apparel & Fashion"` → `APPAREL_FASHION`). The test checks that every value matches the original.

## Putting it on Webflow

1. Add a **Code Embed** where the iframe was and paste in all of `dist/webflow-embed.html`.
2. Delete the iframe, plus the page scripts that only existed for it: the iframe height resizer and the
   `beehive-eligibility-form` postMessage → dataLayer relay. The relay can't double-count
   (the embed never posts messages), but it's dead code now.
3. Check the **UTM relay** script, if you have one. If it calls `iframe.contentWindow.postMessage(...)`, change it to
   `window.postMessage({ type: 'beehive_utms', utms }, '*')`. Without the change the embed still picks up `utm_*`
   from the page URL, but it loses UTMs that are carried across pages.
4. Publish to staging first and check the items below.

## Tracking: what stays the same, what changes

The parity test runs the original and both new builds through the same journeys, at desktop and mobile widths.

| Platform | Iframe build (`dist/index.html`) | Inline embed (`dist/webflow-embed.html`) |
|---|---|---|
| **GA4 / Google Ads** (via GTM) | Same dataLayer pushes and same postMessage relay payloads | Pushes the same `{event, form_name, …}` objects straight into the site's GTM `dataLayer`, with no relay needed. **Check in GTM Preview** that your relay didn't rename or reshape events. |
| **HubSpot** | Request body is byte-for-byte the same | Same fields and `pageName`. `pageUri` becomes the real Webflow URL instead of the GitHub URL. |
| **ContentSquare** | Same tag, same DOM and class names | The embed does **not** load the CS tag, because the Webflow page's own tag records it. Confirm tag `24e5fc3c98aa4` is on that page. Form sessions will now show under the Webflow URL, not the GitHub iframe URL, so update any CS zones or page groups that point at the old URL. |

The test also checks that:
- the events `form_start`, `form_step_complete` (with `step`, `step_label`, `annual_revenue_aed`), `form_submit`, `generate_lead` and `dwell_time` (30/60/120s) are identical, in the same order with the same parameters
- the HubSpot request matches, field for field, for an eligible lead and an ineligible lead, including UTMs
- the rendered DOM of `#beehive-form` is identical at every step
- every screenshot matches pixel for pixel, apart from sub-pixel anti-aliasing noise

Inline-only differences to be aware of:
- `dwell_time.page_path` reports the Webflow page path, not the iframe's path.
- The form now sits inside the Webflow page's CSS. All its rules are scoped under `#beehive-form`, and
  Webflow's default `h1`/`p`/`label`/`button` styles are reset, so it renders identically in the test host page.
  But if the site defines classes with the same names (`.btn`, `.main`, `.field`, `.input`, `.chip`, `.step`, `.options`,
  `.result`, `.intro`), check the form on staging.
- The industry search sheet now covers the page viewport instead of just the iframe area.
- The only message the original sent that the new build doesn't is `{type: '__edit_mode_available'}`, from the removed Tweaks panel.
  It isn't a tracking event.

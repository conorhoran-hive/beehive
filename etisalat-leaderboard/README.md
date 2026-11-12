# Etisalat partner leaderboard: automatic email delivery

Sends the daily Etisalat partner leaderboard to Etisalat leadership as a downloadable, interactive `.html` attachment. The dashboard has the same design as the leaderboard email, plus a month picker from October 2026. It is sent from marketing.noreply via Power Automate, with no laptop involved. It works exactly like the Etisalat channel funnel delivery.

- `skill/etisalat-partner-leaderboard/scripts/dash_delivery.py`: settings-based hand-off helper (`build`, `check`, `body`, `verify`). Everything specific to one dashboard (markers, placeholder, file names, check selectors, body) is in the skill's `assets/delivery.json`. Run `--help` for details.
- `skill/etisalat-partner-leaderboard/scripts/tiny-inflate.js` (+ LICENSE, MIT): decompressor embedded in the template, so the page can unpack the day's data offline.

Not in git, on purpose: `SKILL.md`, `leaderboard.py`, `assets/` (including `delivery.json` with the flow key) and the generated template. They are delivered as the skill zip.

How it fits together:
1. The daily run verifies the data and builds `etisalat-partner-leaderboard.html`. The page's data sits in three lines: `const AS_OF`, `const AS_OF_LABEL`, `const DATA`.
2. `body` writes the email body (headline figures and changes since the last update). `build` splits the page into a fixed template (placeholder `%%ELB_PAYLOAD%%` and version marker `elb-tpl-<hash>`) plus about 3 KB of compressed data and body text. `check` proves the rebuilt file shows exactly the same text as the original in every month.
3. Claude drafts the data email to marketing.noreply (subject `[ETISALAT-LEADERBOARD-DATA] YYYY-MM-DD`), reads it back, `verify` confirms an exact match, then sends it.
4. Power Automate checks the key, lengths, date, template version and that today's file hasn't already been sent. It puts the data into the template from OneDrive, saves the file in `/Etisalat Leaderboard/Sent`, and emails it as an attachment. The page checks a checksum and shows "incomplete, please ask Beehive to resend" if the file is damaged.

The funnel still uses its own `etf_delivery.py`. `dash_delivery.py` is the same method in a settings-based form; the funnel can move to it after a test against a real funnel page.

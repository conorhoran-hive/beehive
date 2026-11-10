# Etisalat channel funnel: automatic email delivery

Sends the daily interactive dashboard to Etisalat leadership as an attachment, with no laptop involved.

- `skill/etisalat-channel-funnel/scripts/etf_delivery.py`: helper used by the daily Claude run (`standalone`, `body`, `build`, `check`, `verify`). Run `--help` for details.
- `skill/etisalat-channel-funnel/scripts/tiny-inflate.js`: small MIT-licensed decompressor embedded in the template, so the page can unpack the day's data offline.
- `power-automate-flow.md`: step-by-step build of the "Etisalat funnel auto-send" flow.

Not in git, on purpose: the skill's `SKILL.md` (it names clients in its decisions list), the flow key, and the generated template. They are delivered separately.

How it fits together:
1. The daily run verifies the data, republishes the dashboard and builds the standalone file (as before).
2. `body` and `build` split the file into a fixed template plus about 10 KB of compressed data and email-body text. `check` proves the rebuilt file shows exactly the same text as the original in every month and channel view.
3. Claude drafts an email with that text to marketing.noreply, reads it back, and `verify` confirms an exact match before sending.
4. Power Automate checks the key, lengths, date, template version and that today's file hasn't already been sent. It rebuilds the file from the OneDrive template, saves it in `/Etisalat Funnel/Sent`, and emails it to Etisalat.

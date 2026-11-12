# Etisalat partner leaderboard: automatic email delivery

Sends the daily leaderboard to Etisalat leadership from marketing.noreply via Power Automate, as a downloadable `.html` attachment, with no laptop involved. The attached file is identical, character for character, to the one the `etisalat-partner-leaderboard` skill builds, and opens offline in any browser.

Why not send it straight from Claude: the Microsoft 365 connector can't attach files or write to OneDrive, and the file is 35–120 KB, too large to transcribe reliably every day.

- `skill/etisalat-partner-leaderboard/scripts/elb_delivery.py`: hand-off helper (`template`, `build`, `check`, `verify`). Run `--help` for details.

Not in git, on purpose: the skill's `SKILL.md`, `leaderboard.py` and `assets/` (including `delivery.json` with the flow key), and the generated template. They are delivered as the skill zip.

How it fits together:
1. The daily run verifies the data and builds the email (as before).
2. `build` codes the email. A fixed dictionary, worked out from the skill's own `render_email()` on sample data, swaps the long repeated pieces (the opening section with the logo, the closing section, every long HTML tag) for 4-character codes such as `^0A^`. The dictionary lives in OneDrive as `etisalat-leaderboard-template.txt`. The day's data email is 1.5–9 KB. `build` and `check` prove that expanding it gives back the exact original.
3. Claude drafts the data email to marketing.noreply (subject `[ETISALAT-LEADERBOARD-DATA] YYYY-MM-DD`), reads it back, `verify` confirms an exact match, then sends it.
4. Power Automate checks the key, lengths, date, template version and that today's file hasn't already been sent. It then swaps each code back in order and checks the length and that no codes are left. It saves the file to `/Etisalat Leaderboard/Sent` and emails it as an attachment to Etisalat leadership, with a short fixed body written in the flow.

Unlike the funnel (a page that unpacks its own data with JavaScript), the leaderboard file has no script, so the flow rebuilds the HTML itself with plain `replace()` steps before attaching it.

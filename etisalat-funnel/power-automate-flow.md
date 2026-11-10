# Power Automate flow: "Etisalat funnel auto-send"

This flow turns the daily data email from Claude into the interactive dashboard and emails it to Etisalat as an attachment. Your laptop does not need to be on.

```
Claude daily run (cloud)
  checks pass → draft email to marketing.noreply → read back → exact match? → send
        │  subject [ETISALAT-FUNNEL-DATA] YYYY-MM-DD, body = one line of compressed data + email body
        ▼
This flow (Conor's Power Automate, marketing.noreply mailbox connection)
  check sender, key, length, date, template version, not already sent
  template + data → etisalat-channel-funnel-YYYY-MM-DD.html saved in /Etisalat Funnel/Sent
  send to Etisalat with the file attached → delete the data email
  any check fails → nothing goes to Etisalat; Conor gets an alert
```

Your existing flow ("Etisalat funnel email", Outbox → send → Sent) stays as it is. It is the manual fallback: drop a file in Outbox and it sends.

## Before you start

1. In OneDrive, create the folder `/Etisalat Funnel/Template`.
2. Upload `etisalat-funnel-template.html` (from the files Claude gave you) into it. Keep that exact file name.
3. Have these ready:
   - the flow key (Claude gave it to you separately; it is also in the skill file). Below it is written as `<FLOW_KEY>`.
   - the Etisalat recipient addresses.
   - your address for alerts.

## Naming matters

Expressions refer to actions by name. Rename each action **exactly** as shown in bold (click the action, then its title). Power Automate turns spaces into underscores, so these names have no spaces.

## Build

Create a new **Automated cloud flow** named `Etisalat funnel auto-send`.

### Trigger: When a new email arrives (V3) (Office 365 Outlook)

- Connection: **marketing.noreply@beehive.ae** (the same connection your other flow uses for sending)
- Folder: `Inbox`
- From: `marketing.noreply@beehive.ae`
- Subject Filter: `[ETISALAT-FUNNEL-DATA]`
- Include Attachments: `No`
- Settings (the trigger's ⋯ menu): turn **Concurrency control** on, with **Degree of parallelism** set to `1`

### Scope, renamed **Main**

Add a **Scope** action and rename it **Main**. Put steps 1 to 12 inside it.

| # | Action (connector) | Rename to | Settings |
|---|---|---|---|
| 1 | Html to text (Content Conversion) | **HtmlToText** | Content: dynamic content **Body** from the trigger |
| 2 | Compose | **Clean** | expression: `replace(replace(replace(body('HtmlToText'), decodeUriComponent('%0D'), ''), decodeUriComponent('%0A'), ''), ' ', '')` |
| 3 | Compose | **Parts** | `split(first(split(last(split(outputs('Clean'), 'ETF-BEGIN\|')), '\|ETF-END')), '\|')` |
| 4 | Compose | **BodyParts** | `split(first(split(last(split(outputs('Clean'), 'BODY-BEGIN\|')), '\|BODY-END')), '\|')` |
| 5 | Compose | **RunDate** | `replace(outputs('Parts')[3], 'date=', '')` |
| 6 | Compose | **FileName** | `concat('etisalat-channel-funnel-', outputs('RunDate'), '.html')` |
| 7 | Get file content using path (OneDrive for Business, **your** connection) | **GetTemplate** | File Path: `/Etisalat Funnel/Template/etisalat-funnel-template.html` · Infer Content Type: `No` |
| 8 | Compose | **TemplateText** | `base64ToString(body('GetTemplate')?['$content'])` |
| 9 | List files in folder (OneDrive for Business, your connection) | **ListSent** | Folder: `/Etisalat Funnel/Sent` |
| 10 | Filter array | **AlreadySent** | From: `body('ListSent')` · condition (advanced mode): `@equals(item()?['Name'], outputs('FileName'))` |
| 11 | Compose | **CheckReport** | expression below |
| 12 | Condition | **AllChecksPass** | expression below |

In the table, `\|` is a plain `|` character. Type `|` (it is escaped only so the table displays).

**CheckReport** (step 11). This text goes into the alert email, so a failure tells you which check failed:

```
concat('parts=', string(length(outputs('Parts'))),
 '; version=', string(equals(outputs('Parts')[0], 'v1')),
 '; key=', string(equals(outputs('Parts')[1], 'key=<FLOW_KEY>')),
 '; dataLength=', string(equals(outputs('Parts')[4], concat('len=', string(length(last(outputs('Parts'))))))),
 '; bodyLength=', string(equals(first(outputs('BodyParts')), concat('len=', string(length(last(outputs('BodyParts'))))))),
 '; date=', outputs('RunDate'), ' today=', convertFromUtc(utcNow(), 'Arabian Standard Time', 'yyyy-MM-dd'),
 '; template=', string(contains(outputs('TemplateText'), concat('etf-tpl-', replace(outputs('Parts')[2], 'tpl=', ''), '"'))),
 '; alreadySent=', string(greater(length(body('AlreadySent')), 0)))
```

**AllChecksPass** (step 12). Set the left side to this expression, the operator to **is equal to**, and the right side to the expression `true`:

```
and(
 equals(length(outputs('Parts')), 6),
 equals(outputs('Parts')[0], 'v1'),
 equals(outputs('Parts')[1], 'key=<FLOW_KEY>'),
 equals(outputs('Parts')[4], concat('len=', string(length(outputs('Parts')[5])))),
 equals(length(outputs('BodyParts')), 2),
 equals(outputs('BodyParts')[0], concat('len=', string(length(outputs('BodyParts')[1])))),
 equals(outputs('RunDate'), convertFromUtc(utcNow(), 'Arabian Standard Time', 'yyyy-MM-dd')),
 contains(outputs('TemplateText'), concat('etf-tpl-', replace(outputs('Parts')[2], 'tpl=', ''), '"')),
 contains(outputs('TemplateText'), '%%ETF_PAYLOAD%%'),
 equals(length(body('AlreadySent')), 0)
)
```

#### If yes (all checks pass)

| # | Action | Rename to | Settings |
|---|---|---|---|
| Y1 | Compose | **Built** | `replace(outputs('TemplateText'), '%%ETF_PAYLOAD%%', outputs('Parts')[5])` |
| Y2 | Create file (OneDrive for Business, your connection) | **SaveCopy** | Folder Path: `/Etisalat Funnel/Sent` · File Name: `outputs('FileName')` · File Content: `outputs('Built')` |
| Y3 | Get file content (OneDrive for Business, your connection) | **GetBuilt** | File: `body('SaveCopy')?['Id']` · Infer Content Type: `No` |
| Y4 | Send an email (V2) (Office 365 Outlook, **marketing.noreply** connection) | **SendToEtisalat** | details below |
| Y5 | Delete email (V2) (Office 365 Outlook, marketing.noreply connection) | **DeleteDataEmail** | Message Id: `triggerOutputs()?['body/id']` |

**SendToEtisalat** (Y4):
- To: the Etisalat recipients. Recipients are set **only here**; Claude cannot change them.
- Subject: `concat('Etisalat channel funnel – ', formatDateTime(outputs('RunDate'), 'd MMM yyyy'))`
- Body: add the expression `base64ToString(outputs('BodyParts')[1])` as a token. This is the email body Claude wrote: headline numbers, changes since the last update, sign-off, address and regulatory status.
- Attachments (show advanced options): Name = `outputs('FileName')`, Content = `body('GetBuilt')`

#### If no (a check failed)

| # | Action | Rename to | Settings |
|---|---|---|---|
| N1 | Send an email (V2) (marketing.noreply connection) | **AlertChecksFailed** | To: you · Subject: `Etisalat funnel NOT sent – checks failed` · Body: `outputs('CheckReport')` |
| N2 | Terminate | **StopFailed** | Status: `Failed` |

Leave the data email in the inbox. Once you've fixed the cause (usually a new template), open the failed run and click **Resubmit**. That works the same day only, because of the date check.

### After the scope: alert on unexpected errors

Add **Send an email (V2)** (marketing.noreply connection) after **Main** (outside it), renamed **AlertError**. In its ⋯ menu choose **Settings** (or **Configure run after**) and tick only **has failed** and **has timed out** for Main.

- To: you
- Subject: `Etisalat funnel flow error`
- Body: `concat('The Etisalat funnel flow failed. Run: https://make.powerautomate.com/environments/', workflow()?['tags']?['environmentName'], '/flows/', workflow()?['name'], '/runs/', workflow()?['run']?['name'])`

Save the flow.

## Testing (in this order)

1. **Internal dry run.** Temporarily set SendToEtisalat's To field to your own address. Ask Claude to "run the Etisalat funnel hand-off test" (or wait for the daily run). Check:
   - you received the email with the file attached and the body text;
   - the attachment opens in Chrome or Edge, with the month dropdown and channel tabs working;
   - `/Etisalat Funnel/Sent/etisalat-channel-funnel-YYYY-MM-DD.html` exists;
   - the data email is gone from the marketing.noreply inbox.
2. **Failure path.** In OneDrive, rename the template file for a moment and resubmit the run. You should get "NOT sent – checks failed" with `template=False`. Rename the file back.
3. **Duplicate guard.** Resubmit a successful run. You should get the alert with `alreadySent=True`, and no second email.
4. **External recipient.** Send to one Etisalat contact first and confirm the .html attachment arrives and isn't stripped. If it is, ask Etisalat IT to allow `marketing.noreply@beehive.ae`.
5. Put the full Etisalat list in To.

## When the dashboard design changes

The daily run builds today's template from the published page. If the design has changed, the version in the data email no longer matches the file in `/Template`. The flow then stops with `template=False`, and nothing wrong goes to Etisalat. Claude also tells you in its daily summary that the template changed and gives you the new `etisalat-funnel-template.html`. Upload it over the old one (same name), then resubmit the failed run.

## What each check protects against

| Check | Protects against |
|---|---|
| Sender filter + key | anyone else emailing marketing.noreply with that subject to get their HTML sent to Etisalat |
| Length of data and body | a truncated or altered email |
| Date = today (Dubai) | an old data email being replayed |
| Template version | sending today's data in an outdated design |
| Already in Sent | a second send on the same day |
| Page checksum (inside the file) | any corruption that slipped through: the page shows "incomplete, please ask Beehive to resend" instead of wrong numbers |

On Claude's side, nothing is sent unless the day's verification passes (no script errors, deal figures match HubSpot), the rebuilt file matches the page in every month and channel view, and the draft read back from Outlook matches the data character for character.

#!/usr/bin/env python3
"""Etisalat channel funnel: data hand-off for the Power Automate email flow.

The daily run cannot attach files to email or write to OneDrive, so it emails only
the day's data (compressed) to marketing.noreply. Power Automate puts that data into
the template HTML stored in OneDrive and sends the result as an attachment.

Commands
  standalone <artifact_read.html> --out FILE
          Turns the saved Artifact read (with the platform skeleton) into the
          standalone offline file (Step 6.2 of the skill).
  build   <standalone.html> --outdir DIR --key KEY [--body body.html]
          Splits the day's standalone dashboard into
            DIR/etisalat-funnel-template.html  (page with a data placeholder + version)
            DIR/payload.txt                    (the exact text for the data email body)
            DIR/rebuilt.html                   (what Power Automate will produce)
            DIR/meta.json                      (sizes, template version, fingerprint)
  check   <standalone.html> --outdir DIR
          Opens standalone.html and DIR/rebuilt.html in headless Chromium, clicks every
          period and channel, and confirms the visible text is identical and there are
          no script errors. Exit code 0 only if they match.
  verify  --outdir DIR [--transcripts GLOB]
          Finds the newest Microsoft 365 read_resource result in the session
          transcript that contains ETF-BEGIN and confirms its body is exactly
          DIR/payload.txt. Exit code 0 only on an exact match. Never retype the
          read-back by hand; this reads it from the transcript.
"""
import argparse, base64, glob, hashlib, html, json, os, re, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
PLACEHOLDER = "%%ETF_PAYLOAD%%"
TPL_MARK = "etf-tpl-"


def _read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def _write(p, s):
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)


def _line(src, name):
    m = re.search(r"^const %s = (.*);[ \t]*$" % name, src, re.M)
    if not m:
        sys.exit("ERROR: could not find 'const %s = ...;' line" % name)
    return m


LOADER = r"""<script>
/* Etisalat funnel data loader: the day's data is inserted below by Power Automate. */
(function(){
%(inflate)s
function fail(msg){
  document.addEventListener("DOMContentLoaded",function(){
    document.body.innerHTML='<p style="font:16px sans-serif;padding:24px">This dashboard file is incomplete ('+msg+'). Please ask Beehive to resend it.</p>';
  });
  throw new Error("ETF data: "+msg);
}
window.etfLoad=function(b64){
  if(!b64 || b64.charAt(0)==="%%") fail("no data");
  var bin; try{ bin=atob(b64); }catch(e){ fail("bad encoding"); }
  var src=new Uint8Array(bin.length); for(var i=0;i<bin.length;i++) src[i]=bin.charCodeAt(i);
  if(src.length<6 || (src[0]&15)!==8) fail("bad header");
  var out; try{ out=tinf_uncompress(src.subarray(2,src.length-4), new Uint8Array(16*1024*1024)); }catch(e){ fail("cannot decompress"); }
  var a=1,b=0; for(var j=0;j<out.length;j++){ a=(a+out[j])%%65521; b=(b+a)%%65521; }
  var n=src.length, want=((src[n-4]<<24)|(src[n-3]<<16)|(src[n-2]<<8)|src[n-1])>>>0;
  if((((b<<16)|a)>>>0)!==want) fail("checksum mismatch");
  var p; try{ p=JSON.parse(new TextDecoder("utf-8").decode(out)); }catch(e){ fail("bad data"); }
  return p;
};
})();
</script>
"""


def cmd_build(a):
    page = _read(a.standalone)
    for n in ("AS_OF", "AS_OF_LABEL", "DATA"):
        _line(page, n)
    as_of = json.loads(_line(page, "AS_OF").group(1))
    as_of_label = json.loads(_line(page, "AS_OF_LABEL").group(1))
    data = json.loads(_line(page, "DATA").group(1))

    # 1. Template: same page, the three data lines replaced by the loader call.
    tpl = page
    m1, m3 = _line(tpl, "AS_OF"), _line(tpl, "DATA")
    if not (m1.start() < _line(tpl, "AS_OF_LABEL").start() < m3.start()):
        sys.exit("ERROR: AS_OF / AS_OF_LABEL / DATA lines are not in the expected order")
    between = tpl[m1.start():m3.end()]
    if len(between.split("\n")) != 3:
        sys.exit("ERROR: expected AS_OF, AS_OF_LABEL and DATA on three consecutive lines")
    call = ('const ETF_P = etfLoad("%s");\n'
            "const AS_OF = ETF_P.asOf, AS_OF_LABEL = ETF_P.asOfLabel, DATA = ETF_P.data;") % PLACEHOLDER
    tpl = tpl[:m1.start()] + call + tpl[m3.end():]
    # loader script goes just before the main script
    idx = tpl.rfind("<script>", 0, tpl.find(call))
    if idx < 0:
        sys.exit("ERROR: main <script> not found")
    loader = LOADER % {"inflate": _read(os.path.join(HERE, "tiny-inflate.js")).replace("module.exports = tinf_uncompress;", "")}
    tpl = tpl[:idx] + loader + tpl[idx:]
    head_end = tpl.find("</head>")
    if head_end < 0:
        sys.exit("ERROR: standalone file has no </head>")
    marker = '<meta name="etf-template" content="%s%s">\n'
    tpl0 = tpl[:head_end] + marker % (TPL_MARK, "0") + tpl[head_end:]
    version = hashlib.sha256(tpl0.encode("utf-8")).hexdigest()[:12]
    tpl = tpl[:head_end] + marker % (TPL_MARK, version) + tpl[head_end:]
    if tpl.count(PLACEHOLDER) != 1:
        sys.exit("ERROR: placeholder must appear exactly once in the template")
    if re.search(r'"(contacts|leads|deals)"\s*:', tpl):
        sys.exit("ERROR: template still contains DATA")

    # 2. Payload: zlib-compressed JSON, base64, one line with markers.
    raw = json.dumps({"asOf": as_of, "asOfLabel": as_of_label, "data": data},
                     ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    b64 = base64.b64encode(zlib.compress(raw, 9)).decode("ascii")
    key = a.key.strip()
    if not re.fullmatch(r"[A-Za-z0-9]{8,64}", key):
        sys.exit("ERROR: key must be 8-64 letters/digits")
    lines = ["ETF-BEGIN|v1|key=%s|tpl=%s|date=%s|len=%d|%s|ETF-END" % (key, version, as_of, len(b64), b64)]
    if a.body:
        body = _read(a.body).strip()
        if re.search(r"<script|<iframe|on\w+\s*=", body, re.I):
            sys.exit("ERROR: email body may not contain scripts or event handlers")
        bb = base64.b64encode(body.encode("utf-8")).decode("ascii")
        lines.append("BODY-BEGIN|len=%d|%s|BODY-END" % (len(bb), bb))
    payload = "\n".join(lines)

    # 3. Simulate Power Automate: string replace of the placeholder.
    rebuilt = tpl.replace(PLACEHOLDER, b64)

    os.makedirs(a.outdir, exist_ok=True)
    _write(os.path.join(a.outdir, "etisalat-funnel-template.html"), tpl)
    _write(os.path.join(a.outdir, "payload.txt"), payload)
    _write(os.path.join(a.outdir, "rebuilt.html"), rebuilt)
    meta = {"asOf": as_of, "templateVersion": version, "templateBytes": len(tpl.encode()),
            "dataJsonBytes": len(raw), "payloadChars": len(payload), "b64Len": len(b64),
            "payloadSha256": hashlib.sha256(payload.encode()).hexdigest(),
            "fileName": "etisalat-channel-funnel-%s.html" % as_of}
    _write(os.path.join(a.outdir, "meta.json"), json.dumps(meta, indent=1))
    print(json.dumps(meta, indent=1))


CHECK_JS = r"""
const { chromium } = require('playwright');
(async () => {
  const [a, b] = process.argv.slice(2);
  const browser = await chromium.launch();
  async function snap(file) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) errs.push(m.text()); });
    await page.route(/^https?:/, r => r.abort());
    await page.goto('file://' + file);
    await page.waitForTimeout(300);
    const out = [];
    const periods = await page.$$eval('#period option', os => os.map(o => o.value));
    const tabs = await page.$$eval('#tabs button', bs => bs.map(b => b.dataset.ch));
    if (!periods.length || !tabs.length) errs.push('no periods or tabs rendered');
    for (const p of periods) {
      await page.selectOption('#period', p);
      for (const t of tabs) {
        await page.click('#tabs button[data-ch="' + t + '"]');
        out.push(p + '|' + t + '\n' + await page.innerText('main'));
      }
    }
    out.push(await page.innerText('header'));
    await ctx.close();
    return { errs, text: out.join('\n----\n'), views: periods.length * tabs.length };
  }
  const x = await snap(a), y = await snap(b);
  await browser.close();
  const ok = !x.errs.length && !y.errs.length && x.text === y.text && x.views > 0;
  console.log(JSON.stringify({ ok, views: x.views, errorsOriginal: x.errs, errorsRebuilt: y.errs, sameText: x.text === y.text }));
  process.exit(ok ? 0 : 1);
})();
"""


def cmd_check(a):
    import subprocess, tempfile
    js = os.path.join(tempfile.mkdtemp(), "etf_check.js")
    _write(js, CHECK_JS)
    r = subprocess.run(["node", js, os.path.abspath(a.standalone),
                        os.path.abspath(os.path.join(a.outdir, "rebuilt.html"))],
                       capture_output=True, text=True, timeout=300)
    print(r.stdout.strip() or r.stderr.strip())
    sys.exit(r.returncode)


def cmd_standalone(a):
    s = _read(a.artifact)
    if "<title>" not in s or "<header>" not in s:
        sys.exit("ERROR: not a dashboard page (no <title> or <header>)")
    s = s[s.index("<title>"):]
    if "</body></html>" in s:
        s = s[:s.rindex("</body></html>")]
    s = re.sub(r'<meta name="claude:viewport-fit-sides"[^>]*>\n?', "", s)
    i = s.index("<header>")
    out = ('<!doctype html><html lang="en"><head><meta charset="utf-8">'
           '<meta name="viewport" content="width=device-width,initial-scale=1">'
           + s[:i] + "</head><body>" + s[i:] + "</body></html>")
    _write(a.out, out)
    print(json.dumps({"out": a.out, "bytes": len(out.encode())}))


TILES_JS = r"""
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const res = {};
  for (const [name, file] of [['cur', process.argv[2]], ['prev', process.argv[3]]]) {
    if (!file) continue;
    const page = await browser.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.route(/^https?:/, r => r.abort());
    await page.goto('file://' + file);
    await page.waitForTimeout(300);
    const opts = await page.$$eval('#period option', os => os.map(o => [o.value, o.textContent]));
    await page.click('#tabs button[data-ch="all"]');
    const views = {};
    for (const [v, label] of opts.slice(0, 2)) {
      await page.selectOption('#period', v);
      views[v] = { label, tiles: await page.$$eval('#tiles .tile', t => t.map(x => ({
        k: (x.querySelector('.k') || {}).textContent || '',
        v: (x.querySelector('.v') || {}).textContent || '',
        x: ((x.querySelector('.x') || {}).textContent || '').split('\n')[0] })) ) };
    }
    res[name] = { errs, views, months: opts.map(o => o[0]) };
    await page.close();
  }
  await browser.close();
  console.log(JSON.stringify(res));
})();
"""

BODY_ROWS = ["Form submissions", "Leads", "SQL", "Deals (approved)", "Disbursed", "Active now"]
BODY_LABELS = {"Active now": "Active clients (today)"}


def cmd_body(a):
    import subprocess, tempfile
    js = os.path.join(tempfile.mkdtemp(), "etf_tiles.js")
    _write(js, TILES_JS)
    args = ["node", js, os.path.abspath(a.standalone)] + ([os.path.abspath(a.previous)] if a.previous else [])
    r = subprocess.run(args, capture_output=True, text=True, timeout=300)
    if r.returncode:
        sys.exit("ERROR reading tiles: " + r.stderr[-500:])
    res = json.loads(r.stdout)
    cur = res["cur"]
    if cur["errs"]:
        sys.exit("ERROR: script errors in page: %s" % cur["errs"])
    page = _read(a.standalone)
    as_of_label = json.loads(_line(page, "AS_OF_LABEL").group(1))
    allv = {t["k"]: t for t in cur["views"]["all"]["tiles"]}
    mkey = [k for k in cur["views"] if k != "all"]
    month = cur["views"][mkey[0]] if mkey else None
    mv = {t["k"]: t for t in month["tiles"]} if month else {}
    prev = {}
    if a.previous and res.get("prev") and not res["prev"]["errs"]:
        prev = {t["k"]: t for t in res["prev"]["views"]["all"]["tiles"]}
    for k in BODY_ROWS:
        if k not in allv:
            sys.exit("ERROR: tile '%s' not found on the page; update BODY_ROWS" % k)

    def num(s):
        try:
            return int(s.replace(",", "").strip())
        except Exception:
            return None

    esc = html.escape
    cell = lambda t: "%s%s" % (esc(t["v"]), ("<br>" + esc(t["x"])) if "$" in t["x"] else "")
    rows, changes = [], []
    for k in BODY_ROWS:
        lab = BODY_LABELS.get(k, k)
        row = "<tr><td>%s</td><td>%s</td>" % (esc(lab), cell(allv[k]))
        if month:
            row += "<td>%s</td>" % (cell(mv[k]) if (k in mv and k != "Active now") else "&ndash;")
        rows.append(row + "</tr>")
        if k in prev:
            c, p = num(allv[k]["v"]), num(prev[k]["v"])
            if c is not None and p is not None and c != p:
                changes.append("%s %s%d" % (lab, "+" if c > p else "", c - p))
    head = "<tr><th>Stage</th><th>All time</th>%s</tr>" % ("<th>%s</th>" % esc(month["label"]) if month else "")
    if not a.previous:
        change_txt = "<p><b>Changes since the last update:</b> not available for this run.</p>"
    elif changes:
        change_txt = "<p><b>Changes since the last update (all time):</b> %s.</p>" % esc(", ".join(changes))
    else:
        change_txt = "<p><b>Changes since the last update:</b> no changes.</p>"
    body = (
        "<p>Dear Etisalat team,</p>"
        "<p>Please find attached today's Etisalat channel funnel dashboard, with data as of %s Dubai time.</p>"
        "%s"
        "<p>Figures are from Beehive's own records and are a snapshot at the time shown; they can change as applications progress. "
        "Past performance is not necessarily a reliable indicator of future performance.</p>"
        "<p>Values are in US dollars and UAE dirhams (AED 3.6725 = USD 1). To use the month filter and channel tabs, "
        "save the attachment and open it in a web browser such as Chrome, Edge or Safari. It works offline.</p>"
        "<p>This report is prepared for the Etisalat leadership team. Please do not forward it outside Etisalat.</p>"
        "<p>Kind regards,<br>The Beehive Team, on behalf of Beehive P2P Limited</p>"
        "<hr><p style=\"font-size:12px;color:#666\">This is an automated email; please do not reply to it. "
        "For questions, contact %s.<br>"
        "Beehive P2P Limited, Gate Avenue, South Zone, DIFC, PO Box 506943, Dubai<br>"
        "Regulated by the Dubai Financial Services Authority</p>"
    ) % (esc(as_of_label), change_txt, esc(a.contact))
    _write(a.out, body)
    print(json.dumps({"bodyChars": len(body), "changes": changes, "month": month["label"] if month else None}))


def _texts(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _texts(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _texts(v)


def cmd_verify(a):
    payload = _read(os.path.join(a.outdir, "payload.txt"))
    files = sorted(glob.glob(a.transcripts, recursive=True), key=os.path.getmtime)
    found = None
    for fp in files:
        with open(fp, encoding="utf-8", errors="replace") as f:
            for ln in f:
                if "ETF-BEGIN" not in ln or "tool_result" not in ln:
                    continue
                try:
                    ev = json.loads(ln)
                except Exception:
                    continue
                for t in _texts(ev):
                    if '"body"' in t and "ETF-BEGIN" in t:
                        try:
                            msg = json.loads(t)
                        except Exception:
                            continue
                        if isinstance(msg, dict) and isinstance(msg.get("body"), dict):
                            found = msg
    if not found:
        sys.exit("NO READ-BACK FOUND: read the draft with read_resource first")
    body = found["body"]
    content = body.get("content", "")
    if body.get("contentType") == "html":
        content = html.unescape(re.sub(r"<[^>]+>", "\n", content))
    norm = lambda s: "\n".join(x.strip() for x in s.replace("\r", "").split("\n") if x.strip())
    ok = norm(content) == norm(payload)
    print(json.dumps({"match": ok, "messageId": found.get("id"), "isDraft": found.get("isDraft"),
                      "readBackChars": len(norm(content)), "payloadChars": len(norm(payload))}))
    sys.exit(0 if ok else 1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    s = p.add_subparsers(dest="cmd", required=True)
    b = s.add_parser("build"); b.add_argument("standalone"); b.add_argument("--outdir", required=True)
    b.add_argument("--key", required=True); b.add_argument("--body")
    c = s.add_parser("check"); c.add_argument("standalone"); c.add_argument("--outdir", required=True)
    v = s.add_parser("verify"); v.add_argument("--outdir", required=True)
    v.add_argument("--transcripts", default="/root/.claude/projects/**/*.jsonl")
    t = s.add_parser("standalone"); t.add_argument("artifact"); t.add_argument("--out", required=True)
    e = s.add_parser("body"); e.add_argument("standalone"); e.add_argument("--previous")
    e.add_argument("--out", required=True); e.add_argument("--contact", required=True)
    a = p.parse_args()
    {"standalone": cmd_standalone, "build": cmd_build, "check": cmd_check, "verify": cmd_verify, "body": cmd_body}[a.cmd](a)


if __name__ == "__main__":
    main()

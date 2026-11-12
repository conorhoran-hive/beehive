#!/usr/bin/env python3
"""Dashboard data hand-off for a Power Automate email flow (settings-based).

Same method as the Etisalat channel funnel: the daily run cannot attach files or write
to OneDrive, so it emails only the day's data (compressed) to marketing.noreply. Power
Automate puts that data into the template page stored in OneDrive and sends the result
as an attachment. The page unpacks the data offline and checks a checksum.

Everything specific to one dashboard lives in a settings file (default:
../assets/delivery.json): line marker, placeholder, template marker and file name, file
name prefix, subject marker, flow key, expected template version, which selectors the
browser check clicks, and which email body to write.

The page must hold its data in three consecutive lines:
    const AS_OF = "...";
    const AS_OF_LABEL = "...";
    const DATA = {...};

Commands
  build   PAGE.html --outdir DIR [--body body.html]
          Splits the page into DIR/<template_file> (page with placeholder + version) and
          DIR/payload.txt (exact data email text), simulates the flow into DIR/rebuilt.html
          and writes DIR/meta.json. Exit 2 if the template version differs from
          template_version in the settings (design changed: new template needed).
  check   PAGE.html --outdir DIR
          Opens PAGE.html and DIR/rebuilt.html in headless Chromium, goes through every
          option of the picker (and tabs, if set), and confirms the visible text is identical
          and there are no script errors. Exit 0 only if they match.
  body    PAGE.html --out body.html [--previous snapshot.json]
          Writes the email body (headline figures, changes since the last update, sign-off).
  verify  --outdir DIR [--transcripts GLOB]
          Finds the newest Microsoft 365 read_resource result in the session transcript
          that contains the data marker and confirms its body is exactly DIR/payload.txt.
          Never retype the read-back by hand; this reads it from the transcript.
"""
import argparse, base64, glob, hashlib, html, json, os, re, sys, zlib

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_SETTINGS = os.path.join(HERE, "..", "assets", "delivery.json")


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
/* Data loader: the day's data is inserted below by Power Automate. */
(function(){
%(inflate)s
function fail(msg){
  document.addEventListener("DOMContentLoaded",function(){
    document.body.innerHTML='<p style="font:16px sans-serif;padding:24px">This file is incomplete ('+msg+'). Please ask Beehive to resend it.</p>';
  });
  throw new Error("data: "+msg);
}
window.dlLoad=function(b64){
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


def cmd_build(a, st):
    page = _read(a.page)
    m1, m2, m3 = _line(page, "AS_OF"), _line(page, "AS_OF_LABEL"), _line(page, "DATA")
    if not (m1.start() < m2.start() < m3.start()) or len(page[m1.start():m3.end()].split("\n")) != 3:
        sys.exit("ERROR: expected AS_OF, AS_OF_LABEL and DATA on three consecutive lines")
    as_of, as_of_label, data = json.loads(m1.group(1)), json.loads(m2.group(1)), json.loads(m3.group(1))
    ph = st["placeholder"]
    call = ('const DL_P = dlLoad("%s");\n'
            "const AS_OF = DL_P.asOf, AS_OF_LABEL = DL_P.asOfLabel, DATA = DL_P.data;") % ph
    tpl = page[:m1.start()] + call + page[m3.end():]
    idx = tpl.rfind("<script>", 0, tpl.find(call))
    if idx < 0:
        sys.exit("ERROR: main <script> not found")
    inflate = _read(os.path.join(HERE, "tiny-inflate.js")).replace("module.exports = tinf_uncompress;", "")
    tpl = tpl[:idx] + LOADER % {"inflate": inflate} + tpl[idx:]
    head_end = tpl.find("</head>")
    if head_end < 0:
        sys.exit("ERROR: page has no </head>")
    marker = '<meta name="dl-template" content="%s%s">\n'
    tpl0 = tpl[:head_end] + marker % (st["template_mark"], "0") + tpl[head_end:]
    version = hashlib.sha256(tpl0.encode("utf-8")).hexdigest()[:12]
    tpl = tpl[:head_end] + marker % (st["template_mark"], version) + tpl[head_end:]
    if tpl.count(ph) != 1:
        sys.exit("ERROR: placeholder must appear exactly once in the template")
    if st.get("template_forbidden") and re.search(st["template_forbidden"], tpl):
        sys.exit("ERROR: template still contains data")

    raw = json.dumps({"asOf": as_of, "asOfLabel": as_of_label, "data": data},
                     ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    b64 = base64.b64encode(zlib.compress(raw, 9)).decode("ascii")
    key = st["flow_key"].strip()
    if not re.fullmatch(r"[A-Za-z0-9]{8,64}", key):
        sys.exit("ERROR: flow_key must be 8-64 letters/digits")
    mk = st["marker"]
    lines = ["%s-BEGIN|v1|key=%s|tpl=%s|date=%s|len=%d|%s|%s-END" % (mk, key, version, as_of, len(b64), b64, mk)]
    if a.body:
        body = _read(a.body).strip()
        if re.search(r"<script|<iframe|on\w+\s*=", body, re.I):
            sys.exit("ERROR: email body may not contain scripts or event handlers")
        bb = base64.b64encode(body.encode("utf-8")).decode("ascii")
        lines.append("BODY-BEGIN|len=%d|%s|BODY-END" % (len(bb), bb))
    payload = "\n".join(lines)
    rebuilt = tpl.replace(ph, b64)

    os.makedirs(a.outdir, exist_ok=True)
    _write(os.path.join(a.outdir, st["template_file"]), tpl)
    _write(os.path.join(a.outdir, "payload.txt"), payload)
    _write(os.path.join(a.outdir, "rebuilt.html"), rebuilt)
    meta = {"asOf": as_of, "templateVersion": version, "expectedTemplateVersion": st.get("template_version"),
            "templateMatchesOneDrive": version == st.get("template_version"),
            "templateBytes": len(tpl.encode()), "dataJsonBytes": len(raw), "payloadChars": len(payload),
            "b64Len": len(b64), "payloadSha256": hashlib.sha256(payload.encode()).hexdigest(),
            "subject": "%s %s" % (st["subject_marker"], as_of), "mailbox": st["mailbox"],
            "fileName": "%s%s.html" % (st["file_prefix"], as_of)}
    _write(os.path.join(a.outdir, "meta.json"), json.dumps(meta, indent=1))
    print(json.dumps(meta, indent=1))
    if not meta["templateMatchesOneDrive"]:
        print("FAILED: the page design changed, so the OneDrive template is out of date. Do not send the "
              "data email. The new %s (version %s) must be uploaded and template_version updated."
              % (st["template_file"], version))
        sys.exit(2)


CHECK_JS = r"""
const { chromium } = require('playwright');
(async () => {
  const [a, b, cfgJson] = process.argv.slice(2);
  const cfg = JSON.parse(cfgJson);
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
    const opts = await page.$$eval(cfg.select + ' option', os => os.map(o => o.value));
    const tabs = cfg.tabs ? await page.$$eval(cfg.tabs + ' button', bs => bs.map(b => b.dataset.ch)) : [null];
    if (!opts.length || !tabs.length) errs.push('no options or tabs rendered');
    for (const p of opts) {
      await page.selectOption(cfg.select, p);
      for (const t of tabs) {
        if (t !== null) await page.click(cfg.tabs + ' button[data-ch="' + t + '"]');
        const parts = [];
        for (const s of cfg.text) parts.push(await page.innerText(s));
        out.push(p + '|' + t + '\n' + parts.join('\n'));
      }
    }
    await ctx.close();
    return { errs, text: out.join('\n----\n'), views: opts.length * tabs.length };
  }
  const x = await snap(a), y = await snap(b);
  await browser.close();
  const ok = !x.errs.length && !y.errs.length && x.text === y.text && x.views > 0;
  console.log(JSON.stringify({ ok, views: x.views, errorsOriginal: x.errs, errorsRebuilt: y.errs, sameText: x.text === y.text }));
  process.exit(ok ? 0 : 1);
})();
"""


def cmd_check(a, st):
    import subprocess, tempfile
    js = os.path.join(tempfile.mkdtemp(), "dl_check.js")
    _write(js, CHECK_JS)
    r = subprocess.run(["node", js, os.path.abspath(a.page), os.path.abspath(os.path.join(a.outdir, "rebuilt.html")),
                        json.dumps(st["check"])], capture_output=True, text=True, timeout=300)
    print(r.stdout.strip() or r.stderr.strip())
    sys.exit(r.returncode)


# ---------------------------------------------------------------- email bodies
def body_leaderboard(page, previous, st):
    """Body for the Etisalat partner leaderboard: headline figures for this month and
    last month, changes since the last update, how to open the file, sign-off."""
    esc = html.escape
    contact = (st.get("contact") or "").strip()
    if not contact:
        sys.exit("ERROR: 'contact' is not set in delivery.json (the address for questions in the email body)")
    as_of_label = json.loads(_line(page, "AS_OF_LABEL").group(1))
    data = json.loads(_line(page, "DATA").group(1))
    months = data["months"]
    cur = months[0]
    label = lambda m: m["band"]
    rows = []
    for m in months[:2]:
        t = m["tot"]
        rows.append("<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>"
                    % (esc(label(m)), t[0], t[1], t[2], t[3], esc(str(t[4]))))
    table = ('<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse">'
             "<tr><th>Period</th><th>Leads</th><th>Deals</th><th>Approved</th><th>Disbursed</th>"
             "<th>Commission earned (AED)</th></tr>%s</table>" % "".join(rows))
    change_txt = "<p><b>Changes since the last update:</b> not available for this run.</p>"
    if previous and os.path.exists(previous):
        prev = json.load(open(previous))
        reps = prev.get("reps", {})
        pt = [sum(r.get(k, 0) for r in reps.values()) for k in ("leads", "deals", "appr", "disb", "comm")]
        ct = cur["tot"][:4] + [float(str(cur["tot"][4]).replace(",", ""))]
        if prev.get("period_start") and cur.get("start") and prev["period_start"] != cur["start"]:
            change_txt = "<p><b>Changes since the last update:</b> a new month has started.</p>"
        else:
            names = ("Leads", "Deals", "Approved", "Disbursed", "Commission earned (AED)")
            ch = []
            for n, c, p in zip(names, ct, pt):
                d = round(c - p)
                if d:
                    ch.append("%s %s%s" % (n, "+" if d > 0 else "-", f"{abs(d):,}"))
            change_txt = ("<p><b>Changes since the last update (this month):</b> %s.</p>" % esc(", ".join(ch))
                          if ch else "<p><b>Changes since the last update:</b> no changes.</p>")
    return (
        "<p>Dear Etisalat team,</p>"
        "<p>Please find attached today's Etisalat partner leaderboard, with data as of %s (Dubai time).</p>"
        "%s%s"
        "<p>Figures are from Beehive's records at the time shown and can change as applications progress, "
        "for example when a lead is later marked as a duplicate. Commission is earned only when a deal is disbursed.</p>"
        "<p>To see each rep's figures and earlier months, save the attachment and open it in a web browser such as "
        "Chrome, Edge or Safari, then choose a month. It works offline.</p>"
        "<p>This report is prepared for the Etisalat leadership team. Please do not forward it outside Etisalat.</p>"
        "<p>Kind regards,<br>The Beehive Team, on behalf of Beehive P2P Limited</p>"
        "<hr><p style=\"font-size:12px;color:#666\">This is an automated email; please do not reply to it. "
        "For questions, contact %s.<br>"
        "Beehive P2P Limited, Gate Avenue, South Zone, DIFC, PO Box 506943, Dubai<br>"
        "Regulated by the Dubai Financial Services Authority</p>"
    ) % (esc(as_of_label), table, change_txt, esc(contact))


BODIES = {"leaderboard": body_leaderboard}


def cmd_body(a, st):
    page = _read(a.page)
    body = BODIES[st["body"]](page, a.previous, st)
    _write(a.out, body)
    print(json.dumps({"bodyChars": len(body)}))


def _texts(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for v in obj.values():
            yield from _texts(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from _texts(v)


def cmd_verify(a, st):
    payload = _read(os.path.join(a.outdir, "payload.txt"))
    tag = st["marker"] + "-BEGIN"
    files = sorted(glob.glob(a.transcripts, recursive=True), key=os.path.getmtime)
    found = None
    for fp in files:
        with open(fp, encoding="utf-8", errors="replace") as f:
            for ln in f:
                if tag not in ln or "tool_result" not in ln:
                    continue
                try:
                    ev = json.loads(ln)
                except Exception:
                    continue
                for t in _texts(ev):
                    if '"body"' in t and tag in t:
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
                      "subject": found.get("subject"),
                      "readBackChars": len(norm(content)), "payloadChars": len(norm(payload))}))
    sys.exit(0 if ok else 1)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--settings", default=DEFAULT_SETTINGS)
    s = p.add_subparsers(dest="cmd", required=True)
    b = s.add_parser("build"); b.add_argument("page"); b.add_argument("--outdir", required=True); b.add_argument("--body")
    c = s.add_parser("check"); c.add_argument("page"); c.add_argument("--outdir", required=True)
    e = s.add_parser("body"); e.add_argument("page"); e.add_argument("--out", required=True); e.add_argument("--previous")
    v = s.add_parser("verify"); v.add_argument("--outdir", required=True)
    v.add_argument("--transcripts", default="/root/.claude/projects/**/*.jsonl")
    a = p.parse_args()
    st = json.loads(_read(a.settings))
    {"build": cmd_build, "check": cmd_check, "body": cmd_body, "verify": cmd_verify}[a.cmd](a, st)


if __name__ == "__main__":
    main()

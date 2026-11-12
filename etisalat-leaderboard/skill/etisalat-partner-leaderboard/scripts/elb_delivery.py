#!/usr/bin/env python3
"""Etisalat partner leaderboard: data hand-off for the Power Automate email flow.

The daily Claude run cannot send the leaderboard itself: the Microsoft 365 connector
rejects or strips <img>, <style>, <span> and comments, and the email is 35-120 KB.
So the run emails a small coded copy to marketing.noreply. Power Automate expands it
with a fixed dictionary stored in OneDrive (the "template") and sends the result, as
the email BODY, character for character the same as etisalat-partner-leaderboard-email.html.

How the coding works
  The dictionary is a fixed list of long pieces of the email (the opening section with
  the logo, the closing section, and every long HTML tag), each with a 4-character code
  such as ^0A^. It is worked out from the skill's own render_email() on fixed sample
  data, so it is the same every day and only changes when the email design changes.
  Today's email is coded by swapping each piece for its code. The flow swaps them back,
  one dictionary entry at a time, in the order stored in the template file.

Commands
  template --outdir DIR
          Writes DIR/etisalat-leaderboard-template.txt (upload to OneDrive) and prints
          its version. Needed only once, and again after a design change.
  build   EMAIL.html --today YYYY-MM-DD --outdir DIR
          Codes today's email and writes
            DIR/etisalat-leaderboard-template.txt  (today's dictionary; same as OneDrive unless the design changed)
            DIR/payload.txt                        (the exact text for the data email body)
            DIR/rebuilt.html                       (what Power Automate will produce)
            DIR/meta.json                          (sizes, versions, subject, file name)
          Fails (exit 2) unless rebuilt.html is identical to EMAIL.html and the template
          version equals template_version in assets/delivery.json.
  check   EMAIL.html --outdir DIR
          Independent re-check from the files on disk, doing exactly what the flow does:
          cleans and splits payload.txt, checks key, lengths, date and template version,
          expands it with the template file, and compares with EMAIL.html byte for byte.
  verify  --outdir DIR [--transcripts GLOB]
          Finds the newest Microsoft 365 read_resource result in the session transcript
          that contains ELB-BEGIN and confirms its body is exactly DIR/payload.txt.
          Never retype the read-back by hand; this reads it from the transcript.

Settings live in assets/delivery.json (subject marker, file name prefix, flow key,
template version, mailbox, alert address). The flow key and template are not in git.
"""
import argparse, base64, datetime as dt, glob, hashlib, html, importlib.util, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "..", "assets")
SETTINGS_PATH = os.path.join(ASSETS, "delivery.json")
SEP = "%%ELB-SEP%%"
TOKEN_CHAR = "^"
ALPH = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
MIN_TAG = 24          # tags shorter than this are left as they are
TEMPLATE_NAME = "etisalat-leaderboard-template.txt"


def _read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


def _write(p, s):
    with open(p, "w", encoding="utf-8", newline="\n") as f:
        f.write(s)


def settings():
    return json.loads(_read(SETTINGS_PATH))


def plen(s):
    """String length as Power Automate's length() counts it (UTF-16 code units)."""
    return len(s.encode("utf-16-le")) // 2


def _lb():
    spec = importlib.util.spec_from_file_location("leaderboard", os.path.join(HERE, "leaderboard.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


# ------------------------------------------------------------- dictionary
def _samples(lb):
    """Fixed sample emails (no real data). Cover: badges 1-3, numbered ranks, unranked
    reps, the carried-over month, a normal month, and an empty board."""
    out = []
    for today, n, amt in (("2026-11-12", 7, 1500.0), ("2027-03-09", 4, 2750.0), ("2027-05-20", 0, 0.0)):
        t = dt.date.fromisoformat(today)
        rows, disp = {}, {}
        for i in range(n):
            k = "sample%02d" % i
            disp[k] = k.upper()
            rows[k] = dict(leads=max(0, 9 - i * 2 + (i % 2)), deals=i % 3, appr=i % 2, disb=1 if i == 1 else 0,
                           comm=amt if i == 1 else 0.0)
        tot = {x: sum(r[x] for r in rows.values()) for x in ("leads", "deals", "appr", "disb", "comm")}
        out.append(lb.render_email(t, lb.period_start(t), rows, disp, tot))
    return out


def _common_prefix(a, b):
    i = 0
    while i < min(len(a), len(b)) and a[i] == b[i]:
        i += 1
    return a[:i]


def dictionary():
    """Ordered list of (code, piece) in DECODE order (the order the flow applies them)."""
    lb = _lb()
    s = _samples(lb)
    pre = _common_prefix(s[0], s[1])
    pre = pre[:pre.rfind(">") + 1]
    suf = _common_prefix(s[0][::-1], s[1][::-1])[::-1]
    suf = suf[suf.find("<"):]
    tags = set()
    for e in s:
        tags.update(t for t in re.findall(r"<[a-zA-Z][^<>]*>", e) if len(t) >= MIN_TAG)
    pieces = [pre, suf] + sorted(tags, key=lambda t: (-len(t), t))
    # encode order: longest first; decode order is the reverse
    pieces = sorted(dict.fromkeys(p for p in pieces if p), key=lambda p: (-len(p), p))
    if len(pieces) > len(ALPH) ** 2:
        sys.exit("ERROR: dictionary too large")
    enc = [(TOKEN_CHAR + ALPH[i // len(ALPH)] + ALPH[i % len(ALPH)] + TOKEN_CHAR, p) for i, p in enumerate(pieces)]
    for _, p in enc:
        if TOKEN_CHAR in p or SEP in p:
            sys.exit("ERROR: a dictionary piece contains '%s' or the separator" % TOKEN_CHAR)
    return list(reversed(enc))


def template_text(dec):
    body = SEP.join(code + piece for code, piece in dec)
    version = hashlib.sha256(body.encode("utf-8")).hexdigest()[:12]
    return "ELB-DICT|tpl=%s|n=%d%s%s" % (version, len(dec), SEP, body), version


def parse_template(tpl):
    parts = tpl.split(SEP)
    m = re.fullmatch(r"ELB-DICT\|tpl=([0-9a-f]{12})\|n=(\d+)", parts[0])
    if not m or int(m.group(2)) != len(parts) - 1:
        sys.exit("ERROR: template header or entry count is wrong")
    return m.group(1), [(p[:4], p[4:]) for p in parts[1:]]


def encode(email, dec):
    if TOKEN_CHAR in email:
        sys.exit("ERROR: the email contains '%s', which the coding reserves" % TOKEN_CHAR)
    out = email
    for code, piece in reversed(dec):
        out = out.replace(piece, code)
    return out


def expand(coded, dec):
    """Exactly what the flow's Apply to each loop does."""
    h = coded
    for code, piece in dec:
        h = h.replace(code, piece)
    return h


# ------------------------------------------------------------- commands
def cmd_template(a):
    tpl, version = template_text(dictionary())
    os.makedirs(a.outdir, exist_ok=True)
    _write(os.path.join(a.outdir, TEMPLATE_NAME), tpl)
    print(json.dumps({"template": os.path.join(a.outdir, TEMPLATE_NAME), "templateVersion": version,
                      "entries": tpl.count(SEP), "bytes": len(tpl.encode())}, indent=1))


def cmd_build(a):
    st = settings()
    email = _read(a.email)
    today = dt.date.fromisoformat(a.today)
    dec = dictionary()
    tpl, version = template_text(dec)
    coded = encode(email, dec)
    b64 = base64.b64encode(coded.encode("utf-8")).decode("ascii")
    key = st["flow_key"].strip()
    if not re.fullmatch(r"[A-Za-z0-9]{8,64}", key):
        sys.exit("ERROR: flow_key in delivery.json must be 8-64 letters/digits")
    payload = "ELB-BEGIN|v1|key=%s|tpl=%s|date=%s|len=%d|out=%d|%s|ELB-END" % (
        key, version, today.isoformat(), len(b64), plen(email), b64)
    rebuilt = expand(base64.b64decode(b64).decode("utf-8"), dec)

    os.makedirs(a.outdir, exist_ok=True)
    _write(os.path.join(a.outdir, TEMPLATE_NAME), tpl)
    _write(os.path.join(a.outdir, "payload.txt"), payload)
    _write(os.path.join(a.outdir, "rebuilt.html"), rebuilt)
    meta = {"date": today.isoformat(), "templateVersion": version,
            "expectedTemplateVersion": st.get("template_version"),
            "templateMatchesOneDrive": version == st.get("template_version"),
            "identical": rebuilt == email, "emailChars": plen(email), "codedChars": len(coded),
            "payloadChars": len(payload), "dictionaryEntries": len(dec),
            "subject": "%s %s" % (st["subject_marker"], today.isoformat()),
            "mailbox": st["mailbox"],
            "fileName": "%s%s.html" % (st["file_prefix"], today.isoformat()),
            "payloadSha256": hashlib.sha256(payload.encode()).hexdigest()}
    _write(os.path.join(a.outdir, "meta.json"), json.dumps(meta, indent=1))
    print(json.dumps(meta, indent=1))
    if not meta["identical"]:
        print("FAILED: the rebuilt email is not identical to the original.")
        sys.exit(2)
    if not meta["templateMatchesOneDrive"]:
        print("FAILED: the email design changed, so the OneDrive template is out of date. "
              "Do not send the data email. Give Conor the new %s (version %s) to upload, and "
              "update template_version in assets/delivery.json." % (TEMPLATE_NAME, version))
        sys.exit(2)


def flow_parse(payload_text):
    """Mirrors the flow: Html to text, remove CR/LF/spaces, split on markers and |."""
    clean = payload_text.replace("\r", "").replace("\n", "").replace(" ", "")
    if "ELB-BEGIN|" not in clean or "|ELB-END" not in clean:
        return None
    inner = clean.split("ELB-BEGIN|")[-1].split("|ELB-END")[0]
    return inner.split("|")


def cmd_check(a):
    st = settings()
    email = _read(a.email)
    tpl = _read(os.path.join(a.outdir, TEMPLATE_NAME))
    parts = flow_parse(_read(os.path.join(a.outdir, "payload.txt")))
    tver, dec = parse_template(tpl)
    res = {"parts": len(parts) if parts else 0}
    ok = bool(parts) and len(parts) == 7
    if ok:
        res.update({
            "version": parts[0] == "v1",
            "key": parts[1] == "key=" + st["flow_key"],
            "template": ("ELB-DICT|%s|n=%d%s" % (parts[2], len(dec), SEP)) in tpl and parts[2] == "tpl=" + tver,
            "dataLength": parts[4] == "len=%d" % len(parts[6]),
            "date": parts[3],
        })
        built = expand(base64.b64decode(parts[6]).decode("utf-8"), dec)
        res["builtLength"] = parts[5] == "out=%d" % plen(built)
        res["noCodesLeft"] = TOKEN_CHAR not in built
        res["identical"] = built == email
        ok = all(v for k, v in res.items() if k not in ("parts", "date"))
    res["ok"] = ok
    print(json.dumps(res))
    sys.exit(0 if ok else 1)


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
                if "ELB-BEGIN" not in ln or "tool_result" not in ln:
                    continue
                try:
                    ev = json.loads(ln)
                except Exception:
                    continue
                for t in _texts(ev):
                    if '"body"' in t and "ELB-BEGIN" in t:
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
    s = p.add_subparsers(dest="cmd", required=True)
    t = s.add_parser("template"); t.add_argument("--outdir", required=True)
    b = s.add_parser("build"); b.add_argument("email"); b.add_argument("--today", required=True)
    b.add_argument("--outdir", required=True)
    c = s.add_parser("check"); c.add_argument("email"); c.add_argument("--outdir", required=True)
    v = s.add_parser("verify"); v.add_argument("--outdir", required=True)
    v.add_argument("--transcripts", default="/root/.claude/projects/**/*.jsonl")
    a = p.parse_args()
    {"template": cmd_template, "build": cmd_build, "check": cmd_check, "verify": cmd_verify}[a.cmd](a)


if __name__ == "__main__":
    main()

// Parity test: legacy/original.html vs dist/index.html (iframe build) vs
// dist/webflow-embed.html (inline build inside a Webflow-like host page).
//
// For identical user journeys it compares:
//   - analytics events (dataLayer + postMessage relay payloads)  -> GA4 / Google Ads
//   - the HubSpot Forms API request body                         -> HubSpot
//   - the rendered DOM of #beehive-form at every step            -> ContentSquare
//   - pixel screenshots of the form at every step                -> design
//
// External scripts are served from node_modules; nothing leaves the machine.
// Usage: npm test
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright'); // pre-installed globally; or npm i -D playwright
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const OUT = 'test/output';
mkdirSync(OUT, { recursive: true });
const URL = 'https://www.beehive.test/eligibility?utm_source=google&utm_campaign=brand';

// A rough stand-in for a Webflow page: normalize.css + webflow.css element defaults.
const WEBFLOW_HOST_CSS = `
  html{font-family:sans-serif}body{margin:0;min-height:100%;background:#fff;font-family:Arial,sans-serif;font-size:14px;line-height:20px;color:#333}
  *{box-sizing:border-box}
  h1{font-size:38px;line-height:44px;margin:20px 0 10px;font-weight:bold;font-family:Georgia,serif;color:#111;text-transform:uppercase}
  p{margin-top:0;margin-bottom:10px}label{display:block;margin-bottom:5px;font-weight:bold}
  ol{margin-top:0;margin-bottom:10px;padding-left:40px}
  button,input,optgroup,select,textarea{color:inherit;font:inherit;margin:0}
  a{color:#3898ec}
  .host-wrap{padding:8px}
`;

const files = {
  legacy: readFileSync('legacy/original.html', 'utf8'),
  iframe: readFileSync('dist/index.html', 'utf8'),
  embed: `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Webflow host page</title>
<style>${WEBFLOW_HOST_CSS}</style>
<script>window.dataLayer=window.dataLayer||[];</script></head>
<body><nav style="height:0"></nav><div class="host-wrap">${readFileSync('dist/webflow-embed.html', 'utf8')}</div></body></html>`,
};

const STATIC = {
  'https://unpkg.com/react@18.3.1/umd/react.development.js': 'node_modules/react/umd/react.development.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js': 'node_modules/react-dom/umd/react-dom.development.js',
  'https://unpkg.com/@babel/standalone@7.29.0/babel.min.js': 'node_modules/@babel/standalone/babel.min.js',
  'https://unpkg.com/react@18.3.1/umd/react.production.min.js': 'node_modules/react/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': 'node_modules/react-dom/umd/react-dom.production.min.js',
};

const browser = await chromium.launch();

async function open(variant, { clock = false, viewport = { width: 800, height: 1000 } } = {}) {
  const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const hubspot = [];
  const requested = new Set();
  await page.route('**/*', async (route) => {
    const url = route.request().url();
    requested.add(new globalThis.URL(url).host);
    if (url.startsWith('https://www.beehive.test/')) return route.fulfill({ contentType: 'text/html', body: files[variant] });
    if (STATIC[url]) return route.fulfill({ contentType: 'application/javascript', body: readFileSync(STATIC[url]) });
    if (url.includes('contentsquare.net')) return route.fulfill({ contentType: 'application/javascript', body: '' });
    if (url.includes('fonts.googleapis.com')) return route.fulfill({ contentType: 'text/css', body: '' });
    if (url.includes('api.hsforms.com')) {
      hubspot.push({ url, body: JSON.parse(route.request().postData()) });
      return route.fulfill({ contentType: 'application/json', body: '{"inlineMessage":"ok"}' });
    }
    return route.abort();
  });
  await page.addInitScript(() => {
    window.__msgs = [];
    window.addEventListener('message', (e) => window.__msgs.push(e.data));
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  if (clock) await page.clock.install();
  await page.goto(URL);
  await page.waitForSelector('#beehive-form .stage');
  return { ctx, page, hubspot, errors, requested };
}

// DOM snapshot with attributes sorted, so attribute order doesn't matter.
const snapshot = (page) => page.evaluate(() => {
  const ser = (n) => {
    if (n.nodeType === 3) return n.textContent;
    if (n.nodeType !== 1) return '';
    const attrs = [...n.attributes].map((a) => `${a.name}="${a.value}"`).sort().join(' ');
    return `<${n.tagName.toLowerCase()}${attrs ? ' ' + attrs : ''}>${[...n.childNodes].map(ser).join('')}</${n.tagName.toLowerCase()}>`;
  };
  return ser(document.getElementById('beehive-form'));
});

async function capture(run, label, shots) {
  await run.page.mouse.move(0, 0); // drop any :hover state
  await run.page.waitForTimeout(450); // let 280ms auto-advance + transitions settle
  shots.push({ label, dom: await snapshot(run.page), png: await run.page.locator('#beehive-form').screenshot({ animations: 'disabled' }) });
}

async function eligibleJourney(run) {
  const { page } = run;
  const shots = [];
  await capture(run, 'intro', shots);
  await page.click('text=Begin');
  await capture(run, 'age', shots);
  await page.click('text=Over 2 years');
  await capture(run, 'sector', shots);
  await page.click('button.opt:has-text("Trading")');
  await page.click('.combo-trigger');
  await page.fill('.combo-search', 'ret');
  await capture(run, 'combobox-open', shots);
  await page.click('.combo-item:has-text("Retail")');
  await capture(run, 'sector-filled', shots);
  await page.click('text=Continue');
  await capture(run, 'revenue', shots);
  await page.click('.chip:has-text("AED 5M")');
  await page.focus('input[type=range]');
  await page.keyboard.press('ArrowRight');
  await capture(run, 'revenue-filled', shots);
  await page.click('text=Continue');
  await page.focus('input[type=range]');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await capture(run, 'loan', shots);
  await page.click('text=Continue');
  await page.evaluate(() => window.postMessage({ type: 'beehive_utms', utms: { utm_source: 'linkedin', utm_medium: 'paid', utm_campaign: 'q4' } }, '*'));
  await page.fill('input[placeholder="First and last name"]', 'Yusuf Al Rashid');
  await page.fill('input[placeholder="Trading or legal name"]', 'Hive Trading LLC');
  await page.fill('input[type=email]', 'yusuf@hivetrading.ae');
  await page.selectOption('select.input', '+968');
  await page.fill('input[type=tel]', '9123 45678'); // over the 8-digit limit -> rejected keystroke behaviour
  await page.fill('input[type=tel]', '9123 4567');
  await page.click('.tc-row >> nth=0');
  await page.click('.tc-row >> nth=1');
  await capture(run, 'contact', shots);
  await page.click('text=Get My Eligibility');
  await page.waitForSelector('.result');
  await capture(run, 'result-eligible', shots);
  return shots;
}

async function ineligibleJourney(run) {
  const { page } = run;
  const shots = [];
  await page.click('text=Begin');
  await page.click('text=1 to 2 years');
  await page.click('button.opt:has-text("Manufacturing")');
  await page.click('button.opt:has-text("Trading")');
  await page.click('.combo-trigger');
  await page.fill('.combo-search', 'zzz');
  await capture(run, 'combobox-empty', shots);
  await page.fill('.combo-search', 'toba');
  await page.click('.combo-item:has-text("Tobacco")');
  await page.click('text=Back');
  await capture(run, 'back-to-age', shots);
  await page.keyboard.press('Enter'); // Enter advances when step is valid
  await capture(run, 'enter-advanced', shots);
  await page.click('text=Continue');
  await page.focus('input[type=range]');
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft');
  await capture(run, 'revenue-low', shots);
  await page.click('text=Go back and check');
  await capture(run, 'restarted', shots);
  for (let i = 0; i < 2; i++) { await page.click('text=Continue'); await page.waitForTimeout(100); }
  await page.click('text=Continue');
  await page.focus('input[type=range]');
  await page.keyboard.press('End');
  await page.click('text=Continue');
  await page.fill('input[placeholder="First and last name"]', 'Sara');
  await page.fill('input[placeholder="Trading or legal name"]', 'Shisha Co');
  await page.fill('input[type=email]', 'sara@shisha.ae');
  await page.fill('input[type=tel]', '50 123 4567');
  await page.click('.tc-row >> nth=0');
  await page.click('text=Get My Eligibility');
  await page.waitForSelector('.result');
  await capture(run, 'result-ineligible', shots);
  await page.click('text=Start fresh');
  await capture(run, 'start-fresh', shots);
  return shots;
}

async function dwell(variant) {
  const run = await open(variant, { clock: true });
  await run.page.clock.runFor(125_000);
  const out = await collect(run);
  await run.ctx.close();
  return out;
}

async function collect(run) {
  const { dataLayer, msgs } = await run.page.evaluate(() => ({ dataLayer: window.dataLayer, msgs: window.__msgs }));
  return {
    dataLayer: dataLayer.filter((d) => d && d.form_name),
    relay: msgs.filter((m) => m && m.source === 'beehive-eligibility-form'),
    otherMsgs: msgs.filter((m) => m && m.source !== 'beehive-eligibility-form' && !('beehiveFormHeight' in m) && m.type !== 'beehive_utms'),
    heights: msgs.filter((m) => m && 'beehiveFormHeight' in m).map((m) => m.beehiveFormHeight),
    hubspot: run.hubspot,
    errors: run.errors,
    hosts: [...run.requested].sort(),
  };
}

async function runVariant(variant, viewport) {
  const result = {};
  for (const [name, fn] of [['eligible', eligibleJourney], ['ineligible', ineligibleJourney]]) {
    const run = await open(variant, { viewport });
    const shots = await fn(run);
    result[name] = { shots, ...(await collect(run)) };
    await run.ctx.close();
  }
  return result;
}

// Screenshots may differ by anti-aliasing noise between runs; tolerate a few
// pixels off by a couple of colour levels, nothing a person could see.
const cmpPage = await browser.newPage();
async function nearlyEqual(a, b) {
  return cmpPage.evaluate(async ([a, b]) => {
    const load = async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode(); return img; };
    const [ia, ib] = await Promise.all([load(a), load(b)]);
    if (ia.width !== ib.width || ia.height !== ib.height) return false;
    const px = (img) => { const c = new OffscreenCanvas(img.width, img.height).getContext('2d'); c.drawImage(img, 0, 0); return c.getImageData(0, 0, img.width, img.height).data; };
    const [da, db] = [px(ia), px(ib)];
    let diff = 0;
    for (let i = 0; i < da.length; i += 4) {
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > 8) return false;
      if (d) diff++;
    }
    return diff <= ia.width * ia.height * 0.0005;
  }, [a.toString('base64'), b.toString('base64')]);
}

let failures = 0;
const check = (ok, msg) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${msg}`); if (!ok) failures++; };
// Inline embed has no parent to relay UTMs, so it falls back to the page URL's
// utm_* params (utm_source=google, utm_campaign=brand in URL above).
const withoutUrlUtms = (subs) => subs.map((s) => ({ ...s, body: { ...s.body, fields: s.body.fields.filter((f) =>
  !(f.name === 'utm_source' && f.value === 'google') && !(f.name === 'utm_campaign' && f.value === 'brand')) } }));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const viewport of [{ width: 800, height: 1000 }, { width: 390, height: 844 }]) {
  console.log(`\n=== viewport ${viewport.width}x${viewport.height} ===`);
  const legacy = await runVariant('legacy', viewport);
  for (const variant of ['iframe', 'embed']) {
    const cur = await runVariant(variant, viewport);
    for (const journey of ['eligible', 'ineligible']) {
      const a = legacy[journey], b = cur[journey];
      const tag = `[${variant}/${journey}]`;
      check(b.errors.length === 0, `${tag} no page errors ${b.errors.join(' ')}`);
      check(same(a.dataLayer, b.dataLayer), `${tag} dataLayer events identical (${b.dataLayer.length} events: ${[...new Set(b.dataLayer.map((d) => d.event))].join(', ')})`);
      if (variant === 'iframe') check(same(a.relay, b.relay), `${tag} postMessage relay payloads identical (${b.relay.length})`);
      else check(b.relay.length === 0, `${tag} no postMessage relay (pushes straight to GTM dataLayer, no double count)`);
      check(same(a.hubspot, b.hubspot) || (variant === 'embed' && same(a.hubspot, withoutUrlUtms(b.hubspot))),
        `${tag} HubSpot request identical (${b.hubspot.length} submission, ${b.hubspot[0]?.body.fields.length} fields: ${b.hubspot[0]?.body.fields.filter((f) => f.name.startsWith('utm_')).map((f) => `${f.name}=${f.value}`).join(' ') || 'no UTMs'})`);
      if (variant === 'iframe') check(same(a.heights.at(-1), b.heights.at(-1)), `${tag} final iframe height message identical (${b.heights.at(-1)})`);
      for (let i = 0; i < a.shots.length; i++) {
        const sa = a.shots[i], sb = b.shots[i];
        const domOk = sa.dom === sb.dom;
        const pixOk = sa.png.equals(sb.png) || await nearlyEqual(sa.png, sb.png);
        if (!domOk) { writeFileSync(`${OUT}/${variant}-${journey}-${sa.label}-legacy.html`, sa.dom); writeFileSync(`${OUT}/${variant}-${journey}-${sa.label}-new.html`, sb.dom); }
        if (!pixOk) { writeFileSync(`${OUT}/${viewport.width}-${variant}-${journey}-${sa.label}-legacy.png`, sa.png); writeFileSync(`${OUT}/${viewport.width}-${variant}-${journey}-${sa.label}-new.png`, sb.png); }
        check(domOk && pixOk, `${tag} step "${sa.label}": DOM ${domOk ? 'identical' : 'DIFFERS'}, screenshot ${pixOk ? 'pixel-identical' : 'DIFFERS'}`);
      }
      if (journey === 'eligible') {
        console.log(`      legacy other postMessages: ${JSON.stringify(a.otherMsgs)}  new: ${JSON.stringify(b.otherMsgs)}`);
        console.log(`      hosts requested — legacy: ${a.hosts.join(', ')}\n                        new:    ${b.hosts.join(', ')}`);
      }
    }
  }
}

console.log('\n=== dwell_time (30/60/120s) ===');
const dl = await dwell('legacy');
for (const variant of ['iframe', 'embed']) {
  const d = await dwell(variant);
  check(same(dl.dataLayer, d.dataLayer), `[${variant}] dwell_time dataLayer identical (${d.dataLayer.map((e) => e.dwell_seconds).join('/')})`);
  if (variant === 'iframe') check(same(dl.relay, d.relay), `[${variant}] dwell_time relay identical`);
}

await browser.close();
console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);

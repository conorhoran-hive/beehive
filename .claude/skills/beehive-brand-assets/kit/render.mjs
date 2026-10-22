// Render every template in ./templates to PDF (and a PNG preview) in ./out.
// Usage: node render.mjs [file.html ...]
import { chromium } from "playwright";
import { readdirSync, mkdirSync } from "node:fs";
import { join, basename, resolve } from "node:path";

const root = new URL(".", import.meta.url).pathname;
const outDir = join(root, "out");
mkdirSync(outDir, { recursive: true });

const files = process.argv.length > 2
  ? process.argv.slice(2).map((f) => resolve(f))
  : readdirSync(join(root, "templates")).filter((f) => f.endsWith(".html")).map((f) => join(root, "templates", f));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });

for (const file of files) {
  const name = basename(file, ".html");
  await page.goto("file://" + file, { waitUntil: "networkidle" });
  await page.emulateMedia({ media: "print" });
  await page.pdf({ path: join(outDir, `${name}.pdf`), format: "A4", printBackground: true, preferCSSPageSize: true });
  await page.locator(".page").first().screenshot({ path: join(outDir, `${name}.png`) });
  console.log(`rendered ${name}`);
}

await browser.close();

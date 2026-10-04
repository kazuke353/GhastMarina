// Scripted headless play-through driver.
// Usage: node scripts/drive.mjs steps.json   (or pass JSON inline)
// Steps: {"goto":"?debug"} {"wait":ms} {"eval":"js"} {"shot":"name"} {"key":"KeyW","hold":ms} {"press":"Space"}
//        {"click":[x,y]} {"until":"js-expr","timeout":ms}
import { createRequire } from 'module';
import fs from 'fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const arg = process.argv[2] || '[]';
const steps = JSON.parse(fs.existsSync(arg) ? fs.readFileSync(arg, 'utf8') : arg);
const base = process.env.GM_URL || 'http://localhost:5173/';
const outDir = process.env.GM_OUT || 'scripts/out';
fs.mkdirSync(outDir, { recursive: true });
const W = +(process.env.GM_W || 1280), H = +(process.env.GM_H || 720);
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
const logs = [];
page.on('console', (m) => {
  const t = `[${m.type()}] ${m.text()}`;
  logs.push(t);
  if (m.type() === 'error' || m.type() === 'warning') console.log(t.slice(0, 600));
});
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log(`[pageerror] ${e.message}\n${(e.stack || '').split('\n').slice(0, 6).join('\n')}`);
});
const t0 = Date.now();
for (const s of steps) {
  try {
    if (s.goto !== undefined) await page.goto(base + s.goto);
    if (s.wait) await page.waitForTimeout(s.wait);
    if (s.until) {
      const tEnd = Date.now() + (s.timeout || 30000);
      let ok = false;
      while (Date.now() < tEnd) {
        ok = await page.evaluate(s.until).catch(() => false);
        if (ok) break;
        await page.waitForTimeout(250);
      }
      console.log(`until ${ok ? 'ok' : 'TIMEOUT'}: ${s.until.slice(0, 80)}`);
    }
    if (s.eval) {
      const r = await page.evaluate(s.eval);
      if (r !== undefined && r !== null) console.log('eval:', typeof r === 'string' ? r : JSON.stringify(r).slice(0, 2000));
    }
    if (s.key) {
      await page.keyboard.down(s.key);
      await page.waitForTimeout(s.hold || 100);
      await page.keyboard.up(s.key);
    }
    if (s.press) await page.keyboard.press(s.press);
    if (s.click) await page.mouse.click(s.click[0], s.click[1]);
    if (s.shot) {
      await page.screenshot({ path: `${outDir}/${s.shot}.png` });
      console.log(`shot ${s.shot} @${((Date.now() - t0) / 1000).toFixed(1)}s`);
    }
  } catch (e) {
    console.log('step error', JSON.stringify(s).slice(0, 120), e.message);
  }
}
if (process.env.GM_LOGS) console.log(logs.slice(-+process.env.GM_LOGS).join('\n'));
console.log(`done, ${errors.length} page errors`);
await browser.close();

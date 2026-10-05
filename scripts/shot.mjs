// Usage: node scripts/shot.mjs "<url query>" out.png [waitMs] [w] [h] [evalJS]
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const [,, query = '', out = 'scripts/out/shot.png', wait = '4000', w = '1280', h = '720', evalJs = ''] = process.argv;
const base = process.env.GM_URL || 'http://localhost:5173/';
const browser = await pw.chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(base + query);
await page.waitForTimeout(+wait);
if (evalJs) {
  const res = await page.evaluate(evalJs);
  if (res !== undefined) console.log('eval:', typeof res === 'string' ? res : JSON.stringify(res));
  await page.waitForTimeout(1500);
}
await page.screenshot({ path: out });
console.log(logs.slice(-40).join('\n'));
await browser.close();

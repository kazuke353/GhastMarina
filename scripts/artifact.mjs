// Turn the single-file build (dist-single/index.html) into a page body for publishing as a claude.ai Artifact:
// the publisher wraps the file in its own <!doctype>/<html>/<head>/<body>, so strip ours and keep
// <title>, metas-free styles, the font stylesheet and the inlined module script.
// Usage: node scripts/artifact.mjs [in] [out]
import fs from 'fs';

const src = process.argv[2] || 'dist-single/index.html';
const out = process.argv[3] || 'dist-single/ghastmarina-artifact.html';
let html = fs.readFileSync(src, 'utf8');

const head = (html.match(/<head>([\s\S]*?)<\/head>/i) || [, ''])[1];
const body = (html.match(/<body>([\s\S]*?)<\/body>/i) || [, ''])[1];

const title = '<title>GhastMarina</title>';
const fonts = (head.match(/<link[^>]+fonts\.googleapis\.com\/css2[^>]*>/i) || [''])[0];
const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/gi)].map((m) => m[0]).join('\n');
const scripts = [...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/gi)].map((m) => m[0]).join('\n');

// single-theme (always dark) game page: explicit ground + dark color-scheme for the host frame
const shell = `<style>:root{color-scheme:dark;--ground:#04060b}html,body{height:100%;background:var(--ground)}</style>`;

const page = [title, fonts, shell, styles, body.trim(), scripts].filter(Boolean).join('\n');
fs.writeFileSync(out, page);
console.log(`${out}: ${(page.length / 1024 / 1024).toFixed(2)} MB`);

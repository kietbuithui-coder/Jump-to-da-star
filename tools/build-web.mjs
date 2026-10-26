#!/usr/bin/env node
/**
 * Single-file web build.
 *
 *   node tools/build-web.mjs            # → jump-to-the-star.html
 *   node tools/build-web.mjs --minify   # smaller, harder to read
 *
 * Produces ONE self-contained .html file with the CSS and the whole module
 * graph inlined. That file:
 *   - opens by double-clicking (no server, no ES-module CORS problems on file://)
 *   - can be dropped on any static host, emailed, or sent in a chat
 *   - still works offline — there are no external requests of any kind
 *
 * Uses esbuild (dev-only) to flatten `src/main.js` and its imports.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const minify = process.argv.includes('--minify');
const outFile = path.join(root, 'jump-to-the-star.html');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles/main.css'), 'utf8');

function runEsbuild(args) {
  const local = path.join(root, 'node_modules/.bin/esbuild');
  const bin = fs.existsSync(local) ? local : 'esbuild';
  return execFileSync(bin, args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

let js;
try {
  js = runEsbuild([
    'src/main.js',
    '--bundle',
    '--format=iife',
    '--target=es2020',
    '--charset=utf8',
    ...(minify ? ['--minify'] : []),
    '--log-level=warning',
  ]);
} catch (err) {
  console.error('esbuild failed. Install it once with:  npm i --no-save esbuild');
  console.error(err.stdout || err.message);
  process.exit(1);
}

if (!js || js.length < 5000) {
  console.error('esbuild produced suspiciously little output — aborting');
  process.exit(1);
}

// The bundle is inline, so `</script>` inside a string would end the tag early.
js = js.replace(/<\/script/gi, '<\\/script');

const styleTag = `<style>\n${css}\n</style>`;
const scriptTag = `<script>\n${js}\n</script>`;

// NOTE: use function replacers. In a replacement *string*, `$$` collapses to
// `$` and `$&` inserts the match — that silently corrupts code like `$$(sel)`.
// (It already bit this build once: `$$` became `$`, so `$('#game')` returned an
//  array and boot died on `canvas.getContext is not a function`.)
let out = html
  .replace('<link rel="stylesheet" href="styles/main.css" />', () => styleTag)
  .replace('<script type="module" src="src/main.js"></script>', () => scriptTag);

if (!out.includes(styleTag.slice(0, 40))) {
  console.error('could not inline the stylesheet — index.html changed shape?');
  process.exit(1);
}
if (!out.includes('<script>\n')) {
  console.error('could not inline the bundle — index.html changed shape?');
  process.exit(1);
}
if (/src="src\/|href="styles\//.test(out)) {
  console.error('the single-file build still references local files');
  process.exit(1);
}

out = out.replace(
  '<meta name="theme-color" />',
  '<meta name="theme-color" content="#160b33" />'
);

fs.writeFileSync(outFile, out);
const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
console.log(`wrote ${path.relative(root, outFile)} — ${kb(Buffer.byteLength(out))} (js ${kb(Buffer.byteLength(js))}, css ${kb(Buffer.byteLength(css))})`);
console.log('open it directly in a browser: no server required.');

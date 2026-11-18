// node build.mjs [dev] [out.html]  -> single self-contained index.html with both worlds (needs esbuild: npm i esbuild, or TOOLS=<dir with node_modules>)
// src/sky (Aereal, world 0) and src/sea (Kelp Sanctum, world 1) each run in their own scope; src/shell.js hosts them and the portals.
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { gzipSync } from 'zlib';
const dev = process.argv[2] === 'dev', out = process.argv[dev ? 3 : 2] || 'index.html';
const src = n => readFileSync(new URL('src/' + n, import.meta.url), 'utf8');
// sky shaders: w`...` literals
const wg = s => s.replace(/w`([^`]*)`/g, (m, c) => '`' + c.replace(/\s+/g, ' ').replace(/ ?([^A-Za-z0-9_.$ ]) ?/g, '$1').trim() + '`').replace('const w = String.raw, ', 'const ');
// sea shaders: /*wgsl*/`...` literals (keeps ${} interpolations)
const minW = s => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{}()\[\],;:=+\-*\/<>&|!%]) ?/g, '$1').trim();
const ww = s => s.replace(/\/\*wgsl\*\/`([^`]*)`/g, (_, w) => {
  const o = w.split(/(\$\{[^}]*\})/).map((p, i) => i % 2 ? p : minW(p)).join('');
  if (/--|\+\+(?!\))/.test(o.replace(/[a-z]\+\+/g, ''))) throw new Error('unsafe operator collapse in WGSL');
  return '`' + o + '`';
});
const sky = ['gen', 'wgsl', 'main'].map(f => src('sky/' + f + '.js')).join('\n'), sea = ['wgsl', 'geo', 'path', 'main'].map(f => src('sea/' + f + '.js')).join('\n');
let js = `const WORLDS = [(() => {\n${dev ? sky : wg(sky)}\nreturn main })(), (() => {\n${dev ? sea : ww(sea)}\nreturn main })()];\n` + src('shell.js');
if (!dev) { const esbuild = createRequire(process.env.TOOLS ? process.env.TOOLS + '/' : import.meta.url)('esbuild'); js = (await esbuild.transform('(()=>{' + js + '})()', { minify: true, target: 'es2022' })).code.trim() }
const css = `html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{width:100%;height:100%;display:block}#h{position:fixed;left:0;right:0;bottom:28px;text-align:center;font:14px/1.7 system-ui,sans-serif;color:#fff;text-shadow:0 1px 6px #000,0 0 3px #000;white-space:pre-line;pointer-events:none;transition:opacity .6s}#t{position:fixed;left:0;right:0;top:38%;text-align:center;font:300 42px system-ui,sans-serif;letter-spacing:.32em;color:#fff;text-shadow:0 2px 24px #000a;pointer-events:none;opacity:0;transition:opacity 1.2s}#fx{position:fixed;inset:0;pointer-events:none;opacity:0;transition:opacity .45s ease-in}#fx.sea{background:radial-gradient(circle,#e8fffb 0,#5fd6d0 35%,#063a4c 100%)}#fx.sky{background:radial-gradient(circle,#fffbe9 0,#ffc777 38%,#5a3f8c 100%)}`;
const html = `<!doctype html><meta charset=utf-8><title>Aereal</title><meta name=viewport content="width=device-width,initial-scale=1"><style>${css}</style><canvas id=c></canvas><div id=fx></div><div id=t></div><div id=h>Growing the world…</div><script>${js}</script>`;
writeFileSync(out, html);
console.log(out, html.length, 'bytes,', gzipSync(html, { level: 9 }).length, 'gzipped');

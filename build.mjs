// node build.mjs [dev] [out.html]  -> single self-contained index.html (needs esbuild: npm i esbuild, or TOOLS=<dir with node_modules>)
import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { gzipSync } from 'zlib';
const dev = process.argv[2] === 'dev', out = process.argv[dev ? 3 : 2] || 'index.html';
const src = n => readFileSync(new URL('src/' + n, import.meta.url), 'utf8');
const wg = s => s.replace(/w`([^`]*)`/g, (m, c) => '`' + c.replace(/\s+/g, ' ').replace(/ ?([^A-Za-z0-9_.$ ]) ?/g, '$1').trim() + '`').replace('const w = String.raw, ', 'const ');
let js = src('gen.js') + (dev ? src('wgsl.js') : wg(src('wgsl.js'))) + src('main.js');
if (!dev) { const esbuild = createRequire(process.env.TOOLS ? process.env.TOOLS + '/' : import.meta.url)('esbuild'); js = (await esbuild.transform('(()=>{' + js + '})()', { minify: true, target: 'es2022' })).code.trim() }
const html = `<!doctype html><meta charset=utf-8><title>Aereal</title><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{width:100%;height:100%;display:block}#h{position:fixed;left:0;right:0;bottom:28px;text-align:center;font:14px system-ui,sans-serif;color:#fff;text-shadow:0 1px 5px #000;white-space:pre-line;pointer-events:none}</style><canvas id=c></canvas><div id=h>Growing the world…</div><script>${js}</script>`;
writeFileSync(out, html);
console.log(out, html.length, 'bytes,', gzipSync(html, { level: 9 }).length, 'gzipped');

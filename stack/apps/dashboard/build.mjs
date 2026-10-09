import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Build a static page from the canonical Mari components. No browser JS or server application.
const root = dirname(fileURLToPath(import.meta.url));
const library = resolve(process.env.MARI_DESIGN_ROOT || `${homedir()}/mari-root/mari-design/components`);
const require = createRequire(resolve(library, 'package.json'));
const { build } = require('esbuild');
const postcss = require('postcss');
const tailwind = require('tailwindcss');
const { default: theme } = await import(pathToFileURL(resolve(library, 'tailwind.config.js')));
const temporary = mkdtempSync(resolve(tmpdir(), 'mari-dashboard-'));
try {
  const output = resolve(temporary, 'page.cjs');
  await build({entryPoints:[resolve(root,'src/page.tsx')],outfile:output,bundle:true,platform:'node',format:'cjs',jsx:'automatic',alias:{'@mari':library,'react':resolve(library,'node_modules/react'),'react-dom':resolve(library,'node_modules/react-dom')},nodePaths:[resolve(library,'node_modules')]});
  const { render } = createRequire(import.meta.url)(output);
  const content = [resolve(root,'src/**/*.tsx'), ...['layout','actions','data-display','navigation','tokens','shell'].map(dir=>resolve(library,`${dir}/**/*.{ts,tsx}`))];
  const { css } = await postcss([tailwind({...theme, content})]).process('@tailwind base;@tailwind components;@tailwind utilities;', {from:undefined});
  const fonts = [['Inter','inter-latin.woff2'],['JetBrains Mono','jetbrains-mono-latin.woff2']].map(([name,file])=>`@font-face{font-family:'${name}';src:url(data:font/woff2;base64,${readFileSync(resolve(library,'../design-system/sample/fonts',file)).toString('base64')}) format('woff2');font-weight:100 900;font-display:swap}`).join('');
  writeFileSync(resolve(root,'site/index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Service dashboard | Mari</title><style>${fonts}${css}body{font-family:Inter,system-ui,sans-serif}</style></head><body class="bg-flysch text-ink min-h-screen">${render()}</body></html>`);
  console.log('Built site/index.html from Mari components.');
} finally { rmSync(temporary, {recursive:true,force:true}); }

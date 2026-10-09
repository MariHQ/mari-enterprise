/** One dependency tree, typecheck, Vite/Tailwind config, and font bundle for every Mari app. */
import {readFileSync, existsSync, mkdirSync, cpSync} from 'node:fs';
import {basename,dirname,resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build,createServer} from 'vite';
import react from '@vitejs/plugin-react';
import ts from 'typescript';
import tailwind from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import {pathToFileURL} from 'node:url';

const HERE=dirname(fileURLToPath(import.meta.url));
const MARI=resolve(HERE,'../../..');
const LIB=join(MARI,'vendor/mari-design/components');
const action=process.argv[2]||'build';
if(!['build','check','dev'].includes(action)||!process.argv[3])throw Error('Usage: node build.mjs build|check|dev <app directory>');
const app=resolve(process.argv[3]);
const appId=basename(app);
const root=join(app,'web');
const base=appId==='container'?'/':`/apps/${appId}/`;
const modules=join(HERE,'node_modules');
const deps=JSON.parse(readFileSync(join(HERE,'package.json'),'utf8')).dependencies;
const aliases=[...['auth','http','records','types','mobile'].map(name=>({find:'@mari-app/'+name,replacement:join(HERE,name+(name==='auth'?'.tsx':'.ts'))})),{find:'@mari-app/screen',replacement:join(HERE,'screen.tsx')},{find:'@mari-design/components',replacement:LIB},{find:'@mari-app/styles.css',replacement:join(HERE,'styles.css')},
 ...Object.keys(deps).map(name=>({find:name,replacement:join(modules,name)}))];

function typecheck(){
 const parsed=ts.parseJsonConfigFileContent({compilerOptions:{target:'ES2020',lib:['ES2020','DOM','DOM.Iterable'],jsx:'react-jsx',module:'ESNext',moduleResolution:'bundler',strict:true,noEmit:true,skipLibCheck:true,esModuleInterop:true,resolveJsonModule:true,allowImportingTsExtensions:true,baseUrl:HERE,
 paths:{'@mari-app/*':[join(HERE,'*')],'@mari-app/screen':[join(HERE,'screen.tsx')],'react-router-dom':[join(modules,'react-router-dom')],'@mari-design/components':[join(LIB,'index.ts')],'@mari-design/components/*':[join(LIB,'*')],react:[join(modules,'@types/react')],'react/*':[join(modules,'@types/react/*')],'react-dom':[join(modules,'@types/react-dom')],'react-dom/*':[join(modules,'@types/react-dom/*')],'lucide-react':[join(modules,'lucide-react')],'@radix-ui/*':[join(modules,'@radix-ui/*')]},types:['react','react-dom'],typeRoots:[join(modules,'@types')]},include:[join(root,'src/**/*')]},ts.sys,root);
 const program=ts.createProgram(parsed.fileNames,parsed.options);
 const diagnostics=[...parsed.errors,...ts.getPreEmitDiagnostics(program)];
 if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:x=>x,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exit(1);}
}
if(action!=='dev')typecheck();
if(action!=='check'){
 const theme=(await import(pathToFileURL(join(LIB,'tailwind.config.js')))).default;
 const config={configFile:false,root,base,publicDir:join(HERE,'public'),plugins:[react()],resolve:{alias:aliases,dedupe:['react','react-dom']},
  css:{postcss:{plugins:[tailwind({...theme,content:[join(root,'index.html'),join(root,'src/**/*.{ts,tsx}'),join(HERE,'*.tsx'),join(LIB,'**/*.{ts,tsx}'),'!'+join(LIB,'node_modules/**'),'!'+join(LIB,'dist/**')]}),autoprefixer()]}},
  server:{host:'127.0.0.1',port:Number(process.env.MARI_WEB_PORT||5175),allowedHosts:['localhost','127.0.0.1'],fs:{allow:[MARI]},proxy:Object.fromEntries(['/auth','/api','/healthz','/apps'].map(path=>[path,process.env.MARI_API_URL||'http://127.0.0.1:8080']))}};
 if(action==='build')await build(config);
 else {const server=await createServer(config);await server.listen();server.printUrls();}
}

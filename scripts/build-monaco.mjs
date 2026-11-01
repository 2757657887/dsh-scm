import {build} from 'esbuild';
import {copyFile} from 'node:fs/promises';
await build({entryPoints:['src/client/monacoEntry.ts'],outfile:'lib/assets/monaco.js',bundle:true,format:'iife',platform:'browser',minify:true,loader:{'.ttf':'file'},assetNames:'[name]-[hash]',publicPath:'/dsh-scm/assets',define:{'globalThis.MonacoEnvironment':'globalThis.__DshScmMonacoEnvironment','process.env.NODE_ENV':'"production"'}});
await build({entryPoints:['node_modules/monaco-editor/esm/vs/editor/editor.worker.js'],outfile:'lib/assets/editor.worker.js',bundle:true,format:'iife',platform:'browser',minify:true});

await copyFile('node_modules/monaco-editor/LICENSE','lib/assets/monaco.LICENSE.txt');
await copyFile('node_modules/dompurify/LICENSE','lib/assets/dompurify.LICENSE.txt');

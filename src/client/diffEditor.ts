import { createElement as h, useEffect, useRef, useState, type ReactNode } from 'react'
import { call } from './api.js'
export interface DiffRequest {repo:string;file:string;staged?:boolean;hash?:string;from?:string}
export interface Versions {original:string;modified:string;binary:boolean;file:string;leftLabel:string;rightLabel:string}
type Model={dispose():void}
type Editor={dispose():void;setModel(m:{original:Model;modified:Model}):void;goToDiff?(direction:'next'|'previous'):void}
type Monaco={editor:{createModel(text:string,language:string):Model;createDiffEditor(el:HTMLElement,options:Record<string,unknown>):Editor;defineTheme(name:string,theme:unknown):void;setTheme(name:string):void}}
let loading:Promise<Monaco>|undefined
function loadMonaco():Promise<Monaco>{
  const scope=window as unknown as {__DshScmMonaco?:Monaco}
  if(scope.__DshScmMonaco)return Promise.resolve(scope.__DshScmMonaco)
  if(loading)return loading
  loading=new Promise<Monaco>((resolve,reject)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='/dsh-scm/assets/monaco.css';document.head.append(css)
    const script=document.createElement('script');script.src='/dsh-scm/assets/monaco.js'
    script.onload=()=>{if(scope.__DshScmMonaco)resolve(scope.__DshScmMonaco);else{loading=undefined;reject(new Error('差异编辑器未正确初始化。'))}}
    script.onerror=()=>{script.remove();css.remove();loading=undefined;reject(new Error('差异编辑器资源加载失败，请重启 DSH。'))}
    document.head.append(script)
  });return loading
}
export function languageFor(file:string):string {
 const ext=file.split('.').pop()?.toLowerCase()??''
 return ({py:'python',js:'javascript',jsx:'javascript',ts:'typescript',tsx:'typescript',cpp:'cpp',cc:'cpp',c:'cpp',h:'cpp',hpp:'cpp',sh:'shell',md:'markdown',css:'css',html:'html',xml:'xml',yml:'yaml',yaml:'yaml'} as Record<string,string>)[ext]??'plaintext'
}
export function VersionDiff(props:{sessionId:string;request:DiffRequest;onClose?:()=>void}):ReactNode {
 const mount=useRef<HTMLElement|null>(null),editor=useRef<Editor|null>(null)
 const [versions,setVersions]=useState<Versions|null>(null),[error,setError]=useState(''),[ready,setReady]=useState(false)
 const r=props.request
 useEffect(()=>{
  let disposed=false;let instance:Editor|undefined;let models:Model[]=[]
  setVersions(null);setError('');setReady(false)
  void Promise.all([loadMonaco(),call<Versions>('file-versions',props.sessionId,{repo:r.repo,file:r.file,staged:r.staged,base:r.hash,name:r.from})]).then(([monaco,value])=>{
   if(disposed)return;setVersions(value)
   if(value.binary)return
   monaco.editor.defineTheme('dsh-scm-dark',{base:'vs-dark',inherit:true,rules:[],colors:{'editor.background':'#1f1f2e','editorGutter.background':'#1f1f2e','diffEditor.insertedLineBackground':'#2ea04320','diffEditor.removedLineBackground':'#f8514920'}})
   const original=monaco.editor.createModel(value.original,languageFor(r.file)),modified=monaco.editor.createModel(value.modified,languageFor(r.file));models=[original,modified]
   if(!mount.current)throw new Error('差异容器已关闭。')
   instance=monaco.editor.createDiffEditor(mount.current,{theme:'dsh-scm-dark',automaticLayout:true,readOnly:true,originalEditable:false,renderSideBySide:true,useInlineViewWhenSpaceIsLimited:false,enableSplitViewResizing:true,ignoreTrimWhitespace:false,renderIndicators:true,renderOverviewRuler:true,diffAlgorithm:'advanced',minimap:{enabled:false},scrollBeyondLastLine:false,fontSize:13,lineNumbers:'on',accessibilitySupport:'auto',maxComputationTime:5000})
   instance.setModel({original,modified});editor.current=instance;setReady(true)
  }).catch(e=>{if(!disposed)setError(e instanceof Error?e.message:String(e))})
  return()=>{disposed=true;instance?.dispose();models.forEach(m=>m.dispose());editor.current=null}
 },[props.sessionId,r.repo,r.file,r.staged,r.hash,r.from])
 return h('div',{style:{display:'flex',flexDirection:'column',height:'100%',minHeight:0,background:'#1f1f2e',color:'#ccc',font:'12px Segoe UI,sans-serif'}},
  h('div',{style:{display:'flex',alignItems:'center',gap:8,padding:'6px 10px',borderBottom:'1px solid #353544'}},props.onClose?h('button',{onClick:props.onClose,title:'返回源代码管理'},'←'):null,h('span',{style:{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'},title:r.file},r.file),h('button',{style:{border:0,background:'transparent',color:'#ccc',cursor:'pointer'},onClick:()=>editor.current?.goToDiff?.('previous'),disabled:!ready,title:'上一个更改'},'↑'),h('button',{style:{border:0,background:'transparent',color:'#ccc',cursor:'pointer'},onClick:()=>editor.current?.goToDiff?.('next'),disabled:!ready,title:'下一个更改'},'↓')),
  h('div',{style:{display:'grid',gridTemplateColumns:'1fr 1fr',fontSize:11,padding:'4px 12px',background:'#252536',borderBottom:'1px solid #353544'}},h('span',null,'原始版本 · '+(versions?.leftLabel??'')),h('span',null,'修改版本 · '+(versions?.rightLabel??''))),
  error?h('div',{role:'alert',style:{padding:15,color:'#f48771'}},error):null,
  versions?.binary?h('div',{style:{padding:20}},'二进制文件无法显示文本差异。'):null,
  !ready&&!error&&!versions?.binary?h('div',{style:{padding:15}},'正在加载左右差异…'):null,
  h('div',{ref:mount,style:{flex:1,minHeight:0,overflow:'hidden'}}))
}
let openTab:((request:DiffRequest)=>void)|undefined
export function bindDiffOpener(fn:(request:DiffRequest)=>void):()=>void {openTab=fn;return()=>{if(openTab===fn)openTab=undefined}}
export function openDiffTab(request:DiffRequest):boolean {if(!openTab)return false;openTab(request);return true}
export function ScmDiffTab(props:{sessionId:string;useTabInfo:()=>{tab:{navigation?:{params?:DiffRequest}}}}):ReactNode {
 let request=props.useTabInfo().tab.navigation?.params
 try { const key='dsh-scm:diff:'+props.sessionId; if(request)sessionStorage.setItem(key,JSON.stringify(request));else request=JSON.parse(sessionStorage.getItem(key)??'null') as DiffRequest|undefined } catch { /* Storage may be disabled. */ }
 return request?h(VersionDiff,{sessionId:props.sessionId,request}):h('div',{style:{padding:20}},'请从源代码管理中选择一个文件。')
}

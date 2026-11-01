import {createElement as h,useEffect,useRef,useState,type ReactNode} from 'react'
import {VersionDiff,type DiffRequest} from './diffEditor.js'
export interface GroupDiffRequest {title:string;files:DiffRequest[]}
function DiffBlock(props:{sessionId:string;request:DiffRequest;root:{current:HTMLElement|null};collapseAll:boolean;revision:number}):ReactNode {
 const section=useRef<HTMLElement|null>(null)
 const [near,setNear]=useState(false),[height,setHeight]=useState(300),[collapsed,setCollapsed]=useState(props.collapseAll)
 useEffect(()=>setCollapsed(props.collapseAll),[props.revision,props.collapseAll])
 useEffect(()=>{
  if(!section.current)return
  const observer=new IntersectionObserver(entries=>setNear(entries[0]?.isIntersecting??false),{root:props.root.current,rootMargin:'150px'})
  observer.observe(section.current);return()=>observer.disconnect()
 },[props.request.file,props.request.repo,props.root])
 return h('section',{ref:section,style:{borderBottom:'1px solid var(--dsw-alias-border-l2,#5555)'}},
  h('button',{type:'button','aria-expanded':!collapsed,onClick:()=>setCollapsed(v=>!v),style:{display:'flex',gap:6,width:'100%',border:0,padding:'6px 12px',background:'var(--dsw-alias-bg-layer-1,transparent)',color:'inherit',textAlign:'left',cursor:'pointer',font:'12px Segoe UI,sans-serif'}},collapsed?'›':'⌄',props.request.file),
  !collapsed?h('div',{style:{height,minHeight:120}},near?h(VersionDiff,{sessionId:props.sessionId,request:props.request,compact:true,onSize:setHeight}):h('div',{style:{padding:16,fontSize:12,color:'var(--dsw-alias-label-tertiary,inherit)'}},'滚动到此处时加载差异…')):null)
}
export function MultiDiff(props:{sessionId:string;request:GroupDiffRequest;onClose?:()=>void}):ReactNode {
 const scroll=useRef<HTMLElement|null>(null),[collapseAll,setCollapseAll]=useState(false),[revision,setRevision]=useState(0)
 const action=(label:string,collapse:boolean)=>h('button',{type:'button',onClick:()=>{setCollapseAll(collapse);setRevision(v=>v+1)},style:{border:0,background:'transparent',color:'inherit',cursor:'pointer',font:'12px Segoe UI,sans-serif'}},label)
 return h('div',{style:{display:'flex',flexDirection:'column',height:'100%',minHeight:0,color:'var(--dsw-alias-label-primary,inherit)',background:'transparent'}},
  h('div',{style:{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderBottom:'1px solid var(--dsw-alias-border-l2,#5555)',font:'12px Segoe UI,sans-serif'}},props.onClose?h('button',{onClick:props.onClose},'←'):null,h('span',{style:{flex:1}},`${props.request.title} · ${props.request.files.length} 个文件`),action('全部折叠',true),action('全部展开',false)),
  h('div',{ref:scroll,style:{flex:1,minHeight:0,overflow:'auto',overscrollBehavior:'contain'}},...props.request.files.map(file=>h(DiffBlock,{key:`${file.repo}:${file.file}:${file.staged}`,sessionId:props.sessionId,request:file,root:scroll,collapseAll,revision}))))
}
let opener:((request:GroupDiffRequest)=>void)|undefined
export function bindGroupDiffOpener(fn:(request:GroupDiffRequest)=>void):()=>void {opener=fn;return()=>{if(opener===fn)opener=undefined}}
export function openGroupDiffTab(request:GroupDiffRequest):boolean {if(!opener)return false;opener(request);return true}
export function ScmMultiDiffTab(props:{sessionId:string;useTabInfo:()=>{tab:{navigation?:{params?:GroupDiffRequest}}}}):ReactNode {
 let request=props.useTabInfo().tab.navigation?.params
 try{const key='dsh-scm:multi-diff:'+props.sessionId;if(request)sessionStorage.setItem(key,JSON.stringify(request));else request=JSON.parse(sessionStorage.getItem(key)??'null') as GroupDiffRequest|undefined}catch{/* Storage may be unavailable. */}
 return request&&Array.isArray(request.files)?h(MultiDiff,{sessionId:props.sessionId,request}):h('div',{style:{padding:20}},'请在源代码管理的分组标题栏选择“查看所有更改”。')
}

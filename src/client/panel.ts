import {openWorkspaceFile,openGraphTab} from './navigation.js'
import {MultiDiff,openGroupDiffTab,type GroupDiffRequest} from './multiDiff.js'
import {scmGlyphs} from './scmIcons.js'
import {VersionDiff,openDiffTab,type DiffRequest} from './diffEditor.js'
import { createElement as h, useState, useEffect, useRef, type ReactNode } from 'react'
import { call, ScmError, type ContextValue, type RepoStatus, type StatusEntry, type CommitInfo, type BranchInfo, type CallFields } from './api.js'
import { graphRows } from './graph.js'
export interface ScmPanelProps { readonly sessionId: string; readonly graphOnly?: boolean }
type CommitDetail={hash:string;subject:string;files:{path:string;from?:string;code:string}[]}
const paneMemory=new Map<string,{message:string;detail:CommitDetail|null;height:number}>()
type MenuItem = { label: string; run?: () => void; disabled?: boolean; children?: MenuItem[]; separator?: boolean }
type Selection = { path: string; staged: boolean }
const paths: Record<string, string[]> = {
  more: ['M4 12h.01M12 12h.01M20 12h.01'], chevron: ['m9 5 7 7-7 7'], check: ['m5 12 4 4L19 6'],
  refresh: ['M20 7v5h-5','M4 17v-5h5','M6 7a7 7 0 0 1 12-1l2 3','M18 17a7 7 0 0 1-12 1l-2-3'],
  plus: ['M12 5v14M5 12h14'], minus: ['M5 12h14'], undo: ['M9 5 4 10l5 5','M4 10h10a6 6 0 0 1 0 12'],
  branch: ['M6 7v10','M18 7c0 5-12 3-12 10','M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4','M18 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4','M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
  down: ['M12 3v14m-5-5 5 5 5-5M4 21h16'], up: ['M12 17V3m-5 5 5-5 5 5M4 21h16'],
  close: ['m6 6 12 12M6 18 18 6'], file: ['M6 3h8l4 4v14H6z','M14 3v5h4'], folder: ['M3 6h7l2 2h9v12H3z'], graph: ['M6 5v14M6 12h12V5','M4 3h4v4H4zM16 3h4v4h-4zM4 17h4v4H4z'], search: ['M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14','m15 15 6 6']
}
function icon(name: string) { if(scmGlyphs[name])return h('svg',{width:16,height:16,viewBox:'0 0 24 24',fill:'currentColor','aria-hidden':true},h('path',{d:scmGlyphs[name]})); return h('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, ...(paths[name] ?? paths.file).map((d, i) => h('path', { d, key: i }))) }
const css = `
.vscm{--fg:var(--dsw-alias-label-primary,inherit);--dim:var(--dsw-alias-label-tertiary,#96969f);--bg:transparent;--hover:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));--sel:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.18));--border:var(--dsw-alias-border-l2,rgba(127,127,127,.2));--blue:var(--dsw-alias-state-business-primary,#3b66c9);display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg);color:var(--fg);font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;position:relative;isolation:isolate;color-scheme:inherit}
.vscm *{box-sizing:border-box}.vscm button,.vscm input,.vscm textarea{font:inherit;color:inherit}.vscm button{cursor:pointer}.vscm button:disabled{opacity:.4;cursor:default}.vscm button:focus-visible,.vscm [tabindex]:focus-visible{outline:1px solid #75beff;outline-offset:-1px}.vscm .ib{display:inline-flex;align-items:center;justify-content:center;width:24px;height:22px;padding:2px;border:0;background:transparent;border-radius:3px;color:var(--fg);flex-shrink:0}.vscm .ib:hover{background:rgba(255,255,255,.1)}
.vscm-title{height:30px;padding:0 12px 0 20px;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:500}.vscm-section{display:flex;align-items:center;height:26px;gap:4px;padding:0 8px;font-size:11px;flex-shrink:0;user-select:none}.vscm-section>span:nth-of-type(2){cursor:pointer;flex:1}.vscm .arrow{flex:none;transform:rotate(90deg);width:16px;height:16px;display:inline-flex}.vscm .arrow.closed{transform:none}.vscm-repos{flex-shrink:0}.vscm-repo{display:flex;align-items:center;gap:6px;padding:0 8px 0 22px;height:24px;cursor:pointer}.vscm-repo.active{background:var(--sel)}.vscm-repo-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vscm-branch{display:flex;gap:2px;align-items:center;font-size:12px;color:#aac8ff;max-width:45%;overflow:hidden;white-space:nowrap;background:none;border:0}.vscm-changes{flex:1;min-height:90px;display:flex;flex-direction:column;overflow:hidden}.vscm-compose{padding:0 20px 8px;flex-shrink:0}.vscm-input{display:block;resize:vertical;width:100%;min-height:28px;max-height:140px;padding:3px 6px;border:1px solid var(--border);border-radius:2px;background:var(--dsw-alias-bg-layer-1,transparent);line-height:20px}.vscm-input:focus{outline:1px solid #5c88df;outline-offset:-1px}.vscm-commitrow{display:flex;margin-top:8px;height:26px;border-radius:2px;overflow:hidden}.vscm-commit{flex:1;border:0;background:var(--blue);display:flex;align-items:center;justify-content:center;gap:4px}.vscm-drop{width:26px;border:0;border-left:1px solid #7592cb;background:var(--blue)}
.vscm-list{overflow:auto;flex:1;min-height:0;overscroll-behavior:contain}.vscm-group{height:24px;display:flex;align-items:center;padding:0 8px 0 12px;gap:4px;font-weight:600;user-select:none}.vscm-group .label{flex:1;cursor:pointer}.vscm-count{min-width:18px;height:18px;border-radius:10px;background:#3c64b9;color:white;text-align:center;font-size:11px;line-height:18px;padding:0 5px;font-weight:400}.vscm-file{height:23px;padding:0 10px 0 22px;display:flex;gap:5px;align-items:center;cursor:pointer;outline:none;white-space:nowrap}.vscm-file:hover{background:var(--hover)}.vscm-file.selected{background:var(--sel)}.vscm-name{overflow:hidden;text-overflow:ellipsis;flex-shrink:0;max-width:60%}.vscm-dir{color:var(--dim);font-size:11px;overflow:hidden;text-overflow:ellipsis;flex:1}.vscm-status{font-size:11px;flex-shrink:0;color:#d7a866}.vscm-file .actions{display:none;margin-left:auto;gap:0}.vscm-file:hover .actions,.vscm-file:focus-within .actions{display:flex}.vscm-file:hover .vscm-dir{min-width:0}.vscm-file[data-code='U'] .vscm-name,.vscm-file[data-code='A'] .vscm-name{color:#8cc68a}.vscm-file[data-code='D'] .vscm-name{color:#dc8b86}.vscm-file[data-code='!'] .vscm-name{color:#f48771}.vscm-file .file-icon{color:#72aabb;display:flex}
.vscm-resizer{height:4px;border-top:1px solid var(--border);cursor:row-resize;flex-shrink:0}.vscm-resizer:hover{background:#007acc}.vscm-history{flex-shrink:0;min-height:80px;display:flex;flex-direction:column}.vscm-commitfiles{position:relative;background:transparent}.vscm-commitfiles .vscm-file{position:relative}.vscm-graph-spine{position:absolute;top:0;bottom:0;border-left:1.5px solid;pointer-events:none;z-index:2}.vscm-commitfiles .vscm-note{padding:5px 22px}.vscm-commitfiles .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.vscm-graphrows{overflow:auto;flex:1;min-height:0}.vscm-graphrow{height:24px;display:flex;align-items:center;white-space:nowrap;cursor:pointer;padding-right:8px;font-size:12px}.vscm-graphrow.selected{background:var(--sel)}.vscm-graphrow:hover{background:var(--hover)}.vscm-graphrow svg{flex-shrink:0}.vscm-subject{flex:1;overflow:hidden;text-overflow:ellipsis}.vscm-ref{font-size:10px;border:1px solid #5e9fe4;border-radius:9px;color:#75bfff;padding:0 5px;margin-left:5px;max-width:110px;overflow:hidden;text-overflow:ellipsis}.vscm-date{font-size:10px;color:var(--dim);margin-left:7px}.vscm-note{padding:12px 20px;color:var(--dim);font-size:12px}.vscm-error{color:#f48771;padding:6px 12px;white-space:pre-wrap;max-height:100px;overflow:auto;border-bottom:1px solid var(--border)}.vscm-busy{height:2px;position:absolute;top:0;left:0;right:0;background:linear-gradient(90deg,transparent,#75beff,transparent);background-size:50%;animation:vscmprogress 1s linear infinite;z-index:20}@keyframes vscmprogress{to{background-position:200%}}
.vscm-overlay{position:absolute;inset:0;z-index:30;background:var(--bg);display:flex;flex-direction:column}.vscm-difftop{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px}.vscm-difftop .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vscm-diff{overflow:auto;flex:1;min-height:0;font:12px/20px Consolas,monospace;white-space:pre;tab-size:4;padding-bottom:24px}.vscm-line{display:block;min-width:max-content;padding:0 10px}.vscm-line.add{background:#1e3a2a;color:#b4debc}.vscm-line.del{background:#462b30;color:#f0b6bd}.vscm-line.hunk{background:#24374c;color:#9cdcfe}.vscm-menu{position:absolute;z-index:60;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid #4b4b59;box-shadow:0 4px 16px #0008;padding:4px;border-radius:4px;min-width:180px;max-width:calc(100% - 12px)}.vscm-menu button{display:block;text-align:left;width:100%;border:0;background:none;padding:5px 14px;font-size:12px}.vscm-menu{max-height:calc(100% - 8px);overflow-y:auto}.vscm-menu button:hover{background:var(--hover)}.vscm-modalshade{position:absolute;inset:0;background:#0006;z-index:70;display:flex;align-items:flex-start;justify-content:center;padding:35px 10px}.vscm-modal{padding:12px;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid #555563;box-shadow:0 5px 20px #0008;width:100%;max-width:420px}.vscm-modal p{font-size:12px;white-space:pre-wrap;word-break:break-word}.vscm-modal footer{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.vscm-modal footer button{background:var(--blue);border:0;padding:4px 12px}.vscm-picker{max-height:250px;overflow:auto;margin-top:6px}.vscm-picker button{display:block;width:100%;border:0;background:none;text-align:left;padding:5px 8px}.vscm-picker button:hover{background:var(--sel)}
`
export function ScmPanel({ sessionId, graphOnly=false }: ScmPanelProps): ReactNode {
  const root = useRef<HTMLElement | null>(null)
  const repoRef = useRef(''), epoch = useRef(0), inFlight = useRef(false), mutation = useRef(false), diffEpoch = useRef(0)
  const [loaded, setLoaded] = useState(false)
  const [context, setContext] = useState<ContextValue | null>(null), [status, setStatus] = useState<RepoStatus | null>(null)
  const [commits, setCommits] = useState<CommitInfo[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [message, setMessage] = useState(''), [collapsed, setCollapsed] = useState<Record<string, boolean>>({}), [selected, setSelected] = useState<Selection[]>([])
  const [visibleSections,setVisibleSections]=useState<Record<string,boolean>>(()=>{if(graphOnly)return {repos:false,changes:false,graph:true};try{return JSON.parse(localStorage.getItem('dsh-scm:visible-sections')??'null')??{repos:true,changes:true,graph:true}}catch{return {repos:true,changes:true,graph:true}}})
  const [graphBranches,setGraphBranches]=useState<BranchInfo[]>([])
  const [graphBranch,setGraphBranch]=useState('')
  const graphBranchRef=useRef('')
  const [repoSort,setRepoSort]=useState<'discovery'|'path'|'name'>(()=>{try{const v=localStorage.getItem('dsh-scm:repo-sort');return v==='path'||v==='name'?v:'discovery'}catch{return 'discovery'}})
  const [treeView,setTreeView]=useState(()=>{try{return localStorage.getItem('dsh-scm:tree-view')==='true'}catch{return false}})
  const [graphHeight, setGraphHeight] = useState(175), [limit, setLimit] = useState(60)
  const [groupDiff,setGroupDiff]=useState<GroupDiffRequest|null>(null)
  const [versionDiff,setVersionDiff]=useState<DiffRequest|null>(null)
  const [commitDetail,setCommitDetail]=useState<CommitDetail|null>(null)
  const [expandedCommit,setExpandedCommit]=useState<string|null>(null)
  const [commitLoading,setCommitLoading]=useState(false)
  const commitEpoch=useRef(0)
  const [diff, setDiff] = useState<{ title: string; text: string; selection?: Selection } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [submenu,setSubmenu]=useState<{x:number;y:number;items:MenuItem[];label:string}|null>(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)
  const [form,setForm]=useState<{title:string;labels:string[];values:string[];submit:(values:string[])=>void}|null>(null)
  const [choices,setChoices]=useState<{title:string;items:{label:string;run:()=>void;disabled?:boolean}[]}|null>(null)
  const [output,setOutput]=useState<string|null>(null)
  const outputLog=useRef('')
  const [branchAction,setBranchAction]=useState<'switch'|'merge'|'delete'>('switch')
  const [fileSort,setFileSort]=useState<'path'|'name'|'status'>(()=>{try{const v=localStorage.getItem('dsh-scm:file-sort');return v==='name'||v==='status'?v:'path'}catch{return 'path'}})
  const [branches, setBranches] = useState<BranchInfo[] | null>(null), [filter, setFilter] = useState('')
  useEffect(()=>{if(graphOnly)return;try{localStorage.setItem('dsh-scm:visible-sections',JSON.stringify(visibleSections));localStorage.setItem('dsh-scm:repo-sort',repoSort);localStorage.setItem('dsh-scm:tree-view',String(treeView));localStorage.setItem('dsh-scm:file-sort',fileSort)}catch{/* Storage is optional. */}},[visibleSections,repoSort,treeView,fileSort])
  const memoryKey=()=>sessionId+'|'+repoRef.current
  function saveMessage(value:string){setMessage(value);const old=paneMemory.get(memoryKey());paneMemory.set(memoryKey(),{message:value,detail:old?.detail??commitDetail,height:old?.height??graphHeight})}
  function restorePane(){const saved=paneMemory.get(memoryKey());setMessage(saved?.message??'');setCommitDetail(saved?.detail??null);setExpandedCommit(saved?.detail?.hash??null);setGraphHeight(saved?.height??175)}
  const api = <T,>(op: string, fields: CallFields = {}) => call<T>(op, sessionId, { repo: repoRef.current || undefined, ...fields })
  const showError = (e: unknown) => setError(e instanceof Error ? e.message + ('detail' in e ? '\n' + String(e.detail) : '') : String(e))
  async function refresh(history = false) {
    if (inFlight.current || mutation.current) return
    inFlight.current = true
    const token = epoch.current, repo = repoRef.current, activeBranch=graphOnly?graphBranchRef.current:''
    try {
      const value = await api<{status: RepoStatus;remotes:string[]}>('status')
      if (epoch.current !== token || repo !== repoRef.current) return
      setStatus(value.status)
      setContext(current=>current?{...current,remotes:value.remotes}:current)
      if (history) { const log = await api<{commits: CommitInfo[]}>('log', { limit,branch:activeBranch||undefined }); if (epoch.current === token && repo === repoRef.current && (!graphOnly||activeBranch===graphBranchRef.current)) setCommits(log.commits) }
    } catch (e) { if (epoch.current === token) showError(e) } finally { inFlight.current = false }
  }
  useEffect(() => {
    const token = ++epoch.current; repoRef.current = '';graphBranchRef.current='';setGraphBranch('');setGraphBranches([]); setLoaded(false); setContext(null);setCommitDetail(null);setExpandedCommit(null);++commitEpoch.current; setStatus(null); setCommits([]); setDiff(null); setError('');setMenu(null);setConfirm(null);setForm(null);setChoices(null);setBranches(null);setOutput(null);setMessage(''); setSelected([])
    void api<ContextValue>('context').then(async c => { if (epoch.current !== token) return; setContext(c); setLoaded(true); repoRef.current = c.isRepo ? (c.repos.find(r=>r.path.replaceAll('\\','/').toLowerCase()===c.repo.replaceAll('\\','/').toLowerCase())?.path ?? c.repo) : c.repos[0]?.path ?? ''; restorePane(); if (repoRef.current) { await refresh(true); if(graphOnly){const b=await api<{branches:BranchInfo[]}>('branches');if(epoch.current===token)setGraphBranches(b.branches)} } }).catch(e => { if (epoch.current === token) { setLoaded(true); showError(e) } })
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && root.current?.getBoundingClientRect().width && repoRef.current) void refresh() }, 5000)
    return () => { ++epoch.current; ++diffEpoch.current; clearInterval(timer) }
  }, [sessionId])
  async function run(op: string, fields: CallFields = {}, after?: (value:{output?:string;path?:string}) => void) {
    if (mutation.current) return
    mutation.current = true; setBusy(true); setError(''); setMenu(null)
    const token = epoch.current
    try { const value=await api<{output?:string;path?:string}>(op, fields); outputLog.current=(outputLog.current+`\n> ${op}\n`+(value.output??'完成')+'\n').slice(-50000); if (epoch.current === token) after?.(value) } catch (e) { if (epoch.current === token) {if(e instanceof ScmError && e.code==='post-commit-failed')saveMessage('');outputLog.current=(outputLog.current+`\n> ${op}\n`+String(e)+'\n'+(e instanceof ScmError?e.detail:'')).slice(-50000);showError(e)} }
    finally { mutation.current = false; setBusy(false); if (epoch.current === token) { inFlight.current = false; await refresh(true) } }
  }
  function showVersions(request:DiffRequest) {if(!openDiffTab(request))setVersionDiff(request)}
  async function openFile(path:string,staged:boolean) {
    setSelected([{path,staged}])
    const file=(staged?status?.staged:changes)?.find(f=>f.path===path)
    showVersions({repo:repoRef.current,file:path,staged,from:file?.from})
  }
  async function selectCommit(commit:CommitInfo) {
    if(expandedCommit===commit.hash){
      ++commitEpoch.current;setExpandedCommit(null);setCommitDetail(null);setCommitLoading(false)
      const saved=paneMemory.get(memoryKey());if(saved)paneMemory.set(memoryKey(),{...saved,detail:null})
      return
    }
    setExpandedCommit(commit.hash)
    const token=++commitEpoch.current,repo=repoRef.current
    setCommitLoading(true);setCommitDetail(null)
    try { const value=await api<{hash:string;subject:string;files:{path:string;from?:string;code:string}[]}>('commit-files',{base:commit.hash});if(token===commitEpoch.current&&repo===repoRef.current){setCommitDetail(value);const saved=paneMemory.get(memoryKey());paneMemory.set(memoryKey(),{message:saved?.message??message,detail:value,height:graphHeight})} }
    catch(e){if(token===commitEpoch.current)showError(e)}finally{if(token===commitEpoch.current)setCommitLoading(false)}
  }
  function toggle(key: string) { setCollapsed(c => ({...c, [key]: !c[key]})) }
  function button(name: string, title: string, fn: (event: MouseEvent) => void, disabled = busy) { return h('button', {type: 'button', className: 'ib', title, 'aria-label': title, onClick: fn, disabled}, icon(name)) }
  function openMenu(event: MouseEvent, items: MenuItem[]) {
    event.preventDefault(); event.stopPropagation()
    const box = root.current?.getBoundingClientRect(); if (!box) return
    setSubmenu(null)
    setMenu({ x: Math.max(4, Math.min(event.clientX-box.left,box.width-210)), y: Math.max(4,Math.min(event.clientY-box.top,box.height-items.length*30-12)), items })
  }
  function showSubmenu(item:MenuItem,element:HTMLElement) {
    const box=root.current?.getBoundingClientRect(),rect=element.getBoundingClientRect()
    if(!box||!menu||!item.children||box.width<390)return false
    const width=180, left=menu.x>=width?menu.x-width+2:menu.x+180
    setSubmenu({x:Math.max(4,Math.min(left,box.width-width-4)),y:Math.max(4,Math.min(rect.top-box.top,box.height-item.children.length*30-8)),items:item.children,label:item.label})
    return true
  }
  const changes = [...(status?.unstaged ?? []), ...(status?.untracked ?? [])]
  const stage = (files: readonly StatusEntry[], staged: boolean) => void run(staged ? 'unstage' : 'stage', { files: [...new Set(files.flatMap(f => f.from ? [f.from, f.path] : [f.path]))] }, () => { setSelected([]); setDiff(null) })
  function discard(files:readonly string[]) {
    const paths=[...new Set(files.flatMap(path=>{const entry=changes.find(f=>f.path===path);return entry?.from?[entry.from,path]:[path]}))]
    const repo=repoRef.current,token=epoch.current
    setMenu(null);setConfirm({text:`确定要放弃以下 ${paths.length} 个文件的未暂存更改吗？已暂存内容会保留；未跟踪文件将被删除。此操作无法通过 Git 撤销。\n\n${paths.join('\n')}`,run:()=>{
      setConfirm(null)
      if(token!==epoch.current||repo!==repoRef.current){setError('工作区已切换，请重新选择需要放弃的文件。');return}
      void run('discard',{files:paths,confirm:true},()=>{setSelected([]);setDiff(null)})
    }})
  }
  function commit(mode:'normal'|'amend'|'push'|'sync'='normal',overrideMessage?:string) {
    setMenu(null)
    const commitMessage=overrideMessage??message
    if (!commitMessage.trim() || busy) { if (!commitMessage.trim()) root.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus(); return }
    if ((mode==='push'||mode==='sync')&&!status?.upstream) { setError('当前分支没有上游分支，请先发布分支。');return }
    const token=epoch.current,repo=repoRef.current
    const perform=(stageAll:boolean)=>{
      if(token!==epoch.current||repo!==repoRef.current){setError('工作区已切换，请重新提交。');return}
      const fields:CallFields={message:commitMessage,mode:mode==='normal'?undefined:mode,confirm:mode==='amend'||stageAll}
      if(stageAll)fields.files=changes.flatMap(f=>f.from?[f.from,f.path]:[f.path])
      void run('commit',fields,()=>saveMessage(''))
    }
    if(mode==='amend') { setConfirm({text:'这会修改最近一次提交并改写提交历史。确认继续？',run:()=>{setConfirm(null);perform(false)}});return }
    if (!status?.staged.length) {
      if (changes.length) setConfirm({text:'没有暂存的更改。是否暂存所有更改并提交？',run:()=>{setConfirm(null);perform(true)}})
      return
    }
    perform(false)
  }
  function ask(title:string,labels:string[],submit:(values:string[])=>void) {const token=epoch.current,repo=repoRef.current;setMenu(null);setForm({title,labels,values:labels.map(()=>''),submit:values=>{if(token!==epoch.current||repo!==repoRef.current){setError('工作区已切换，请重新操作。');return}submit(values)}})}
  function confirmRun(text:string,fn:()=>void){setMenu(null);const repo=repoRef.current,token=epoch.current;setConfirm({text,run:()=>{setConfirm(null);if(repo!==repoRef.current||token!==epoch.current){setError('工作区已切换，请重新操作。');return}fn()}})}
  function pickBranch(action:'switch'|'merge'|'delete') {const token=epoch.current,repo=repoRef.current;setMenu(null);setBranchAction(action);setFilter('');void api<{branches:BranchInfo[]}>('branches').then(v=>{if(token===epoch.current&&repo===repoRef.current)setBranches(v.branches)}).catch(showError)}
  function pickStash(op:'stash-apply'|'stash-pop'|'stash-drop') {const token=epoch.current,repo=repoRef.current;setMenu(null);void api<{items:{id:string;label:string}[]}>('stash-list').then(v=>{if(token!==epoch.current||repo!==repoRef.current)return;setChoices({title:'选择存储',items:v.items.map(item=>({label:`${item.id} ${item.label}`,run:()=>{setChoices(null);if(op==='stash-drop')confirmRun(`删除 ${item.id}？`,()=>void run(op,{name:item.id,confirm:true}));else void run(op,{name:item.id,confirm:true})}}))})}).catch(showError)}
  function pickTag() {const token=epoch.current,repo=repoRef.current;setMenu(null);void api<{items:string[]}>('tag-list').then(v=>{if(token!==epoch.current||repo!==repoRef.current)return;setChoices({title:'选择要删除的标记',items:v.items.map(tag=>({label:tag,run:()=>{setChoices(null);confirmRun(`删除本地标记 ${tag}？`,()=>void run('tag-delete',{name:tag,confirm:true}))}}))})}).catch(showError)}
  function pushAction(){if(status?.upstream)void run('push',{confirm:true});else confirmRun(`发布分支 ${status?.branch} 到 ${context?.remotes[0]??'origin'}？`,()=>void run('push',{confirm:true,setUpstream:true,branch:status?.branch,remote:context?.remotes[0]??'origin'}))}
  function menuItem(label:string,children:MenuItem[]):MenuItem{return {label,children}}
  function startAmend(){
    setMenu(null)
    if(message.trim()){commit('amend');return}
    const token=epoch.current,repo=repoRef.current
    void api<{message:string}>('head-message').then(value=>{if(token!==epoch.current||repo!==repoRef.current)return;setForm({title:'提交(修改)',labels:['提交消息'],values:[value.message],submit:values=>{if(token!==epoch.current||repo!==repoRef.current){setError('工作区已切换，请重新操作。');return}saveMessage(values[0]??'');commit('amend',values[0]??'')}})}).catch(showError)
  }
  function remoteItems(): MenuItem[] { return [
    {label:'拉取',run:()=>void run('pull')},{label:'推送',run:pushAction},
    {label:'克隆',run:()=>ask('克隆仓库到当前工作区',['仓库地址','新目录名称'],v=>void run('clone',{base:v[0],name:v[1]},result=>setOutput(`克隆完成：${result.path??''}`)))},
    {label:'签出到…',run:()=>pickBranch('switch')},{label:'抓取',run:()=>void run('fetch')},
    {label:'',separator:true},
    menuItem('提交',[{label:'提交',run:()=>commit()},{label:'提交（修改）',run:startAmend},{label:'提交和推送',run:()=>commit('push')},{label:'提交和同步',run:()=>commit('sync')},{label:'撤销上次提交…',run:()=>confirmRun('撤销最近一次提交并保留暂存内容？',()=>void run('undo-commit',{confirm:true}))}]),
    menuItem('更改',[{label:'打开更改',run:()=>{setMenu(null);viewAll(changes,false,'更改')},disabled:!changes.length},{label:'暂存所有更改',run:()=>stage(changes,false),disabled:!changes.length},{label:'取消暂存所有更改',run:()=>stage(status?.staged??[],true),disabled:!status?.staged.length},{label:'放弃所有更改…',run:()=>discard(changes.map(f=>f.path)),disabled:!changes.length}]),
    menuItem('拉取，推送',[{label:'拉取',run:()=>void run('pull')},{label:'推送',run:pushAction},{label:'同步',run:()=>void run('sync')},{label:'拉取（变基）…',run:()=>confirmRun('拉取并变基会改写本地提交，确认继续？',()=>void run('pull',{mode:'rebase'}))},{label:'抓取',run:()=>void run('fetch')},{label:'抓取并清理失效引用',run:()=>void run('fetch',{mode:'prune'})},{label:'抓取所有远程',run:()=>void run('fetch',{mode:'all'})}]),
    menuItem('分支',[{label:'签出到…',run:()=>pickBranch('switch')},{label:'创建分支…',run:()=>{setMenu(null);setBranchAction('switch');setBranches([]);setFilter('')}},{label:'合并分支…',run:()=>pickBranch('merge')},{label:'删除分支…',run:()=>pickBranch('delete')}]),
    menuItem('远程',[{label:'添加远程…',run:()=>ask('添加远程',['名称','Git 地址'],v=>void run('remote-add',{name:v[0],base:v[1]},()=>void refresh(true)))},{label:'删除远程…',run:()=>{setMenu(null);setChoices({title:'选择远程',items:(context?.remotes??[]).map(remote=>({label:remote,run:()=>{setChoices(null);confirmRun(`删除远程 ${remote}？`,()=>void run('remote-remove',{name:remote,confirm:true}))}}))})}}]),
    menuItem('存储',[{label:'存储',run:()=>void run('stash-save')},{label:'存储（包括未跟踪文件）',run:()=>void run('stash-save',{mode:'untracked'})},{label:'存储已暂存的更改',run:()=>void run('stash-save',{mode:'staged'})},{label:'应用存储…',run:()=>pickStash('stash-apply')},{label:'弹出存储…',run:()=>pickStash('stash-pop')},{label:'删除存储…',run:()=>pickStash('stash-drop')}]),
    menuItem('标记',[{label:'创建标记…',run:()=>ask('创建标记',['标记名称'],v=>void run('tag-create',{name:v[0]}))},{label:'删除标记…',run:pickTag},{label:'推送标记…',run:()=>confirmRun('将本地标记推送到远程？',()=>void run('push-tags',{confirm:true}))}]),
    menuItem('工作树',[{label:'创建工作树…',run:()=>ask('创建工作树',['名称'],v=>void run('worktree-add',{name:v[0]},result=>setOutput(`工作树已创建：${result.path??''}`)))},{label:'查看工作树…',run:()=>{setMenu(null);void api<{worktrees:{path:string;branch:string|null;main:boolean;dirty:boolean}[]}>('worktree-list').then(v=>setChoices({title:'工作树',items:v.worktrees.map(w=>({label:`${w.path} ${w.branch??''}${w.main?'（主工作树）':''}`,disabled:w.main,run:()=>{if(w.main)return;setChoices(null);confirmRun(`删除工作树 ${w.path}？`,()=>void run('worktree-remove',{worktree:w.path,confirm:true}))}}))})).catch(showError)}}]),
    {label:'',separator:true},{label:'显示 GIT 输出',run:()=>{setMenu(null);setOutput(outputLog.current||'暂无 Git 操作输出。')}} ] }
  function row(file: StatusEntry, staged: boolean, conflict = false, depth = 0) {
    const name = file.path.split('/').pop()!, dir = file.path.slice(0, Math.max(0,file.path.length-name.length-1)), code = conflict ? '!' : file.code==='??'?'U':(staged?file.code[0]:file.code[1]) || 'M'
    const active = selected.some(s=>s.path===file.path&&s.staged===staged)
    const items = (): MenuItem[] => {
      const group = active ? selected.filter(s=>s.staged===staged).map(s=>s.path) : [file.path]
      return [{label:'打开更改',run:()=>{setMenu(null);void openFile(file.path,staged)}},{label:'打开文件',disabled:code==='D',run:()=>{setMenu(null);try{if(!openWorkspaceFile(repoRef.current,file.path,sessionId))setError('当前 DSH 未提供文件打开服务。')}catch(error){showError(error)}}}, {label:staged?'取消暂存更改':'暂存更改',run:()=>stage(group.map(path=>({path,code:''})),staged)}, ...(!staged?[{label:'放弃更改…',run:()=>discard(group)}]:[])]
    }
    return h('div', {key:`${staged}:${file.path}`,role:'option','aria-selected':active,tabIndex:0,className:`vscm-file ${active?'selected':''}`,'data-code':code,style:treeView?{paddingLeft:22+depth*12}:undefined,title:file.from?`${file.from} → ${file.path}`:file.path,
      onClick:(e:MouseEvent)=>{if(e.ctrlKey||e.metaKey)setSelected(s=>active?s.filter(x=>x.path!==file.path||x.staged!==staged):[...s,{path:file.path,staged}]);else void openFile(file.path,staged)},
      onContextMenu:(e:MouseEvent)=>openMenu(e,items()),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter')void openFile(file.path,staged);if(e.key==='Delete'&&!staged){e.preventDefault();discard([file.path])}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const el=e.currentTarget as HTMLElement;((e.key==='ArrowDown'?el.nextElementSibling:el.previousElementSibling) as HTMLElement)?.focus()}}},
      h('span',{className:'file-icon'},icon('file')),h('span',{className:'vscm-name'},name),h('span',{className:'vscm-dir'},treeView?'':dir),
      h('span',{className:'actions'},button('openFile','打开文件',e=>{e.stopPropagation();try{if(!openWorkspaceFile(repoRef.current,file.path,sessionId))setError('当前 DSH 未提供文件打开服务。')}catch(error){showError(error)}},busy||code==='D'),...(!staged?[button('discard','放弃更改',e=>{e.stopPropagation();discard([file.path])})]:[]),button(staged?'minus':'plus',staged?'取消暂存更改':'暂存更改',e=>{e.stopPropagation();stage([file],staged)})),h('span',{className:'vscm-status'},code))
  }
  function viewAll(files:readonly StatusEntry[],staged:boolean,title:string){
    const request:GroupDiffRequest={title,files:files.map(f=>({repo:repoRef.current,file:f.path,from:f.from,staged}))}
    if(!openGroupDiffTab(request))setGroupDiff(request)
  }
  function treeRows(files:readonly StatusEntry[],staged:boolean,conflict:boolean,prefix=''):ReactNode[] {
    const remaining=files.filter(f=>f.path.startsWith(prefix))
    const immediate=remaining.filter(f=>!f.path.slice(prefix.length).includes('/'))
    const folders=[...new Set(remaining.map(f=>f.path.slice(prefix.length)).filter(p=>p.includes('/')).map(p=>p.split('/')[0]!))].sort((a,b)=>a.localeCompare(b))
    return [...folders.flatMap(folder=>{const path=prefix+folder+'/', children=remaining.filter(f=>f.path.startsWith(path)), key='folder:'+staged+':'+path;return [h('div',{key,className:'vscm-file',style:{paddingLeft:22+prefix.split('/').filter(Boolean).length*12},role:'treeitem','aria-expanded':!collapsed[key],tabIndex:0,onKeyDown:(event:KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle(key)}},onClick:()=>toggle(key)},h('span',{className:`arrow ${collapsed[key]?'closed':''}`},icon('chevron')),h('span',{className:'file-icon'},icon('folder')),h('span',{className:'vscm-name'},folder),h('span',{className:'vscm-dir'}),h('span',{className:'actions'},...(!staged&&!conflict?[button('discard','放弃此文件夹的更改',event=>{event.stopPropagation();discard(children.map(f=>f.path))})]:[]),button(staged?'minus':'plus',staged?'取消暂存此文件夹':'暂存此文件夹',event=>{event.stopPropagation();stage(children,staged)})),h('span',{className:'vscm-count'},children.length)),...(!collapsed[key]?treeRows(children,staged,conflict,path):[])]}),...immediate.map(f=>row(f,staged,conflict,prefix.split('/').filter(Boolean).length))]
  }
  function group(title: string, key: string, files: readonly StatusEntry[], staged: boolean, conflict=false) {
    if (!files.length) return null
    return h('div',{key},h('div',{className:'vscm-group'},h('span',{className:`arrow ${collapsed[key]?'closed':''}`,onClick:()=>toggle(key)},icon('chevron')),h('span',{className:'label',onClick:()=>toggle(key)},title),...(!conflict?[button('diffMultiple',staged?'打开暂存的更改':'打开更改',()=>viewAll(files,staged,title)),...(!staged?[button('discard','放弃所有更改',()=>discard([...new Set(files.map(f=>f.path))]))]:[])]:[]),button(staged?'minus':'plus',staged?'取消暂存所有更改':'暂存所有更改',()=>stage(files,staged)),h('span',{className:'vscm-count'},files.length)),...(!collapsed[key]?(()=>{const ordered=[...files].sort((a,b)=>fileSort==='name'?(a.path.split('/').pop()??'').localeCompare(b.path.split('/').pop()??''):fileSort==='status'?a.code.localeCompare(b.code)||a.path.localeCompare(b.path):a.path.localeCompare(b.path));return treeView?treeRows(ordered,staged,conflict):ordered.map(f=>row(f,staged,conflict))})():[]))
  }
  const graph = graphRows(commits)
  function renderCommit(commit:CommitInfo,i:number):ReactNode {
    const g=graph[i]!,colors=['#4ea1ff','#bb87e0','#e2b05c','#6cceac']
    const expanded=expandedCommit===commit.hash
    const detail=commitDetail?.hash===commit.hash?commitDetail:null
    const x=g.lane*12+12
    const row=h('div',{className:`vscm-graphrow ${expanded?'selected':''}`,role:'button',tabIndex:0,'aria-expanded':expanded,
      title:`${commit.subject}\n${commit.author} · ${commit.date} · ${commit.hash}`,
      onClick:()=>void selectCommit(commit),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();void selectCommit(commit)}}},
      h('svg',{width:g.width*12+12,height:24,viewBox:`0 0 ${g.width*12+12} 24`},
        g.incoming?h('path',{d:`M ${x} 0 V 8`,stroke:colors[g.lane%4],strokeWidth:1.4}):null,
        ...g.edges.map((edge,j)=>h('path',{key:j,d:`M ${edge.from*12+12} ${edge.from===g.lane?17:0} C ${edge.from*12+12} 20 ${edge.to*12+12} 16 ${edge.to*12+12} 24`,stroke:colors[edge.from%4],fill:'none',strokeWidth:1.4})),
        h('circle',{cx:x,cy:12,r:i===0?4.5:3,fill:i===0?'none':colors[g.lane%4],stroke:colors[g.lane%4],strokeWidth:1.5})),
      h('span',{className:'vscm-subject'},commit.subject),commit.refs?h('span',{className:'vscm-ref'},commit.refs.replace('HEAD -> ','')):null,h('span',{className:'vscm-date'},commit.date))
    const fileList=expanded?h('div',{className:'vscm-commitfiles','data-commit-files':commit.hash},
      ...g.edges.filter((edge,j,all)=>all.findIndex(other=>other.to===edge.to)===j).map(edge=>h('span',{key:`spine-${edge.to}`,className:'vscm-graph-spine','aria-hidden':true,style:{left:edge.to*12+12,borderColor:colors[edge.from%4]}})),
      commitLoading?h('div',{className:'vscm-note'},'正在读取提交文件…'):null,
      ...(detail?.files??[]).map(file=>h('div',{key:file.path,className:'vscm-file',tabIndex:0,role:'button',style:{paddingLeft:g.width*12+14},title:file.from?`${file.from} → ${file.path}`:file.path,
        onClick:()=>showVersions({repo:repoRef.current,file:file.path,hash:commit.hash,from:file.from}),
        onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter')showVersions({repo:repoRef.current,file:file.path,hash:commit.hash,from:file.from})}},
        h('span',{className:'file-icon'},icon('file')),h('span',{className:'vscm-name'},file.path.split('/').pop()),h('span',{className:'vscm-dir'},file.path.includes('/')?file.path.slice(0,file.path.lastIndexOf('/')):''),h('span',{className:'vscm-status'},file.code))),
      detail&&detail.files.length===0?h('div',{className:'vscm-note'},'此提交没有文件更改。'):null):null
    return h('div',{key:commit.hash,'data-commit':commit.hash},row,fileList)
  }
  function closeDiff() { ++diffEpoch.current;setDiff(null) }
  return h('div',{className:'vscm',ref:root,onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(null);setConfirm(null);setBranches(null);setForm(null);setChoices(null);setOutput(null);closeDiff()}if(e.key==='F5'){e.preventDefault();void refresh(true)}},onClick:()=>{if(menu)setMenu(null)}},
    h('style',null,css),busy?h('div',{className:'vscm-busy'}):null,
    h('div',{className:'vscm-title'},graphOnly?'Git 图表':'源代码管理',graphOnly?null:button('more','显示区域',e=>openMenu(e,([{key:'repos',label:'存储库'},{key:'changes',label:'更改'},{key:'graph',label:'图表'}]).map(item=>({label:(visibleSections[item.key]?'✓  ':'　 ')+item.label,run:()=>{setVisibleSections(v=>({...v,[item.key]:!v[item.key]}));setMenu(null)}}))))),
    error?h('div',{className:'vscm-error',role:'alert'},error,button('close','关闭错误',()=>setError(''))):null,
    visibleSections.repos?h('div',{className:'vscm-repos'},h('div',{className:'vscm-section'},h('span',{className:`arrow ${collapsed.repos?'closed':''}`,onClick:()=>toggle('repos')},icon('chevron')),h('span',{onClick:()=>toggle('repos')},'存储库'),button('more','存储库排序',e=>openMenu(e,([{label:'按发现时间排序',value:'discovery'},{label:'按路径排序',value:'path'},{label:'按名称排序',value:'name'}] as const).map(option=>({label:(repoSort===option.value?'✓  ':'　 ')+option.label,run:()=>{setRepoSort(option.value);setMenu(null)}}))))),
      ...(!collapsed.repos?[...(context?.repos ?? [])].sort((a,b)=>repoSort==='discovery'?0:repoSort==='path'?a.path.localeCompare(b.path):a.name.localeCompare(b.name)).map(repo=>h('div',{key:repo.path,className:`vscm-repo ${repoRef.current===repo.path?'active':''}`,title:repo.path,onClick:()=>{if(mutation.current)return;++epoch.current;repoRef.current=repo.path;setMenu(null);setConfirm(null);setForm(null);setChoices(null);setBranches(null);setOutput(null);setStatus(null);setCommitDetail(null);setExpandedCommit(null);++commitEpoch.current;setDiff(null);setCommits([]);restorePane();setSelected([]);inFlight.current=false;void refresh(true)}},icon('folder'),h('span',{className:'vscm-repo-name'},repo.name.split(/[\\/]/).pop()),h('button',{className:'vscm-branch',disabled:busy||repoRef.current!==repo.path,onClick:(e:MouseEvent)=>{e.stopPropagation();setFilter('');void api<{branches:BranchInfo[]}>('branches',{repo:repo.path}).then(v=>setBranches(v.branches)).catch(showError)}},icon('branch'),repoRef.current===repo.path?status?.branch:repo.branch),button('sync','同步更改',e=>{e.stopPropagation();void run('sync')},busy||repoRef.current!==repo.path||!status?.upstream),button('more','存储库操作',e=>{e.stopPropagation();if(repoRef.current===repo.path)openMenu(e,remoteItems())},busy||repoRef.current!==repo.path))):[])):null,
    visibleSections.changes?h('div',{className:'vscm-changes'},h('div',{className:'vscm-section'},h('span',{className:`arrow ${collapsed.changes?'closed':''}`,onClick:()=>toggle('changes')},icon('chevron')),h('span',{onClick:()=>toggle('changes')},'更改'),button('check','提交',()=>commit()),button('refresh','刷新',()=>void refresh(true)),button('graph','查看 Git 图表',()=>{if(!openGraphTab())setError('当前 DSH 无法打开 Git 图表。')}),button('more','更多操作',e=>openMenu(e,[{label:treeView?'以列表形式查看':'以树形形式查看',run:()=>{setTreeView(v=>!v);setMenu(null)}},menuItem('查看和排序',[{label:(fileSort==='path'?'✓  ':'　 ')+'按路径排序',run:()=>{setFileSort('path');setMenu(null)}},{label:(fileSort==='name'?'✓  ':'　 ')+'按名称排序',run:()=>{setFileSort('name');setMenu(null)}},{label:(fileSort==='status'?'✓  ':'　 ')+'按状态排序',run:()=>{setFileSort('status');setMenu(null)}}]),{label:'',separator:true},...remoteItems()]))),
      !collapsed.changes?h('div',{className:'vscm-compose'},h('textarea',{className:'vscm-input',rows:1,'aria-label':'提交消息',placeholder:`消息(Ctrl+Enter 在“${status?.branch??''}”提交)`,value:message,onChange:(e:{target:{value:string}})=>saveMessage(e.target.value),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commit()}}}),h('div',{className:'vscm-commitrow'},h('button',{type:'button',className:'vscm-commit',disabled:busy||!message.trim()||!status||status.conflicts.length>0,onClick:()=>commit()},icon('check'),'提交'),h('button',{className:'vscm-drop',title:'提交操作',onClick:(e:MouseEvent)=>openMenu(e,[{label:'提交',run:()=>commit()},{label:'提交(修改)',run:startAmend},{label:'提交和推送',run:()=>commit('push')},{label:'提交和同步',run:()=>commit('sync')}])},'⌄'))):null,
      !collapsed.changes?h('div',{className:'vscm-list',role:'listbox','aria-multiselectable':true,'aria-label':'更改的文件'},group('合并更改','conflicts',status?.conflicts??[],false,true),group('暂存的更改','staged',status?.staged??[],true),group('更改','unstaged',changes,false),status&&changes.length===0&&status.staged.length===0&&status.conflicts.length===0?h('div',{className:'vscm-note'},'没有更改。'):null,!context?h('div',{className:'vscm-note'},loaded?'未能读取工作区，请查看上方错误。':'正在读取工作区…'):context.repos.length===0?h('div',{className:'vscm-note'},'请在当前 DSH 会话中打开一个 Git 项目。'):null):null):null,
    visibleSections.graph&&visibleSections.changes?h('div',{className:'vscm-resizer',role:'separator','aria-label':'调整图表高度',onPointerDown:(e:PointerEvent)=>{e.preventDefault();const start=e.clientY,initial=graphHeight;const move=(ev:PointerEvent)=>setGraphHeight(Math.max(80,Math.min((root.current?.clientHeight??600)-160,initial+start-ev.clientY)));const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)}}):null,
    visibleSections.graph?h('div',{className:'vscm-history',style:{height:graphOnly?'auto':collapsed.graph?26:graphHeight,flex:graphOnly?1:undefined}},h('div',{className:'vscm-section'},h('span',{className:`arrow ${collapsed.graph?'closed':''}`,onClick:()=>toggle('graph')},icon('chevron')),h('span',{onClick:()=>toggle('graph')},'图表'),graphOnly?h('select',{'aria-label':'图表分支',value:graphBranch,onChange:(e:{target:{value:string}})=>{const branch=e.target.value,token=epoch.current,repo=repoRef.current;graphBranchRef.current=branch;setGraphBranch(branch);void api<{commits:CommitInfo[]}>('log',{limit,branch:branch||undefined}).then(v=>{if(token===epoch.current&&repo===repoRef.current&&branch===graphBranchRef.current)setCommits(v.commits)}).catch(showError)},style:{maxWidth:160,background:'transparent',color:'inherit'}},h('option',{value:''},'所有分支'),...graphBranches.filter(b=>!b.remote).map(b=>h('option',{key:b.name,value:b.name},b.name))):null,h('span',{title:status?.upstream??'尚未设置上游',style:{fontSize:11,color:'#a9bbdf'}},`${status?.behind??0}↓ ${status?.ahead??0}↑`),button('down','拉取',()=>void run('pull')),button('up',status?.upstream?'推送':'发布分支',()=>remoteItems()[1]!.run?.()),button('refresh','刷新图表',()=>void refresh(true)),button('more','图表操作',e=>openMenu(e,[{label:'加载更多提交',run:()=>{setMenu(null);setLimit(n=>Math.min(200,n+60));void api<{commits:CommitInfo[]}>('log',{limit:Math.min(200,limit+60),branch:graphOnly?(graphBranch||undefined):undefined}).then(v=>setCommits(v.commits)).catch(showError)}},...remoteItems()]))),
      !collapsed.graph?h('div',{className:'vscm-graphrows'},...(graphOnly&&((status?.staged.length??0)+changes.length)>0?[h('div',{key:'uncommitted',className:'vscm-graphrow',role:'button',tabIndex:0,onClick:()=>{const request:GroupDiffRequest={title:'未提交的更改',files:[...(status?.staged??[]).map(f=>({repo:repoRef.current,file:f.path,from:f.from,staged:true})),...changes.map(f=>({repo:repoRef.current,file:f.path,from:f.from,staged:false}))]};if(!openGroupDiffTab(request))setGroupDiff(request)}},h('span',{style:{width:24,textAlign:'center',color:'#4ea1ff'}},'●'),h('span',{className:'vscm-subject'},'未提交的更改'),h('span',{className:'vscm-count'},(status?.staged.length??0)+changes.length))]:[]),...commits.map(renderCommit),commits.length===0?h('div',{className:'vscm-note'},'暂无提交。'):null):null):null,
    groupDiff?h('div',{className:'vscm-overlay'},h(MultiDiff,{sessionId,request:groupDiff,onClose:()=>setGroupDiff(null)})):null,
    versionDiff?h('div',{className:'vscm-overlay'},h(VersionDiff,{sessionId,request:versionDiff,onClose:()=>setVersionDiff(null)})):null,
    diff?h('div',{className:'vscm-overlay'},h('div',{className:'vscm-difftop'},button('close','返回源代码管理',closeDiff),h('span',{className:'name'},diff.title),diff.selection?button(diff.selection.staged?'minus':'plus',diff.selection.staged?'取消暂存更改':'暂存更改',()=>stage([{path:diff.selection!.path,code:''}],diff.selection!.staged)):null),h('div',{className:'vscm-diff'},...diff.text.slice(0,512*1024).split('\n').slice(0,6000).map((line,i)=>h('span',{key:i,className:`vscm-line ${line.startsWith('@@')?'hunk':line.startsWith('+')?'add':line.startsWith('-')?'del':''}`},line||' ')))):null,
    menu?h('div',{className:'vscm-menu',role:'menu',style:{left:menu.x,top:menu.y},onClick:(e:MouseEvent)=>e.stopPropagation()},...menu.items.map((item,i)=>item.separator?h('div',{key:i,role:'separator',style:{borderTop:'1px solid var(--border)',margin:'4px 0'}}):h('button',{key:i,role:'menuitem','aria-haspopup':item.children?'menu':undefined,'aria-expanded':item.children?submenu?.label===item.label:undefined,disabled:item.disabled||busy,onMouseEnter:(e:MouseEvent)=>{if(item.children)showSubmenu(item,e.currentTarget as HTMLElement);else setSubmenu(null)},onFocus:(e:FocusEvent)=>{if(item.children)showSubmenu(item,e.currentTarget as HTMLElement)},onClick:(e:MouseEvent)=>{if(item.children){if(!showSubmenu(item,e.currentTarget as HTMLElement))setMenu({...menu,items:[{label:'‹ 返回',run:()=>setMenu({...menu,items:menu.items})},...item.children]})}else item.run?.()}},item.label,item.children?h('span',{style:{float:'right'}},'›'):null))):null,
    menu&&submenu?h('div',{className:'vscm-menu',role:'menu','aria-label':submenu.label,style:{left:submenu.x,top:submenu.y,zIndex:61},onClick:(e:MouseEvent)=>e.stopPropagation()},...submenu.items.map((item,i)=>h('button',{key:i,role:'menuitem',disabled:item.disabled||busy,onClick:()=>{setSubmenu(null);item.run?.()}},item.label))):null,
    confirm?h('div',{className:'vscm-modalshade'},h('div',{className:'vscm-modal',role:'alertdialog','aria-modal':true,'aria-label':'确认 Git 操作'},h('strong',null,'源代码管理'),h('p',null,confirm.text),h('footer',null,h('button',{onClick:()=>setConfirm(null)},'取消'),h('button',{onClick:confirm.run},'确定')))):null,
    form?h('div',{className:'vscm-modalshade'},h('div',{className:'vscm-modal',role:'dialog','aria-label':form.title},h('strong',null,form.title),...form.labels.map((label,i)=>h('label',{key:i,style:{display:'block',marginTop:8}},label,h(label==='提交消息'?'textarea':'input',{className:'vscm-input',value:form.values[i],onChange:(e:{target:{value:string}})=>setForm(old=>old?{...old,values:old.values.map((v,j)=>j===i?e.target.value:v)}:null)}))),h('footer',null,h('button',{onClick:()=>setForm(null)},'取消'),h('button',{disabled:form.values.some(v=>!v.trim()),onClick:()=>{const f=form;setForm(null);f.submit(f.values)}},'确定')))):null,
    choices?h('div',{className:'vscm-modalshade'},h('div',{className:'vscm-modal',role:'dialog','aria-label':choices.title},h('strong',null,choices.title),h('div',{className:'vscm-picker'},...(choices.items.length?choices.items.map((item,i)=>h('button',{key:i,disabled:item.disabled,onClick:item.run},item.label)):[h('p',{key:'empty'},'没有可选项目。')])),h('footer',null,h('button',{onClick:()=>setChoices(null)},'关闭')))):null,
    output!==null?h('div',{className:'vscm-modalshade'},h('div',{className:'vscm-modal',role:'dialog','aria-label':'GIT 输出'},h('strong',null,'GIT 输出'),h('pre',{style:{whiteSpace:'pre-wrap',overflow:'auto',maxHeight:350}},output),h('footer',null,h('button',{onClick:()=>setOutput(null)},'关闭')))):null,
    branches?h('div',{className:'vscm-modalshade'},h('div',{className:'vscm-modal',role:'dialog','aria-label':'选择分支'},h('div',{style:{display:'flex',justifyContent:'space-between'}},h('strong',null,branches.length?'选择要签出的分支':'创建分支'),button('close','关闭',()=>{setBranches(null);setFilter('')})),h('input',{className:'vscm-input',autoFocus:true,placeholder:branches.length?'搜索分支…':'新分支名称',value:filter,onChange:(e:{target:{value:string}})=>setFilter(e.target.value),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter'&&!branches.length&&filter.trim()){void run('branch-create',{name:filter.trim()},()=>{setBranches(null);setFilter('')})}}}),branches.length?h('div',{className:'vscm-picker'},...branches.filter(b=>b.name.toLowerCase().includes(filter.toLowerCase())).map(b=>h('button',{key:b.name,disabled:busy,onClick:()=>{setBranches(null);setFilter('');if(branchAction==='merge')void run('merge',{branch:b.name});else if(branchAction==='delete')confirmRun(`删除分支 ${b.name}？`,()=>void run('branch-delete',{name:b.name,confirm:true}));else void run('switch',{branch:b.name,track:b.remote})}},`${b.current?'✓ ':''}${b.name}   ${b.shortHash}`))):h('footer',null,h('button',{disabled:busy||!filter.trim(),onClick:()=>void run('branch-create',{name:filter.trim()},()=>{setBranches(null);setFilter('')})},'创建分支')))):null)
}

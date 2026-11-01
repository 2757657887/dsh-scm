import {openWorkspaceFile} from './navigation.js'
import {MultiDiff,openGroupDiffTab,type GroupDiffRequest} from './multiDiff.js'
import {scmGlyphs} from './scmIcons.js'
import {VersionDiff,openDiffTab,type DiffRequest} from './diffEditor.js'
import { createElement as h, useState, useEffect, useRef, type ReactNode } from 'react'
import { call, type ContextValue, type RepoStatus, type StatusEntry, type CommitInfo, type BranchInfo, type CallFields } from './api.js'
import { graphRows } from './graph.js'
export interface ScmPanelProps { readonly sessionId: string }
type CommitDetail={hash:string;subject:string;files:{path:string;from?:string;code:string}[]}
const paneMemory=new Map<string,{message:string;detail:CommitDetail|null;height:number}>()
type MenuItem = { label: string; run: () => void; disabled?: boolean }
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
.vscm-overlay{position:absolute;inset:0;z-index:30;background:var(--bg);display:flex;flex-direction:column}.vscm-difftop{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px}.vscm-difftop .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vscm-diff{overflow:auto;flex:1;min-height:0;font:12px/20px Consolas,monospace;white-space:pre;tab-size:4;padding-bottom:24px}.vscm-line{display:block;min-width:max-content;padding:0 10px}.vscm-line.add{background:#1e3a2a;color:#b4debc}.vscm-line.del{background:#462b30;color:#f0b6bd}.vscm-line.hunk{background:#24374c;color:#9cdcfe}.vscm-menu{position:absolute;z-index:60;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid #4b4b59;box-shadow:0 4px 16px #0008;padding:4px;border-radius:4px;min-width:180px;max-width:calc(100% - 12px)}.vscm-menu button{display:block;text-align:left;width:100%;border:0;background:none;padding:5px 14px;font-size:12px}.vscm-menu button:hover{background:var(--hover)}.vscm-modalshade{position:absolute;inset:0;background:#0006;z-index:70;display:flex;align-items:flex-start;justify-content:center;padding:35px 10px}.vscm-modal{padding:12px;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid #555563;box-shadow:0 5px 20px #0008;width:100%;max-width:420px}.vscm-modal p{font-size:12px;white-space:pre-wrap;word-break:break-word}.vscm-modal footer{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.vscm-modal footer button{background:var(--blue);border:0;padding:4px 12px}.vscm-picker{max-height:250px;overflow:auto;margin-top:6px}.vscm-picker button{display:block;width:100%;border:0;background:none;text-align:left;padding:5px 8px}.vscm-picker button:hover{background:var(--sel)}
`
export function ScmPanel({ sessionId }: ScmPanelProps): ReactNode {
  const root = useRef<HTMLElement | null>(null)
  const repoRef = useRef(''), epoch = useRef(0), inFlight = useRef(false), mutation = useRef(false), diffEpoch = useRef(0)
  const [loaded, setLoaded] = useState(false)
  const [context, setContext] = useState<ContextValue | null>(null), [status, setStatus] = useState<RepoStatus | null>(null)
  const [commits, setCommits] = useState<CommitInfo[]>([]), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [message, setMessage] = useState(''), [collapsed, setCollapsed] = useState<Record<string, boolean>>({}), [selected, setSelected] = useState<Selection[]>([])
  const [graphHeight, setGraphHeight] = useState(175), [limit, setLimit] = useState(60)
  const [groupDiff,setGroupDiff]=useState<GroupDiffRequest|null>(null)
  const [versionDiff,setVersionDiff]=useState<DiffRequest|null>(null)
  const [commitDetail,setCommitDetail]=useState<CommitDetail|null>(null)
  const [expandedCommit,setExpandedCommit]=useState<string|null>(null)
  const [commitLoading,setCommitLoading]=useState(false)
  const commitEpoch=useRef(0)
  const [diff, setDiff] = useState<{ title: string; text: string; selection?: Selection } | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; items: MenuItem[] } | null>(null)
  const [confirm, setConfirm] = useState<{ text: string; run: () => void } | null>(null)
  const [branches, setBranches] = useState<BranchInfo[] | null>(null), [filter, setFilter] = useState('')
  const memoryKey=()=>sessionId+'|'+repoRef.current
  function saveMessage(value:string){setMessage(value);const old=paneMemory.get(memoryKey());paneMemory.set(memoryKey(),{message:value,detail:old?.detail??commitDetail,height:old?.height??graphHeight})}
  function restorePane(){const saved=paneMemory.get(memoryKey());setMessage(saved?.message??'');setCommitDetail(saved?.detail??null);setExpandedCommit(saved?.detail?.hash??null);setGraphHeight(saved?.height??175)}
  const api = <T,>(op: string, fields: CallFields = {}) => call<T>(op, sessionId, { repo: repoRef.current || undefined, ...fields })
  const showError = (e: unknown) => setError(e instanceof Error ? e.message + ('detail' in e ? '\n' + String(e.detail) : '') : String(e))
  async function refresh(history = false) {
    if (inFlight.current || mutation.current) return
    inFlight.current = true
    const token = epoch.current, repo = repoRef.current
    try {
      const value = await api<{status: RepoStatus}>('status')
      if (epoch.current !== token || repo !== repoRef.current) return
      setStatus(value.status)
      if (history) { const log = await api<{commits: CommitInfo[]}>('log', { limit }); if (epoch.current === token && repo === repoRef.current) setCommits(log.commits) }
    } catch (e) { if (epoch.current === token) showError(e) } finally { inFlight.current = false }
  }
  useEffect(() => {
    const token = ++epoch.current; repoRef.current = ''; setLoaded(false); setContext(null);setCommitDetail(null);setExpandedCommit(null);++commitEpoch.current; setStatus(null); setCommits([]); setDiff(null); setError(''); setMessage(''); setSelected([])
    void api<ContextValue>('context').then(async c => { if (epoch.current !== token) return; setContext(c); setLoaded(true); repoRef.current = c.isRepo ? (c.repos.find(r=>r.path.replaceAll('\\','/').toLowerCase()===c.repo.replaceAll('\\','/').toLowerCase())?.path ?? c.repo) : c.repos[0]?.path ?? ''; restorePane(); if (repoRef.current) await refresh(true) }).catch(e => { if (epoch.current === token) { setLoaded(true); showError(e) } })
    const timer = setInterval(() => { if (document.visibilityState === 'visible' && root.current?.getBoundingClientRect().width && repoRef.current) void refresh() }, 5000)
    return () => { ++epoch.current; ++diffEpoch.current; clearInterval(timer) }
  }, [sessionId])
  async function run(op: string, fields: CallFields = {}, after?: () => void) {
    if (mutation.current) return
    mutation.current = true; setBusy(true); setError(''); setMenu(null)
    const token = epoch.current
    try { await api(op, fields); if (epoch.current === token) after?.() } catch (e) { if (epoch.current === token) showError(e) }
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
    setMenu({ x: Math.max(4, Math.min(event.clientX-box.left,box.width-210)), y: Math.max(4,Math.min(event.clientY-box.top,box.height-items.length*30-12)), items })
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
  function commit() {
    if (!message.trim() || busy) { if (!message.trim()) root.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus(); return }
    if (!status?.staged.length) {
      if (changes.length) setConfirm({ text:'没有暂存的更改。是否暂存所有更改并提交？', run: () => { setConfirm(null); void run('commit', {message, files:changes.flatMap(f=>f.from?[f.from,f.path]:[f.path]), confirm:true},()=>saveMessage('')) } })
      return
    }
    void run('commit', {message}, () => saveMessage(''))
  }
  function remoteItems(): MenuItem[] { return [
    {label:'拉取', run:()=>void run('pull')}, {label:status?.upstream?'推送':'发布分支…', run:()=>{if(status?.upstream)void run('push',{confirm:true});else setConfirm({text:`发布分支 ${status?.branch} 到 ${context?.remotes[0]??'origin'}？`,run:()=>{setConfirm(null);void run('push',{confirm:true,setUpstream:true,branch:status?.branch,remote:context?.remotes[0]??'origin'})}})}}, {label:'提取', run:()=>void run('fetch')},
    {label:'切换分支…', run:()=>{setMenu(null); void api<{branches: BranchInfo[]}>('branches').then(v=>setBranches(v.branches)).catch(showError)}},
    {label:'创建分支…', run:()=>{setMenu(null); setBranches([]); setFilter('')}},
    {label:'刷新',run:()=>{setMenu(null);void refresh(true)}} ] }
  function row(file: StatusEntry, staged: boolean, conflict = false) {
    const name = file.path.split('/').pop()!, dir = file.path.slice(0, Math.max(0,file.path.length-name.length-1)), code = conflict ? '!' : file.code==='??'?'U':(staged?file.code[0]:file.code[1]) || 'M'
    const active = selected.some(s=>s.path===file.path&&s.staged===staged)
    const items = (): MenuItem[] => {
      const group = active ? selected.filter(s=>s.staged===staged).map(s=>s.path) : [file.path]
      return [{label:'打开更改',run:()=>{setMenu(null);void openFile(file.path,staged)}},{label:'打开文件',disabled:code==='D',run:()=>{setMenu(null);try{if(!openWorkspaceFile(repoRef.current,file.path,sessionId))setError('当前 DSH 未提供文件打开服务。')}catch(error){showError(error)}}}, {label:staged?'取消暂存更改':'暂存更改',run:()=>stage(group.map(path=>({path,code:''})),staged)}, ...(!staged?[{label:'放弃更改…',run:()=>discard(group)}]:[])]
    }
    return h('div', {key:`${staged}:${file.path}`,role:'option','aria-selected':active,tabIndex:0,className:`vscm-file ${active?'selected':''}`,'data-code':code,title:file.from?`${file.from} → ${file.path}`:file.path,
      onClick:(e:MouseEvent)=>{if(e.ctrlKey||e.metaKey)setSelected(s=>active?s.filter(x=>x.path!==file.path||x.staged!==staged):[...s,{path:file.path,staged}]);else void openFile(file.path,staged)},
      onContextMenu:(e:MouseEvent)=>openMenu(e,items()),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter')void openFile(file.path,staged);if(e.key==='Delete'&&!staged){e.preventDefault();discard([file.path])}if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const el=e.currentTarget as HTMLElement;((e.key==='ArrowDown'?el.nextElementSibling:el.previousElementSibling) as HTMLElement)?.focus()}}},
      h('span',{className:'file-icon'},icon('file')),h('span',{className:'vscm-name'},name),h('span',{className:'vscm-dir'},dir),
      h('span',{className:'actions'},button('openFile','打开文件',e=>{e.stopPropagation();try{if(!openWorkspaceFile(repoRef.current,file.path,sessionId))setError('当前 DSH 未提供文件打开服务。')}catch(error){showError(error)}},busy||code==='D'),...(!staged?[button('discard','放弃更改',e=>{e.stopPropagation();discard([file.path])})]:[]),button(staged?'minus':'plus',staged?'取消暂存更改':'暂存更改',e=>{e.stopPropagation();stage([file],staged)})),h('span',{className:'vscm-status'},code))
  }
  function viewAll(files:readonly StatusEntry[],staged:boolean,title:string){
    const request:GroupDiffRequest={title,files:files.map(f=>({repo:repoRef.current,file:f.path,from:f.from,staged}))}
    if(!openGroupDiffTab(request))setGroupDiff(request)
  }
  function group(title: string, key: string, files: readonly StatusEntry[], staged: boolean, conflict=false) {
    if (!files.length) return null
    return h('div',{key},h('div',{className:'vscm-group'},h('span',{className:`arrow ${collapsed[key]?'closed':''}`,onClick:()=>toggle(key)},icon('chevron')),h('span',{className:'label',onClick:()=>toggle(key)},title),...(!conflict?[button('diffMultiple',staged?'打开暂存的更改':'打开更改',()=>viewAll(files,staged,title)),...(!staged?[button('discard','放弃所有更改',()=>discard([...new Set(files.map(f=>f.path))]))]:[])]:[]),button(staged?'minus':'plus',staged?'取消暂存所有更改':'暂存所有更改',()=>stage(files,staged)),h('span',{className:'vscm-count'},files.length)),...(!collapsed[key]?files.map(f=>row(f,staged,conflict)):[]))
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
  return h('div',{className:'vscm',ref:root,onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Escape'){setMenu(null);setConfirm(null);setBranches(null);closeDiff()}if(e.key==='F5'){e.preventDefault();void refresh(true)}},onClick:()=>{if(menu)setMenu(null)}},
    h('style',null,css),busy?h('div',{className:'vscm-busy'}):null,
    h('div',{className:'vscm-title'},'源代码管理',button('more','更多操作',e=>openMenu(e,remoteItems()))),
    error?h('div',{className:'vscm-error',role:'alert'},error,button('close','关闭错误',()=>setError(''))):null,
    h('div',{className:'vscm-repos'},h('div',{className:'vscm-section'},h('span',{className:`arrow ${collapsed.repos?'closed':''}`,onClick:()=>toggle('repos')},icon('chevron')),h('span',{onClick:()=>toggle('repos')},'存储库')),
      ...(!collapsed.repos?(context?.repos ?? []).map(repo=>h('div',{key:repo.path,className:`vscm-repo ${repoRef.current===repo.path?'active':''}`,title:repo.path,onClick:()=>{if(mutation.current)return;++epoch.current;repoRef.current=repo.path;setStatus(null);setCommitDetail(null);setExpandedCommit(null);++commitEpoch.current;setDiff(null);setCommits([]);restorePane();setSelected([]);inFlight.current=false;void refresh(true)}},icon('folder'),h('span',{className:'vscm-repo-name'},repo.name.split(/[\\/]/).pop()),h('button',{className:'vscm-branch',disabled:busy||repoRef.current!==repo.path,onClick:(e:MouseEvent)=>{e.stopPropagation();setFilter('');void api<{branches:BranchInfo[]}>('branches',{repo:repo.path}).then(v=>setBranches(v.branches)).catch(showError)}},icon('branch'),repoRef.current===repo.path?status?.branch:repo.branch),button('refresh','刷新',e=>{e.stopPropagation();void refresh(true)}))):[])),
    h('div',{className:'vscm-changes'},h('div',{className:'vscm-section'},h('span',{className:`arrow ${collapsed.changes?'closed':''}`,onClick:()=>toggle('changes')},icon('chevron')),h('span',{onClick:()=>toggle('changes')},'更改'),button('check','提交',()=>commit()),button('refresh','刷新',()=>void refresh(true)),button('more','更多操作',e=>openMenu(e,remoteItems()))),
      !collapsed.changes?h('div',{className:'vscm-compose'},h('textarea',{className:'vscm-input',rows:1,'aria-label':'提交消息',placeholder:`消息(Ctrl+Enter 在“${status?.branch??''}”提交)`,value:message,onChange:(e:{target:{value:string}})=>saveMessage(e.target.value),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)){e.preventDefault();commit()}}}),h('div',{className:'vscm-commitrow'},h('button',{type:'button',className:'vscm-commit',disabled:busy||!message.trim()||!status||status.conflicts.length>0,onClick:commit},icon('check'),'提交'),h('button',{className:'vscm-drop',title:'提交操作',onClick:(e:MouseEvent)=>openMenu(e,[{label:'提交暂存的更改',run:()=>commit(),disabled:!status?.staged.length||!message.trim()}])},'⌄'))):null,
      !collapsed.changes?h('div',{className:'vscm-list',role:'listbox','aria-multiselectable':true,'aria-label':'更改的文件'},group('合并更改','conflicts',status?.conflicts??[],false,true),group('暂存的更改','staged',status?.staged??[],true),group('更改','unstaged',changes,false),status&&changes.length===0&&status.staged.length===0&&status.conflicts.length===0?h('div',{className:'vscm-note'},'没有更改。'):null,!context?h('div',{className:'vscm-note'},loaded?'未能读取工作区，请查看上方错误。':'正在读取工作区…'):context.repos.length===0?h('div',{className:'vscm-note'},'请在当前 DSH 会话中打开一个 Git 项目。'):null):null),
    h('div',{className:'vscm-resizer',role:'separator','aria-label':'调整图表高度',onPointerDown:(e:PointerEvent)=>{e.preventDefault();const start=e.clientY,initial=graphHeight;const move=(ev:PointerEvent)=>setGraphHeight(Math.max(80,Math.min((root.current?.clientHeight??600)-160,initial+start-ev.clientY)));const end=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',end)};window.addEventListener('pointermove',move);window.addEventListener('pointerup',end)}}),
    h('div',{className:'vscm-history',style:{height:collapsed.graph?26:graphHeight}},h('div',{className:'vscm-section'},h('span',{className:`arrow ${collapsed.graph?'closed':''}`,onClick:()=>toggle('graph')},icon('chevron')),h('span',{onClick:()=>toggle('graph')},'图表'),h('span',{title:status?.upstream??'尚未设置上游',style:{fontSize:11,color:'#a9bbdf'}},`${status?.behind??0}↓ ${status?.ahead??0}↑`),button('down','拉取',()=>void run('pull')),button('up',status?.upstream?'推送':'发布分支',()=>remoteItems()[1]!.run()),button('refresh','刷新图表',()=>void refresh(true)),button('more','图表操作',e=>openMenu(e,[{label:'加载更多提交',run:()=>{setMenu(null);setLimit(n=>Math.min(200,n+60));void api<{commits:CommitInfo[]}>('log',{limit:Math.min(200,limit+60)}).then(v=>setCommits(v.commits)).catch(showError)}},...remoteItems()]))),
      !collapsed.graph?h('div',{className:'vscm-graphrows'},...commits.map(renderCommit),commits.length===0?h('div',{className:'vscm-note'},'暂无提交。'):null):null),
    groupDiff?h('div',{className:'vscm-overlay'},h(MultiDiff,{sessionId,request:groupDiff,onClose:()=>setGroupDiff(null)})):null,
    versionDiff?h('div',{className:'vscm-overlay'},h(VersionDiff,{sessionId,request:versionDiff,onClose:()=>setVersionDiff(null)})):null,
    diff?h('div',{className:'vscm-overlay'},h('div',{className:'vscm-difftop'},button('close','返回源代码管理',closeDiff),h('span',{className:'name'},diff.title),diff.selection?button(diff.selection.staged?'minus':'plus',diff.selection.staged?'取消暂存更改':'暂存更改',()=>stage([{path:diff.selection!.path,code:''}],diff.selection!.staged)):null),h('div',{className:'vscm-diff'},...diff.text.slice(0,512*1024).split('\n').slice(0,6000).map((line,i)=>h('span',{key:i,className:`vscm-line ${line.startsWith('@@')?'hunk':line.startsWith('+')?'add':line.startsWith('-')?'del':''}`},line||' ')))):null,
    menu?h('div',{className:'vscm-menu',role:'menu',style:{left:menu.x,top:menu.y},onClick:(e:MouseEvent)=>e.stopPropagation()},...menu.items.map((item,i)=>h('button',{key:i,role:'menuitem',disabled:item.disabled||busy,onClick:item.run},item.label))):null,
    confirm?h('div',{className:'vscm-modalshade'},h('div',{className:'vscm-modal',role:'alertdialog','aria-modal':true,'aria-label':'确认 Git 操作'},h('strong',null,'源代码管理'),h('p',null,confirm.text),h('footer',null,h('button',{onClick:()=>setConfirm(null)},'取消'),h('button',{onClick:confirm.run},'确定')))):null,
    branches?h('div',{className:'vscm-modalshade'},h('div',{className:'vscm-modal',role:'dialog','aria-label':'选择分支'},h('div',{style:{display:'flex',justifyContent:'space-between'}},h('strong',null,branches.length?'选择要签出的分支':'创建分支'),button('close','关闭',()=>{setBranches(null);setFilter('')})),h('input',{className:'vscm-input',autoFocus:true,placeholder:branches.length?'搜索分支…':'新分支名称',value:filter,onChange:(e:{target:{value:string}})=>setFilter(e.target.value),onKeyDown:(e:KeyboardEvent)=>{if(e.key==='Enter'&&!branches.length&&filter.trim()){void run('branch-create',{name:filter.trim()},()=>{setBranches(null);setFilter('')})}}}),branches.length?h('div',{className:'vscm-picker'},...branches.filter(b=>b.name.toLowerCase().includes(filter.toLowerCase())).map(b=>h('button',{key:b.name,disabled:busy,onClick:()=>void run('switch',{branch:b.name,track:b.remote},()=>{setBranches(null);setFilter('')})},`${b.current?'✓ ':''}${b.name}   ${b.shortHash}`))):h('footer',null,h('button',{disabled:busy||!filter.trim(),onClick:()=>void run('branch-create',{name:filter.trim()},()=>{setBranches(null);setFilter('')})},'创建分支')))):null)
}

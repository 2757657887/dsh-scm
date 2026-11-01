/** DSH native file resources; opening a file must not open a Git diff. */
export function workspaceFileAddress(repo:string,file:string,sessionId:string):string {
 if(!repo||!file||file.startsWith('/')||file.startsWith('\\')||/^[A-Za-z]:/.test(file)||file.split('/').some(part=>part==='..'||part===''))throw new Error('无效的工作区文件路径。')
 const path=repo.replaceAll('\\','/').replace(/\/+$/,'')+'/'+file
 if(!path.startsWith('/')&&!/^[A-Za-z]:\//.test(path))throw new Error('工作区需要绝对路径。')
 if(!sessionId)throw new Error('缺少当前会话。')
 return 'dsh-resource://file/session/'+encodeURIComponent(sessionId)+'/'+path.split('/').map(part=>/^[A-Za-z]:$/.test(part)?part:encodeURIComponent(part)).join('/')
}
let opener:((address:string)=>void)|undefined
export function bindFileOpener(fn:(address:string)=>void):()=>void{opener=fn;return()=>{if(opener===fn)opener=undefined}}
export function openWorkspaceFile(repo:string,file:string,sessionId:string):boolean {if(!opener)return false;opener(workspaceFileAddress(repo,file,sessionId));return true}

let graphOpener:(()=>void)|undefined
export function bindGraphOpener(fn:()=>void):()=>void{graphOpener=fn;return()=>{if(graphOpener===fn)graphOpener=undefined}}
export function openGraphTab():boolean{if(!graphOpener)return false;graphOpener();return true}

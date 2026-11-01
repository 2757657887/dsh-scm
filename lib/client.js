window.__ModuleLoader__.load({
	id: "dsh-scm",
	factory: (require) => {
		var __factories = [];
		var __cache = {};
		function __require(id) {
			if (__cache[id] === undefined) __cache[id] = __factories[id]();
			return __cache[id];
		}
__factories[0] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
/**
 * Typed client for the host's `/dsh-scm/*` route.
 *
 * Every call carries the session id and nothing else that could name a path:
 * the host resolves the workspace from the session, so the panel cannot reach
 * outside the directory it is drawn in even if it wanted to.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScmError = void 0;
exports.call = call;
/** An operation failure, carrying git's own words when there are any. */
class ScmError extends Error {
    code;
    detail;
    constructor(code, message, detail = '') {
        super(message);
        this.name = 'ScmError';
        this.code = code;
        this.detail = detail;
    }
}
exports.ScmError = ScmError;
/**
 * Call one operation.
 * @param operation - route suffix, e.g. `status`.
 * @param sessionId - the session the panel is drawn in.
 * @param fields - operation parameters.
 * @returns the operation's value.
 * @throws ScmError when the host refuses or git fails.
 */
async function call(operation, sessionId, fields = {}) {
    const response = await fetch(`/dsh-scm/${operation}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, ...fields }),
    });
    let envelope;
    try {
        envelope = (await response.json());
    }
    catch {
        throw new ScmError('bad-response', `the host answered ${response.status} without JSON`);
    }
    if (envelope.ok !== true || envelope.value === undefined) {
        const error = envelope.error ?? { code: 'unknown', message: 'the operation failed' };
        throw new ScmError(error.code, error.message, error.detail ?? '');
    }
    return envelope.value;
}

return module.exports;
};
__factories[1] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.languageFor = languageFor;
exports.VersionDiff = VersionDiff;
exports.bindDiffOpener = bindDiffOpener;
exports.openDiffTab = openDiffTab;
exports.ScmDiffTab = ScmDiffTab;
const react_1 = require("react");
const api_js_1 = __require(0);
let loading;
function loadMonaco() {
    const scope = window;
    if (scope.__DshScmMonaco)
        return Promise.resolve(scope.__DshScmMonaco);
    if (loading)
        return loading;
    loading = new Promise((resolve, reject) => {
        const css = document.createElement('link');
        css.rel = 'stylesheet';
        css.href = '/dsh-scm/assets/monaco.css';
        document.head.append(css);
        const script = document.createElement('script');
        script.src = '/dsh-scm/assets/monaco.js';
        script.onload = () => { if (scope.__DshScmMonaco)
            resolve(scope.__DshScmMonaco);
        else {
            loading = undefined;
            reject(new Error('差异编辑器未正确初始化。'));
        } };
        script.onerror = () => { script.remove(); css.remove(); loading = undefined; reject(new Error('差异编辑器资源加载失败，请重启 DSH。')); };
        document.head.append(script);
    });
    return loading;
}
function languageFor(file) {
    const ext = file.split('.').pop()?.toLowerCase() ?? '';
    return { py: 'python', js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript', cpp: 'cpp', cc: 'cpp', c: 'cpp', h: 'cpp', hpp: 'cpp', sh: 'shell', md: 'markdown', css: 'css', html: 'html', xml: 'xml', yml: 'yaml', yaml: 'yaml' }[ext] ?? 'plaintext';
}
function VersionDiff(props) {
    const mount = (0, react_1.useRef)(null), editor = (0, react_1.useRef)(null);
    const [versions, setVersions] = (0, react_1.useState)(null), [error, setError] = (0, react_1.useState)(''), [ready, setReady] = (0, react_1.useState)(false);
    const r = props.request;
    (0, react_1.useEffect)(() => {
        let disposed = false;
        let instance;
        let models = [];
        setVersions(null);
        setError('');
        setReady(false);
        void Promise.all([loadMonaco(), (0, api_js_1.call)('file-versions', props.sessionId, { repo: r.repo, file: r.file, staged: r.staged, base: r.hash, name: r.from })]).then(([monaco, value]) => {
            if (disposed)
                return;
            setVersions(value);
            if (value.binary)
                return;
            monaco.editor.defineTheme('dsh-scm-dark', { base: 'vs-dark', inherit: true, rules: [], colors: { 'editor.background': '#1f1f2e', 'editorGutter.background': '#1f1f2e', 'diffEditor.insertedLineBackground': '#2ea04320', 'diffEditor.removedLineBackground': '#f8514920' } });
            const original = monaco.editor.createModel(value.original, languageFor(r.file)), modified = monaco.editor.createModel(value.modified, languageFor(r.file));
            models = [original, modified];
            if (!mount.current)
                throw new Error('差异容器已关闭。');
            instance = monaco.editor.createDiffEditor(mount.current, { theme: 'dsh-scm-dark', automaticLayout: true, readOnly: true, originalEditable: false, renderSideBySide: true, useInlineViewWhenSpaceIsLimited: false, enableSplitViewResizing: true, ignoreTrimWhitespace: false, renderIndicators: true, renderOverviewRuler: true, diffAlgorithm: 'advanced', minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, lineNumbers: 'on', accessibilitySupport: 'auto', maxComputationTime: 5000 });
            instance.setModel({ original, modified });
            editor.current = instance;
            setReady(true);
        }).catch(e => { if (!disposed)
            setError(e instanceof Error ? e.message : String(e)); });
        return () => { disposed = true; instance?.dispose(); models.forEach(m => m.dispose()); editor.current = null; };
    }, [props.sessionId, r.repo, r.file, r.staged, r.hash, r.from]);
    return (0, react_1.createElement)('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#1f1f2e', color: '#ccc', font: '12px Segoe UI,sans-serif' } }, (0, react_1.createElement)('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid #353544' } }, props.onClose ? (0, react_1.createElement)('button', { onClick: props.onClose, title: '返回源代码管理' }, '←') : null, (0, react_1.createElement)('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.file }, r.file), (0, react_1.createElement)('button', { style: { border: 0, background: 'transparent', color: '#ccc', cursor: 'pointer' }, onClick: () => editor.current?.goToDiff?.('previous'), disabled: !ready, title: '上一个更改' }, '↑'), (0, react_1.createElement)('button', { style: { border: 0, background: 'transparent', color: '#ccc', cursor: 'pointer' }, onClick: () => editor.current?.goToDiff?.('next'), disabled: !ready, title: '下一个更改' }, '↓')), (0, react_1.createElement)('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 11, padding: '4px 12px', background: '#252536', borderBottom: '1px solid #353544' } }, (0, react_1.createElement)('span', null, '原始版本 · ' + (versions?.leftLabel ?? '')), (0, react_1.createElement)('span', null, '修改版本 · ' + (versions?.rightLabel ?? ''))), error ? (0, react_1.createElement)('div', { role: 'alert', style: { padding: 15, color: '#f48771' } }, error) : null, versions?.binary ? (0, react_1.createElement)('div', { style: { padding: 20 } }, '二进制文件无法显示文本差异。') : null, !ready && !error && !versions?.binary ? (0, react_1.createElement)('div', { style: { padding: 15 } }, '正在加载左右差异…') : null, (0, react_1.createElement)('div', { ref: mount, style: { flex: 1, minHeight: 0, overflow: 'hidden' } }));
}
let openTab;
function bindDiffOpener(fn) { openTab = fn; return () => { if (openTab === fn)
    openTab = undefined; }; }
function openDiffTab(request) { if (!openTab)
    return false; openTab(request); return true; }
function ScmDiffTab(props) {
    let request = props.useTabInfo().tab.navigation?.params;
    try {
        const key = 'dsh-scm:diff:' + props.sessionId;
        if (request)
            sessionStorage.setItem(key, JSON.stringify(request));
        else
            request = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    }
    catch { /* Storage may be disabled. */ }
    return request ? (0, react_1.createElement)(VersionDiff, { sessionId: props.sessionId, request }) : (0, react_1.createElement)('div', { style: { padding: 20 } }, '请从源代码管理中选择一个文件。');
}

return module.exports;
};
__factories[2] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphRows = graphRows;
/** Carry parent lanes through topo-ordered rows, including merges and branches. */
function graphRows(commits) {
    let lanes = [];
    return commits.map(c => {
        let lane = lanes.indexOf(c.hash);
        if (lane < 0) {
            lane = lanes.length;
            lanes.push(c.hash);
        }
        const before = [...lanes];
        lanes.splice(lane, 1);
        c.parents.forEach((parent, i) => { if (!lanes.includes(parent))
            lanes.splice(Math.min(lane + i, lanes.length), 0, parent); });
        const edges = [];
        before.forEach((hash, from) => { if (from !== lane && lanes.includes(hash))
            edges.push({ from, to: lanes.indexOf(hash) }); });
        c.parents.forEach(parent => edges.push({ from: lane, to: lanes.indexOf(parent) }));
        return { lane, edges, width: Math.max(before.length, lanes.length, 1) };
    });
}

return module.exports;
};
__factories[3] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
exports.apply = apply;
const diffEditor_js_1 = __require(1);
const panel_js_1 = __require(4);
/** Registration identity shared by the tab registry and the body slot. */
const TYPE_ID = 'dsh-scm:scm';
/** Tab kind that `openTab` names. */
const KIND = 'vscode-scm';
/** The slot registrar, with the framework's generic inference erased. */
/** `slots` is the only service needed before the first render. */
exports.inject = ['slots'];
/**
 * Register the tab type, its body, and the guide entry that opens it.
 * @param ctx - client context.
 */
function apply(ctx) {
    // The tab-type registry is provided by the right sidebar's client half, which
    // may arrive after this plugin: `inject` re-runs when it does.
    ctx.inject(['sidebarRightTabs'], injected => {
        const tabs = injected.get('sidebarRightTabs');
        if (tabs === undefined)
            return undefined;
        const stopDiff = tabs.register({ id: 'dsh-scm:diff', kind: 'scm-diff', title: () => '差异对比' });
        const stopScm = tabs.register({
            id: TYPE_ID,
            kind: KIND,
            title: () => '源代码管理',
            guide: [
                {
                    id: 'source-control',
                    order: 30,
                    title: () => '源代码管理',
                    description: () => 'Git 改动、暂存、提交、分支与远程同步',
                },
            ],
        });
        return () => { stopScm(); stopDiff(); };
    });
    ctx.inject(['sidebarRight'], injected => {
        const sidebar = injected.get('sidebarRight');
        if (sidebar)
            return (0, diffEditor_js_1.bindDiffOpener)(request => sidebar.openTab('scm-diff', { params: request }));
    });
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'dsh-scm:diff' }, diffEditor_js_1.ScmDiffTab)), 'dsh-scm: diff body');
    // Stage two: the body. The seat dispatches by the type id above and hands the
    // body its session id through this registration's inject factory.
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
        name: 'sidebar.right.pane.tab',
        key: TYPE_ID,
        inject: (sessionId) => ({ sessionId }),
    }, (props) => (0, panel_js_1.ScmPanel)(props))), 'dsh-scm: panel body');
}

return module.exports;
};
__factories[4] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScmPanel = ScmPanel;
const diffEditor_js_1 = __require(1);
const react_1 = require("react");
const api_js_1 = __require(0);
const graph_js_1 = __require(2);
const paneMemory = new Map();
const paths = {
    more: ['M4 12h.01M12 12h.01M20 12h.01'], chevron: ['m9 5 7 7-7 7'], check: ['m5 12 4 4L19 6'],
    refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6 7a7 7 0 0 1 12-1l2 3', 'M18 17a7 7 0 0 1-12 1l-2-3'],
    plus: ['M12 5v14M5 12h14'], minus: ['M5 12h14'], undo: ['M9 5 4 10l5 5', 'M4 10h10a6 6 0 0 1 0 12'],
    branch: ['M6 7v10', 'M18 7c0 5-12 3-12 10', 'M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'M18 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
    down: ['M12 3v14m-5-5 5 5 5-5M4 21h16'], up: ['M12 17V3m-5 5 5-5 5 5M4 21h16'],
    close: ['m6 6 12 12M6 18 18 6'], file: ['M6 3h8l4 4v14H6z', 'M14 3v5h4'], folder: ['M3 6h7l2 2h9v12H3z'], graph: ['M6 5v14M6 12h12V5', 'M4 3h4v4H4zM16 3h4v4h-4zM4 17h4v4H4z'], search: ['M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14', 'm15 15 6 6']
};
function icon(name) { return (0, react_1.createElement)('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, ...(paths[name] ?? paths.file).map((d, i) => (0, react_1.createElement)('path', { d, key: i }))); }
const css = `
.vscm{--fg:#ccc;--dim:#96969f;--bg:#1f1f2e;--hover:#2a2d3e;--sel:#30314b;--border:#353544;--blue:#3b66c9;display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg);color:var(--fg);font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;position:relative;isolation:isolate;color-scheme:dark}
.vscm *{box-sizing:border-box}.vscm button,.vscm input,.vscm textarea{font:inherit;color:inherit}.vscm button{cursor:pointer}.vscm button:disabled{opacity:.4;cursor:default}.vscm button:focus-visible,.vscm [tabindex]:focus-visible{outline:1px solid #75beff;outline-offset:-1px}.vscm .ib{display:inline-flex;align-items:center;justify-content:center;width:24px;height:22px;padding:2px;border:0;background:transparent;border-radius:3px;color:var(--fg);flex-shrink:0}.vscm .ib:hover{background:rgba(255,255,255,.1)}
.vscm-title{height:30px;padding:0 12px 0 20px;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:500}.vscm-section{display:flex;align-items:center;height:26px;gap:4px;padding:0 8px;font-size:11px;flex-shrink:0;user-select:none}.vscm-section>span:nth-of-type(2){cursor:pointer;flex:1}.vscm .arrow{flex:none;transform:rotate(90deg);width:16px;height:16px;display:inline-flex}.vscm .arrow.closed{transform:none}.vscm-repos{flex-shrink:0}.vscm-repo{display:flex;align-items:center;gap:6px;padding:0 8px 0 22px;height:24px;cursor:pointer}.vscm-repo.active{background:var(--sel)}.vscm-repo-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vscm-branch{display:flex;gap:2px;align-items:center;font-size:12px;color:#aac8ff;max-width:45%;overflow:hidden;white-space:nowrap;background:none;border:0}.vscm-changes{flex:1;min-height:90px;display:flex;flex-direction:column;overflow:hidden}.vscm-compose{padding:0 20px 8px;flex-shrink:0}.vscm-input{display:block;resize:vertical;width:100%;min-height:28px;max-height:140px;padding:3px 6px;border:1px solid #42424e;border-radius:2px;background:#252534;line-height:20px}.vscm-input:focus{outline:1px solid #5c88df;outline-offset:-1px}.vscm-commitrow{display:flex;margin-top:8px;height:26px;border-radius:2px;overflow:hidden}.vscm-commit{flex:1;border:0;background:var(--blue);display:flex;align-items:center;justify-content:center;gap:4px}.vscm-drop{width:26px;border:0;border-left:1px solid #7592cb;background:var(--blue)}
.vscm-list{overflow:auto;flex:1;min-height:0;overscroll-behavior:contain}.vscm-group{height:24px;display:flex;align-items:center;padding:0 8px 0 12px;gap:4px;font-weight:600;user-select:none}.vscm-group .label{flex:1;cursor:pointer}.vscm-count{min-width:18px;height:18px;border-radius:10px;background:#3c64b9;color:white;text-align:center;font-size:11px;line-height:18px;padding:0 5px;font-weight:400}.vscm-file{height:23px;padding:0 10px 0 22px;display:flex;gap:5px;align-items:center;cursor:pointer;outline:none;white-space:nowrap}.vscm-file:hover{background:var(--hover)}.vscm-file.selected{background:var(--sel)}.vscm-name{overflow:hidden;text-overflow:ellipsis;flex-shrink:0;max-width:60%}.vscm-dir{color:var(--dim);font-size:11px;overflow:hidden;text-overflow:ellipsis;flex:1}.vscm-status{font-size:11px;flex-shrink:0;color:#d7a866}.vscm-file .actions{display:none;margin-left:auto;gap:0}.vscm-file:hover .actions,.vscm-file:focus-within .actions{display:flex}.vscm-file:hover .vscm-dir{min-width:0}.vscm-file[data-code='U'] .vscm-name,.vscm-file[data-code='A'] .vscm-name{color:#8cc68a}.vscm-file[data-code='D'] .vscm-name{color:#dc8b86}.vscm-file[data-code='!'] .vscm-name{color:#f48771}.vscm-file .file-icon{color:#72aabb;display:flex}
.vscm-resizer{height:4px;border-top:1px solid var(--border);cursor:row-resize;flex-shrink:0}.vscm-resizer:hover{background:#007acc}.vscm-history{flex-shrink:0;min-height:80px;display:flex;flex-direction:column}.vscm-commitfiles{flex:none;max-height:175px;border-top:1px solid var(--border);overflow:hidden}.vscm-commitfiles .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.vscm-graphrows{overflow:auto;flex:1;min-height:0}.vscm-graphrow{height:24px;display:flex;align-items:center;white-space:nowrap;cursor:pointer;padding-right:8px;font-size:12px}.vscm-graphrow.selected{background:var(--sel)}.vscm-graphrow:hover{background:var(--hover)}.vscm-graphrow svg{flex-shrink:0}.vscm-subject{flex:1;overflow:hidden;text-overflow:ellipsis}.vscm-ref{font-size:10px;border:1px solid #5e9fe4;border-radius:9px;color:#75bfff;padding:0 5px;margin-left:5px;max-width:110px;overflow:hidden;text-overflow:ellipsis}.vscm-date{font-size:10px;color:var(--dim);margin-left:7px}.vscm-note{padding:12px 20px;color:var(--dim);font-size:12px}.vscm-error{color:#f48771;padding:6px 12px;white-space:pre-wrap;max-height:100px;overflow:auto;border-bottom:1px solid var(--border)}.vscm-busy{height:2px;position:absolute;top:0;left:0;right:0;background:linear-gradient(90deg,transparent,#75beff,transparent);background-size:50%;animation:vscmprogress 1s linear infinite;z-index:20}@keyframes vscmprogress{to{background-position:200%}}
.vscm-overlay{position:absolute;inset:0;z-index:30;background:var(--bg);display:flex;flex-direction:column}.vscm-difftop{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px}.vscm-difftop .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vscm-diff{overflow:auto;flex:1;min-height:0;font:12px/20px Consolas,monospace;white-space:pre;tab-size:4;padding-bottom:24px}.vscm-line{display:block;min-width:max-content;padding:0 10px}.vscm-line.add{background:#1e3a2a;color:#b4debc}.vscm-line.del{background:#462b30;color:#f0b6bd}.vscm-line.hunk{background:#24374c;color:#9cdcfe}.vscm-menu{position:absolute;z-index:60;background:#252536;border:1px solid #4b4b59;box-shadow:0 4px 16px #0008;padding:4px;border-radius:4px;min-width:180px;max-width:calc(100% - 12px)}.vscm-menu button{display:block;text-align:left;width:100%;border:0;background:none;padding:5px 14px;font-size:12px}.vscm-menu button:hover{background:#3b5990}.vscm-modalshade{position:absolute;inset:0;background:#0006;z-index:70;display:flex;align-items:flex-start;justify-content:center;padding:35px 10px}.vscm-modal{padding:12px;background:#252536;border:1px solid #555563;box-shadow:0 5px 20px #0008;width:100%;max-width:420px}.vscm-modal p{font-size:12px;white-space:pre-wrap;word-break:break-word}.vscm-modal footer{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.vscm-modal footer button{background:#3b66c9;border:0;padding:4px 12px}.vscm-picker{max-height:250px;overflow:auto;margin-top:6px}.vscm-picker button{display:block;width:100%;border:0;background:none;text-align:left;padding:5px 8px}.vscm-picker button:hover{background:var(--sel)}
`;
function ScmPanel({ sessionId }) {
    const root = (0, react_1.useRef)(null);
    const repoRef = (0, react_1.useRef)(''), epoch = (0, react_1.useRef)(0), inFlight = (0, react_1.useRef)(false), mutation = (0, react_1.useRef)(false), diffEpoch = (0, react_1.useRef)(0);
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    const [context, setContext] = (0, react_1.useState)(null), [status, setStatus] = (0, react_1.useState)(null);
    const [commits, setCommits] = (0, react_1.useState)([]), [busy, setBusy] = (0, react_1.useState)(false), [error, setError] = (0, react_1.useState)('');
    const [message, setMessage] = (0, react_1.useState)(''), [collapsed, setCollapsed] = (0, react_1.useState)({}), [selected, setSelected] = (0, react_1.useState)([]);
    const [graphHeight, setGraphHeight] = (0, react_1.useState)(175), [limit, setLimit] = (0, react_1.useState)(60);
    const [versionDiff, setVersionDiff] = (0, react_1.useState)(null);
    const [commitDetail, setCommitDetail] = (0, react_1.useState)(null);
    const [commitLoading, setCommitLoading] = (0, react_1.useState)(false);
    const commitEpoch = (0, react_1.useRef)(0);
    const [diff, setDiff] = (0, react_1.useState)(null);
    const [menu, setMenu] = (0, react_1.useState)(null);
    const [confirm, setConfirm] = (0, react_1.useState)(null);
    const [branches, setBranches] = (0, react_1.useState)(null), [filter, setFilter] = (0, react_1.useState)('');
    const memoryKey = () => sessionId + '|' + repoRef.current;
    function saveMessage(value) { setMessage(value); const old = paneMemory.get(memoryKey()); paneMemory.set(memoryKey(), { message: value, detail: old?.detail ?? commitDetail, height: old?.height ?? graphHeight }); }
    function restorePane() { const saved = paneMemory.get(memoryKey()); setMessage(saved?.message ?? ''); setCommitDetail(saved?.detail ?? null); setGraphHeight(saved?.height ?? 175); }
    const api = (op, fields = {}) => (0, api_js_1.call)(op, sessionId, { repo: repoRef.current || undefined, ...fields });
    const showError = (e) => setError(e instanceof Error ? e.message + ('detail' in e ? '\n' + String(e.detail) : '') : String(e));
    async function refresh(history = false) {
        if (inFlight.current || mutation.current)
            return;
        inFlight.current = true;
        const token = epoch.current, repo = repoRef.current;
        try {
            const value = await api('status');
            if (epoch.current !== token || repo !== repoRef.current)
                return;
            setStatus(value.status);
            if (history) {
                const log = await api('log', { limit });
                if (epoch.current === token && repo === repoRef.current)
                    setCommits(log.commits);
            }
        }
        catch (e) {
            if (epoch.current === token)
                showError(e);
        }
        finally {
            inFlight.current = false;
        }
    }
    (0, react_1.useEffect)(() => {
        const token = ++epoch.current;
        repoRef.current = '';
        setLoaded(false);
        setContext(null);
        setCommitDetail(null);
        ++commitEpoch.current;
        setStatus(null);
        setCommits([]);
        setDiff(null);
        setError('');
        setMessage('');
        setSelected([]);
        void api('context').then(async (c) => { if (epoch.current !== token)
            return; setContext(c); setLoaded(true); repoRef.current = c.isRepo ? (c.repos.find(r => r.path.replaceAll('\\', '/').toLowerCase() === c.repo.replaceAll('\\', '/').toLowerCase())?.path ?? c.repo) : c.repos[0]?.path ?? ''; restorePane(); if (repoRef.current)
            await refresh(true); }).catch(e => { if (epoch.current === token) {
            setLoaded(true);
            showError(e);
        } });
        const timer = setInterval(() => { if (document.visibilityState === 'visible' && root.current?.getBoundingClientRect().width && repoRef.current)
            void refresh(); }, 5000);
        return () => { ++epoch.current; ++diffEpoch.current; clearInterval(timer); };
    }, [sessionId]);
    async function run(op, fields = {}, after) {
        if (mutation.current)
            return;
        mutation.current = true;
        setBusy(true);
        setError('');
        setMenu(null);
        const token = epoch.current;
        try {
            await api(op, fields);
            if (epoch.current === token)
                after?.();
        }
        catch (e) {
            if (epoch.current === token)
                showError(e);
        }
        finally {
            mutation.current = false;
            setBusy(false);
            if (epoch.current === token) {
                inFlight.current = false;
                await refresh(true);
            }
        }
    }
    function showVersions(request) { if (!(0, diffEditor_js_1.openDiffTab)(request))
        setVersionDiff(request); }
    async function openFile(path, staged) {
        setSelected([{ path, staged }]);
        const file = (staged ? status?.staged : changes)?.find(f => f.path === path);
        showVersions({ repo: repoRef.current, file: path, staged, from: file?.from });
    }
    async function selectCommit(commit) {
        const token = ++commitEpoch.current, repo = repoRef.current;
        setCommitLoading(true);
        setCommitDetail(null);
        setGraphHeight(n => Math.max(n, 300));
        try {
            const value = await api('commit-files', { base: commit.hash });
            if (token === commitEpoch.current && repo === repoRef.current) {
                setCommitDetail(value);
                const saved = paneMemory.get(memoryKey());
                paneMemory.set(memoryKey(), { message: saved?.message ?? message, detail: value, height: Math.max(graphHeight, 300) });
            }
        }
        catch (e) {
            if (token === commitEpoch.current)
                showError(e);
        }
        finally {
            if (token === commitEpoch.current)
                setCommitLoading(false);
        }
    }
    function toggle(key) { setCollapsed(c => ({ ...c, [key]: !c[key] })); }
    function button(name, title, fn, disabled = busy) { return (0, react_1.createElement)('button', { type: 'button', className: 'ib', title, 'aria-label': title, onClick: fn, disabled }, icon(name)); }
    function openMenu(event, items) {
        event.preventDefault();
        event.stopPropagation();
        const box = root.current?.getBoundingClientRect();
        if (!box)
            return;
        setMenu({ x: Math.max(4, Math.min(event.clientX - box.left, box.width - 210)), y: Math.max(4, Math.min(event.clientY - box.top, box.height - items.length * 30 - 12)), items });
    }
    const changes = [...(status?.unstaged ?? []), ...(status?.untracked ?? [])];
    const stage = (files, staged) => void run(staged ? 'unstage' : 'stage', { files: [...new Set(files.flatMap(f => f.from ? [f.from, f.path] : [f.path]))] }, () => { setSelected([]); setDiff(null); });
    function discard(files) { setMenu(null); setConfirm({ text: `确定要放弃以下文件的未暂存更改吗？未跟踪文件将被删除。此操作无法通过 Git 撤销。\n\n${files.join('\n')}`, run: () => { setConfirm(null); void run('discard', { files: [...files], confirm: true }, () => setDiff(null)); } }); }
    function commit() {
        if (!message.trim() || busy) {
            if (!message.trim())
                root.current?.querySelector('textarea')?.focus();
            return;
        }
        if (!status?.staged.length) {
            if (changes.length)
                setConfirm({ text: '没有暂存的更改。是否暂存所有更改并提交？', run: () => { setConfirm(null); void run('commit', { message, files: changes.flatMap(f => f.from ? [f.from, f.path] : [f.path]), confirm: true }, () => saveMessage('')); } });
            return;
        }
        void run('commit', { message }, () => saveMessage(''));
    }
    function remoteItems() {
        return [
            { label: '拉取', run: () => void run('pull') }, { label: status?.upstream ? '推送' : '发布分支…', run: () => { if (status?.upstream)
                    void run('push', { confirm: true });
                else
                    setConfirm({ text: `发布分支 ${status?.branch} 到 ${context?.remotes[0] ?? 'origin'}？`, run: () => { setConfirm(null); void run('push', { confirm: true, setUpstream: true, branch: status?.branch, remote: context?.remotes[0] ?? 'origin' }); } }); } }, { label: '提取', run: () => void run('fetch') },
            { label: '切换分支…', run: () => { setMenu(null); void api('branches').then(v => setBranches(v.branches)).catch(showError); } },
            { label: '创建分支…', run: () => { setMenu(null); setBranches([]); setFilter(''); } },
            { label: '刷新', run: () => { setMenu(null); void refresh(true); } }
        ];
    }
    function row(file, staged, conflict = false) {
        const name = file.path.split('/').pop(), dir = file.path.slice(0, Math.max(0, file.path.length - name.length - 1)), code = conflict ? '!' : file.code === '??' ? 'U' : (staged ? file.code[0] : file.code[1]) || 'M';
        const active = selected.some(s => s.path === file.path && s.staged === staged);
        const items = () => {
            const group = active ? selected.filter(s => s.staged === staged).map(s => s.path) : [file.path];
            return [{ label: '打开更改', run: () => { setMenu(null); void openFile(file.path, staged); } }, { label: staged ? '取消暂存更改' : '暂存更改', run: () => stage(group.map(path => ({ path, code: '' })), staged) }, ...(!staged ? [{ label: '放弃更改…', run: () => discard(group) }] : [])];
        };
        return (0, react_1.createElement)('div', { key: `${staged}:${file.path}`, role: 'option', 'aria-selected': active, tabIndex: 0, className: `vscm-file ${active ? 'selected' : ''}`, 'data-code': code, title: file.from ? `${file.from} → ${file.path}` : file.path,
            onClick: (e) => { if (e.ctrlKey || e.metaKey)
                setSelected(s => active ? s.filter(x => x.path !== file.path || x.staged !== staged) : [...s, { path: file.path, staged }]);
            else
                void openFile(file.path, staged); },
            onContextMenu: (e) => openMenu(e, items()), onKeyDown: (e) => { if (e.key === 'Enter')
                void openFile(file.path, staged); if (e.key === 'Delete' && !staged) {
                e.preventDefault();
                discard([file.path]);
            } if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                const el = e.currentTarget;
                (e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling)?.focus();
            } } }, (0, react_1.createElement)('span', { className: 'file-icon' }, icon('file')), (0, react_1.createElement)('span', { className: 'vscm-name' }, name), (0, react_1.createElement)('span', { className: 'vscm-dir' }, dir), (0, react_1.createElement)('span', { className: 'actions' }, ...(!staged ? [button('undo', '放弃更改', e => { e.stopPropagation(); discard([file.path]); })] : []), button(staged ? 'minus' : 'plus', staged ? '取消暂存更改' : '暂存更改', e => { e.stopPropagation(); stage([file], staged); })), (0, react_1.createElement)('span', { className: 'vscm-status' }, code));
    }
    function group(title, key, files, staged, conflict = false) {
        if (!files.length)
            return null;
        return (0, react_1.createElement)('div', { key }, (0, react_1.createElement)('div', { className: 'vscm-group' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed[key] ? 'closed' : ''}`, onClick: () => toggle(key) }, icon('chevron')), (0, react_1.createElement)('span', { className: 'label', onClick: () => toggle(key) }, title), button(staged ? 'minus' : 'plus', staged ? '取消暂存所有更改' : '暂存所有更改', () => stage(files, staged)), (0, react_1.createElement)('span', { className: 'vscm-count' }, files.length)), ...(!collapsed[key] ? files.map(f => row(f, staged, conflict)) : []));
    }
    const graph = (0, graph_js_1.graphRows)(commits);
    function closeDiff() { ++diffEpoch.current; setDiff(null); }
    return (0, react_1.createElement)('div', { className: 'vscm', ref: root, onKeyDown: (e) => { if (e.key === 'Escape') {
            setMenu(null);
            setConfirm(null);
            setBranches(null);
            closeDiff();
        } if (e.key === 'F5') {
            e.preventDefault();
            void refresh(true);
        } }, onClick: () => { if (menu)
            setMenu(null); } }, (0, react_1.createElement)('style', null, css), busy ? (0, react_1.createElement)('div', { className: 'vscm-busy' }) : null, (0, react_1.createElement)('div', { className: 'vscm-title' }, '源代码管理', button('more', '更多操作', e => openMenu(e, remoteItems()))), error ? (0, react_1.createElement)('div', { className: 'vscm-error', role: 'alert' }, error, button('close', '关闭错误', () => setError(''))) : null, (0, react_1.createElement)('div', { className: 'vscm-repos' }, (0, react_1.createElement)('div', { className: 'vscm-section' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed.repos ? 'closed' : ''}`, onClick: () => toggle('repos') }, icon('chevron')), (0, react_1.createElement)('span', { onClick: () => toggle('repos') }, '存储库')), ...(!collapsed.repos ? (context?.repos ?? []).map(repo => (0, react_1.createElement)('div', { key: repo.path, className: `vscm-repo ${repoRef.current === repo.path ? 'active' : ''}`, title: repo.path, onClick: () => { if (mutation.current)
            return; ++epoch.current; repoRef.current = repo.path; setStatus(null); setCommitDetail(null); ++commitEpoch.current; setDiff(null); setCommits([]); restorePane(); setSelected([]); inFlight.current = false; void refresh(true); } }, icon('folder'), (0, react_1.createElement)('span', { className: 'vscm-repo-name' }, repo.name.split(/[\\/]/).pop()), (0, react_1.createElement)('button', { className: 'vscm-branch', disabled: busy || repoRef.current !== repo.path, onClick: (e) => { e.stopPropagation(); setFilter(''); void api('branches', { repo: repo.path }).then(v => setBranches(v.branches)).catch(showError); } }, icon('branch'), repoRef.current === repo.path ? status?.branch : repo.branch), button('refresh', '刷新', e => { e.stopPropagation(); void refresh(true); }))) : [])), (0, react_1.createElement)('div', { className: 'vscm-changes' }, (0, react_1.createElement)('div', { className: 'vscm-section' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed.changes ? 'closed' : ''}`, onClick: () => toggle('changes') }, icon('chevron')), (0, react_1.createElement)('span', { onClick: () => toggle('changes') }, '更改'), button('check', '提交', () => commit()), button('refresh', '刷新', () => void refresh(true)), button('more', '更多操作', e => openMenu(e, remoteItems()))), !collapsed.changes ? (0, react_1.createElement)('div', { className: 'vscm-compose' }, (0, react_1.createElement)('textarea', { className: 'vscm-input', rows: 1, 'aria-label': '提交消息', placeholder: `消息(Ctrl+Enter 在“${status?.branch ?? ''}”提交)`, value: message, onChange: (e) => saveMessage(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commit();
        } } }), (0, react_1.createElement)('div', { className: 'vscm-commitrow' }, (0, react_1.createElement)('button', { type: 'button', className: 'vscm-commit', disabled: busy || !message.trim() || !status || status.conflicts.length > 0, onClick: commit }, icon('check'), '提交'), (0, react_1.createElement)('button', { className: 'vscm-drop', title: '提交操作', onClick: (e) => openMenu(e, [{ label: '提交暂存的更改', run: () => commit(), disabled: !status?.staged.length || !message.trim() }]) }, '⌄'))) : null, !collapsed.changes ? (0, react_1.createElement)('div', { className: 'vscm-list', role: 'listbox', 'aria-multiselectable': true, 'aria-label': '更改的文件' }, group('合并更改', 'conflicts', status?.conflicts ?? [], false, true), group('暂存的更改', 'staged', status?.staged ?? [], true), group('更改', 'unstaged', changes, false), status && changes.length === 0 && status.staged.length === 0 && status.conflicts.length === 0 ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '没有更改。') : null, !context ? (0, react_1.createElement)('div', { className: 'vscm-note' }, loaded ? '未能读取工作区，请查看上方错误。' : '正在读取工作区…') : context.repos.length === 0 ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '请在当前 DSH 会话中打开一个 Git 项目。') : null) : null), (0, react_1.createElement)('div', { className: 'vscm-resizer', role: 'separator', 'aria-label': '调整图表高度', onPointerDown: (e) => { e.preventDefault(); const start = e.clientY, initial = graphHeight; const move = (ev) => setGraphHeight(Math.max(80, Math.min((root.current?.clientHeight ?? 600) - 160, initial + start - ev.clientY))); const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); } }), (0, react_1.createElement)('div', { className: 'vscm-history', style: { height: collapsed.graph ? 26 : graphHeight } }, (0, react_1.createElement)('div', { className: 'vscm-section' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed.graph ? 'closed' : ''}`, onClick: () => toggle('graph') }, icon('chevron')), (0, react_1.createElement)('span', { onClick: () => toggle('graph') }, '图表'), (0, react_1.createElement)('span', { title: status?.upstream ?? '尚未设置上游', style: { fontSize: 11, color: '#a9bbdf' } }, `${status?.behind ?? 0}↓ ${status?.ahead ?? 0}↑`), button('down', '拉取', () => void run('pull')), button('up', status?.upstream ? '推送' : '发布分支', () => remoteItems()[1].run()), button('refresh', '刷新图表', () => void refresh(true)), button('more', '图表操作', e => openMenu(e, [{ label: '加载更多提交', run: () => { setMenu(null); setLimit(n => Math.min(200, n + 60)); void api('log', { limit: Math.min(200, limit + 60) }).then(v => setCommits(v.commits)).catch(showError); } }, ...remoteItems()]))), !collapsed.graph ? (0, react_1.createElement)('div', { className: 'vscm-graphrows' }, ...commits.map((commit, i) => { const g = graph[i], colors = ['#4ea1ff', '#bb87e0', '#e2b05c', '#6cceac']; return (0, react_1.createElement)('div', { key: commit.hash, className: `vscm-graphrow ${commitDetail?.hash === commit.hash ? 'selected' : ''}`, 'aria-pressed': commitDetail?.hash === commit.hash, tabIndex: 0, role: 'button', title: `${commit.subject}\n${commit.author} · ${commit.date} · ${commit.hash}`, onClick: () => void selectCommit(commit), onKeyDown: (e) => { if (e.key === 'Enter')
            void selectCommit(commit); } }, (0, react_1.createElement)('svg', { width: g.width * 12 + 12, height: 24, viewBox: `0 0 ${g.width * 12 + 12} 24` }, ...g.edges.map((edge, j) => (0, react_1.createElement)('path', { key: j, d: `M ${edge.from * 12 + 12} ${edge.from === g.lane ? 12 : 0} C ${edge.from * 12 + 12} 20 ${edge.to * 12 + 12} 16 ${edge.to * 12 + 12} 24`, stroke: colors[edge.from % 4], fill: 'none', strokeWidth: 1.4 })), (0, react_1.createElement)('circle', { cx: g.lane * 12 + 12, cy: 12, r: i === 0 ? 4.5 : 3, fill: i === 0 ? '#1f1f2e' : colors[g.lane % 4], stroke: colors[g.lane % 4], strokeWidth: 1.5 })), (0, react_1.createElement)('span', { className: 'vscm-subject' }, commit.subject), commit.refs ? (0, react_1.createElement)('span', { className: 'vscm-ref' }, commit.refs.replace('HEAD -> ', '')) : null, (0, react_1.createElement)('span', { className: 'vscm-date' }, commit.date)); }), commits.length === 0 ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '暂无提交。') : null) : null, !collapsed.graph && (commitDetail || commitLoading) ? (0, react_1.createElement)('div', { className: 'vscm-commitfiles' }, (0, react_1.createElement)('div', { className: 'vscm-group' }, (0, react_1.createElement)('span', { className: 'label', title: commitDetail?.subject }, commitLoading ? '正在读取提交文件…' : commitDetail?.subject), button('close', '关闭提交详情', () => { ++commitEpoch.current; setCommitDetail(null); setCommitLoading(false); const saved = paneMemory.get(memoryKey()); if (saved)
        paneMemory.set(memoryKey(), { ...saved, detail: null }); })), (0, react_1.createElement)('div', { style: { overflow: 'auto', maxHeight: 145 } }, ...(commitDetail?.files ?? []).map(file => (0, react_1.createElement)('div', { key: file.path, className: 'vscm-file', tabIndex: 0, role: 'button', title: file.from ? `${file.from} → ${file.path}` : file.path, onClick: () => showVersions({ repo: repoRef.current, file: file.path, hash: commitDetail.hash, from: file.from }), onKeyDown: (e) => { if (e.key === 'Enter')
            showVersions({ repo: repoRef.current, file: file.path, hash: commitDetail.hash, from: file.from }); } }, (0, react_1.createElement)('span', { className: 'file-icon' }, icon('file')), (0, react_1.createElement)('span', { className: 'vscm-name' }, file.path.split('/').pop()), (0, react_1.createElement)('span', { className: 'vscm-dir' }, file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''), (0, react_1.createElement)('span', { className: 'vscm-status' }, file.code))))) : null), versionDiff ? (0, react_1.createElement)('div', { className: 'vscm-overlay' }, (0, react_1.createElement)(diffEditor_js_1.VersionDiff, { sessionId, request: versionDiff, onClose: () => setVersionDiff(null) })) : null, diff ? (0, react_1.createElement)('div', { className: 'vscm-overlay' }, (0, react_1.createElement)('div', { className: 'vscm-difftop' }, button('close', '返回源代码管理', closeDiff), (0, react_1.createElement)('span', { className: 'name' }, diff.title), diff.selection ? button(diff.selection.staged ? 'minus' : 'plus', diff.selection.staged ? '取消暂存更改' : '暂存更改', () => stage([{ path: diff.selection.path, code: '' }], diff.selection.staged)) : null), (0, react_1.createElement)('div', { className: 'vscm-diff' }, ...diff.text.slice(0, 512 * 1024).split('\n').slice(0, 6000).map((line, i) => (0, react_1.createElement)('span', { key: i, className: `vscm-line ${line.startsWith('@@') ? 'hunk' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : ''}` }, line || ' ')))) : null, menu ? (0, react_1.createElement)('div', { className: 'vscm-menu', role: 'menu', style: { left: menu.x, top: menu.y }, onClick: (e) => e.stopPropagation() }, ...menu.items.map((item, i) => (0, react_1.createElement)('button', { key: i, role: 'menuitem', disabled: item.disabled || busy, onClick: item.run }, item.label))) : null, confirm ? (0, react_1.createElement)('div', { className: 'vscm-modalshade' }, (0, react_1.createElement)('div', { className: 'vscm-modal', role: 'alertdialog', 'aria-modal': true, 'aria-label': '确认 Git 操作' }, (0, react_1.createElement)('strong', null, '源代码管理'), (0, react_1.createElement)('p', null, confirm.text), (0, react_1.createElement)('footer', null, (0, react_1.createElement)('button', { onClick: () => setConfirm(null) }, '取消'), (0, react_1.createElement)('button', { onClick: confirm.run }, '确定')))) : null, branches ? (0, react_1.createElement)('div', { className: 'vscm-modalshade' }, (0, react_1.createElement)('div', { className: 'vscm-modal', role: 'dialog', 'aria-label': '选择分支' }, (0, react_1.createElement)('div', { style: { display: 'flex', justifyContent: 'space-between' } }, (0, react_1.createElement)('strong', null, branches.length ? '选择要签出的分支' : '创建分支'), button('close', '关闭', () => { setBranches(null); setFilter(''); })), (0, react_1.createElement)('input', { className: 'vscm-input', autoFocus: true, placeholder: branches.length ? '搜索分支…' : '新分支名称', value: filter, onChange: (e) => setFilter(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && !branches.length && filter.trim()) {
            void run('branch-create', { name: filter.trim() }, () => { setBranches(null); setFilter(''); });
        } } }), branches.length ? (0, react_1.createElement)('div', { className: 'vscm-picker' }, ...branches.filter(b => b.name.toLowerCase().includes(filter.toLowerCase())).map(b => (0, react_1.createElement)('button', { key: b.name, disabled: busy, onClick: () => void run('switch', { branch: b.name, track: b.remote }, () => { setBranches(null); setFilter(''); }) }, `${b.current ? '✓ ' : ''}${b.name}   ${b.shortHash}`))) : (0, react_1.createElement)('footer', null, (0, react_1.createElement)('button', { disabled: busy || !filter.trim(), onClick: () => void run('branch-create', { name: filter.trim() }, () => { setBranches(null); setFilter(''); }) }, '创建分支')))) : null);
}

return module.exports;
};
		return __require(3);
	},
});

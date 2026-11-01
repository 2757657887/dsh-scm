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
const editorTheme_js_1 = __require(2);
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
        let themeObserver;
        setVersions(null);
        setError('');
        setReady(false);
        void Promise.all([loadMonaco(), (0, api_js_1.call)('file-versions', props.sessionId, { repo: r.repo, file: r.file, staged: r.staged, base: r.hash, name: r.from })]).then(([monaco, value]) => {
            if (disposed)
                return;
            setVersions(value);
            props.onSize?.(Math.min(550, Math.max(130, Math.max(value.original.split('\n').length, value.modified.split('\n').length) * 20 + 34)));
            if (value.binary)
                return;
            const applyTheme = () => { if (mount.current) {
                monaco.editor.defineTheme('dsh-scm-theme', (0, editorTheme_js_1.editorTheme)(mount.current));
                monaco.editor.setTheme('dsh-scm-theme');
            } };
            applyTheme();
            themeObserver = new MutationObserver(applyTheme);
            themeObserver.observe(document.documentElement, { attributes: true });
            themeObserver.observe(document.body, { attributes: true });
            const original = monaco.editor.createModel(value.original, languageFor(r.file)), modified = monaco.editor.createModel(value.modified, languageFor(r.file));
            models = [original, modified];
            if (!mount.current)
                throw new Error('差异容器已关闭。');
            instance = monaco.editor.createDiffEditor(mount.current, { theme: 'dsh-scm-theme', automaticLayout: true, readOnly: true, originalEditable: false, renderSideBySide: true, useInlineViewWhenSpaceIsLimited: false, enableSplitViewResizing: true, ignoreTrimWhitespace: false, renderIndicators: true, renderOverviewRuler: true, diffAlgorithm: 'advanced', minimap: { enabled: false }, scrollBeyondLastLine: false, fontSize: 13, lineNumbers: 'on', accessibilitySupport: 'auto', maxComputationTime: 5000 });
            instance.setModel({ original, modified });
            editor.current = instance;
            setReady(true);
        }).catch(e => { if (!disposed)
            setError(e instanceof Error ? e.message : String(e)); });
        return () => { disposed = true; themeObserver?.disconnect(); instance?.dispose(); models.forEach(m => m.dispose()); editor.current = null; };
    }, [props.sessionId, r.repo, r.file, r.staged, r.hash, r.from]);
    return (0, react_1.createElement)('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: 'transparent', color: 'var(--dsw-alias-label-primary,inherit)', font: '12px Segoe UI,sans-serif' } }, !props.compact ? (0, react_1.createElement)('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderBottom: '1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2))' } }, props.onClose ? (0, react_1.createElement)('button', { onClick: props.onClose, title: '返回源代码管理' }, '←') : null, (0, react_1.createElement)('span', { style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: r.file }, r.file), (0, react_1.createElement)('button', { style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }, onClick: () => editor.current?.goToDiff?.('previous'), disabled: !ready, title: '上一个更改' }, '↑'), (0, react_1.createElement)('button', { style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer' }, onClick: () => editor.current?.goToDiff?.('next'), disabled: !ready, title: '下一个更改' }, '↓')) : null, (0, react_1.createElement)('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', fontSize: 11, padding: '4px 12px', background: 'var(--dsw-alias-bg-layer-1,transparent)', borderBottom: '1px solid var(--dsw-alias-border-l2,rgba(127,127,127,.2))' } }, (0, react_1.createElement)('span', null, '原始版本 · ' + (versions?.leftLabel ?? '')), (0, react_1.createElement)('span', null, '修改版本 · ' + (versions?.rightLabel ?? ''))), error ? (0, react_1.createElement)('div', { role: 'alert', style: { padding: 15, color: '#f48771' } }, error) : null, versions?.binary ? (0, react_1.createElement)('div', { style: { padding: 20 } }, '二进制文件无法显示文本差异。') : null, !ready && !error && !versions?.binary ? (0, react_1.createElement)('div', { style: { padding: 15 } }, '正在加载左右差异…') : null, (0, react_1.createElement)('div', { ref: mount, style: { flex: 1, minHeight: 0, overflow: 'hidden' } }));
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
exports.editorTheme = editorTheme;
/** Resolve DSH theme colors in the same DOM scope as the diff editor. */
function editorTheme(host) {
    function color(name, fallback) {
        const probe = document.createElement('span');
        probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
        probe.style.color = `var(${name}, ${fallback})`;
        host.append(probe);
        const value = getComputedStyle(probe).color;
        probe.remove();
        const parts = value.match(/^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)/);
        return parts ? ('#' + parts.slice(1, 4).map(v => Math.max(0, Math.min(255, Math.round(Number(v)))).toString(16).padStart(2, '0')).join('')) : fallback;
    }
    const foreground = color('--dsw-alias-label-primary', getComputedStyle(host).color || '#cccccc');
    const secondary = color('--dsw-alias-label-tertiary', '#888888');
    const brightness = foreground.startsWith('#') ? (parseInt(foreground.slice(1, 3), 16) * .299 + parseInt(foreground.slice(3, 5), 16) * .587 + parseInt(foreground.slice(5, 7), 16) * .114) : 200;
    return { base: brightness > 128 ? 'vs-dark' : 'vs', inherit: true, rules: [], colors: { 'editor.background': '#00000000', 'editorGutter.background': '#00000000', 'editor.foreground': foreground, 'editorLineNumber.foreground': secondary, 'editorLineNumber.activeForeground': foreground } };
}

return module.exports;
};
__factories[3] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graphRows = graphRows;
/** Carry parent lanes through topo-ordered rows, including merges and branches. */
function graphRows(commits) {
    let lanes = [];
    return commits.map(c => {
        let lane = lanes.indexOf(c.hash);
        const incoming = lane >= 0;
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
        return { lane, edges, incoming, width: Math.max(before.length, lanes.length, 1) };
    });
}

return module.exports;
};
__factories[4] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.inject = void 0;
exports.apply = apply;
const navigation_js_1 = __require(6);
const multiDiff_js_1 = __require(5);
const diffEditor_js_1 = __require(1);
const panel_js_1 = __require(7);
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
        const stopGraph = tabs.register({ id: 'dsh-scm:graph', kind: 'scm-graph', title: () => 'Git 图表' });
        const stopMulti = tabs.register({ id: 'dsh-scm:multi-diff', kind: 'scm-multi-diff', title: () => '所有更改' });
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
        return () => { stopScm(); stopDiff(); stopMulti(); stopGraph(); };
    });
    ctx.inject(['sidebarRight'], injected => {
        const sidebar = injected.get('sidebarRight');
        if (sidebar) {
            const single = (0, diffEditor_js_1.bindDiffOpener)(request => sidebar.openTab('scm-diff', { params: request }));
            const group = (0, multiDiff_js_1.bindGroupDiffOpener)(request => sidebar.openTab('scm-multi-diff', { params: request }));
            const file = (0, navigation_js_1.bindFileOpener)(address => sidebar.openResource(address));
            const graph = (0, navigation_js_1.bindGraphOpener)(() => sidebar.openTab('scm-graph'));
            return () => { single(); group(); file(); graph(); };
        }
    });
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'dsh-scm:graph', inject: (sessionId) => ({ sessionId }) }, (props) => (0, panel_js_1.ScmPanel)({ ...props, graphOnly: true }))), 'dsh-scm: graph body');
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({ name: 'sidebar.right.pane.tab', key: 'dsh-scm:multi-diff' }, multiDiff_js_1.ScmMultiDiffTab)), 'dsh-scm: multi diff body');
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
__factories[5] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiDiff = MultiDiff;
exports.bindGroupDiffOpener = bindGroupDiffOpener;
exports.openGroupDiffTab = openGroupDiffTab;
exports.ScmMultiDiffTab = ScmMultiDiffTab;
const react_1 = require("react");
const diffEditor_js_1 = __require(1);
function DiffBlock(props) {
    const section = (0, react_1.useRef)(null);
    const [near, setNear] = (0, react_1.useState)(false), [height, setHeight] = (0, react_1.useState)(300), [collapsed, setCollapsed] = (0, react_1.useState)(props.collapseAll);
    (0, react_1.useEffect)(() => setCollapsed(props.collapseAll), [props.revision, props.collapseAll]);
    (0, react_1.useEffect)(() => {
        if (!section.current)
            return;
        const observer = new IntersectionObserver(entries => setNear(entries[0]?.isIntersecting ?? false), { root: props.root.current, rootMargin: '150px' });
        observer.observe(section.current);
        return () => observer.disconnect();
    }, [props.request.file, props.request.repo, props.root]);
    return (0, react_1.createElement)('section', { ref: section, style: { borderBottom: '1px solid var(--dsw-alias-border-l2,#5555)' } }, (0, react_1.createElement)('button', { type: 'button', 'aria-expanded': !collapsed, onClick: () => setCollapsed(v => !v), style: { display: 'flex', gap: 6, width: '100%', border: 0, padding: '6px 12px', background: 'var(--dsw-alias-bg-layer-1,transparent)', color: 'inherit', textAlign: 'left', cursor: 'pointer', font: '12px Segoe UI,sans-serif' } }, collapsed ? '›' : '⌄', props.request.file), !collapsed ? (0, react_1.createElement)('div', { style: { height, minHeight: 120 } }, near ? (0, react_1.createElement)(diffEditor_js_1.VersionDiff, { sessionId: props.sessionId, request: props.request, compact: true, onSize: setHeight }) : (0, react_1.createElement)('div', { style: { padding: 16, fontSize: 12, color: 'var(--dsw-alias-label-tertiary,inherit)' } }, '滚动到此处时加载差异…')) : null);
}
function MultiDiff(props) {
    const scroll = (0, react_1.useRef)(null), [collapseAll, setCollapseAll] = (0, react_1.useState)(false), [revision, setRevision] = (0, react_1.useState)(0);
    const action = (label, collapse) => (0, react_1.createElement)('button', { type: 'button', onClick: () => { setCollapseAll(collapse); setRevision(v => v + 1); }, style: { border: 0, background: 'transparent', color: 'inherit', cursor: 'pointer', font: '12px Segoe UI,sans-serif' } }, label);
    return (0, react_1.createElement)('div', { style: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: 'var(--dsw-alias-label-primary,inherit)', background: 'transparent' } }, (0, react_1.createElement)('div', { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: '1px solid var(--dsw-alias-border-l2,#5555)', font: '12px Segoe UI,sans-serif' } }, props.onClose ? (0, react_1.createElement)('button', { onClick: props.onClose }, '←') : null, (0, react_1.createElement)('span', { style: { flex: 1 } }, `${props.request.title} · ${props.request.files.length} 个文件`), action('全部折叠', true), action('全部展开', false)), (0, react_1.createElement)('div', { ref: scroll, style: { flex: 1, minHeight: 0, overflow: 'auto', overscrollBehavior: 'contain' } }, ...props.request.files.map(file => (0, react_1.createElement)(DiffBlock, { key: `${file.repo}:${file.file}:${file.staged}`, sessionId: props.sessionId, request: file, root: scroll, collapseAll, revision }))));
}
let opener;
function bindGroupDiffOpener(fn) { opener = fn; return () => { if (opener === fn)
    opener = undefined; }; }
function openGroupDiffTab(request) { if (!opener)
    return false; opener(request); return true; }
function ScmMultiDiffTab(props) {
    let request = props.useTabInfo().tab.navigation?.params;
    try {
        const key = 'dsh-scm:multi-diff:' + props.sessionId;
        if (request)
            sessionStorage.setItem(key, JSON.stringify(request));
        else
            request = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    }
    catch { /* Storage may be unavailable. */ }
    return request && Array.isArray(request.files) ? (0, react_1.createElement)(MultiDiff, { sessionId: props.sessionId, request }) : (0, react_1.createElement)('div', { style: { padding: 20 } }, '请在源代码管理的分组标题栏选择“查看所有更改”。');
}

return module.exports;
};
__factories[6] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspaceFileAddress = workspaceFileAddress;
exports.bindFileOpener = bindFileOpener;
exports.openWorkspaceFile = openWorkspaceFile;
exports.bindGraphOpener = bindGraphOpener;
exports.openGraphTab = openGraphTab;
/** DSH native file resources; opening a file must not open a Git diff. */
function workspaceFileAddress(repo, file, sessionId) {
    if (!repo || !file || file.startsWith('/') || file.startsWith('\\') || /^[A-Za-z]:/.test(file) || file.split('/').some(part => part === '..' || part === ''))
        throw new Error('无效的工作区文件路径。');
    const path = repo.replaceAll('\\', '/').replace(/\/+$/, '') + '/' + file;
    if (!path.startsWith('/') && !/^[A-Za-z]:\//.test(path))
        throw new Error('工作区需要绝对路径。');
    if (!sessionId)
        throw new Error('缺少当前会话。');
    return 'dsh-resource://file/session/' + encodeURIComponent(sessionId) + '/' + path.split('/').map(part => /^[A-Za-z]:$/.test(part) ? part : encodeURIComponent(part)).join('/');
}
let opener;
function bindFileOpener(fn) { opener = fn; return () => { if (opener === fn)
    opener = undefined; }; }
function openWorkspaceFile(repo, file, sessionId) { if (!opener)
    return false; opener(workspaceFileAddress(repo, file, sessionId)); return true; }
let graphOpener;
function bindGraphOpener(fn) { graphOpener = fn; return () => { if (graphOpener === fn)
    graphOpener = undefined; }; }
function openGraphTab() { if (!graphOpener)
    return false; graphOpener(); return true; }

return module.exports;
};
__factories[7] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScmPanel = ScmPanel;
const navigation_js_1 = __require(6);
const multiDiff_js_1 = __require(5);
const scmIcons_js_1 = __require(8);
const diffEditor_js_1 = __require(1);
const react_1 = require("react");
const api_js_1 = __require(0);
const graph_js_1 = __require(3);
const paneMemory = new Map();
const paths = {
    more: ['M4 12h.01M12 12h.01M20 12h.01'], chevron: ['m9 5 7 7-7 7'], check: ['m5 12 4 4L19 6'],
    refresh: ['M20 7v5h-5', 'M4 17v-5h5', 'M6 7a7 7 0 0 1 12-1l2 3', 'M18 17a7 7 0 0 1-12 1l-2-3'],
    plus: ['M12 5v14M5 12h14'], minus: ['M5 12h14'], undo: ['M9 5 4 10l5 5', 'M4 10h10a6 6 0 0 1 0 12'],
    branch: ['M6 7v10', 'M18 7c0 5-12 3-12 10', 'M6 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'M18 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4', 'M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4'],
    down: ['M12 3v14m-5-5 5 5 5-5M4 21h16'], up: ['M12 17V3m-5 5 5-5 5 5M4 21h16'],
    close: ['m6 6 12 12M6 18 18 6'], file: ['M6 3h8l4 4v14H6z', 'M14 3v5h4'], folder: ['M3 6h7l2 2h9v12H3z'], graph: ['M6 5v14M6 12h12V5', 'M4 3h4v4H4zM16 3h4v4h-4zM4 17h4v4H4z'], search: ['M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14', 'm15 15 6 6']
};
function icon(name) { if (scmIcons_js_1.scmGlyphs[name])
    return (0, react_1.createElement)('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }, (0, react_1.createElement)('path', { d: scmIcons_js_1.scmGlyphs[name] })); return (0, react_1.createElement)('svg', { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, ...(paths[name] ?? paths.file).map((d, i) => (0, react_1.createElement)('path', { d, key: i }))); }
const css = `
.vscm{--fg:var(--dsw-alias-label-primary,inherit);--dim:var(--dsw-alias-label-tertiary,#96969f);--bg:transparent;--hover:var(--dsw-alias-interactive-bg-hover,rgba(127,127,127,.1));--sel:var(--dsw-alias-bg-layer-2,rgba(127,127,127,.18));--border:var(--dsw-alias-border-l2,rgba(127,127,127,.2));--blue:var(--dsw-alias-state-business-primary,#3b66c9);display:flex;flex-direction:column;height:100%;min-height:0;background:var(--bg);color:var(--fg);font:13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',sans-serif;position:relative;isolation:isolate;color-scheme:inherit}
.vscm *{box-sizing:border-box}.vscm button,.vscm input,.vscm textarea{font:inherit;color:inherit}.vscm button{cursor:pointer}.vscm button:disabled{opacity:.4;cursor:default}.vscm button:focus-visible,.vscm [tabindex]:focus-visible{outline:1px solid #75beff;outline-offset:-1px}.vscm .ib{display:inline-flex;align-items:center;justify-content:center;width:24px;height:22px;padding:2px;border:0;background:transparent;border-radius:3px;color:var(--fg);flex-shrink:0}.vscm .ib:hover{background:rgba(255,255,255,.1)}
.vscm-title{height:30px;padding:0 12px 0 20px;display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:500}.vscm-section{display:flex;align-items:center;height:26px;gap:4px;padding:0 8px;font-size:11px;flex-shrink:0;user-select:none}.vscm-section>span:nth-of-type(2){cursor:pointer;flex:1}.vscm .arrow{flex:none;transform:rotate(90deg);width:16px;height:16px;display:inline-flex}.vscm .arrow.closed{transform:none}.vscm-repos{flex-shrink:0}.vscm-repo{display:flex;align-items:center;gap:6px;padding:0 8px 0 22px;height:24px;cursor:pointer}.vscm-repo.active{background:var(--sel)}.vscm-repo-name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vscm-branch{display:flex;gap:2px;align-items:center;font-size:12px;color:#aac8ff;max-width:45%;overflow:hidden;white-space:nowrap;background:none;border:0}.vscm-changes{flex:1;min-height:90px;display:flex;flex-direction:column;overflow:hidden}.vscm-compose{padding:0 20px 8px;flex-shrink:0}.vscm-input{display:block;resize:vertical;width:100%;min-height:28px;max-height:140px;padding:3px 6px;border:1px solid var(--border);border-radius:2px;background:var(--dsw-alias-bg-layer-1,transparent);line-height:20px}.vscm-input:focus{outline:1px solid #5c88df;outline-offset:-1px}.vscm-commitrow{display:flex;margin-top:8px;height:26px;border-radius:2px;overflow:hidden}.vscm-commit{flex:1;border:0;background:var(--blue);display:flex;align-items:center;justify-content:center;gap:4px}.vscm-drop{width:26px;border:0;border-left:1px solid #7592cb;background:var(--blue)}
.vscm-list{overflow:auto;flex:1;min-height:0;overscroll-behavior:contain}.vscm-group{height:24px;display:flex;align-items:center;padding:0 8px 0 12px;gap:4px;font-weight:600;user-select:none}.vscm-group .label{flex:1;cursor:pointer}.vscm-count{min-width:18px;height:18px;border-radius:10px;background:#3c64b9;color:white;text-align:center;font-size:11px;line-height:18px;padding:0 5px;font-weight:400}.vscm-file{height:23px;padding:0 10px 0 22px;display:flex;gap:5px;align-items:center;cursor:pointer;outline:none;white-space:nowrap}.vscm-file:hover{background:var(--hover)}.vscm-file.selected{background:var(--sel)}.vscm-name{overflow:hidden;text-overflow:ellipsis;flex-shrink:0;max-width:60%}.vscm-dir{color:var(--dim);font-size:11px;overflow:hidden;text-overflow:ellipsis;flex:1}.vscm-status{font-size:11px;flex-shrink:0;color:#d7a866}.vscm-file .actions{display:none;margin-left:auto;gap:0}.vscm-file:hover .actions,.vscm-file:focus-within .actions{display:flex}.vscm-file:hover .vscm-dir{min-width:0}.vscm-file[data-code='U'] .vscm-name,.vscm-file[data-code='A'] .vscm-name{color:#8cc68a}.vscm-file[data-code='D'] .vscm-name{color:#dc8b86}.vscm-file[data-code='!'] .vscm-name{color:#f48771}.vscm-file .file-icon{color:#72aabb;display:flex}
.vscm-resizer{height:4px;border-top:1px solid var(--border);cursor:row-resize;flex-shrink:0}.vscm-resizer:hover{background:#007acc}.vscm-history{flex-shrink:0;min-height:80px;display:flex;flex-direction:column}.vscm-commitfiles{position:relative;background:transparent}.vscm-commitfiles .vscm-file{position:relative}.vscm-graph-spine{position:absolute;top:0;bottom:0;border-left:1.5px solid;pointer-events:none;z-index:2}.vscm-commitfiles .vscm-note{padding:5px 22px}.vscm-commitfiles .label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:11px}.vscm-graphrows{overflow:auto;flex:1;min-height:0}.vscm-graphrow{height:24px;display:flex;align-items:center;white-space:nowrap;cursor:pointer;padding-right:8px;font-size:12px}.vscm-graphrow.selected{background:var(--sel)}.vscm-graphrow:hover{background:var(--hover)}.vscm-graphrow svg{flex-shrink:0}.vscm-subject{flex:1;overflow:hidden;text-overflow:ellipsis}.vscm-ref{font-size:10px;border:1px solid #5e9fe4;border-radius:9px;color:#75bfff;padding:0 5px;margin-left:5px;max-width:110px;overflow:hidden;text-overflow:ellipsis}.vscm-date{font-size:10px;color:var(--dim);margin-left:7px}.vscm-note{padding:12px 20px;color:var(--dim);font-size:12px}.vscm-error{color:#f48771;padding:6px 12px;white-space:pre-wrap;max-height:100px;overflow:auto;border-bottom:1px solid var(--border)}.vscm-busy{height:2px;position:absolute;top:0;left:0;right:0;background:linear-gradient(90deg,transparent,#75beff,transparent);background-size:50%;animation:vscmprogress 1s linear infinite;z-index:20}@keyframes vscmprogress{to{background-position:200%}}
.vscm-overlay{position:absolute;inset:0;z-index:30;background:var(--bg);display:flex;flex-direction:column}.vscm-difftop{display:flex;gap:6px;align-items:center;padding:6px 10px;border-bottom:1px solid var(--border);font-size:12px}.vscm-difftop .name{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.vscm-diff{overflow:auto;flex:1;min-height:0;font:12px/20px Consolas,monospace;white-space:pre;tab-size:4;padding-bottom:24px}.vscm-line{display:block;min-width:max-content;padding:0 10px}.vscm-line.add{background:#1e3a2a;color:#b4debc}.vscm-line.del{background:#462b30;color:#f0b6bd}.vscm-line.hunk{background:#24374c;color:#9cdcfe}.vscm-menu{position:absolute;z-index:60;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid #4b4b59;box-shadow:0 4px 16px #0008;padding:4px;border-radius:4px;min-width:180px;max-width:calc(100% - 12px)}.vscm-menu button{display:block;text-align:left;width:100%;border:0;background:none;padding:5px 14px;font-size:12px}.vscm-menu{max-height:calc(100% - 8px);overflow-y:auto}.vscm-menu button:hover{background:var(--hover)}.vscm-modalshade{position:absolute;inset:0;background:#0006;z-index:70;display:flex;align-items:flex-start;justify-content:center;padding:35px 10px}.vscm-modal{padding:12px;background:var(--dsw-alias-bg-layer-1,Canvas);border:1px solid #555563;box-shadow:0 5px 20px #0008;width:100%;max-width:420px}.vscm-modal p{font-size:12px;white-space:pre-wrap;word-break:break-word}.vscm-modal footer{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}.vscm-modal footer button{background:var(--blue);border:0;padding:4px 12px}.vscm-picker{max-height:250px;overflow:auto;margin-top:6px}.vscm-picker button{display:block;width:100%;border:0;background:none;text-align:left;padding:5px 8px}.vscm-picker button:hover{background:var(--sel)}
`;
function ScmPanel({ sessionId, graphOnly = false }) {
    const root = (0, react_1.useRef)(null);
    const repoRef = (0, react_1.useRef)(''), epoch = (0, react_1.useRef)(0), inFlight = (0, react_1.useRef)(false), mutation = (0, react_1.useRef)(false), diffEpoch = (0, react_1.useRef)(0);
    const [loaded, setLoaded] = (0, react_1.useState)(false);
    const [context, setContext] = (0, react_1.useState)(null), [status, setStatus] = (0, react_1.useState)(null);
    const [commits, setCommits] = (0, react_1.useState)([]), [busy, setBusy] = (0, react_1.useState)(false), [error, setError] = (0, react_1.useState)('');
    const [message, setMessage] = (0, react_1.useState)(''), [collapsed, setCollapsed] = (0, react_1.useState)({}), [selected, setSelected] = (0, react_1.useState)([]);
    const [visibleSections, setVisibleSections] = (0, react_1.useState)(() => { if (graphOnly)
        return { repos: false, changes: false, graph: true }; try {
        return JSON.parse(localStorage.getItem('dsh-scm:visible-sections') ?? 'null') ?? { repos: true, changes: true, graph: true };
    }
    catch {
        return { repos: true, changes: true, graph: true };
    } });
    const [graphBranches, setGraphBranches] = (0, react_1.useState)([]);
    const [graphBranch, setGraphBranch] = (0, react_1.useState)('');
    const graphBranchRef = (0, react_1.useRef)('');
    const [repoSort, setRepoSort] = (0, react_1.useState)(() => { try {
        const v = localStorage.getItem('dsh-scm:repo-sort');
        return v === 'path' || v === 'name' ? v : 'discovery';
    }
    catch {
        return 'discovery';
    } });
    const [treeView, setTreeView] = (0, react_1.useState)(() => { try {
        return localStorage.getItem('dsh-scm:tree-view') === 'true';
    }
    catch {
        return false;
    } });
    const [graphHeight, setGraphHeight] = (0, react_1.useState)(175), [limit, setLimit] = (0, react_1.useState)(60);
    const [groupDiff, setGroupDiff] = (0, react_1.useState)(null);
    const [versionDiff, setVersionDiff] = (0, react_1.useState)(null);
    const [commitDetail, setCommitDetail] = (0, react_1.useState)(null);
    const [expandedCommit, setExpandedCommit] = (0, react_1.useState)(null);
    const [commitLoading, setCommitLoading] = (0, react_1.useState)(false);
    const commitEpoch = (0, react_1.useRef)(0);
    const [diff, setDiff] = (0, react_1.useState)(null);
    const [menu, setMenu] = (0, react_1.useState)(null);
    const [submenu, setSubmenu] = (0, react_1.useState)(null);
    const [confirm, setConfirm] = (0, react_1.useState)(null);
    const [form, setForm] = (0, react_1.useState)(null);
    const [choices, setChoices] = (0, react_1.useState)(null);
    const [output, setOutput] = (0, react_1.useState)(null);
    const outputLog = (0, react_1.useRef)('');
    const [branchAction, setBranchAction] = (0, react_1.useState)('switch');
    const [fileSort, setFileSort] = (0, react_1.useState)(() => { try {
        const v = localStorage.getItem('dsh-scm:file-sort');
        return v === 'name' || v === 'status' ? v : 'path';
    }
    catch {
        return 'path';
    } });
    const [branches, setBranches] = (0, react_1.useState)(null), [filter, setFilter] = (0, react_1.useState)('');
    (0, react_1.useEffect)(() => { if (graphOnly)
        return; try {
        localStorage.setItem('dsh-scm:visible-sections', JSON.stringify(visibleSections));
        localStorage.setItem('dsh-scm:repo-sort', repoSort);
        localStorage.setItem('dsh-scm:tree-view', String(treeView));
        localStorage.setItem('dsh-scm:file-sort', fileSort);
    }
    catch { /* Storage is optional. */ } }, [visibleSections, repoSort, treeView, fileSort]);
    const memoryKey = () => sessionId + '|' + repoRef.current;
    function saveMessage(value) { setMessage(value); const old = paneMemory.get(memoryKey()); paneMemory.set(memoryKey(), { message: value, detail: old?.detail ?? commitDetail, height: old?.height ?? graphHeight }); }
    function restorePane() { const saved = paneMemory.get(memoryKey()); setMessage(saved?.message ?? ''); setCommitDetail(saved?.detail ?? null); setExpandedCommit(saved?.detail?.hash ?? null); setGraphHeight(saved?.height ?? 175); }
    const api = (op, fields = {}) => (0, api_js_1.call)(op, sessionId, { repo: repoRef.current || undefined, ...fields });
    const showError = (e) => setError(e instanceof Error ? e.message + ('detail' in e ? '\n' + String(e.detail) : '') : String(e));
    async function refresh(history = false) {
        if (inFlight.current || mutation.current)
            return;
        inFlight.current = true;
        const token = epoch.current, repo = repoRef.current, activeBranch = graphOnly ? graphBranchRef.current : '';
        try {
            const value = await api('status');
            if (epoch.current !== token || repo !== repoRef.current)
                return;
            setStatus(value.status);
            setContext(current => current ? { ...current, remotes: value.remotes } : current);
            if (history) {
                const log = await api('log', { limit, branch: activeBranch || undefined });
                if (epoch.current === token && repo === repoRef.current && (!graphOnly || activeBranch === graphBranchRef.current))
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
        graphBranchRef.current = '';
        setGraphBranch('');
        setGraphBranches([]);
        setLoaded(false);
        setContext(null);
        setCommitDetail(null);
        setExpandedCommit(null);
        ++commitEpoch.current;
        setStatus(null);
        setCommits([]);
        setDiff(null);
        setError('');
        setMenu(null);
        setConfirm(null);
        setForm(null);
        setChoices(null);
        setBranches(null);
        setOutput(null);
        setMessage('');
        setSelected([]);
        void api('context').then(async (c) => { if (epoch.current !== token)
            return; setContext(c); setLoaded(true); repoRef.current = c.isRepo ? (c.repos.find(r => r.path.replaceAll('\\', '/').toLowerCase() === c.repo.replaceAll('\\', '/').toLowerCase())?.path ?? c.repo) : c.repos[0]?.path ?? ''; restorePane(); if (repoRef.current) {
            await refresh(true);
            if (graphOnly) {
                const b = await api('branches');
                if (epoch.current === token)
                    setGraphBranches(b.branches);
            }
        } }).catch(e => { if (epoch.current === token) {
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
            const value = await api(op, fields);
            outputLog.current = (outputLog.current + `\n> ${op}\n` + (value.output ?? '完成') + '\n').slice(-50000);
            if (epoch.current === token)
                after?.(value);
        }
        catch (e) {
            if (epoch.current === token) {
                if (e instanceof api_js_1.ScmError && e.code === 'post-commit-failed')
                    saveMessage('');
                outputLog.current = (outputLog.current + `\n> ${op}\n` + String(e) + '\n' + (e instanceof api_js_1.ScmError ? e.detail : '')).slice(-50000);
                showError(e);
            }
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
        if (expandedCommit === commit.hash) {
            ++commitEpoch.current;
            setExpandedCommit(null);
            setCommitDetail(null);
            setCommitLoading(false);
            const saved = paneMemory.get(memoryKey());
            if (saved)
                paneMemory.set(memoryKey(), { ...saved, detail: null });
            return;
        }
        setExpandedCommit(commit.hash);
        const token = ++commitEpoch.current, repo = repoRef.current;
        setCommitLoading(true);
        setCommitDetail(null);
        try {
            const value = await api('commit-files', { base: commit.hash });
            if (token === commitEpoch.current && repo === repoRef.current) {
                setCommitDetail(value);
                const saved = paneMemory.get(memoryKey());
                paneMemory.set(memoryKey(), { message: saved?.message ?? message, detail: value, height: graphHeight });
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
        setSubmenu(null);
        setMenu({ x: Math.max(4, Math.min(event.clientX - box.left, box.width - 210)), y: Math.max(4, Math.min(event.clientY - box.top, box.height - items.length * 30 - 12)), items });
    }
    function showSubmenu(item, element) {
        const box = root.current?.getBoundingClientRect(), rect = element.getBoundingClientRect();
        if (!box || !menu || !item.children || box.width < 390)
            return false;
        const width = 180, left = menu.x >= width ? menu.x - width + 2 : menu.x + 180;
        setSubmenu({ x: Math.max(4, Math.min(left, box.width - width - 4)), y: Math.max(4, Math.min(rect.top - box.top, box.height - item.children.length * 30 - 8)), items: item.children, label: item.label });
        return true;
    }
    const changes = [...(status?.unstaged ?? []), ...(status?.untracked ?? [])];
    const stage = (files, staged) => void run(staged ? 'unstage' : 'stage', { files: [...new Set(files.flatMap(f => f.from ? [f.from, f.path] : [f.path]))] }, () => { setSelected([]); setDiff(null); });
    function discard(files) {
        const paths = [...new Set(files.flatMap(path => { const entry = changes.find(f => f.path === path); return entry?.from ? [entry.from, path] : [path]; }))];
        const repo = repoRef.current, token = epoch.current;
        setMenu(null);
        setConfirm({ text: `确定要放弃以下 ${paths.length} 个文件的未暂存更改吗？已暂存内容会保留；未跟踪文件将被删除。此操作无法通过 Git 撤销。\n\n${paths.join('\n')}`, run: () => {
                setConfirm(null);
                if (token !== epoch.current || repo !== repoRef.current) {
                    setError('工作区已切换，请重新选择需要放弃的文件。');
                    return;
                }
                void run('discard', { files: paths, confirm: true }, () => { setSelected([]); setDiff(null); });
            } });
    }
    function commit(mode = 'normal', overrideMessage) {
        setMenu(null);
        const commitMessage = overrideMessage ?? message;
        if (!commitMessage.trim() || busy) {
            if (!commitMessage.trim())
                root.current?.querySelector('textarea')?.focus();
            return;
        }
        if ((mode === 'push' || mode === 'sync') && !status?.upstream) {
            setError('当前分支没有上游分支，请先发布分支。');
            return;
        }
        const token = epoch.current, repo = repoRef.current;
        const perform = (stageAll) => {
            if (token !== epoch.current || repo !== repoRef.current) {
                setError('工作区已切换，请重新提交。');
                return;
            }
            const fields = { message: commitMessage, mode: mode === 'normal' ? undefined : mode, confirm: mode === 'amend' || stageAll };
            if (stageAll)
                fields.files = changes.flatMap(f => f.from ? [f.from, f.path] : [f.path]);
            void run('commit', fields, () => saveMessage(''));
        };
        if (mode === 'amend') {
            setConfirm({ text: '这会修改最近一次提交并改写提交历史。确认继续？', run: () => { setConfirm(null); perform(false); } });
            return;
        }
        if (!status?.staged.length) {
            if (changes.length)
                setConfirm({ text: '没有暂存的更改。是否暂存所有更改并提交？', run: () => { setConfirm(null); perform(true); } });
            return;
        }
        perform(false);
    }
    function ask(title, labels, submit) { const token = epoch.current, repo = repoRef.current; setMenu(null); setForm({ title, labels, values: labels.map(() => ''), submit: values => { if (token !== epoch.current || repo !== repoRef.current) {
            setError('工作区已切换，请重新操作。');
            return;
        } submit(values); } }); }
    function confirmRun(text, fn) { setMenu(null); const repo = repoRef.current, token = epoch.current; setConfirm({ text, run: () => { setConfirm(null); if (repo !== repoRef.current || token !== epoch.current) {
            setError('工作区已切换，请重新操作。');
            return;
        } fn(); } }); }
    function pickBranch(action) { const token = epoch.current, repo = repoRef.current; setMenu(null); setBranchAction(action); setFilter(''); void api('branches').then(v => { if (token === epoch.current && repo === repoRef.current)
        setBranches(v.branches); }).catch(showError); }
    function pickStash(op) { const token = epoch.current, repo = repoRef.current; setMenu(null); void api('stash-list').then(v => { if (token !== epoch.current || repo !== repoRef.current)
        return; setChoices({ title: '选择存储', items: v.items.map(item => ({ label: `${item.id} ${item.label}`, run: () => { setChoices(null); if (op === 'stash-drop')
                confirmRun(`删除 ${item.id}？`, () => void run(op, { name: item.id, confirm: true }));
            else
                void run(op, { name: item.id, confirm: true }); } })) }); }).catch(showError); }
    function pickTag() { const token = epoch.current, repo = repoRef.current; setMenu(null); void api('tag-list').then(v => { if (token !== epoch.current || repo !== repoRef.current)
        return; setChoices({ title: '选择要删除的标记', items: v.items.map(tag => ({ label: tag, run: () => { setChoices(null); confirmRun(`删除本地标记 ${tag}？`, () => void run('tag-delete', { name: tag, confirm: true })); } })) }); }).catch(showError); }
    function pushAction() { if (status?.upstream)
        void run('push', { confirm: true });
    else
        confirmRun(`发布分支 ${status?.branch} 到 ${context?.remotes[0] ?? 'origin'}？`, () => void run('push', { confirm: true, setUpstream: true, branch: status?.branch, remote: context?.remotes[0] ?? 'origin' })); }
    function menuItem(label, children) { return { label, children }; }
    function startAmend() {
        setMenu(null);
        if (message.trim()) {
            commit('amend');
            return;
        }
        const token = epoch.current, repo = repoRef.current;
        void api('head-message').then(value => { if (token !== epoch.current || repo !== repoRef.current)
            return; setForm({ title: '提交(修改)', labels: ['提交消息'], values: [value.message], submit: values => { if (token !== epoch.current || repo !== repoRef.current) {
                setError('工作区已切换，请重新操作。');
                return;
            } saveMessage(values[0] ?? ''); commit('amend', values[0] ?? ''); } }); }).catch(showError);
    }
    function remoteItems() {
        return [
            { label: '拉取', run: () => void run('pull') }, { label: '推送', run: pushAction },
            { label: '克隆', run: () => ask('克隆仓库到当前工作区', ['仓库地址', '新目录名称'], v => void run('clone', { base: v[0], name: v[1] }, result => setOutput(`克隆完成：${result.path ?? ''}`))) },
            { label: '签出到…', run: () => pickBranch('switch') }, { label: '抓取', run: () => void run('fetch') },
            { label: '', separator: true },
            menuItem('提交', [{ label: '提交', run: () => commit() }, { label: '提交（修改）', run: startAmend }, { label: '提交和推送', run: () => commit('push') }, { label: '提交和同步', run: () => commit('sync') }, { label: '撤销上次提交…', run: () => confirmRun('撤销最近一次提交并保留暂存内容？', () => void run('undo-commit', { confirm: true })) }]),
            menuItem('更改', [{ label: '打开更改', run: () => { setMenu(null); viewAll(changes, false, '更改'); }, disabled: !changes.length }, { label: '暂存所有更改', run: () => stage(changes, false), disabled: !changes.length }, { label: '取消暂存所有更改', run: () => stage(status?.staged ?? [], true), disabled: !status?.staged.length }, { label: '放弃所有更改…', run: () => discard(changes.map(f => f.path)), disabled: !changes.length }]),
            menuItem('拉取，推送', [{ label: '拉取', run: () => void run('pull') }, { label: '推送', run: pushAction }, { label: '同步', run: () => void run('sync') }, { label: '拉取（变基）…', run: () => confirmRun('拉取并变基会改写本地提交，确认继续？', () => void run('pull', { mode: 'rebase' })) }, { label: '抓取', run: () => void run('fetch') }, { label: '抓取并清理失效引用', run: () => void run('fetch', { mode: 'prune' }) }, { label: '抓取所有远程', run: () => void run('fetch', { mode: 'all' }) }]),
            menuItem('分支', [{ label: '签出到…', run: () => pickBranch('switch') }, { label: '创建分支…', run: () => { setMenu(null); setBranchAction('switch'); setBranches([]); setFilter(''); } }, { label: '合并分支…', run: () => pickBranch('merge') }, { label: '删除分支…', run: () => pickBranch('delete') }]),
            menuItem('远程', [{ label: '添加远程…', run: () => ask('添加远程', ['名称', 'Git 地址'], v => void run('remote-add', { name: v[0], base: v[1] }, () => void refresh(true))) }, { label: '删除远程…', run: () => { setMenu(null); setChoices({ title: '选择远程', items: (context?.remotes ?? []).map(remote => ({ label: remote, run: () => { setChoices(null); confirmRun(`删除远程 ${remote}？`, () => void run('remote-remove', { name: remote, confirm: true })); } })) }); } }]),
            menuItem('存储', [{ label: '存储', run: () => void run('stash-save') }, { label: '存储（包括未跟踪文件）', run: () => void run('stash-save', { mode: 'untracked' }) }, { label: '存储已暂存的更改', run: () => void run('stash-save', { mode: 'staged' }) }, { label: '应用存储…', run: () => pickStash('stash-apply') }, { label: '弹出存储…', run: () => pickStash('stash-pop') }, { label: '删除存储…', run: () => pickStash('stash-drop') }]),
            menuItem('标记', [{ label: '创建标记…', run: () => ask('创建标记', ['标记名称'], v => void run('tag-create', { name: v[0] })) }, { label: '删除标记…', run: pickTag }, { label: '推送标记…', run: () => confirmRun('将本地标记推送到远程？', () => void run('push-tags', { confirm: true })) }]),
            menuItem('工作树', [{ label: '创建工作树…', run: () => ask('创建工作树', ['名称'], v => void run('worktree-add', { name: v[0] }, result => setOutput(`工作树已创建：${result.path ?? ''}`))) }, { label: '查看工作树…', run: () => { setMenu(null); void api('worktree-list').then(v => setChoices({ title: '工作树', items: v.worktrees.map(w => ({ label: `${w.path} ${w.branch ?? ''}${w.main ? '（主工作树）' : ''}`, disabled: w.main, run: () => { if (w.main)
                                return; setChoices(null); confirmRun(`删除工作树 ${w.path}？`, () => void run('worktree-remove', { worktree: w.path, confirm: true })); } })) })).catch(showError); } }]),
            { label: '', separator: true }, { label: '显示 GIT 输出', run: () => { setMenu(null); setOutput(outputLog.current || '暂无 Git 操作输出。'); } }
        ];
    }
    function row(file, staged, conflict = false, depth = 0) {
        const name = file.path.split('/').pop(), dir = file.path.slice(0, Math.max(0, file.path.length - name.length - 1)), code = conflict ? '!' : file.code === '??' ? 'U' : (staged ? file.code[0] : file.code[1]) || 'M';
        const active = selected.some(s => s.path === file.path && s.staged === staged);
        const items = () => {
            const group = active ? selected.filter(s => s.staged === staged).map(s => s.path) : [file.path];
            return [{ label: '打开更改', run: () => { setMenu(null); void openFile(file.path, staged); } }, { label: '打开文件', disabled: code === 'D', run: () => { setMenu(null); try {
                        if (!(0, navigation_js_1.openWorkspaceFile)(repoRef.current, file.path, sessionId))
                            setError('当前 DSH 未提供文件打开服务。');
                    }
                    catch (error) {
                        showError(error);
                    } } }, { label: staged ? '取消暂存更改' : '暂存更改', run: () => stage(group.map(path => ({ path, code: '' })), staged) }, ...(!staged ? [{ label: '放弃更改…', run: () => discard(group) }] : [])];
        };
        return (0, react_1.createElement)('div', { key: `${staged}:${file.path}`, role: 'option', 'aria-selected': active, tabIndex: 0, className: `vscm-file ${active ? 'selected' : ''}`, 'data-code': code, style: treeView ? { paddingLeft: 22 + depth * 12 } : undefined, title: file.from ? `${file.from} → ${file.path}` : file.path,
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
            } } }, (0, react_1.createElement)('span', { className: 'file-icon' }, icon('file')), (0, react_1.createElement)('span', { className: 'vscm-name' }, name), (0, react_1.createElement)('span', { className: 'vscm-dir' }, treeView ? '' : dir), (0, react_1.createElement)('span', { className: 'actions' }, button('openFile', '打开文件', e => { e.stopPropagation(); try {
            if (!(0, navigation_js_1.openWorkspaceFile)(repoRef.current, file.path, sessionId))
                setError('当前 DSH 未提供文件打开服务。');
        }
        catch (error) {
            showError(error);
        } }, busy || code === 'D'), ...(!staged ? [button('discard', '放弃更改', e => { e.stopPropagation(); discard([file.path]); })] : []), button(staged ? 'minus' : 'plus', staged ? '取消暂存更改' : '暂存更改', e => { e.stopPropagation(); stage([file], staged); })), (0, react_1.createElement)('span', { className: 'vscm-status' }, code));
    }
    function viewAll(files, staged, title) {
        const request = { title, files: files.map(f => ({ repo: repoRef.current, file: f.path, from: f.from, staged })) };
        if (!(0, multiDiff_js_1.openGroupDiffTab)(request))
            setGroupDiff(request);
    }
    function treeRows(files, staged, conflict, prefix = '') {
        const remaining = files.filter(f => f.path.startsWith(prefix));
        const immediate = remaining.filter(f => !f.path.slice(prefix.length).includes('/'));
        const folders = [...new Set(remaining.map(f => f.path.slice(prefix.length)).filter(p => p.includes('/')).map(p => p.split('/')[0]))].sort((a, b) => a.localeCompare(b));
        return [...folders.flatMap(folder => { const path = prefix + folder + '/', children = remaining.filter(f => f.path.startsWith(path)), key = 'folder:' + staged + ':' + path; return [(0, react_1.createElement)('div', { key, className: 'vscm-file', style: { paddingLeft: 22 + prefix.split('/').filter(Boolean).length * 12 }, role: 'treeitem', 'aria-expanded': !collapsed[key], tabIndex: 0, onKeyDown: (event) => { if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        toggle(key);
                    } }, onClick: () => toggle(key) }, (0, react_1.createElement)('span', { className: `arrow ${collapsed[key] ? 'closed' : ''}` }, icon('chevron')), (0, react_1.createElement)('span', { className: 'file-icon' }, icon('folder')), (0, react_1.createElement)('span', { className: 'vscm-name' }, folder), (0, react_1.createElement)('span', { className: 'vscm-dir' }), (0, react_1.createElement)('span', { className: 'actions' }, ...(!staged && !conflict ? [button('discard', '放弃此文件夹的更改', event => { event.stopPropagation(); discard(children.map(f => f.path)); })] : []), button(staged ? 'minus' : 'plus', staged ? '取消暂存此文件夹' : '暂存此文件夹', event => { event.stopPropagation(); stage(children, staged); })), (0, react_1.createElement)('span', { className: 'vscm-count' }, children.length)), ...(!collapsed[key] ? treeRows(children, staged, conflict, path) : [])]; }), ...immediate.map(f => row(f, staged, conflict, prefix.split('/').filter(Boolean).length))];
    }
    function group(title, key, files, staged, conflict = false) {
        if (!files.length)
            return null;
        return (0, react_1.createElement)('div', { key }, (0, react_1.createElement)('div', { className: 'vscm-group' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed[key] ? 'closed' : ''}`, onClick: () => toggle(key) }, icon('chevron')), (0, react_1.createElement)('span', { className: 'label', onClick: () => toggle(key) }, title), ...(!conflict ? [button('diffMultiple', staged ? '打开暂存的更改' : '打开更改', () => viewAll(files, staged, title)), ...(!staged ? [button('discard', '放弃所有更改', () => discard([...new Set(files.map(f => f.path))]))] : [])] : []), button(staged ? 'minus' : 'plus', staged ? '取消暂存所有更改' : '暂存所有更改', () => stage(files, staged)), (0, react_1.createElement)('span', { className: 'vscm-count' }, files.length)), ...(!collapsed[key] ? (() => { const ordered = [...files].sort((a, b) => fileSort === 'name' ? (a.path.split('/').pop() ?? '').localeCompare(b.path.split('/').pop() ?? '') : fileSort === 'status' ? a.code.localeCompare(b.code) || a.path.localeCompare(b.path) : a.path.localeCompare(b.path)); return treeView ? treeRows(ordered, staged, conflict) : ordered.map(f => row(f, staged, conflict)); })() : []));
    }
    const graph = (0, graph_js_1.graphRows)(commits);
    function renderCommit(commit, i) {
        const g = graph[i], colors = ['#4ea1ff', '#bb87e0', '#e2b05c', '#6cceac'];
        const expanded = expandedCommit === commit.hash;
        const detail = commitDetail?.hash === commit.hash ? commitDetail : null;
        const x = g.lane * 12 + 12;
        const row = (0, react_1.createElement)('div', { className: `vscm-graphrow ${expanded ? 'selected' : ''}`, role: 'button', tabIndex: 0, 'aria-expanded': expanded,
            title: `${commit.subject}\n${commit.author} · ${commit.date} · ${commit.hash}`,
            onClick: () => void selectCommit(commit), onKeyDown: (e) => { if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                void selectCommit(commit);
            } } }, (0, react_1.createElement)('svg', { width: g.width * 12 + 12, height: 24, viewBox: `0 0 ${g.width * 12 + 12} 24` }, g.incoming ? (0, react_1.createElement)('path', { d: `M ${x} 0 V 8`, stroke: colors[g.lane % 4], strokeWidth: 1.4 }) : null, ...g.edges.map((edge, j) => (0, react_1.createElement)('path', { key: j, d: `M ${edge.from * 12 + 12} ${edge.from === g.lane ? 17 : 0} C ${edge.from * 12 + 12} 20 ${edge.to * 12 + 12} 16 ${edge.to * 12 + 12} 24`, stroke: colors[edge.from % 4], fill: 'none', strokeWidth: 1.4 })), (0, react_1.createElement)('circle', { cx: x, cy: 12, r: i === 0 ? 4.5 : 3, fill: i === 0 ? 'none' : colors[g.lane % 4], stroke: colors[g.lane % 4], strokeWidth: 1.5 })), (0, react_1.createElement)('span', { className: 'vscm-subject' }, commit.subject), commit.refs ? (0, react_1.createElement)('span', { className: 'vscm-ref' }, commit.refs.replace('HEAD -> ', '')) : null, (0, react_1.createElement)('span', { className: 'vscm-date' }, commit.date));
        const fileList = expanded ? (0, react_1.createElement)('div', { className: 'vscm-commitfiles', 'data-commit-files': commit.hash }, ...g.edges.filter((edge, j, all) => all.findIndex(other => other.to === edge.to) === j).map(edge => (0, react_1.createElement)('span', { key: `spine-${edge.to}`, className: 'vscm-graph-spine', 'aria-hidden': true, style: { left: edge.to * 12 + 12, borderColor: colors[edge.from % 4] } })), commitLoading ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '正在读取提交文件…') : null, ...(detail?.files ?? []).map(file => (0, react_1.createElement)('div', { key: file.path, className: 'vscm-file', tabIndex: 0, role: 'button', style: { paddingLeft: g.width * 12 + 14 }, title: file.from ? `${file.from} → ${file.path}` : file.path,
            onClick: () => showVersions({ repo: repoRef.current, file: file.path, hash: commit.hash, from: file.from }),
            onKeyDown: (e) => { if (e.key === 'Enter')
                showVersions({ repo: repoRef.current, file: file.path, hash: commit.hash, from: file.from }); } }, (0, react_1.createElement)('span', { className: 'file-icon' }, icon('file')), (0, react_1.createElement)('span', { className: 'vscm-name' }, file.path.split('/').pop()), (0, react_1.createElement)('span', { className: 'vscm-dir' }, file.path.includes('/') ? file.path.slice(0, file.path.lastIndexOf('/')) : ''), (0, react_1.createElement)('span', { className: 'vscm-status' }, file.code))), detail && detail.files.length === 0 ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '此提交没有文件更改。') : null) : null;
        return (0, react_1.createElement)('div', { key: commit.hash, 'data-commit': commit.hash }, row, fileList);
    }
    function closeDiff() { ++diffEpoch.current; setDiff(null); }
    return (0, react_1.createElement)('div', { className: 'vscm', ref: root, onKeyDown: (e) => { if (e.key === 'Escape') {
            setMenu(null);
            setConfirm(null);
            setBranches(null);
            setForm(null);
            setChoices(null);
            setOutput(null);
            closeDiff();
        } if (e.key === 'F5') {
            e.preventDefault();
            void refresh(true);
        } }, onClick: () => { if (menu)
            setMenu(null); } }, (0, react_1.createElement)('style', null, css), busy ? (0, react_1.createElement)('div', { className: 'vscm-busy' }) : null, (0, react_1.createElement)('div', { className: 'vscm-title' }, graphOnly ? 'Git 图表' : '源代码管理', graphOnly ? null : button('more', '显示区域', e => openMenu(e, ([{ key: 'repos', label: '存储库' }, { key: 'changes', label: '更改' }, { key: 'graph', label: '图表' }]).map(item => ({ label: (visibleSections[item.key] ? '✓  ' : '　 ') + item.label, run: () => { setVisibleSections(v => ({ ...v, [item.key]: !v[item.key] })); setMenu(null); } }))))), error ? (0, react_1.createElement)('div', { className: 'vscm-error', role: 'alert' }, error, button('close', '关闭错误', () => setError(''))) : null, visibleSections.repos ? (0, react_1.createElement)('div', { className: 'vscm-repos' }, (0, react_1.createElement)('div', { className: 'vscm-section' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed.repos ? 'closed' : ''}`, onClick: () => toggle('repos') }, icon('chevron')), (0, react_1.createElement)('span', { onClick: () => toggle('repos') }, '存储库'), button('more', '存储库排序', e => openMenu(e, [{ label: '按发现时间排序', value: 'discovery' }, { label: '按路径排序', value: 'path' }, { label: '按名称排序', value: 'name' }].map(option => ({ label: (repoSort === option.value ? '✓  ' : '　 ') + option.label, run: () => { setRepoSort(option.value); setMenu(null); } }))))), ...(!collapsed.repos ? [...(context?.repos ?? [])].sort((a, b) => repoSort === 'discovery' ? 0 : repoSort === 'path' ? a.path.localeCompare(b.path) : a.name.localeCompare(b.name)).map(repo => (0, react_1.createElement)('div', { key: repo.path, className: `vscm-repo ${repoRef.current === repo.path ? 'active' : ''}`, title: repo.path, onClick: () => { if (mutation.current)
            return; ++epoch.current; repoRef.current = repo.path; setMenu(null); setConfirm(null); setForm(null); setChoices(null); setBranches(null); setOutput(null); setStatus(null); setCommitDetail(null); setExpandedCommit(null); ++commitEpoch.current; setDiff(null); setCommits([]); restorePane(); setSelected([]); inFlight.current = false; void refresh(true); } }, icon('folder'), (0, react_1.createElement)('span', { className: 'vscm-repo-name' }, repo.name.split(/[\\/]/).pop()), (0, react_1.createElement)('button', { className: 'vscm-branch', disabled: busy || repoRef.current !== repo.path, onClick: (e) => { e.stopPropagation(); setFilter(''); void api('branches', { repo: repo.path }).then(v => setBranches(v.branches)).catch(showError); } }, icon('branch'), repoRef.current === repo.path ? status?.branch : repo.branch), button('sync', '同步更改', e => { e.stopPropagation(); void run('sync'); }, busy || repoRef.current !== repo.path || !status?.upstream), button('more', '存储库操作', e => { e.stopPropagation(); if (repoRef.current === repo.path)
        openMenu(e, remoteItems()); }, busy || repoRef.current !== repo.path))) : [])) : null, visibleSections.changes ? (0, react_1.createElement)('div', { className: 'vscm-changes' }, (0, react_1.createElement)('div', { className: 'vscm-section' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed.changes ? 'closed' : ''}`, onClick: () => toggle('changes') }, icon('chevron')), (0, react_1.createElement)('span', { onClick: () => toggle('changes') }, '更改'), button('check', '提交', () => commit()), button('refresh', '刷新', () => void refresh(true)), button('graph', '查看 Git 图表', () => { if (!(0, navigation_js_1.openGraphTab)())
        setError('当前 DSH 无法打开 Git 图表。'); }), button('more', '更多操作', e => openMenu(e, [{ label: treeView ? '以列表形式查看' : '以树形形式查看', run: () => { setTreeView(v => !v); setMenu(null); } }, menuItem('查看和排序', [{ label: (fileSort === 'path' ? '✓  ' : '　 ') + '按路径排序', run: () => { setFileSort('path'); setMenu(null); } }, { label: (fileSort === 'name' ? '✓  ' : '　 ') + '按名称排序', run: () => { setFileSort('name'); setMenu(null); } }, { label: (fileSort === 'status' ? '✓  ' : '　 ') + '按状态排序', run: () => { setFileSort('status'); setMenu(null); } }]), { label: '', separator: true }, ...remoteItems()]))), !collapsed.changes ? (0, react_1.createElement)('div', { className: 'vscm-compose' }, (0, react_1.createElement)('textarea', { className: 'vscm-input', rows: 1, 'aria-label': '提交消息', placeholder: `消息(Ctrl+Enter 在“${status?.branch ?? ''}”提交)`, value: message, onChange: (e) => saveMessage(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            commit();
        } } }), (0, react_1.createElement)('div', { className: 'vscm-commitrow' }, (0, react_1.createElement)('button', { type: 'button', className: 'vscm-commit', disabled: busy || !message.trim() || !status || status.conflicts.length > 0, onClick: () => commit() }, icon('check'), '提交'), (0, react_1.createElement)('button', { className: 'vscm-drop', title: '提交操作', onClick: (e) => openMenu(e, [{ label: '提交', run: () => commit() }, { label: '提交(修改)', run: startAmend }, { label: '提交和推送', run: () => commit('push') }, { label: '提交和同步', run: () => commit('sync') }]) }, '⌄'))) : null, !collapsed.changes ? (0, react_1.createElement)('div', { className: 'vscm-list', role: 'listbox', 'aria-multiselectable': true, 'aria-label': '更改的文件' }, group('合并更改', 'conflicts', status?.conflicts ?? [], false, true), group('暂存的更改', 'staged', status?.staged ?? [], true), group('更改', 'unstaged', changes, false), status && changes.length === 0 && status.staged.length === 0 && status.conflicts.length === 0 ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '没有更改。') : null, !context ? (0, react_1.createElement)('div', { className: 'vscm-note' }, loaded ? '未能读取工作区，请查看上方错误。' : '正在读取工作区…') : context.repos.length === 0 ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '请在当前 DSH 会话中打开一个 Git 项目。') : null) : null) : null, visibleSections.graph && visibleSections.changes ? (0, react_1.createElement)('div', { className: 'vscm-resizer', role: 'separator', 'aria-label': '调整图表高度', onPointerDown: (e) => { e.preventDefault(); const start = e.clientY, initial = graphHeight; const move = (ev) => setGraphHeight(Math.max(80, Math.min((root.current?.clientHeight ?? 600) - 160, initial + start - ev.clientY))); const end = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', end); }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', end); } }) : null, visibleSections.graph ? (0, react_1.createElement)('div', { className: 'vscm-history', style: { height: graphOnly ? 'auto' : collapsed.graph ? 26 : graphHeight, flex: graphOnly ? 1 : undefined } }, (0, react_1.createElement)('div', { className: 'vscm-section' }, (0, react_1.createElement)('span', { className: `arrow ${collapsed.graph ? 'closed' : ''}`, onClick: () => toggle('graph') }, icon('chevron')), (0, react_1.createElement)('span', { onClick: () => toggle('graph') }, '图表'), graphOnly ? (0, react_1.createElement)('select', { 'aria-label': '图表分支', value: graphBranch, onChange: (e) => { const branch = e.target.value, token = epoch.current, repo = repoRef.current; graphBranchRef.current = branch; setGraphBranch(branch); void api('log', { limit, branch: branch || undefined }).then(v => { if (token === epoch.current && repo === repoRef.current && branch === graphBranchRef.current)
            setCommits(v.commits); }).catch(showError); }, style: { maxWidth: 160, background: 'transparent', color: 'inherit' } }, (0, react_1.createElement)('option', { value: '' }, '所有分支'), ...graphBranches.filter(b => !b.remote).map(b => (0, react_1.createElement)('option', { key: b.name, value: b.name }, b.name))) : null, (0, react_1.createElement)('span', { title: status?.upstream ?? '尚未设置上游', style: { fontSize: 11, color: '#a9bbdf' } }, `${status?.behind ?? 0}↓ ${status?.ahead ?? 0}↑`), button('down', '拉取', () => void run('pull')), button('up', status?.upstream ? '推送' : '发布分支', () => remoteItems()[1].run?.()), button('refresh', '刷新图表', () => void refresh(true)), button('more', '图表操作', e => openMenu(e, [{ label: '加载更多提交', run: () => { setMenu(null); setLimit(n => Math.min(200, n + 60)); void api('log', { limit: Math.min(200, limit + 60), branch: graphOnly ? (graphBranch || undefined) : undefined }).then(v => setCommits(v.commits)).catch(showError); } }, ...remoteItems()]))), !collapsed.graph ? (0, react_1.createElement)('div', { className: 'vscm-graphrows' }, ...(graphOnly && ((status?.staged.length ?? 0) + changes.length) > 0 ? [(0, react_1.createElement)('div', { key: 'uncommitted', className: 'vscm-graphrow', role: 'button', tabIndex: 0, onClick: () => { const request = { title: '未提交的更改', files: [...(status?.staged ?? []).map(f => ({ repo: repoRef.current, file: f.path, from: f.from, staged: true })), ...changes.map(f => ({ repo: repoRef.current, file: f.path, from: f.from, staged: false }))] }; if (!(0, multiDiff_js_1.openGroupDiffTab)(request))
                setGroupDiff(request); } }, (0, react_1.createElement)('span', { style: { width: 24, textAlign: 'center', color: '#4ea1ff' } }, '●'), (0, react_1.createElement)('span', { className: 'vscm-subject' }, '未提交的更改'), (0, react_1.createElement)('span', { className: 'vscm-count' }, (status?.staged.length ?? 0) + changes.length))] : []), ...commits.map(renderCommit), commits.length === 0 ? (0, react_1.createElement)('div', { className: 'vscm-note' }, '暂无提交。') : null) : null) : null, groupDiff ? (0, react_1.createElement)('div', { className: 'vscm-overlay' }, (0, react_1.createElement)(multiDiff_js_1.MultiDiff, { sessionId, request: groupDiff, onClose: () => setGroupDiff(null) })) : null, versionDiff ? (0, react_1.createElement)('div', { className: 'vscm-overlay' }, (0, react_1.createElement)(diffEditor_js_1.VersionDiff, { sessionId, request: versionDiff, onClose: () => setVersionDiff(null) })) : null, diff ? (0, react_1.createElement)('div', { className: 'vscm-overlay' }, (0, react_1.createElement)('div', { className: 'vscm-difftop' }, button('close', '返回源代码管理', closeDiff), (0, react_1.createElement)('span', { className: 'name' }, diff.title), diff.selection ? button(diff.selection.staged ? 'minus' : 'plus', diff.selection.staged ? '取消暂存更改' : '暂存更改', () => stage([{ path: diff.selection.path, code: '' }], diff.selection.staged)) : null), (0, react_1.createElement)('div', { className: 'vscm-diff' }, ...diff.text.slice(0, 512 * 1024).split('\n').slice(0, 6000).map((line, i) => (0, react_1.createElement)('span', { key: i, className: `vscm-line ${line.startsWith('@@') ? 'hunk' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : ''}` }, line || ' ')))) : null, menu ? (0, react_1.createElement)('div', { className: 'vscm-menu', role: 'menu', style: { left: menu.x, top: menu.y }, onClick: (e) => e.stopPropagation() }, ...menu.items.map((item, i) => item.separator ? (0, react_1.createElement)('div', { key: i, role: 'separator', style: { borderTop: '1px solid var(--border)', margin: '4px 0' } }) : (0, react_1.createElement)('button', { key: i, role: 'menuitem', 'aria-haspopup': item.children ? 'menu' : undefined, 'aria-expanded': item.children ? submenu?.label === item.label : undefined, disabled: item.disabled || busy, onMouseEnter: (e) => { if (item.children)
            showSubmenu(item, e.currentTarget);
        else
            setSubmenu(null); }, onFocus: (e) => { if (item.children)
            showSubmenu(item, e.currentTarget); }, onClick: (e) => { if (item.children) {
            if (!showSubmenu(item, e.currentTarget))
                setMenu({ ...menu, items: [{ label: '‹ 返回', run: () => setMenu({ ...menu, items: menu.items }) }, ...item.children] });
        }
        else
            item.run?.(); } }, item.label, item.children ? (0, react_1.createElement)('span', { style: { float: 'right' } }, '›') : null))) : null, menu && submenu ? (0, react_1.createElement)('div', { className: 'vscm-menu', role: 'menu', 'aria-label': submenu.label, style: { left: submenu.x, top: submenu.y, zIndex: 61 }, onClick: (e) => e.stopPropagation() }, ...submenu.items.map((item, i) => (0, react_1.createElement)('button', { key: i, role: 'menuitem', disabled: item.disabled || busy, onClick: () => { setSubmenu(null); item.run?.(); } }, item.label))) : null, confirm ? (0, react_1.createElement)('div', { className: 'vscm-modalshade' }, (0, react_1.createElement)('div', { className: 'vscm-modal', role: 'alertdialog', 'aria-modal': true, 'aria-label': '确认 Git 操作' }, (0, react_1.createElement)('strong', null, '源代码管理'), (0, react_1.createElement)('p', null, confirm.text), (0, react_1.createElement)('footer', null, (0, react_1.createElement)('button', { onClick: () => setConfirm(null) }, '取消'), (0, react_1.createElement)('button', { onClick: confirm.run }, '确定')))) : null, form ? (0, react_1.createElement)('div', { className: 'vscm-modalshade' }, (0, react_1.createElement)('div', { className: 'vscm-modal', role: 'dialog', 'aria-label': form.title }, (0, react_1.createElement)('strong', null, form.title), ...form.labels.map((label, i) => (0, react_1.createElement)('label', { key: i, style: { display: 'block', marginTop: 8 } }, label, (0, react_1.createElement)(label === '提交消息' ? 'textarea' : 'input', { className: 'vscm-input', value: form.values[i], onChange: (e) => setForm(old => old ? { ...old, values: old.values.map((v, j) => j === i ? e.target.value : v) } : null) }))), (0, react_1.createElement)('footer', null, (0, react_1.createElement)('button', { onClick: () => setForm(null) }, '取消'), (0, react_1.createElement)('button', { disabled: form.values.some(v => !v.trim()), onClick: () => { const f = form; setForm(null); f.submit(f.values); } }, '确定')))) : null, choices ? (0, react_1.createElement)('div', { className: 'vscm-modalshade' }, (0, react_1.createElement)('div', { className: 'vscm-modal', role: 'dialog', 'aria-label': choices.title }, (0, react_1.createElement)('strong', null, choices.title), (0, react_1.createElement)('div', { className: 'vscm-picker' }, ...(choices.items.length ? choices.items.map((item, i) => (0, react_1.createElement)('button', { key: i, disabled: item.disabled, onClick: item.run }, item.label)) : [(0, react_1.createElement)('p', { key: 'empty' }, '没有可选项目。')])), (0, react_1.createElement)('footer', null, (0, react_1.createElement)('button', { onClick: () => setChoices(null) }, '关闭')))) : null, output !== null ? (0, react_1.createElement)('div', { className: 'vscm-modalshade' }, (0, react_1.createElement)('div', { className: 'vscm-modal', role: 'dialog', 'aria-label': 'GIT 输出' }, (0, react_1.createElement)('strong', null, 'GIT 输出'), (0, react_1.createElement)('pre', { style: { whiteSpace: 'pre-wrap', overflow: 'auto', maxHeight: 350 } }, output), (0, react_1.createElement)('footer', null, (0, react_1.createElement)('button', { onClick: () => setOutput(null) }, '关闭')))) : null, branches ? (0, react_1.createElement)('div', { className: 'vscm-modalshade' }, (0, react_1.createElement)('div', { className: 'vscm-modal', role: 'dialog', 'aria-label': '选择分支' }, (0, react_1.createElement)('div', { style: { display: 'flex', justifyContent: 'space-between' } }, (0, react_1.createElement)('strong', null, branches.length ? '选择要签出的分支' : '创建分支'), button('close', '关闭', () => { setBranches(null); setFilter(''); })), (0, react_1.createElement)('input', { className: 'vscm-input', autoFocus: true, placeholder: branches.length ? '搜索分支…' : '新分支名称', value: filter, onChange: (e) => setFilter(e.target.value), onKeyDown: (e) => { if (e.key === 'Enter' && !branches.length && filter.trim()) {
            void run('branch-create', { name: filter.trim() }, () => { setBranches(null); setFilter(''); });
        } } }), branches.length ? (0, react_1.createElement)('div', { className: 'vscm-picker' }, ...branches.filter(b => b.name.toLowerCase().includes(filter.toLowerCase())).map(b => (0, react_1.createElement)('button', { key: b.name, disabled: busy, onClick: () => { setBranches(null); setFilter(''); if (branchAction === 'merge')
            void run('merge', { branch: b.name });
        else if (branchAction === 'delete')
            confirmRun(`删除分支 ${b.name}？`, () => void run('branch-delete', { name: b.name, confirm: true }));
        else
            void run('switch', { branch: b.name, track: b.remote }); } }, `${b.current ? '✓ ' : ''}${b.name}   ${b.shortHash}`))) : (0, react_1.createElement)('footer', null, (0, react_1.createElement)('button', { disabled: busy || !filter.trim(), onClick: () => void run('branch-create', { name: filter.trim() }, () => { setBranches(null); setFilter(''); }) }, '创建分支')))) : null);
}

return module.exports;
};
__factories[8] = function () {
var module = { exports: {} }; var exports = module.exports;
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scmGlyphs = void 0;
/** Monaco Codicons (MIT), embedded paths avoid loading an icon font. */
exports.scmGlyphs = {
    diffMultiple: 'M19.52 18.0V6.640000000000001Q19.52 5.68 18.88 5.039999999999999L14.48 0.6400000000000006Q13.84 0.0 12.88 0.0H6.0Q4.72 0.0 3.84 0.879999999999999Q2.96 1.759999999999998 2.96 3.039999999999999V18.0Q2.96 19.28 3.84 20.12Q4.72 20.96 6.0 21.04H16.48Q17.76 20.96 18.64 20.12Q19.52 19.28 19.52 18.0ZM4.48 18.0V2.960000000000001Q4.48 2.3999999999999986 4.92 1.959999999999999Q5.36 1.5199999999999996 6.0 1.5199999999999996H12.88Q13.200000000000001 1.5199999999999996 13.44 1.6799999999999997L17.76 6.079999999999998Q18.0 6.32 18.0 6.640000000000001V18.0Q18.0 18.64 17.560000000000002 19.08Q17.12 19.52 16.48 19.52H6.0Q5.36 19.52 4.92 19.08Q4.48 18.64 4.48 18.0ZM22.48 9.6V18.0Q22.48 19.6 21.68 21.0Q20.88 22.4 19.52 23.2Q18.16 24.0 16.48 24.0H9.040000000000001Q8.16 24.0 7.48 23.6Q6.8 23.2 6.4 22.48H16.48Q18.32 22.48 19.68 21.16Q21.04 19.84 21.04 18.0V7.199999999999999L21.84 8.0Q22.48 8.719999999999999 22.48 9.6ZM15.040000000000001 8.24Q15.040000000000001 8.56 14.8 8.76Q14.56 8.959999999999999 14.24 8.959999999999999H12.0V11.28Q12.0 11.52 11.8 11.76Q11.6 12.0 11.280000000000001 12.0Q10.96 12.0 10.72 11.76Q10.48 11.52 10.48 11.28V8.959999999999999H8.24Q7.92 8.959999999999999 7.720000000000001 8.76Q7.5200000000000005 8.56 7.5200000000000005 8.239999999999998Q7.5200000000000005 7.919999999999998 7.720000000000001 7.719999999999999Q7.92 7.52 8.24 7.52H10.48V5.280000000000001Q10.48 4.960000000000001 10.72 4.720000000000001Q10.96 4.48 11.280000000000001 4.48Q11.6 4.48 11.8 4.720000000000001Q12.0 4.960000000000001 12.0 5.280000000000001V7.52H14.24Q14.56 7.52 14.760000000000002 7.719999999999999Q14.96 7.919999999999998 14.96 8.24ZM15.040000000000001 15.76Q14.96 16.08 14.760000000000002 16.28Q14.56 16.48 14.24 16.48H8.24Q7.92 16.48 7.720000000000001 16.28Q7.5200000000000005 16.08 7.5200000000000005 15.759999999999998Q7.5200000000000005 15.44 7.720000000000001 15.2Q7.92 14.959999999999999 8.24 14.959999999999999H14.24Q14.56 14.959999999999999 14.760000000000002 15.2Q14.96 15.44 14.96 15.76Z',
    discard: 'M4.48 3.759999999999998Q4.48 3.4400000000000013 4.720000000000001 3.200000000000001Q4.96 2.960000000000001 5.28 2.960000000000001Q5.6000000000000005 2.960000000000001 5.800000000000001 3.200000000000001Q6.0 3.4400000000000013 6.0 3.759999999999998V9.52L10.72 4.719999999999999Q11.92 3.599999999999998 13.48 3.1999999999999993Q15.040000000000001 2.8000000000000007 16.560000000000002 3.1999999999999993Q18.080000000000002 3.599999999999998 19.240000000000002 4.759999999999998Q20.400000000000002 5.919999999999998 20.8 7.479999999999999Q21.2 9.04 20.8 10.559999999999999Q20.400000000000002 12.08 19.28 13.28L11.68 20.8Q11.52 20.96 11.2 20.96Q10.88 20.96 10.64 20.759999999999998Q10.4 20.56 10.4 20.240000000000002Q10.4 19.92 10.64 19.68L18.16 12.16Q19.52 10.879999999999999 19.52 9.0Q19.52 7.120000000000001 18.2 5.800000000000001Q16.88 4.48 15.0 4.48Q13.120000000000001 4.48 11.84 5.84L7.12 10.48H12.72Q13.040000000000001 10.48 13.280000000000001 10.719999999999999Q13.52 10.959999999999999 13.52 11.28Q13.52 11.6 13.280000000000001 11.8Q13.040000000000001 12.0 12.72 12.0H5.44Q5.04 12.0 4.76 11.719999999999999Q4.48 11.44 4.48 11.12Z',
    openFile: 'M12.88 1.5199999999999996Q13.84 1.5199999999999996 14.48 2.16L18.88 6.559999999999999Q19.52 7.199999999999999 19.52 8.16V19.52Q19.52 20.72 18.64 21.6Q17.76 22.48 16.48 22.48H7.5200000000000005Q6.24 22.48 5.36 21.6Q4.48 20.72 4.48 19.52V9.04H6.0V19.52Q6.0 20.16 6.4399999999999995 20.6Q6.88 21.04 7.5200000000000005 21.04H16.48Q17.12 21.04 17.560000000000002 20.6Q18.0 20.16 18.0 19.52V9.04H14.24Q13.280000000000001 9.04 12.64 8.36Q12.0 7.68 12.0 6.719999999999999V3.039999999999999L11.92 2.879999999999999Q11.76 2.4800000000000004 11.44 2.16L10.8 1.5199999999999996ZM13.52 6.719999999999999Q13.52 7.039999999999999 13.719999999999999 7.279999999999999Q13.92 7.52 14.24 7.52H17.68L13.52 3.280000000000001ZM6.72 0.0Q7.04 0.0 7.28 0.23999999999999844L10.32 3.1999999999999993Q10.4 3.3599999999999994 10.440000000000001 3.4799999999999986Q10.48 3.599999999999998 10.48 3.759999999999998Q10.48 3.919999999999998 10.440000000000001 4.039999999999999Q10.4 4.16 10.32 4.32L7.28 7.280000000000001Q7.04 7.52 6.76 7.52Q6.48 7.52 6.24 7.279999999999999Q6.0 7.039999999999999 6.0 6.76Q6.0 6.48 6.24 6.239999999999998L7.92 4.48H3.7600000000000002Q2.8000000000000003 4.48 2.16 5.16Q1.52 5.84 1.52 6.719999999999999V8.24Q1.52 8.56 1.28 8.8Q1.04 9.04 0.72 9.04Q0.4 9.04 0.2 8.8Q0.0 8.56 0.0 8.24V6.719999999999999Q0.0 5.199999999999999 1.08 4.119999999999999Q2.16 3.039999999999999 3.7600000000000002 3.039999999999999H7.92L6.24 1.2800000000000011Q6.0 1.0399999999999991 6.0 0.7599999999999998Q6.0 0.4800000000000004 6.24 0.2400000000000002Q6.48 0.0 6.72 0.0Z',
    sync: 'M21.04 5.280000000000001V9.76Q21.04 10.08 20.799999999999997 10.280000000000001Q20.56 10.48 20.240000000000002 10.48H15.76Q15.44 10.48 15.2 10.280000000000001Q14.96 10.08 14.96 9.76Q14.96 9.44 15.2 9.2Q15.44 8.959999999999999 15.76 8.959999999999999H18.88Q18.0 6.960000000000001 16.12 5.720000000000001Q14.24 4.48 12.0 4.48Q9.52 4.48 7.48 6.0Q5.44 7.52 4.8 9.92Q4.72 10.24 4.52 10.36Q4.32 10.48 4.08 10.48H3.84Q3.52 10.4 3.4000000000000004 10.120000000000001Q3.2800000000000002 9.84 3.36 9.52Q4.16 6.640000000000001 6.5600000000000005 4.800000000000001Q8.96 2.960000000000001 12.0 2.960000000000001Q14.32 3.039999999999999 16.28 4.08Q18.240000000000002 5.120000000000001 19.52 7.039999999999999V5.280000000000001Q19.52 4.960000000000001 19.72 4.720000000000001Q19.92 4.48 20.240000000000002 4.48Q20.56 4.48 20.799999999999997 4.720000000000001Q21.04 4.960000000000001 21.04 5.280000000000001ZM20.16 13.52Q19.84 13.44 19.560000000000002 13.6Q19.28 13.76 19.2 14.08Q18.48 16.48 16.48 18.0Q14.48 19.52 12.0 19.52Q9.76 19.52 7.88 18.28Q6.0 17.04 5.12 15.04H8.24Q8.56 15.04 8.760000000000002 14.8Q8.96 14.56 8.96 14.24Q8.96 13.92 8.760000000000002 13.719999999999999Q8.56 13.52 8.24 13.52H3.7600000000000002Q3.44 13.52 3.2 13.719999999999999Q2.96 13.92 2.96 14.24V18.8Q2.96 19.04 3.2 19.28Q3.44 19.52 3.76 19.52Q4.08 19.52 4.28 19.28Q4.48 19.04 4.48 18.8V16.96Q5.68 18.88 7.68 19.96Q9.68 21.04 12.0 21.04Q14.96 21.04 17.4 19.2Q19.84 17.36 20.64 14.48Q20.72 14.16 20.560000000000002 13.879999999999999Q20.400000000000002 13.6 20.080000000000002 13.52Z',
};

return module.exports;
};
		return __require(4);
	},
});

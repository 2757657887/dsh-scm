import { realpathSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { commitFiles, fileVersions } from './versions.js';
import * as gitApi from './git.js';
import { isLoopback, resolveWithin, sessionRoot } from './fence.js';
import { webServerOf } from './services.js';
import { addWorktree, ensureParent, listWorktrees, pruneWorktrees, registerWorkspace, registeredWorkspaces, removeWorktree, sanitizeName, unregisterWorkspace, worktreeHome, worktreeTarget, } from './worktree.js';
/** Route prefix owned by this plugin. */
export const ROUTE_PREFIX = '/dsh-scm';
/** Body ceiling: a commit message and a few hundred paths, nothing more. */
const MAX_BODY_BYTES = 512 * 1024;
function fail(code, message, detail) {
    return { ok: false, error: detail === undefined ? { code, message } : { code, message, detail } };
}
/** Read and parse a bounded JSON body. */
async function readBody(request) {
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = chunk;
        size += buffer.length;
        if (size > MAX_BODY_BYTES)
            return null;
        chunks.push(buffer);
    }
    if (size === 0)
        return {};
    try {
        const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        return typeof parsed === 'object' && parsed !== null ? parsed : null;
    }
    catch {
        return null;
    }
}
function send(response, status, payload) {
    const text = JSON.stringify(payload);
    response.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    response.end(text);
}
/**
 * Resolve the session → workspace → repository chain for one request.
 * @returns the scoped request, or the refusal to send back.
 */
async function scope(ctx, body, options) {
    const sessionId = typeof body.sessionId === 'string' ? body.sessionId : '';
    if (sessionId === '')
        return fail('no-session', 'sessionId is required');
    const workspace = await sessionRoot(ctx, sessionId);
    if (workspace === undefined)
        return fail('unknown-session', 'the session has no working directory');
    // A worktree lives outside the checkout it branched from, so the roots this
    // request may reach are widened — but only to paths DSH already knows: the
    // user's registered workspaces and this plugin's own worktree home.
    const extraRoots = [...registeredWorkspaces(ctx), worktreeHome(options.worktreeHome)];
    const repo = resolveWithin(workspace, typeof body.repo === 'string' ? body.repo : undefined, extraRoots);
    if (repo === null)
        return fail('outside-workspace', 'the requested repository is outside the session workspace');
    return { root: workspace, repo, body };
}
function isFailure(value) {
    return value.ok === false;
}
/** String-list field, rejecting anything that is not a plain relative path. */
function relativePaths(value) {
    if (!Array.isArray(value))
        return null;
    const out = [];
    for (const item of value) {
        if (typeof item !== 'string' || item === '' || item.startsWith('/') || item.startsWith('\\') || item.startsWith(':') || /^[A-Za-z]:/.test(item) || item.replaceAll('\\', '/').split('/').includes('..'))
            return null;
        out.push(item);
    }
    return out;
}
function str(value) {
    return typeof value === 'string' ? value.trim() : '';
}
/** Whether `name` is a branch name git itself would accept. */
async function validBranchName(repo, name) {
    if (name === '' || name.startsWith('-'))
        return false;
    const check = await gitApi.git(['check-ref-format', '--branch', name], repo);
    return check.code === 0;
}
/** Run one named operation against a scoped repository. */
async function operate(ctx, name, scoped, options) {
    const { repo, body } = scoped;
    const remote = str(body.remote);
    switch (name) {
        case 'context': {
            const repos = await gitApi.discoverRepos(scoped.root);
            const isRepo = await gitApi.isRepository(repo);
            return {
                ok: true,
                value: {
                    workspace: scoped.root,
                    repo,
                    isRepo,
                    repos,
                    remotes: isRepo ? await gitApi.remotes(repo) : [],
                    worktrees: isRepo ? await listWorktrees(repo) : [],
                    worktreeHome: worktreeHome(options.worktreeHome),
                    options,
                },
            };
        }
        case 'status': {
            if (!(await gitApi.isRepository(repo)))
                return fail('not-a-repository', 'this directory is not a git repository');
            const status = await gitApi.status(repo);
            return { ok: true, value: { status, remotes: await gitApi.remotes(repo) } };
        }
        case 'diff': {
            const file = str(body.file);
            if (file && relativePaths([file]) === null)
                return fail('bad-file', 'relative file path required');
            const diff = await gitApi.diff(repo, file === '' ? undefined : file, body.staged === true);
            return { ok: true, value: { diff } };
        }
        case 'log': {
            const limit = typeof body.limit === 'number' && body.limit > 0 && body.limit <= 200 ? body.limit : options.recentCommits;
            const branch = str(body.branch);
            if (branch && !(await validBranchName(repo, branch)))
                return fail('bad-branch', '无效的分支名。');
            return { ok: true, value: { commits: await gitApi.log(repo, limit, branch || undefined) } };
        }
        case 'file-versions': {
            const file = str(body.file), hash = str(body.base), from = str(body.name);
            if (!file || relativePaths([file]) === null || (from && relativePaths([from]) === null))
                return fail('bad-file', 'invalid file path');
            if (hash && !/^[a-f0-9]{7,40}$/.test(hash))
                return fail('bad-revision', 'invalid commit');
            return { ok: true, value: await fileVersions(repo, file, { staged: body.staged === true, hash: hash || undefined, from: from || undefined }) };
        }
        case 'commit-files': {
            const hash = str(body.base);
            if (!/^[a-f0-9]{7,40}$/.test(hash))
                return fail('bad-revision', 'invalid commit');
            return { ok: true, value: await commitFiles(repo, hash) };
        }
        case 'commit-detail': {
            const hash = str(body.base);
            if (!/^[a-f0-9]{7,40}$/.test(hash))
                return fail('bad-revision', 'invalid commit hash');
            const result = await gitApi.git(['show', '--no-ext-diff', '--no-color', '--format=fuller', '--stat', '--patch', hash, '--'], repo);
            return { ok: true, value: { diff: result.stdout.slice(0, 512 * 1024) } };
        }
        case 'head-message': {
            const result = await gitApi.git(['log', '-1', '--format=%B'], repo);
            return result.code === 0 ? { ok: true, value: { message: result.stdout.trimEnd() } } : fail('git-failed', '无法读取最近一次提交。', result.stderr);
        }
        case 'branches':
            return { ok: true, value: { branches: await gitApi.branches(repo) } };
        case 'stage':
        case 'unstage': {
            const files = relativePaths(body.files);
            if (files === null || files.length === 0)
                return fail('bad-files', 'files must be a non-empty list of relative paths');
            const unborn = (await gitApi.git(['rev-parse', '--verify', 'HEAD'], repo)).code !== 0;
            const args = name === 'stage'
                ? ['add', '--', ...files]
                : unborn ? ['rm', '--cached', '--', ...files] : ['restore', '--staged', '--', ...files];
            let result = await gitApi.git(args, repo);
            for (let retry = 0; result.code !== 0 && /index\.lock.*(?:exists|File exists)/is.test(result.stderr) && retry < 3; retry++) {
                await new Promise(resolve => setTimeout(resolve, 300 * (retry + 1)));
                result = await gitApi.git(args, repo);
            }
            if (result.code !== 0 && result.stderr.includes('index.lock'))
                return fail('index-locked', '仓库索引被其他 Git 操作锁定。请稍后重试；若持续出现，请检查遗留的 index.lock。插件不会自动删除锁文件。', result.stderr);
            return result.code === 0 ? { ok: true, value: { files } } : fail('git-failed', `${name} failed`, result.stderr);
        }
        case 'discard': {
            if (body.confirm !== true)
                return fail('needs-confirm', 'discarding changes requires confirm: true');
            const files = relativePaths(body.files);
            if (files === null || files.length === 0)
                return fail('bad-files', 'files must be a non-empty list of relative paths');
            // Untracked files have no committed content to restore: remove them instead.
            const untracked = [];
            const tracked = [];
            for (const file of files) {
                const trackedCheck = await gitApi.git(['ls-files', '--error-unmatch', '--', file], repo);
                (trackedCheck.code === 0 ? tracked : untracked).push(file);
            }
            const messages = [];
            if (tracked.length > 0) {
                const restore = await gitApi.git(['restore', '--', ...tracked], repo);
                if (restore.code !== 0)
                    return fail('git-failed', 'discard failed', restore.stderr);
                messages.push(...tracked);
            }
            if (untracked.length > 0) {
                const clean = await gitApi.git(['clean', '-f', '--', ...untracked], repo);
                if (clean.code !== 0)
                    return fail('git-failed', 'removing untracked files failed', clean.stderr);
                messages.push(...untracked);
            }
            return { ok: true, value: { discarded: messages } };
        }
        case 'commit': {
            const message = str(body.message);
            if (message === '')
                return fail('no-message', 'a commit message is required');
            const mode = str(body.mode);
            if (mode && !['amend', 'push', 'sync'].includes(mode))
                return fail('bad-mode', 'unknown commit mode');
            if (mode === 'amend' && body.confirm !== true)
                return fail('needs-confirm', 'amending requires confirmation');
            if (mode === 'push' || mode === 'sync') {
                const upstream = await gitApi.git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repo);
                if (upstream.code !== 0)
                    return fail('no-upstream', '当前分支没有上游分支，请先发布分支。');
            }
            if (body.files !== undefined) {
                const files = relativePaths(body.files);
                if (body.confirm !== true || !files?.length)
                    return fail('needs-confirm', 'staging all requires confirmation');
                const add = await gitApi.git(['add', '--', ...files], repo);
                if (add.code !== 0)
                    return fail('git-failed', 'stage failed', add.stderr);
            }
            const result = await gitApi.git(['commit', ...(mode === 'amend' ? ['--amend'] : []), '-m', message], repo);
            if (result.code !== 0)
                return fail('git-failed', 'commit failed', `${result.stdout}\n${result.stderr}`);
            if (mode === 'sync') {
                const pull = await gitApi.git(['pull', '--ff-only'], repo);
                if (pull.code !== 0)
                    return fail('post-commit-failed', '提交已完成，但同步中的拉取失败；请勿重复提交。', `${pull.stdout}${pull.stderr}`.trim());
            }
            if (mode === 'push' || mode === 'sync') {
                const push = await gitApi.git(['push'], repo);
                if (push.code !== 0)
                    return fail('post-commit-failed', '提交已完成，但推送失败；请勿重复提交。', `${push.stdout}${push.stderr}`.trim());
            }
            return { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim() } };
        }
        case 'switch': {
            const branch = str(body.branch);
            if (!(await validBranchName(repo, branch)))
                return fail('bad-branch', 'invalid branch name');
            if (body.track === true) {
                // Checking out a branch that only exists on a remote: create the local
                // branch that tracks it. Git's own DWIM would guess this, but naming the
                // local branch explicitly keeps the result predictable.
                const short = branch.includes('/') ? branch.slice(branch.indexOf('/') + 1) : branch;
                if (!(await validBranchName(repo, short)))
                    return fail('bad-branch', 'invalid branch name');
                const existing = await gitApi.git(['rev-parse', '--verify', '--quiet', `refs/heads/${short}`], repo);
                if (existing.code === 0) {
                    const plain = await gitApi.git(['switch', '--no-guess', '--', short], repo);
                    return plain.code === 0
                        ? { ok: true, value: { branch: short, tracking: branch } }
                        : fail('git-failed', `switching to ${short} failed`, `${plain.stdout}${plain.stderr}`);
                }
                const created = await gitApi.git(['switch', '-c', short, '--track', '--', branch], repo);
                return created.code === 0
                    ? { ok: true, value: { branch: short, tracking: branch } }
                    : fail('git-failed', `checking out ${branch} failed`, `${created.stdout}${created.stderr}`);
            }
            const result = await gitApi.git(['switch', '--no-guess', '--', branch], repo);
            return result.code === 0
                ? { ok: true, value: { branch } }
                : fail('git-failed', `switching to ${branch} failed`, `${result.stdout}${result.stderr}`);
        }
        case 'branch-create': {
            const branch = str(body.name);
            if (!(await validBranchName(repo, branch)))
                return fail('bad-branch', 'invalid branch name');
            // The base is a caller-chosen revision: it must resolve to a commit, so a
            // typo (or an option-shaped string) is refused instead of reaching git.
            const base = str(body.base);
            if (base !== '') {
                if (base.startsWith('-'))
                    return fail('bad-base', 'invalid base revision');
                const verified = await gitApi.git(['rev-parse', '--verify', '--quiet', `${base}^{commit}`], repo);
                if (verified.code !== 0)
                    return fail('bad-base', `来源无法解析：${base}`);
            }
            const args = base === '' ? ['switch', '-c', branch] : ['switch', '-c', branch, base];
            const result = await gitApi.git(args, repo);
            if (result.code !== 0) {
                return fail('git-failed', `creating ${branch} failed`, `${result.stdout}${result.stderr}`);
            }
            // `git switch -c` sets the upstream when the base is a remote-tracking
            // branch; report it so the panel can say so.
            const upstream = await gitApi.git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repo);
            return { ok: true, value: { branch, base: base === '' ? null : base, upstream: upstream.code === 0 ? upstream.stdout.trim() : null } };
        }
        case 'branch-delete': {
            if (body.confirm !== true)
                return fail('needs-confirm', 'deleting a branch requires confirm: true');
            const branch = str(body.name);
            if (!(await validBranchName(repo, branch)))
                return fail('bad-branch', 'invalid branch name');
            const result = await gitApi.git(['branch', body.force === true ? '-D' : '-d', '--', branch], repo);
            return result.code === 0 ? { ok: true, value: { branch } } : fail('git-failed', `deleting ${branch} failed`, result.stderr);
        }
        case 'merge': {
            const branch = str(body.branch);
            if (!(await validBranchName(repo, branch)))
                return fail('bad-branch', 'invalid branch name');
            const result = await gitApi.git(['merge', '--no-edit', '--', branch], repo);
            if (result.code !== 0) {
                // A failed merge is usually a conflict: name the paths so the panel can
                // list them instead of showing only git's prose.
                const after = await gitApi.status(repo);
                const paths = after.conflicts.map(entry => entry.path).join(', ');
                const detail = [
                    paths === '' ? undefined : `conflicted paths: ${paths}`,
                    `${result.stdout}${result.stderr}`.trim(),
                ].filter((line) => line !== undefined && line !== '').join('\n');
                return fail('merge-failed', `merging ${branch} failed`, detail);
            }
            return { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim() } };
        }
        case 'fetch': {
            const args = ['fetch'];
            if (body.mode === 'prune')
                args.push('--prune');
            if (body.mode === 'all')
                args.push('--all');
            else if (remote !== '')
                args.push('--', remote);
            const result = await gitApi.git(args, repo);
            return result.code === 0 ? { ok: true, value: { output: result.stderr.trim() } } : fail('git-failed', 'fetch failed', result.stderr);
        }
        case 'pull': {
            // `mode` picks the integration: fast-forward only by default, an explicit
            // merge when the caller asks for one.
            const args = ['pull', body.mode === 'merge' ? '--no-rebase' : body.mode === 'rebase' ? '--rebase' : '--ff-only'];
            if (remote !== '') {
                args.push('--', remote);
                const branch = str(body.branch);
                if (branch !== '')
                    args.push(branch);
            }
            const result = await gitApi.git(args, repo);
            if (result.code !== 0) {
                const hint = /not possible to fast-forward|divergent/i.test(`${result.stdout}${result.stderr}`)
                    ? '分支已分叉：改用「拉取（合并）」或先手动处理'
                    : undefined;
                return fail('pull-failed', 'pull failed', [hint, `${result.stdout}${result.stderr}`.trim()].filter(Boolean).join('\n'));
            }
            return { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim() } };
        }
        case 'push': {
            if (body.confirm !== true)
                return fail('needs-confirm', 'pushing requires confirm: true');
            const branch = str(body.branch);
            const setUpstream = body.setUpstream === true;
            const args = ['push'];
            if (setUpstream) {
                // Publishing: a branch that exists only locally has no remote-tracking
                // ref to push to, so the push must name it and record the relationship
                // in one step (this is git's own \`--set-upstream\`).
                if (!(await validBranchName(repo, branch))) {
                    return fail('bad-branch', 'publishing a branch needs its local branch name');
                }
                const available = await gitApi.remotes(repo);
                const target = remote === '' ? (available[0] ?? 'origin') : remote;
                args.push('--set-upstream', '--', target, branch);
            }
            else {
                if (remote !== '')
                    args.push('--', remote);
                if (remote !== '' && branch !== '')
                    args.push(branch);
            }
            const result = await gitApi.git(args, repo);
            if (result.code === 0)
                return { ok: true, value: { output: result.stderr.trim(), published: setUpstream } };
            const detail = `${result.stdout}${result.stderr}`.trim();
            // The one failure every new branch hits: no upstream. Say what to do
            // instead of relaying git's suggestion verbatim.
            if (/has no upstream branch|--set-upstream/i.test(detail)) {
                return fail('no-upstream', '当前分支在远端还没有上游分支', `${detail}\n\n点「发布分支」会以 --set-upstream 推送并在同一步建立跟踪关系。`);
            }
            return fail('git-failed', 'push failed', detail);
        }
        case 'clone': {
            const url = str(body.base), folder = str(body.name);
            if (!url || url.startsWith('-') || /[\r\n]/.test(url))
                return fail('bad-url', '请输入有效的 Git 仓库地址。');
            if (!folder || folder === '.' || folder === '..' || /[\\/<>:"|?*\x00-\x1f]/.test(folder) || /[. ]$/.test(folder))
                return fail('bad-folder', '请输入有效的单级目录名称。');
            const { join } = await import('node:path');
            const { lstat } = await import('node:fs/promises');
            const target = join(scoped.root, folder);
            try {
                await lstat(target);
                return fail('exists', '目标目录已存在。');
            }
            catch (error) {
                if (error.code !== 'ENOENT')
                    throw error;
            }
            const result = await gitApi.git(['clone', '--', url, target], scoped.root);
            return result.code === 0 ? { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim(), path: target } } : fail('git-failed', '克隆失败。', `${result.stdout}${result.stderr}`.trim());
        }
        case 'remote-add':
        case 'remote-remove': {
            const remoteName = str(body.name), url = str(body.base);
            if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remoteName))
                return fail('bad-remote', '无效的远程名称。');
            if (name === 'remote-remove' && body.confirm !== true)
                return fail('needs-confirm', '删除远程需要确认。');
            if (name === 'remote-add' && (!url || url.startsWith('-') || /[\r\n]/.test(url)))
                return fail('bad-url', '无效的远程地址。');
            const result = await gitApi.git(name === 'remote-add' ? ['remote', 'add', '--', remoteName, url] : ['remote', 'remove', '--', remoteName], repo);
            return result.code === 0 ? { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim() } } : fail('git-failed', '远程操作失败。', result.stderr);
        }
        case 'undo-commit': {
            if (body.confirm !== true)
                return fail('needs-confirm', '撤销提交需要确认。');
            const result = await gitApi.git(['reset', '--soft', 'HEAD^'], repo);
            return result.code === 0 ? { ok: true, value: { output: result.stdout.trim() } } : fail('git-failed', '撤销提交失败。', result.stderr);
        }
        case 'sync': {
            const upstream = await gitApi.git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], repo);
            if (upstream.code !== 0)
                return fail('no-upstream', '当前分支没有上游分支，请先发布分支。');
            const pull = await gitApi.git(['pull', '--ff-only'], repo);
            if (pull.code !== 0)
                return fail('sync-failed', '同步中的拉取失败，尚未推送。', `${pull.stdout}${pull.stderr}`.trim());
            const push = await gitApi.git(['push'], repo);
            return push.code === 0 ? { ok: true, value: { output: `${pull.stdout}${pull.stderr}${push.stdout}${push.stderr}`.trim() } } : fail('sync-failed', '拉取已完成，但推送失败。', `${push.stdout}${push.stderr}`.trim());
        }
        case 'stash-list': {
            const result = await gitApi.git(['stash', 'list', '--format=%gd%x00%gs'], repo);
            if (result.code !== 0)
                return fail('git-failed', '无法读取存储。', result.stderr);
            return { ok: true, value: { items: result.stdout.split('\n').filter(Boolean).map(line => { const [id = '', label = ''] = line.split('\0'); return { id, label }; }) } };
        }
        case 'stash-save': {
            const args = ['stash', 'push'];
            if (body.mode === 'untracked')
                args.push('--include-untracked');
            if (body.mode === 'staged')
                args.push('--staged');
            const message = str(body.message);
            if (message)
                args.push('-m', message);
            const result = await gitApi.git(args, repo);
            return result.code === 0 ? { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim() } } : fail('git-failed', '存储失败。', result.stderr);
        }
        case 'stash-apply':
        case 'stash-pop':
        case 'stash-drop': {
            const ref = str(body.name) || 'stash@{0}';
            if (!/^stash@\{[0-9]+\}$/.test(ref))
                return fail('bad-stash', '无效的存储标识。');
            if (name === 'stash-drop' && body.confirm !== true)
                return fail('needs-confirm', '删除存储需要确认。');
            const action = name === 'stash-apply' ? 'apply' : name === 'stash-pop' ? 'pop' : 'drop';
            const result = await gitApi.git(['stash', action, ref], repo);
            return result.code === 0 ? { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim() } } : fail('git-failed', '存储操作失败。', `${result.stdout}${result.stderr}`.trim());
        }
        case 'tag-list': {
            const result = await gitApi.git(['tag', '--list'], repo);
            return result.code === 0 ? { ok: true, value: { items: result.stdout.split('\n').filter(Boolean) } } : fail('git-failed', '无法读取标记。', result.stderr);
        }
        case 'tag-create':
        case 'tag-delete': {
            const tag = str(body.name);
            if (!tag || tag.startsWith('-') || /\s/.test(tag))
                return fail('bad-tag', '无效的标记名。');
            const valid = await gitApi.git(['check-ref-format', `refs/tags/${tag}`], repo);
            if (valid.code !== 0)
                return fail('bad-tag', '无效的标记名。');
            if (name === 'tag-delete' && body.confirm !== true)
                return fail('needs-confirm', '删除标记需要确认。');
            const result = await gitApi.git(name === 'tag-delete' ? ['tag', '-d', '--', tag] : ['tag', '--', tag], repo);
            return result.code === 0 ? { ok: true, value: { output: result.stdout.trim() } } : fail('git-failed', '标记操作失败。', result.stderr);
        }
        case 'push-tags': {
            if (body.confirm !== true)
                return fail('needs-confirm', '推送标记需要确认。');
            const result = await gitApi.git(['push', '--tags'], repo);
            return result.code === 0 ? { ok: true, value: { output: `${result.stdout}${result.stderr}`.trim() } } : fail('git-failed', '推送标记失败。', result.stderr);
        }
        case 'worktree-list': {
            if (!(await gitApi.isRepository(repo)))
                return fail('not-a-repository', 'this directory is not a git repository');
            return { ok: true, value: { worktrees: await listWorktrees(repo), home: worktreeHome(options.worktreeHome) } };
        }
        case 'worktree-add': {
            if (!(await gitApi.isRepository(repo)))
                return fail('not-a-repository', 'this directory is not a git repository');
            const name = sanitizeName(str(body.name));
            if (name === null)
                return fail('bad-name', 'a worktree name containing letters or digits is required');
            const suggested = str(body.branch);
            const branch = suggested === '' ? `wt/${name}` : suggested;
            if (!(await validBranchName(repo, branch)))
                return fail('bad-branch', 'invalid branch name');
            const home = worktreeHome(options.worktreeHome);
            const target = worktreeTarget(home, repo, name);
            // An existing branch is checked out; a fresh name is created from the base.
            const existing = await gitApi.git(['rev-parse', '--verify', '--quiet', `refs/heads/${branch}`], repo);
            ensureParent(target);
            const created = await addWorktree(repo, target, branch, str(body.base), existing.code !== 0);
            if (created.code !== 0) {
                return fail('git-failed', `creating worktree ${name} failed`, `${created.stdout}${created.stderr}`);
            }
            // Registering it with DSH is what makes the checkout reachable: a new
            // session can then be started directly on the worktree.
            const registered = await registerWorkspace(ctx, target, `wt: ${name}`);
            return { ok: true, value: { path: target, branch, name, registered } };
        }
        case 'worktree-remove': {
            if (body.confirm !== true)
                return fail('needs-confirm', 'removing a worktree requires confirm: true');
            const extraRoots = [...registeredWorkspaces(ctx), worktreeHome(options.worktreeHome)];
            const target = resolveWithin(scoped.root, str(body.worktree), extraRoots);
            if (target === null)
                return fail('outside-workspace', 'the worktree is outside every root this session may reach');
            const listed = await listWorktrees(repo);
            const entry = listed.find(item => { try {
                return realpathSync(item.path).toLowerCase() === target.toLowerCase();
            }
            catch {
                return false;
            } });
            if (entry === undefined)
                return fail('unknown-worktree', 'no such worktree of this repository');
            if (entry.main)
                return fail('worktree-is-main', 'the main worktree cannot be removed');
            if (entry.dirty && body.force !== true) {
                return fail('worktree-dirty', 'the worktree has uncommitted changes; force removal was not requested');
            }
            const removed = await removeWorktree(repo, target, body.force === true);
            if (removed.code !== 0)
                return fail('git-failed', 'removing the worktree failed', `${removed.stdout}${removed.stderr}`);
            // The registration would otherwise dangle and offer a checkout that is gone.
            const unregistered = await unregisterWorkspace(ctx, target);
            return { ok: true, value: { removed: target, branch: entry.branch, unregistered } };
        }
        case 'worktree-prune': {
            const pruned = await pruneWorktrees(repo);
            return pruned.code === 0
                ? { ok: true, value: { output: `${pruned.stdout}${pruned.stderr}`.trim() } }
                : fail('git-failed', 'pruning worktrees failed', pruned.stderr);
        }
        case 'init': {
            const result = await gitApi.git(['init'], repo);
            return result.code === 0 ? { ok: true, value: { output: result.stdout.trim() } } : fail('git-failed', 'git init failed', result.stderr);
        }
        default:
            return fail('unknown-op', `unknown operation: ${name}`);
    }
}
/**
 * Mount the plugin's HTTP surface.
 * @param ctx - host context (needs `webServer`).
 * @param options - resolved plugin configuration, echoed to the browser half.
 * @returns disposer removing the route.
 */
export function registerRoutes(ctx, options) {
    const queues = new Map();
    const handler = async (request, response) => {
        // The web server turns any escaping exception into a bare 400, which tells
        // the caller nothing; keeping failures inside the envelope makes them
        // diagnosable from the panel.
        try {
            const origin = request.headers.origin;
            if (origin && origin !== 'dsh-app://app' && origin !== `http://${request.headers.host}` && origin !== `https://${request.headers.host}`) {
                send(response, 403, fail('forbidden', 'cross-origin request refused'));
                return;
            }
            if (!isLoopback(request)) {
                send(response, 403, fail('forbidden', 'dsh-scm is loopback-only'));
                return;
            }
            const assetPath = new URL(request.url ?? '/', 'http://local').pathname;
            if (request.method === 'GET' && assetPath.startsWith(ROUTE_PREFIX + '/assets/')) {
                const file = assetPath.slice((ROUTE_PREFIX + '/assets/').length);
                if (!/^[a-zA-Z0-9_.-]+\.(js|css|ttf)$/.test(file)) {
                    response.writeHead(404);
                    response.end();
                    return;
                }
                try {
                    const buffer = await readFile(new URL('../assets/' + file, import.meta.url));
                    response.writeHead(200, { 'content-type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'font/ttf', 'cache-control': 'no-cache' });
                    response.end(buffer);
                }
                catch {
                    response.writeHead(404);
                    response.end();
                }
                return;
            }
            if (request.method !== 'POST') {
                send(response, 405, fail('method', 'POST required'));
                return;
            }
            const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
            const operation = pathname.startsWith(`${ROUTE_PREFIX}/`) ? pathname.slice(ROUTE_PREFIX.length + 1) : '';
            if (operation === '' || operation.includes('/')) {
                send(response, 404, fail('not-found', 'unknown route'));
                return;
            }
            const body = await readBody(request);
            if (body === null) {
                send(response, 400, fail('bad-body', 'a JSON body is required'));
                return;
            }
            const scoped = await scope(ctx, body, options);
            if (isFailure(scoped)) {
                send(response, scoped.error.code === 'outside-workspace' || scoped.error.code === 'unknown-session' ? 403 : 400, scoped);
                return;
            }
            const readOnly = ['context', 'status', 'diff', 'log', 'branches', 'commit-detail', 'commit-files', 'file-versions', 'worktree-list', 'stash-list', 'tag-list', 'head-message'].includes(operation);
            let release;
            let pending;
            if (!readOnly) {
                const previous = queues.get(scoped.repo) ?? Promise.resolve();
                pending = new Promise(resolve => { release = resolve; });
                queues.set(scoped.repo, pending);
                await previous;
            }
            let outcome;
            try {
                outcome = await operate(ctx, operation, scoped, options);
            }
            finally {
                release?.();
                if (pending && queues.get(scoped.repo) === pending)
                    queues.delete(scoped.repo);
            }
            send(response, outcome.ok ? 200 : 409, outcome);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            ctx.logger?.warn?.(error instanceof Error ? error : new Error(message));
            if (!response.headersSent)
                send(response, 500, fail('internal', message));
            else
                response.end();
        }
    };
    return webServerOf(ctx).register({ kind: 'prefix', path: ROUTE_PREFIX, handler });
}
//# sourceMappingURL=routes.js.map
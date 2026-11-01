import { readFile, stat, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { git } from './git.js';
const MAX = 2 * 1024 * 1024;
export async function commitFiles(repo, hash) {
    const info = await git(['show', '-s', '--format=%P%x00%s', hash, '--'], repo);
    if (info.code)
        throw new Error(info.stderr);
    const [parents = '', subject = ''] = info.stdout.trimEnd().split('\0');
    const parent = parents.split(' ')[0] || '';
    const result = await git(parent ? ['diff', '--no-ext-diff', '--name-status', '-z', '-M', parent, hash, '--'] : ['diff-tree', '--root', '--no-commit-id', '-r', '--name-status', '-z', '-M', hash, '--'], repo);
    if (result.code)
        throw new Error(result.stderr);
    const fields = result.stdout.split('\0');
    const files = [];
    for (let i = 0; i < fields.length && fields[i];) {
        const code = fields[i++];
        const first = fields[i++];
        if (code.startsWith('R') || code.startsWith('C'))
            files.push({ code: code[0], from: first, path: fields[i++] });
        else
            files.push({ code, path: first });
    }
    return { hash, parent, subject, files };
}
async function blob(repo, ref) {
    const size = await git(['cat-file', '-s', ref], repo);
    if (size.code)
        return Buffer.alloc(0); // File absent in this revision (addition/deletion).
    if (Number(size.stdout) > MAX)
        throw new Error('文件超过 2 MB，无法在差异编辑器中预览。');
    const result = await git(['cat-file', 'blob', ref], repo);
    if (result.code)
        throw new Error(result.stderr);
    return Buffer.from(result.stdout, 'utf8');
}
export async function fileVersions(repo, file, options = {}) {
    let original, modified;
    let leftLabel, rightLabel;
    if (options.hash) {
        const info = await commitFiles(repo, options.hash);
        const entry = info.files.find(f => f.path === file);
        if (!entry)
            throw new Error('文件不在该提交的更改列表中。');
        original = info.parent ? await blob(repo, `${info.parent}:${entry.from ?? file}`) : Buffer.alloc(0);
        modified = await blob(repo, `${options.hash}:${file}`);
        leftLabel = info.parent.slice(0, 8) || '空文件';
        rightLabel = options.hash.slice(0, 8);
    }
    else {
        const head = await git(['rev-parse', '--verify', 'HEAD'], repo);
        original = options.staged ? (head.code ? Buffer.alloc(0) : await blob(repo, `HEAD:${options.from ?? file}`)) : await blob(repo, `:${file}`);
        leftLabel = options.staged ? 'HEAD' : '索引';
        rightLabel = options.staged ? '索引' : '工作区';
        if (options.staged)
            modified = await blob(repo, `:${file}`);
        else {
            const path = resolve(repo, file);
            const rel = relative(repo, path);
            if (isAbsolute(rel) || rel === '..' || rel.startsWith('..' + String.fromCharCode(92)) || rel.startsWith('../'))
                throw new Error('路径超出仓库。');
            try {
                const target = await realpath(path);
                const root = await realpath(repo);
                const actual = relative(root, target);
                if (isAbsolute(actual) || actual === '..' || actual.startsWith('../') || actual.startsWith('..' + String.fromCharCode(92)))
                    throw new Error('无法预览指向仓库外的链接。');
                const details = await stat(target);
                if (!details.isFile())
                    throw new Error('不是普通文件。');
                if (details.size > MAX)
                    throw new Error('文件超过 2 MB，无法预览。');
                modified = await readFile(target);
            }
            catch (e) {
                if (e.code === 'ENOENT')
                    modified = Buffer.alloc(0);
                else
                    throw e;
            }
        }
    }
    const binary = original.includes(0) || modified.includes(0);
    return { original: binary ? '' : original.toString('utf8'), modified: binary ? '' : modified.toString('utf8'), binary, leftLabel, rightLabel, file };
}
//# sourceMappingURL=versions.js.map
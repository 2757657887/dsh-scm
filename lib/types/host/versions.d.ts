export interface ChangedFile {
    path: string;
    from?: string;
    code: string;
}
export declare function commitFiles(repo: string, hash: string): Promise<{
    hash: string;
    parent: string;
    subject: string;
    files: ChangedFile[];
}>;
export declare function fileVersions(repo: string, file: string, options?: {
    staged?: boolean;
    hash?: string;
    from?: string;
}): Promise<{
    original: string;
    modified: string;
    binary: boolean;
    leftLabel: string;
    rightLabel: string;
    file: string;
}>;

import * as vscode from 'vscode';
const CONFIG_SECTION = 'commentRemover';
export const DEFAULT_IGNORED_DIRS: string[] = [
    'node_modules',
    '.node_modules',
    'venv',
    '.venv',
    'env',
    '.env',
    '__pycache__',
    '.git',
    '.svn',
    '.hg',
    'dist',
    'build',
    'out',
    '.next',
    '.nuxt',
    'target',
    'bin',
    'obj'
];
export interface CommentRemoverConfig {
    ignorePatterns: string[];
    preserveCommentPrefixes: string[];
    ignoredDirectories: string[];
    removeLineComments: boolean;
    removeBlockComments: boolean;
    removeEmptyLines: boolean;
    preserveJSDocComments: boolean;
}
export function getConfig(): CommentRemoverConfig {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    return {
        ignorePatterns: config.get<string[]>('ignorePatterns', []),
        preserveCommentPrefixes: config.get<string[]>('preserveCommentPrefixes', []),
        ignoredDirectories: config.get<string[]>('ignoredDirectories', DEFAULT_IGNORED_DIRS),
        removeLineComments: config.get<boolean>('removeLineComments', true),
        removeBlockComments: config.get<boolean>('removeBlockComments', true),
        removeEmptyLines: config.get<boolean>('removeEmptyLines', true),
        preserveJSDocComments: config.get<boolean>('preserveJSDocComments', false)
    };
}
export function getIgnorePatterns(): string[] {
    return getConfig().ignorePatterns;
}
export function getPreserveCommentPrefixes(): string[] {
    return getConfig().preserveCommentPrefixes;
}
export function getIgnoredDirectories(): string[] {
    return getConfig().ignoredDirectories;
}
export async function addIgnorePattern(pattern: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentPatterns = config.get<string[]>('ignorePatterns', []);
    if (!currentPatterns.includes(pattern)) {
        const newPatterns = [...currentPatterns, pattern];
        await config.update('ignorePatterns', newPatterns, vscode.ConfigurationTarget.Global);
    }
}
export async function removeIgnorePattern(pattern: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentPatterns = config.get<string[]>('ignorePatterns', []);
    const newPatterns = currentPatterns.filter(p => p !== pattern);
    await config.update('ignorePatterns', newPatterns, vscode.ConfigurationTarget.Global);
}
export async function setIgnorePatterns(patterns: string[]): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update('ignorePatterns', patterns, vscode.ConfigurationTarget.Global);
}
export async function addPreservePrefix(prefix: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentPrefixes = config.get<string[]>('preserveCommentPrefixes', []);
    if (!currentPrefixes.includes(prefix)) {
        const newPrefixes = [...currentPrefixes, prefix];
        await config.update('preserveCommentPrefixes', newPrefixes, vscode.ConfigurationTarget.Global);
    }
}
export async function removePreservePrefix(prefix: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentPrefixes = config.get<string[]>('preserveCommentPrefixes', []);
    const newPrefixes = currentPrefixes.filter(p => p !== prefix);
    await config.update('preserveCommentPrefixes', newPrefixes, vscode.ConfigurationTarget.Global);
}
export async function addIgnoredDirectory(dir: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentDirs = config.get<string[]>('ignoredDirectories', DEFAULT_IGNORED_DIRS);
    if (!currentDirs.includes(dir)) {
        const newDirs = [...currentDirs, dir];
        await config.update('ignoredDirectories', newDirs, vscode.ConfigurationTarget.Global);
    }
}
export async function removeIgnoredDirectory(dir: string): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    const currentDirs = config.get<string[]>('ignoredDirectories', DEFAULT_IGNORED_DIRS);
    const newDirs = currentDirs.filter(d => d !== dir);
    await config.update('ignoredDirectories', newDirs, vscode.ConfigurationTarget.Global);
}
export async function resetIgnoredDirectories(): Promise<void> {
    const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
    await config.update('ignoredDirectories', DEFAULT_IGNORED_DIRS, vscode.ConfigurationTarget.Global);
}
import * as vscode from 'vscode';
import * as path from 'path';
export interface DeletedLine {
    originalLineNumber: number;
    targetLineNumber: number;
    content: string;
}
export interface PendingChange {
    fileUri: vscode.Uri;
    originalContent: string;
    deletedLines: DeletedLine[];
    timestamp: number;
}
const pendingChanges = new Map<string, PendingChange>();
let ghostDecorationTypes: vscode.TextEditorDecorationType[] = [];
function createGhostDecorationType(content: string): vscode.TextEditorDecorationType {
    return vscode.window.createTextEditorDecorationType({
        after: {
            contentText: `\n ${content.trim()}`,
            color: '#ff6b6b',
            fontStyle: 'italic',
            margin: '0 0 0 3em'
        },
        backgroundColor: 'rgba(255, 107, 107, 0.1)',
        isWholeLine: true
    });
}
function clearAllGhostDecorations(editor: vscode.TextEditor): void {
    for (const decType of ghostDecorationTypes) {
        editor.setDecorations(decType, []);
        decType.dispose();
    }
    ghostDecorationTypes = [];
}
function applyGhostLineDecorations(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.fsPath;
    const change = pendingChanges.get(filePath);
    clearAllGhostDecorations(editor);
    if (!change || change.deletedLines.length === 0) {
        return;
    }
    const lineGroups = new Map<number, DeletedLine[]>();
    for (const deleted of change.deletedLines) {
        const group = lineGroups.get(deleted.targetLineNumber) || [];
        group.push(deleted);
        lineGroups.set(deleted.targetLineNumber, group);
    }
    for (const [targetLineNum, lines] of lineGroups) {
        if (targetLineNum < 0 || targetLineNum >= editor.document.lineCount) {
            continue;
        }
        const combinedContent = lines
            .map(l => l.content.trim())
            .filter(c => c.length > 0)
            .join('  ⏎  ');
        if (!combinedContent) {
            continue;
        }
        const decType = createGhostDecorationType(combinedContent);
        ghostDecorationTypes.push(decType);
        const targetLine = editor.document.lineAt(targetLineNum);
        editor.setDecorations(decType, [{ range: targetLine.range }]);
    }
}
class PendingChangeDecorationProvider implements vscode.FileDecorationProvider {
    private _onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    readonly onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;
    provideFileDecoration(uri: vscode.Uri): vscode.FileDecoration | undefined {
        if (pendingChanges.has(uri.fsPath)) {
            return {
                badge: '●',
                color: new vscode.ThemeColor('charts.green'),
                tooltip: 'Comments removed - pending review'
            };
        }
        return undefined;
    }
    refresh(uri?: vscode.Uri): void {
        this._onDidChangeFileDecorations.fire(uri);
    }
    dispose(): void {
        this._onDidChangeFileDecorations.dispose();
    }
}
let fileDecorationProvider: PendingChangeDecorationProvider;
let statusBarItem: vscode.StatusBarItem;
function createStatusBar(): void {
    statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'comment-remover.showPendingChanges';
}
function updateStatusBar(): void {
    const count = pendingChanges.size;
    if (count > 0) {
        statusBarItem.text = `$(comment) ${count} file(s) pending review`;
        statusBarItem.tooltip = 'Click to show pending comment changes';
        statusBarItem.show();
    } else {
        statusBarItem.hide();
    }
}
function calculateDeletedLines(original: string, modified: string): DeletedLine[] {
    const origLines = original.split('\n');
    const modLines = modified.split('\n');
    const deleted: DeletedLine[] = [];
    let origIdx = 0;
    let modIdx = 0;
    while (origIdx < origLines.length) {
        if (modIdx < modLines.length && origLines[origIdx] === modLines[modIdx]) {
            origIdx++;
            modIdx++;
        } else {
            const content = origLines[origIdx].trim();
            if (content.length > 0) {
                deleted.push({
                    originalLineNumber: origIdx,
                    targetLineNumber: modIdx,
                    content: origLines[origIdx]
                });
            }
            origIdx++;
        }
    }
    return deleted;
}
function updateUI(): void {
    const editor = vscode.window.activeTextEditor;
    const totalPending = pendingChanges.size;
    vscode.commands.executeCommand('setContext', 'commentRemover.hasPendingChanges', totalPending > 0);
    if (editor) {
        const hasPending = pendingChanges.has(editor.document.uri.fsPath);
        vscode.commands.executeCommand('setContext', 'commentRemover.currentFileHasChanges', hasPending);
        if (hasPending) {
            applyGhostLineDecorations(editor);
        } else {
            clearAllGhostDecorations(editor);
        }
    }
    updateStatusBar();
}
export function initialize(context: vscode.ExtensionContext): void {
    fileDecorationProvider = new PendingChangeDecorationProvider();
    context.subscriptions.push(
        vscode.window.registerFileDecorationProvider(fileDecorationProvider)
    );
    createStatusBar();
    context.subscriptions.push(statusBarItem);
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(() => {
            updateUI();
        })
    );
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(e => {
            const filePath = e.document.uri.fsPath;
            const change = pendingChanges.get(filePath);
            if (!change) {
                return;
            }
            const currentContent = e.document.getText();
            if (currentContent === change.originalContent) {
                clearPendingChange(filePath);
                return;
            }
            change.deletedLines = calculateDeletedLines(change.originalContent, currentContent);
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.uri.fsPath === filePath) {
                applyGhostLineDecorations(editor);
            }
        })
    );
    updateUI();
}
export function dispose(): void {
    pendingChanges.clear();
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        clearAllGhostDecorations(editor);
    }
    statusBarItem?.dispose();
    fileDecorationProvider?.dispose();
}
export function addPendingChange(
    fileUri: vscode.Uri,
    originalContent: string,
    newContent: string
): void {
    const deletedLines = calculateDeletedLines(originalContent, newContent);
    pendingChanges.set(fileUri.fsPath, {
        fileUri,
        originalContent,
        deletedLines,
        timestamp: Date.now()
    });
    fileDecorationProvider?.refresh(fileUri);
    updateUI();
    setTimeout(() => updateUI(), 100);
    setTimeout(() => updateUI(), 300);
}
export function hasPendingChanges(filePath: string): boolean {
    return pendingChanges.has(filePath);
}
export function getAllPendingChanges(): Map<string, PendingChange> {
    return pendingChanges;
}
export function clearPendingChange(filePath: string): void {
    const change = pendingChanges.get(filePath);
    if (!change) {
        return;
    }
    pendingChanges.delete(filePath);
    fileDecorationProvider?.refresh(change.fileUri);
    const editor = vscode.window.activeTextEditor;
    if (editor && editor.document.uri.fsPath === filePath) {
        clearAllGhostDecorations(editor);
    }
    updateUI();
}
export function clearAllPendingChanges(): void {
    const uris = Array.from(pendingChanges.values()).map(c => c.fileUri);
    pendingChanges.clear();
    uris.forEach(uri => fileDecorationProvider?.refresh(uri));
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        clearAllGhostDecorations(editor);
    }
    updateUI();
}
export async function keepChange(filePath: string): Promise<boolean> {
    if (!pendingChanges.has(filePath)) {
        vscode.window.showInformationMessage('No pending changes for this file');
        return false;
    }
    clearPendingChange(filePath);
    vscode.window.showInformationMessage(`✓ Kept: ${path.basename(filePath)}`);
    return true;
}
export async function undoChange(filePath: string): Promise<boolean> {
    const change = pendingChanges.get(filePath);
    if (!change) {
        vscode.window.showInformationMessage('No pending changes for this file');
        return false;
    }
    try {
        const document = await vscode.workspace.openTextDocument(change.fileUri);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        edit.replace(change.fileUri, fullRange, change.originalContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        clearPendingChange(filePath);
        vscode.window.showInformationMessage(`↩ Restored: ${path.basename(filePath)}`);
        return true;
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to restore: ${path.basename(filePath)}`);
        return false;
    }
}
export async function keepAllChanges(): Promise<void> {
    const count = pendingChanges.size;
    if (count === 0) {
        vscode.window.showInformationMessage('No pending changes');
        return;
    }
    const files = Array.from(pendingChanges.keys());
    for (const filePath of files) {
        clearPendingChange(filePath);
    }
    vscode.window.showInformationMessage(`✓ Kept changes in ${count} file(s)`);
}
export async function undoAllChanges(): Promise<void> {
    const count = pendingChanges.size;
    if (count === 0) {
        vscode.window.showInformationMessage('No pending changes');
        return;
    }
    const files = Array.from(pendingChanges.keys());
    let undone = 0;
    for (const filePath of files) {
        if (await undoChange(filePath)) {
            undone++;
        }
    }
    vscode.window.showInformationMessage(`↩ Restored ${undone} file(s)`);
}
export function goToNextFile(): void {
    const files = Array.from(pendingChanges.keys());
    if (files.length === 0) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    const currentPath = editor?.document.uri.fsPath;
    let nextIndex = 0;
    if (currentPath && files.includes(currentPath)) {
        const currentIndex = files.indexOf(currentPath);
        nextIndex = (currentIndex + 1) % files.length;
    }
    vscode.window.showTextDocument(vscode.Uri.file(files[nextIndex]));
}
export function goToPrevFile(): void {
    const files = Array.from(pendingChanges.keys());
    if (files.length === 0) {
        return;
    }
    const editor = vscode.window.activeTextEditor;
    const currentPath = editor?.document.uri.fsPath;
    let prevIndex = files.length - 1;
    if (currentPath && files.includes(currentPath)) {
        const currentIndex = files.indexOf(currentPath);
        prevIndex = (currentIndex - 1 + files.length) % files.length;
    }
    vscode.window.showTextDocument(vscode.Uri.file(files[prevIndex]));
}
export async function showQuickPick(): Promise<void> {
    const changes = Array.from(pendingChanges.entries());
    if (changes.length === 0) {
        vscode.window.showInformationMessage('No pending changes');
        return;
    }
    interface QuickPickItem extends vscode.QuickPickItem {
        action: 'keepAll' | 'undoAll' | 'open';
        filePath?: string;
    }
    const items: QuickPickItem[] = [
        { label: '$(check-all) Keep All', description: `${changes.length} file(s)`, action: 'keepAll' },
        { label: '$(discard) Undo All', description: `${changes.length} file(s)`, action: 'undoAll' },
        { label: '', kind: vscode.QuickPickItemKind.Separator, action: 'open' },
        ...changes.map(([filePath, change]) => ({
            label: `$(file) ${path.basename(filePath)}`,
            description: `${change.deletedLines.length} comments removed`,
            detail: path.dirname(filePath),
            action: 'open' as const,
            filePath
        }))
    ];
    const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Pending comment changes'
    });
    if (!selected) {
        return;
    }
    switch (selected.action) {
        case 'keepAll':
            await keepAllChanges();
            break;
        case 'undoAll':
            await undoAllChanges();
            break;
        case 'open':
            if (selected.filePath) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(selected.filePath));
                await vscode.window.showTextDocument(doc);
            }
            break;
    }
}
export const initStatusBar = (): void => { };
export const disposeStatusBar = (): void => { };
export const disposeDecorationTypes = (): void => { };
export const initFileDecorationProvider = (_ctx: vscode.ExtensionContext): void => { };
export const setupEditorListener = (_ctx: vscode.ExtensionContext): void => { };
export const applyInlineDecorations = (editor: vscode.TextEditor): void => {
    applyGhostLineDecorations(editor);
};
export const goToNextHunk = goToNextFile;
export const goToPrevHunk = goToPrevFile;
export const showPendingChangesQuickPick = showQuickPick;
export class OriginalContentProvider implements vscode.TextDocumentContentProvider {
    provideTextDocumentContent(uri: vscode.Uri): string {
        const change = pendingChanges.get(uri.with({ scheme: 'file' }).fsPath);
        return change?.originalContent || '';
    }
}
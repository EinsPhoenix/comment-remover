import * as vscode from 'vscode';
import * as path from 'path';
import { processFile, processFolder, undoLastRemoval } from '../core/fileProcessor';
import {
    getIgnorePatterns,
    addIgnorePattern,
    removeIgnorePattern,
    getPreserveCommentPrefixes,
    addPreservePrefix,
    removePreservePrefix,
    getIgnoredDirectories,
    addIgnoredDirectory,
    removeIgnoredDirectory,
    resetIgnoredDirectories,
    DEFAULT_IGNORED_DIRS,
    getConfig
} from '../core/config';
import {
    keepChange,
    undoChange,
    keepAllChanges,
    undoAllChanges,
    showPendingChangesQuickPick,
    hasPendingChanges,
    getAllPendingChanges,
    goToNextHunk,
    goToPrevHunk
} from '../core/changeReview';
export function registerCommands(
    context: vscode.ExtensionContext,
    outputChannel: vscode.OutputChannel
): void {
    const removeCommentsFromFile = vscode.commands.registerCommand(
        'comment-remover.removeCommentsFromFile',
        async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('No file selected');
                return;
            }
            outputChannel.clear();
            outputChannel.appendLine(`Processing file: ${uri.fsPath}`);
            outputChannel.appendLine('---');
            const wasProcessed = await processFile(uri, outputChannel, true);
            if (wasProcessed) {
                outputChannel.appendLine('---');
                outputChannel.appendLine('Completed successfully');
                outputChannel.show(true);
                vscode.window.showInformationMessage(`Comments removed from: ${path.basename(uri.fsPath)}`);
            } else {
                vscode.window.showInformationMessage(`No comments found in: ${path.basename(uri.fsPath)}`);
            }
        }
    );
    const removeCommentsFromFolder = vscode.commands.registerCommand(
        'comment-remover.removeCommentsFromFolder',
        async (uri: vscode.Uri) => {
            if (!uri) {
                vscode.window.showErrorMessage('No folder selected');
                return;
            }
            vscode.window.showInformationMessage('Processing folder...');
            const processedCount = await processFolder(uri, outputChannel);
            if (processedCount > 0) {
                vscode.window.showInformationMessage(
                    `Comments removed from ${processedCount} file(s) in folder: ${path.basename(uri.fsPath)}`
                );
            } else {
                vscode.window.showInformationMessage(
                    `No comments found in folder: ${path.basename(uri.fsPath)}`
                );
            }
        }
    );
    const undoLastRemovalCommand = vscode.commands.registerCommand(
        'comment-remover.undoLastRemoval',
        async () => {
            await undoLastRemoval();
        }
    );
    const addIgnorePatternCommand = vscode.commands.registerCommand(
        'comment-remover.addIgnorePattern',
        async () => {
            const pattern = await vscode.window.showInputBox({
                prompt: 'Enter a pattern to ignore (e.g., *.css, test.txt, **/*.min.js)',
                placeHolder: '*.css',
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return 'Pattern cannot be empty';
                    }
                    return null;
                }
            });
            if (pattern) {
                await addIgnorePattern(pattern.trim());
                vscode.window.showInformationMessage(`Added ignore pattern: ${pattern}`);
            }
        }
    );
    const removeIgnorePatternCommand = vscode.commands.registerCommand(
        'comment-remover.removeIgnorePattern',
        async () => {
            const patterns = getIgnorePatterns();
            if (patterns.length === 0) {
                vscode.window.showInformationMessage('No ignore patterns configured');
                return;
            }
            const selected = await vscode.window.showQuickPick(patterns, {
                placeHolder: 'Select a pattern to remove',
                canPickMany: false
            });
            if (selected) {
                await removeIgnorePattern(selected);
                vscode.window.showInformationMessage(`Removed ignore pattern: ${selected}`);
            }
        }
    );
    const showIgnorePatternsCommand = vscode.commands.registerCommand(
        'comment-remover.showIgnorePatterns',
        async () => {
            const patterns = getIgnorePatterns();
            if (patterns.length === 0) {
                vscode.window.showInformationMessage('No ignore patterns configured. Go to Settings > Comment Remover to add patterns.');
                return;
            }
            const message = `Current ignore patterns:\n${patterns.map(p => `• ${p}`).join('\n')}`;
            vscode.window.showInformationMessage(message, 'Open Settings').then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'commentRemover.ignorePatterns');
                }
            });
        }
    );
    const addPreservePrefixCommand = vscode.commands.registerCommand(
        'comment-remover.addPreservePrefix',
        async () => {
            const prefix = await vscode.window.showInputBox({
                prompt: 'Enter a character or string to preserve after comment marker (e.g., "/" for "///", "!" for "//!")',
                placeHolder: '/',
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return 'Prefix cannot be empty';
                    }
                    return null;
                }
            });
            if (prefix) {
                await addPreservePrefix(prefix.trim());
                vscode.window.showInformationMessage(`Added preserve prefix: "${prefix}" - Comments like "//${prefix}..." will be preserved`);
            }
        }
    );
    const removePreservePrefixCommand = vscode.commands.registerCommand(
        'comment-remover.removePreservePrefix',
        async () => {
            const prefixes = getPreserveCommentPrefixes();
            if (prefixes.length === 0) {
                vscode.window.showInformationMessage('No preserve prefixes configured');
                return;
            }
            const selected = await vscode.window.showQuickPick(
                prefixes.map(p => ({ label: `"${p}"`, description: `Preserves "//${p}..." comments`, value: p })),
                {
                    placeHolder: 'Select a prefix to remove',
                    canPickMany: false
                }
            );
            if (selected) {
                await removePreservePrefix(selected.value);
                vscode.window.showInformationMessage(`Removed preserve prefix: "${selected.value}"`);
            }
        }
    );
    const showPreservePrefixesCommand = vscode.commands.registerCommand(
        'comment-remover.showPreservePrefixes',
        async () => {
            const prefixes = getPreserveCommentPrefixes();
            if (prefixes.length === 0) {
                vscode.window.showInformationMessage('No preserve prefixes configured. Add prefixes to preserve specific comment types like "///" or "//!"');
                return;
            }
            const message = `Preserved comment prefixes:\n${prefixes.map(p => `• "//${p}..." and "#${p}..."`).join('\n')}`;
            vscode.window.showInformationMessage(message, 'Open Settings').then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'commentRemover.preserveCommentPrefixes');
                }
            });
        }
    );
    const addIgnoredDirectoryCommand = vscode.commands.registerCommand(
        'comment-remover.addIgnoredDirectory',
        async () => {
            const dir = await vscode.window.showInputBox({
                prompt: 'Enter a directory name to ignore (e.g., "vendor", "generated")',
                placeHolder: 'vendor',
                validateInput: (value) => {
                    if (!value || value.trim() === '') {
                        return 'Directory name cannot be empty';
                    }
                    return null;
                }
            });
            if (dir) {
                await addIgnoredDirectory(dir.trim());
                vscode.window.showInformationMessage(`Added ignored directory: ${dir}`);
            }
        }
    );
    const removeIgnoredDirectoryCommand = vscode.commands.registerCommand(
        'comment-remover.removeIgnoredDirectory',
        async () => {
            const dirs = getIgnoredDirectories();
            if (dirs.length === 0) {
                vscode.window.showInformationMessage('No ignored directories configured');
                return;
            }
            const isDefault = (dir: string) => DEFAULT_IGNORED_DIRS.includes(dir);
            const selected = await vscode.window.showQuickPick(
                dirs.map(d => ({
                    label: d,
                    description: isDefault(d) ? '(default)' : '(custom)',
                    value: d
                })),
                {
                    placeHolder: 'Select a directory to remove from ignore list',
                    canPickMany: false
                }
            );
            if (selected) {
                await removeIgnoredDirectory(selected.value);
                vscode.window.showInformationMessage(`Removed ignored directory: ${selected.value}`);
            }
        }
    );
    const showIgnoredDirectoriesCommand = vscode.commands.registerCommand(
        'comment-remover.showIgnoredDirectories',
        async () => {
            const dirs = getIgnoredDirectories();
            const isDefault = (dir: string) => DEFAULT_IGNORED_DIRS.includes(dir);
            const defaultDirs = dirs.filter(isDefault);
            const customDirs = dirs.filter(d => !isDefault(d));
            let message = 'Ignored directories:\n';
            if (defaultDirs.length > 0) {
                message += `\nDefault: ${defaultDirs.join(', ')}`;
            }
            if (customDirs.length > 0) {
                message += `\nCustom: ${customDirs.join(', ')}`;
            }
            vscode.window.showInformationMessage(message, 'Open Settings', 'Reset to Default').then(selection => {
                if (selection === 'Open Settings') {
                    vscode.commands.executeCommand('workbench.action.openSettings', 'commentRemover.ignoredDirectories');
                } else if (selection === 'Reset to Default') {
                    resetIgnoredDirectories().then(() => {
                        vscode.window.showInformationMessage('Ignored directories reset to default');
                    });
                }
            });
        }
    );
    const showAllSettingsCommand = vscode.commands.registerCommand(
        'comment-remover.showAllSettings',
        async () => {
            const config = getConfig();
            const items = [
                { label: 'Ignore Patterns', description: `${config.ignorePatterns.length} pattern(s)`, command: 'commentRemover.ignorePatterns' },
                { label: 'Ignored Directories', description: `${config.ignoredDirectories.length} director(ies)`, command: 'commentRemover.ignoredDirectories' },
                { label: 'Preserve Prefixes', description: config.preserveCommentPrefixes.length > 0 ? config.preserveCommentPrefixes.map(p => `"//${p}"`).join(', ') : 'None', command: 'commentRemover.preserveCommentPrefixes' },
                { label: 'Remove Line Comments', description: config.removeLineComments ? 'Yes' : 'No', command: 'commentRemover.removeLineComments' },
                { label: 'Remove Block Comments', description: config.removeBlockComments ? 'Yes' : 'No', command: 'commentRemover.removeBlockComments' },
                { label: 'Remove Empty Lines', description: config.removeEmptyLines ? 'Yes' : 'No', command: 'commentRemover.removeEmptyLines' },
                { label: 'Preserve JSDoc Comments', description: config.preserveJSDocComments ? 'Yes' : 'No', command: 'commentRemover.preserveJSDocComments' },
                { label: 'Review Changes Before Applying', description: config.reviewChangesBeforeApplying ? 'Yes' : 'No', command: 'commentRemover.reviewChangesBeforeApplying' }
            ];
            const selected = await vscode.window.showQuickPick(items, {
                placeHolder: 'Comment Remover Settings - Select to configure',
                canPickMany: false
            });
            if (selected) {
                vscode.commands.executeCommand('workbench.action.openSettings', selected.command);
            }
        }
    );
    const keepChangesCommand = vscode.commands.registerCommand(
        'comment-remover.keepChanges',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }
            const filePath = editor.document.uri.fsPath;
            if (!hasPendingChanges(filePath)) {
                vscode.window.showInformationMessage('No pending changes in this file');
                return;
            }
            await keepChange(filePath);
        }
    );
    const undoChangesCommand = vscode.commands.registerCommand(
        'comment-remover.undoChanges',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                vscode.window.showInformationMessage('No active editor');
                return;
            }
            const filePath = editor.document.uri.fsPath;
            if (!hasPendingChanges(filePath)) {
                vscode.window.showInformationMessage('No pending changes in this file');
                return;
            }
            await undoChange(filePath);
        }
    );
    const showPendingChangesCommand = vscode.commands.registerCommand(
        'comment-remover.showPendingChanges',
        async () => {
            await showPendingChangesQuickPick();
        }
    );
    const keepAllChangesCommand = vscode.commands.registerCommand(
        'comment-remover.keepAllChanges',
        async () => {
            await keepAllChanges();
        }
    );
    const undoAllChangesCommand = vscode.commands.registerCommand(
        'comment-remover.undoAllChanges',
        async () => {
            await undoAllChanges();
        }
    );
    const nextChangeCommand = vscode.commands.registerCommand(
        'comment-remover.nextChange',
        () => {
            goToNextHunk();
        }
    );
    const prevChangeCommand = vscode.commands.registerCommand(
        'comment-remover.prevChange',
        () => {
            goToPrevHunk();
        }
    );
    context.subscriptions.push(
        removeCommentsFromFile,
        removeCommentsFromFolder,
        undoLastRemovalCommand,
        addIgnorePatternCommand,
        removeIgnorePatternCommand,
        showIgnorePatternsCommand,
        addPreservePrefixCommand,
        removePreservePrefixCommand,
        showPreservePrefixesCommand,
        addIgnoredDirectoryCommand,
        removeIgnoredDirectoryCommand,
        showIgnoredDirectoriesCommand,
        showAllSettingsCommand,
        keepChangesCommand,
        undoChangesCommand,
        showPendingChangesCommand,
        keepAllChangesCommand,
        undoAllChangesCommand,
        nextChangeCommand,
        prevChangeCommand
    );
}
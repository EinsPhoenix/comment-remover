import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { removeComments } from './commentRemover';
import { shouldIgnoreFile, shouldIgnoreDirectory } from '../utils/patternMatcher';
import { getIgnorePatterns, getIgnoredDirectories } from './config';
export interface UndoEntry {
    filePath: string;
    originalContent: string;
}
let undoStack: UndoEntry[] = [];
export function getUndoStack(): UndoEntry[] {
    return undoStack;
}
export function clearUndoStack(): void {
    undoStack = [];
}
export function popUndoEntry(): UndoEntry | undefined {
    return undoStack.pop();
}
export async function processFile(
    fileUri: vscode.Uri,
    outputChannel: vscode.OutputChannel,
    showInEditor: boolean = false
): Promise<boolean> {
    try {
        const ignorePatterns = getIgnorePatterns();
        if (shouldIgnoreFile(fileUri.fsPath, ignorePatterns)) {
            outputChannel.appendLine(`⊘ Ignored: ${fileUri.fsPath}`);
            return false;
        }
        const document = await vscode.workspace.openTextDocument(fileUri);
        if (document.isDirty) {
            await document.save();
        }
        const originalContent = document.getText();
        const processedContent = removeComments(originalContent);
        if (originalContent === processedContent) {
            return false;
        }
        undoStack.push({
            filePath: fileUri.fsPath,
            originalContent: originalContent
        });
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(originalContent.length)
        );
        edit.replace(fileUri, fullRange, processedContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        outputChannel.appendLine(`✓ Processed: ${fileUri.fsPath}`);
        if (showInEditor) {
            await vscode.window.showTextDocument(document, { preview: false });
        }
        return true;
    } catch (error) {
        console.error(`Error processing file ${fileUri.fsPath}:`, error);
        outputChannel.appendLine(`✗ Error: ${fileUri.fsPath}`);
        return false;
    }
}
export async function getAllFiles(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    const ignorePatterns = getIgnorePatterns();
    const ignoredDirectories = getIgnoredDirectories();
    try {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            if (entry.isDirectory()) {
                if (shouldIgnoreDirectory(fullPath, entry.name, ignorePatterns, ignoredDirectories)) {
                    continue;
                }
                const subFiles = await getAllFiles(fullPath);
                files.push(...subFiles);
            } else if (entry.isFile()) {
                if (!shouldIgnoreFile(fullPath, ignorePatterns)) {
                    files.push(fullPath);
                }
            }
        }
    } catch (error) {
        console.error(`Error reading directory ${dirPath}:`, error);
    }
    return files;
}
export async function processFolder(
    folderUri: vscode.Uri,
    outputChannel: vscode.OutputChannel
): Promise<number> {
    try {
        const files = await getAllFiles(folderUri.fsPath);
        let processedCount = 0;
        outputChannel.clear();
        outputChannel.appendLine(`Processing folder: ${folderUri.fsPath}`);
        outputChannel.appendLine(`Found ${files.length} file(s) (after applying ignore patterns)`);
        outputChannel.appendLine('---');
        for (const filePath of files) {
            const fileUri = vscode.Uri.file(filePath);
            const wasProcessed = await processFile(fileUri, outputChannel, false);
            if (wasProcessed) {
                processedCount++;
            }
        }
        outputChannel.appendLine('---');
        outputChannel.appendLine(`Completed: ${processedCount} file(s) processed`);
        outputChannel.show(true);
        return processedCount;
    } catch (error) {
        console.error(`Error processing folder ${folderUri.fsPath}:`, error);
        outputChannel.appendLine(`✗ Error processing folder: ${error}`);
        return 0;
    }
}
export async function undoLastRemoval(): Promise<boolean> {
    const lastEntry = popUndoEntry();
    if (!lastEntry) {
        vscode.window.showInformationMessage('Nothing to undo');
        return false;
    }
    try {
        const fileUri = vscode.Uri.file(lastEntry.filePath);
        const document = await vscode.workspace.openTextDocument(fileUri);
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length)
        );
        edit.replace(fileUri, fullRange, lastEntry.originalContent);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        vscode.window.showInformationMessage(`Undo successful: ${path.basename(lastEntry.filePath)}`);
        return true;
    } catch (error) {
        console.error(`Error undoing for file ${lastEntry.filePath}:`, error);
        vscode.window.showErrorMessage(`Failed to undo: ${path.basename(lastEntry.filePath)}`);
        return false;
    }
}

import * as vscode from 'vscode';
import { registerCommands } from './commands';
import { clearUndoStack } from './core/fileProcessor';

let outputChannel: vscode.OutputChannel;

export function activate(context: vscode.ExtensionContext) {
	console.log('Extension "comment-remover" is now active');

	outputChannel = vscode.window.createOutputChannel('Comment Remover');
	context.subscriptions.push(outputChannel);

	registerCommands(context, outputChannel);
}

export function deactivate() {
	clearUndoStack();
}
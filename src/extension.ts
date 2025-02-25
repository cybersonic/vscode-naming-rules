// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Logger from './utils/logger';
import * as path from 'path';
// import { NamingConventionChecker } from '../naming-convention/index';

// Todo: `npm link` (allows linking without publishing)
import { scanFolder } from 'naming-rules';

const logger = new Logger('[NamingRC]');
let diagnosticCollection: vscode.DiagnosticCollection;

export async function activate(context: vscode.ExtensionContext) {

	const decorationProvider = new NamingIssueDecorationProvider();

	context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));

	diagnosticCollection = vscode.languages.createDiagnosticCollection('namingConventions');
	context.subscriptions.push(diagnosticCollection);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('vscode-naming-conventions.checkRules', () => {
		vscode.window.showInformationMessage('Checking the rules');

		vscodeRuleScan(diagnosticCollection, decorationProvider);
	});
	context.subscriptions.push(disposable)


	// Watch for changes in the entire workspace
	const workspaceWatcher = vscode.workspace.createFileSystemWatcher('**/*', false, false, false);

	workspaceWatcher.onDidCreate(() => {
		// Files or folders added. Optionally only scan if they match your rules.
		vscodeRuleScan(diagnosticCollection, decorationProvider);
	});
	workspaceWatcher.onDidChange(() => {
		// Files changed.
		vscodeRuleScan(diagnosticCollection, decorationProvider);
	});
	workspaceWatcher.onDidDelete(() => {
		// Files removed.
		vscodeRuleScan(diagnosticCollection, decorationProvider);
	});

	context.subscriptions.push(workspaceWatcher);

	// Run the scan on activation
	vscodeRuleScan(diagnosticCollection, decorationProvider);

	logger.log('Started Naming Rules Extension');
}

function vscodeRuleScan(diagnosticCollection: vscode.DiagnosticCollection, decorationProvider: NamingIssueDecorationProvider) {
	const diagnostics = scanFolder(vscode.workspace.rootPath || '');

	let diagnosticStruct: { [key: string]: vscode.Diagnostic[] } = {};


	// Clear existing diagnostics
	diagnosticCollection.clear();
	// Clear existing decorations
	decorationProvider.updateIssues([]);
	for (const diagnostic of diagnostics) {
		// vscode.window.showInformationMessage(diagnostic.message);
		// Ranges are 1-based, so we need to convert them to 0-based

		const startLine = Math.max(0, diagnostic.range.start.line - 1);
		const endLine = Math.max(0, diagnostic.range.end.line - 1);
		const startColumn = Math.max(0, diagnostic.range.start.column - 1);
		const endColumn = Math.max(0, diagnostic.range.end.column - 1);


		const diagnosticItem = new vscode.Diagnostic(

			new vscode.Range(
				new vscode.Position(startLine, startColumn),
				new vscode.Position(endLine, endColumn)
			),
			diagnostic.message,
			Math.max(0, diagnostic.severity - 1)
		);
		diagnosticItem.source = 'Naming Convention';

		// Terniary but with obejct. Not super readable but it works.
		diagnosticItem.code = diagnostic.href ? {

			value: diagnostic.getRuleNickname(),
			target: vscode.Uri.parse(diagnostic.href)
		} : diagnostic.getRuleNickname();

		if (diagnostic.uri in diagnosticStruct) {
			diagnosticStruct[diagnostic.uri].push(diagnosticItem);
		}
		else {
			diagnosticStruct[diagnostic.uri] = [diagnosticItem];
		}

	}

	// We can now loop and set the diagnostics
	for (const uri in diagnosticStruct) {
		diagnosticCollection.set(vscode.Uri.file(uri), diagnosticStruct[uri]);
	}

	const misnamedUris = diagnostics.map(d => d.uri);
	decorationProvider.updateIssues(misnamedUris);
	// console.log(diagnostics);
}


class NamingIssueDecorationProvider implements vscode.FileDecorationProvider {
	private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[]> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
	onDidChangeFileDecorations?: vscode.Event<vscode.Uri | vscode.Uri[]> = this._onDidChangeFileDecorations.event;

	// A map of misnamed items. This can be updated when you scan and find issues.
	private misnamedItems = new Set<string>();

	// Call this method when your diagnostics update.
	public updateIssues(uris: string[]) {
		this.misnamedItems = new Set(uris);
		this._onDidChangeFileDecorations.fire(Array.from(this.misnamedItems).map(uri => vscode.Uri.file(uri)));
	}

	provideFileDecoration(uri: vscode.Uri, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {


		if (!this.misnamedItems.has(uri.fsPath)) {
			return;
		}
		const diagnostics = diagnosticCollection.get(uri);
		if (!diagnostics) {
			return;
		}
		for (const diagnostic of diagnostics) {
			const severity = Math.max(0, diagnostic.severity - 1);

			if (severity === vscode.DiagnosticSeverity.Error) {
				return {
					badge: '!',
					tooltip: diagnostic.message,
					color: new vscode.ThemeColor('problemsErrorIcon.foreground')
				};
			}
			else if (severity === vscode.DiagnosticSeverity.Warning) {
				return {
					badge: '⚠️',
					tooltip: diagnostic.message,
					color: new vscode.ThemeColor('problemsWarningIcon.foreground')
				};
			}
			else if (severity === vscode.DiagnosticSeverity.Information) {
				return {
					badge: 'ℹ️',
					tooltip: diagnostic.message,
					color: new vscode.ThemeColor('problemsInfoIcon.foreground')
				};
			}
			else if (severity === vscode.DiagnosticSeverity.Hint) {
				return {
					badge: '💡',
					tooltip: diagnostic.message,
					color: new vscode.ThemeColor('problemsHintIcon.foreground')
				};
			}
		}
		return;
	}
}
// This method is called when your extension is deactivated
export function deactivate() { }

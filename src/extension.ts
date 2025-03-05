// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import Logger from './utils/logger';
import * as path from 'path';

// Todo: `npm link` (allows linking without publishing)
import { scanFolder, scanFile, scan } from 'naming-rules';


const logger = new Logger('[NamingRC]');
const namingrcfile = '.namingrc.json';

let diagnosticCollection: vscode.DiagnosticCollection;
let rulesWatchers: vscode.FileSystemWatcher[] = [];
let namingConfig = {};
export async function activate(context: vscode.ExtensionContext) {

	const decorationProvider = new NamingIssueDecorationProvider();

	context.subscriptions.push(vscode.window.registerFileDecorationProvider(decorationProvider));

	diagnosticCollection = vscode.languages.createDiagnosticCollection('namingRules');
	context.subscriptions.push(diagnosticCollection);

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let CheckRulesCommand = vscode.commands.registerCommand('vscode-naming-rules.checkRules', () => {
		vscode.window.showInformationMessage('Checking the rules');
		vscodeRuleScan(diagnosticCollection, decorationProvider);
	});

	context.subscriptions.push(CheckRulesCommand)



	// Add a function to open the namingrc file
	let openNamingRulesFile = vscode.commands.registerCommand('vscode-naming-rules.openConfig', () => {
		vscode.window.showInformationMessage('Opening Namning Rules');

		vscode.workspace.findFiles(`${namingrcfile}`, '**/(node_modules|.git)/**', 1).then((uris) => {
			if (uris.length > 0) {
				vscode.window.showTextDocument(uris[0]);
			}
			else {
				vscode.window.showErrorMessage('No namingrc file found');
			}
		});
	});

	context.subscriptions.push(openNamingRulesFile)



	// We look for changes to the namingrc file
	const namingRcWatcher = vscode.workspace.createFileSystemWatcher(
		`**/${namingrcfile}`,
		false,
		false,
		false
	);
	namingRcWatcher.onDidChange(() => {
		logger.log("Namingrc file changed");
		createGlobWatchers(context);
		vscodeRuleScan(diagnosticCollection, decorationProvider);
	}
	);
	namingRcWatcher.onDidCreate(() => {
		logger.log("Namingrc file created");
		createGlobWatchers(context);
		vscodeRuleScan(diagnosticCollection, decorationProvider);
	}
	);
	namingRcWatcher.onDidDelete(() => {
		logger.log("Namingrc file deleted");



		// Clear existing diagnostics
		diagnosticCollection.clear();

		// Clear existing decorations
		decorationProvider.updateIssues([]);

		// This might error
		createGlobWatchers(context);

	}
	);
	context.subscriptions.push(namingRcWatcher);
	// Now we added a watcher, we can now run our scans
	vscodeRuleScan(diagnosticCollection, decorationProvider);

	// how to remove them when we update the file
	createGlobWatchers(context);

	logger.log('Started Naming Rules Extension');
}



async function createGlobWatchers(context: vscode.ExtensionContext) {

	// Dispose of existing watchers
	rulesWatchers.forEach(watcher => watcher.dispose());
	const decorationProvider = new NamingIssueDecorationProvider();
	const namingfiles: vscode.Uri[] = await vscode.workspace.findFiles('**/.namingrc.json', '**/(node_modules|.git)/**', 10);
	let allGlobs: string[] = [];
	// Set the global naming config
	if (namingfiles.length >= 1) {
		namingConfig = await vscode.workspace.fs.readFile(namingfiles[0]).then((data) => JSON.parse(data.toString()));
	}

	// Just use one at the root for now
	for (const namingfile of namingfiles) {
		const namingJSON = vscode.workspace.fs.readFile(namingfile);
		const theseglobs = await namingJSON.then((data) => {
			const rules = JSON.parse(data.toString())['rules'] || [];
			let globsToWatch = rules.map((rule: any) => rule.includes);
			for (const glob of globsToWatch) {
				allGlobs.push(glob);
			}
		});
	}
	const dedupeGlobs = Array.from(new Set(allGlobs));

	const globString: string = "{" + dedupeGlobs.join(',') + "}";
	addWatcherForGlob(globString, context);

	// for (const glob of dedupeGlobs) {
	// 	addWatcherForGlob(glob, context);
	// }

}

function addWatcherForGlob(glob: string, context: vscode.ExtensionContext) {

	console.log(`Adding glob watcher for [${glob}]`);

	let base: string = vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri.fsPath : "/";

	const pattern = new vscode.RelativePattern(base, glob);

	const watcher = vscode.workspace.createFileSystemWatcher(
		pattern,
		false,
		false,
		false
	);
	watcher.onDidCreate((file) => {
		console.log("File created", file.path);
		// Files or folders added. Optionally only scan if they match your rules.
		vscodeRuleScanForFile(file, diagnosticCollection);
	});
	watcher.onDidChange((file) => {
		console.log("File changed", file.path);
		diagnosticCollection.delete(file);
		// Files changed.
		vscodeRuleScanForFile(file, diagnosticCollection);
	});
	watcher.onDidDelete((file) => {
		console.log("File deleted", file.path);
		diagnosticCollection.delete(file);
		// vscodeRuleScanForFile(file, diagnosticCollection);
	});
	rulesWatchers.push(watcher);
	context.subscriptions.push(watcher);
}

function vscodeRuleScanForFile(filePath: vscode.Uri, diagnosticCollection: vscode.DiagnosticCollection) {


	// decorationProvider: NamingIssueDecorationProvider
	diagnosticCollection.delete(filePath);
	// TODO: get the config or it might be just left to the scan function
	const diagnostics = scan(filePath.fsPath, namingConfig).then((diagnostics) => {
		for (const fileDiagnostic of diagnostics) {
			console.log({ fileDiagnostic });
		}
	});


	// let diagnosticStruct: { [key: string]: vscode.Diagnostic[] } = {};
	// decorationProvider.updateIssues([]);

	// for (const diagnostic of diagnostics) {

	// 	const startLine = Math.max(0, diagnostic.range.start.line - 1);
	// 	const endLine = Math.max(0, diagnostic.range.end.line - 1);
	// 	const startColumn = Math.max(0, diagnostic.range.start.column - 1);
	// 	const endColumn = Math.max(0, diagnostic.range.end.column - 1);


	// 	const diagnosticItem = new vscode.Diagnostic(

	// 		new vscode.Range(
	// 			new vscode.Position(startLine, startColumn),
	// 			new vscode.Position(endLine, endColumn)
	// 		),
	// 		diagnostic.message,
	// 		Math.max(0, diagnostic.severity - 1)
	// 	);
	// 	diagnosticItem.source = 'namingrc ';

	// 	// Terniary but with obejct. Not super readable but it works.
	// 	diagnosticItem.code = diagnostic.href ? {

	// 		value: diagnostic.getRuleNickname(),
	// 		target: vscode.Uri.parse(diagnostic.href)
	// 	} : diagnostic.getRuleNickname();

	// 	if (diagnostic.uri in diagnosticStruct) {
	// 		diagnosticStruct[diagnostic.uri].push(diagnosticItem);
	// 	}
	// 	else {
	// 		diagnosticStruct[diagnostic.uri] = [diagnosticItem];
	// 	}

	// }

	// // We can now loop and set the diagnostics
	// for (const uri in diagnosticStruct) {
	// 	diagnosticCollection.set(vscode.Uri.file(uri), diagnosticStruct[uri]);
	// }
}
function vscodeRuleScan(diagnosticCollection: vscode.DiagnosticCollection, decorationProvider: NamingIssueDecorationProvider) {
	scanFolder(vscode.workspace.rootPath || '').then((diagnostics) => {
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
			diagnosticItem.source = 'namingrc ';

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
		decorationProvider.refreshAll();
		// console.log(diagnostics);
	});
}


class NamingIssueDecorationProvider implements vscode.FileDecorationProvider {
	private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[]> = new vscode.EventEmitter<vscode.Uri | vscode.Uri[]>();
	onDidChangeFileDecorations?: vscode.Event<vscode.Uri | vscode.Uri[]> = this._onDidChangeFileDecorations.event;

	// A map of misnamed items. This can be updated when you scan and find issues.
	private misnamedItems = new Set<string>();


	// Your implementation of provideFileDecoration() here

	public refreshAll() {
		// @ts-ignore: Passing undefined to signal that all decorations should be refreshed.
		this._onDidChangeFileDecorations.fire(undefined);
		// Passing `undefined` signals that all decorations should be refreshed.
		// this.misnamedItems = new Set<string>();
		// for (const item in this.misnamedItems) {
		// 	this._onDidChangeFileDecorations.fire(vscode.Uri.parse(item));
		// }
		// const workspaces = vscode.workspace.workspaceFolders?.map(workspace => workspace.uri) || [];
		// this._onDidChangeFileDecorations.fire(workspaces);
	}


	// Call this method when your diagnostics update.
	public updateIssues(uris: string[]) {
		this.misnamedItems = new Set(uris);
		this._onDidChangeFileDecorations.fire(Array.from(this.misnamedItems).map(uri => vscode.Uri.file(uri)));
	}

	provideFileDecoration(uri: vscode.Uri, _token: vscode.CancellationToken): vscode.ProviderResult<vscode.FileDecoration> {
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



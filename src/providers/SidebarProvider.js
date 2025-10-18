const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

class SidebarProvider {
	constructor(context) {
		this.context = context;
		this._view = undefined;
		this._lastAnalysis = { error: "No analysis yet.", fix: "" };
	}

	resolveWebviewView(webviewView) {
		this._view = webviewView;
		const webview = webviewView.webview;

		webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.context.extensionUri, "media"),
			],
		};

		const htmlPath = path.join(
			this.context.extensionUri.fsPath,
			"media",
			"sidebar.html"
		);
		let html = fs.readFileSync(htmlPath, "utf8");

		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, "media", "main.css")
		);
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.context.extensionUri, "media", "sidebar.js")
		);

		html = html
			.replace("{{styleUri}}", styleUri.toString())
			.replace("{{scriptUri}}", scriptUri.toString());
		webview.html = html;

		console.log("SidebarProvider: Resolved webview view");

		webview.onDidReceiveMessage(
			(msg) => {
				console.log("SidebarProvider: Received message from webview:", msg);
				switch (msg.command) {
					case "applyFix":
						this.applyFix(msg.fix);
						break;
					case "requestLast":
						this.postAnalysis(this._lastAnalysis.error, this._lastAnalysis.fix);
						break;

					// Trigger the registered commands
					// 💡 Trigger the registered commands
					case "triggerAnalyze":
						// Corresponds to the runAnalyzeBtn click in sidebar.js
						vscode.window.showInformationMessage("Running analysis...");
						vscode.commands.executeCommand("geminiCode.analyzeSelected");
						break;
					case "triggerScan":
						// Corresponds to the runScanBtn click in sidebar.js
						vscode.commands.executeCommand("geminiCode.scanProject");
						break;
					case "triggerExplain":
						// Corresponds to the runExplainBtn click in sidebar.js
						vscode.commands.executeCommand("geminiCode.explainError");
						break;
					case "openFile":
						this.openFile(msg.file, msg.pos);
						break;
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	postAnalysis(error, fix) {
		this._lastAnalysis = { error, fix };
		if (this._view) {
			this._view.webview.postMessage({ command: "showAnalysis", error, fix });
		}
	}

	postScanResults(results) {
		if (this._view) {
			this._view.webview.postMessage({ command: "showScan", results });
		}
	}

	postExplanation(text) {
		if (this._view) {
			this._view.webview.postMessage({ command: "showExplanation", text });
		}
	}

	async applyFix(fix) {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active editor to apply fix.");
			return;
		}
		const sel = editor.selection;
		const cleaned = fix.replace(/^['"](.*)['"]$/, "$1");
		await editor.edit((b) => b.replace(sel, cleaned));
		vscode.window.showInformationMessage("Applied fix.");
	}
}

module.exports = { SidebarProvider };

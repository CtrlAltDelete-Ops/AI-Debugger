const vscode = require("vscode");
const fs = require("fs");
const path = require("path");

class GeminiAnalystProvider {
	/**
	 * @param {vscode.ExtensionContext} context
	 */
	constructor(context) {
		this._context = context;
		this._view = undefined;
		this._lastSelection = "";

		// Register the WebviewViewProvider for the sidebar
		context.subscriptions.push(
			vscode.window.registerWebviewViewProvider(
				"geminiCodeAnalyst.sidebar",
				this,
				{ webviewOptions: { retainContextWhenHidden: true } }
			)
		);
	}

	/**
	 * Called when the Webview is first created.
	 * @param {vscode.WebviewView} webviewView
	 */
	resolveWebviewView(webviewView) {
		this._view = webviewView;
		this._view.webview.options = {
			enableScripts: true,
		};

		// Set the initial HTML content
		this._view.webview.html = this._getHtmlForWebview(this._view.webview);

		// Handle messages from the Webview
		this._view.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.command) {
					case "applyFix":
						this.applyFix(message.fix);
						return;
					case "requestLastAnalysis":
						// When the sidebar is opened, send the last result
						this.postAnalysisResult(
							message.error || "No analysis run yet.",
							message.fix || "Select code and run the command."
						);
						return;
				}
			},
			null,
			this._context.subscriptions
		);
	}

	/**
	 * Replaces the currently selected text in the active editor with the suggested fix.
	 * @param {string} fix The code fix to apply.
	 */
	async applyFix(fix) {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			vscode.window.showErrorMessage("No active text editor to apply the fix.");
			return;
		}

		const selection = editor.selection;
		// Check if the current selection is the same as what was analyzed
		// This is a basic safety check
		if (
			editor.document.getText(selection).trim() !== this._lastSelection.trim()
		) {
			vscode.window.showWarningMessage(
				"The selected code has changed since the analysis was run. Please re-select and analyze again, or proceed with caution."
			);
			// Still allow applying, but warn the user.
		}

		await editor.edit((editBuilder) => {
			editBuilder.replace(selection, fix.replace(/^"(.*)"$/, "$1"));
		});

		// Clear the selection after applying the fix
		editor.selection = new vscode.Selection(selection.end, selection.end);
		vscode.window.showInformationMessage("Code fix applied successfully.");
	}

	/**
	 * Sends the analysis result (error and fix) to the Webview panel.
	 * @param {string} error
	 * @param {string} fix
	 */
	postAnalysisResult(error, fix) {
		if (this._view) {
			this._view.webview.postMessage({
				command: "showAnalysis",
				error,
				fix,
			});
		}
	}

	/**
	 * @param {vscode.Webview} webview
	 * @returns {string} The full HTML document.
	 */
	_getHtmlForWebview(webview) {
		// Get the URI for a resource, e.g., to load styles or scripts from the extension's folder
		const html = this._context.asAbsolutePath("media/main.html");
		const htmlFile = fs.readFileSync(html, "utf8");
		const styleUri = webview.asWebviewUri(
			vscode.Uri.file(
				path.join(this._context.extensionPath, "media", "main.css")
			)
		);
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.file(
				path.join(this._context.extensionPath, "media", "main.js")
			)
		);

		// Replace the placeholder with the actual style URI
		const finalHtml = htmlFile
			.replace("{{styleUri}}", styleUri)
			.replace("{{scriptUri}}", scriptUri);

		return finalHtml;
	}
}

module.exports = { GeminiAnalystProvider };

// extension.js
const vscode = require("vscode");
const { GoogleGenAI } = require("@google/genai");

/**
 * Manages the Gemini Code Analyst Webview panel.
 */
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
			editBuilder.replace(selection, fix);
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
				error: error,
				fix: fix,
			});
		}
	}

	/**
	 * Generates the clean, modern HTML content for the Webview.
	 * Includes inline styles and script for simplicity.
	 * @param {vscode.Webview} webview
	 * @returns {string} The full HTML document.
	 */
	_getHtmlForWebview(webview) {
		// Get the URI for a resource, e.g., to load styles or scripts from the extension's folder
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this._context.extensionUri, "media", "main.css")
		);

		return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Gemini Code Analyst</title>
                <style>
                    /* Minimal, GitHub Copilot-like modern styles */
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
                        color: var(--vscode-editor-foreground);
                        background-color: var(--vscode-editor-background);
                        padding: 10px;
                        margin: 0;
                    }
                    .tab-container {
                        display: flex;
                        border-bottom: 1px solid var(--vscode-separator-border);
                        margin-bottom: 10px;
                    }
                    .tab {
                        padding: 8px 15px;
                        cursor: pointer;
                        font-weight: 500;
                        border-radius: 5px 5px 0 0;
                        color: var(--vscode-foreground);
                        opacity: 0.6;
                    }
                    .tab.active {
                        opacity: 1;
                        border-bottom: 2px solid var(--vscode-textLink-foreground);
                        color: var(--vscode-textLink-foreground);
                    }
                    .tab-content {
                        padding-top: 10px;
                    }
                    .hidden {
                        display: none;
                    }
                    pre {
                        background-color: var(--vscode-editorGroupHeader-tabsBackground);
                        padding: 10px;
                        border-radius: 4px;
                        overflow-x: auto;
                        white-space: pre-wrap; /* Allows wrapping */
                        word-break: break-all; /* Helps with long lines in code */
                        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
                        font-size: 13px;
                    }
                    #applyFixButton {
                        background-color: var(--vscode-button-background);
                        color: var(--vscode-button-foreground);
                        border: none;
                        padding: 8px 15px;
                        border-radius: 5px;
                        cursor: pointer;
                        width: 100%;
                        margin-top: 15px;
                        font-weight: bold;
                    }
                    #applyFixButton:hover {
                        background-color: var(--vscode-button-hoverBackground);
                    }
                    .loading-spinner {
                        border: 4px solid var(--vscode-editor-background);
                        border-top: 4px solid var(--vscode-textLink-foreground);
                        border-radius: 50%;
                        width: 30px;
                        height: 30px;
                        animation: spin 1s linear infinite;
                        margin: 20px auto;
                    }
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                </style>
            </head>
            <body>
                <div class="tab-container">
                    <div class="tab active" id="error-tab" onclick="switchTab('error')">Error</div>
                    <div class="tab" id="fix-tab" onclick="switchTab('fix')">Fix Suggestion</div>
                </div>

                <div class="tab-content" id="error-content">
                    <p id="errorMessage"><span style="color:var(--vscode-errorForeground)">No analysis run yet. Select code and run 'Analyze Code with Gemini' from the context menu.</span></p>
                </div>

                <div class="tab-content hidden" id="fix-content">
                    <pre id="fixSuggestion">-- Fix code will appear here --</pre>
                    <button id="applyFixButton" disabled>Apply Fix</button>
                </div>

                <div id="loading" class="hidden">
                    <div class="loading-spinner"></div>
                    <p style="text-align: center;">Analyzing code with Gemini...</p>
                </div>

                <script>
                    const vscode = acquireVsCodeApi();
                    let currentFix = '';

                    function switchTab(tabName) {
                        document.getElementById('error-tab').classList.remove('active');
                        document.getElementById('fix-tab').classList.remove('active');
                        document.getElementById('error-content').classList.add('hidden');
                        document.getElementById('fix-content').classList.add('hidden');

                        document.getElementById(tabName + '-tab').classList.add('active');
                        document.getElementById(tabName + '-content').classList.remove('hidden');
                    }

                    // Handle messages from the extension (extension.js)
                    window.addEventListener('message', event => {
                        const message = event.data;
                        switch (message.command) {
                            case 'showAnalysis':
                                document.getElementById('loading').classList.add('hidden');
                                document.getElementById('errorMessage').innerHTML = message.error;
                                document.getElementById('fixSuggestion').textContent = message.fix;
                                currentFix = message.fix;
                                
                                const button = document.getElementById('applyFixButton');
                                if (currentFix && currentFix.trim() !== '-- Fix code will appear here --') {
                                    button.disabled = false;
                                    button.style.opacity = '1';
                                } else {
                                    button.disabled = true;
                                    button.style.opacity = '0.7';
                                }
                                
                                // Automatically switch to the fix tab if there's a fix
                                switchTab(currentFix ? 'fix' : 'error');
                                break;
                            case 'startLoading':
                                document.getElementById('loading').classList.remove('hidden');
                                document.getElementById('errorMessage').innerHTML = 'Sending code for analysis...';
                                document.getElementById('fixSuggestion').textContent = '';
                                document.getElementById('applyFixButton').disabled = true;
                                document.getElementById('applyFixButton').style.opacity = '0.7';
                                switchTab('error'); // Show error tab during loading
                                break;
                        }
                    });

                    document.getElementById('applyFixButton').addEventListener('click', () => {
                        if (currentFix) {
                            vscode.postMessage({
                                command: 'applyFix',
                                fix: currentFix
                            });
                        }
                    });
                </script>
            </body>
            </html>`;
	}
}

/**
 * Main activation function for the extension.
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log("Gemini Code Analyst is now active!");

	// Initialize the Webview provider
	const analystProvider = new GeminiAnalystProvider(context);

	// --- Gemini API Setup ---
	// Use the API key from an environment variable (GEMINI_API_KEY)
	const apiKey =
		process.env.GEMINI_API_KEY || "AIzaSyBVLGsOx2pL8za5bO7qACLkkPuLYPyyRDw";
	if (!apiKey) {
		vscode.window.showErrorMessage(
			"GEMINI_API_KEY environment variable is not set. Please set it to use the Gemini Code Analyst extension."
		);
		return;
	}
	const ai = new GoogleGenAI({ apiKey });
	const model = "gemini-2.5-flash"; // Good model for concise code analysis/fixes

	// --- Command Registration ---
	let disposable = vscode.commands.registerCommand(
		"geminiCodeAnalyst.analyzeSelectedCode",
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) {
				vscode.window.showWarningMessage("No active editor.");
				return;
			}

			const selection = editor.selection;
			if (selection.isEmpty) {
				vscode.window.showWarningMessage(
					"Please select the code you want to analyze."
				);
				return;
			}

			let selectedCode = editor.document.getText(selection);

			// 1. Preprocess the code input
			// Remove extra whitespace (trim start/end) and ensure it's clean
			const cleanedCode = selectedCode.trim();
			if (cleanedCode.length === 0) {
				vscode.window.showWarningMessage(
					"Selected code is empty or only whitespace."
				);
				return;
			}

			// Store the original selection for safe application later
			analystProvider._lastSelection = cleanedCode;

			// 2. Prepare the prompt
			const prompt = `Analyze the following code snippet for potential errors or bugs. Respond strictly with two parts, without any extra explanation, formatting, or conversational text. The response must use the exact format provided below:

Error: "Your error is: ..."
Fix: concise code fix suggestion

Code to analyze:\n\n\`\`\`\n${cleanedCode}\n\`\`\`
If there are no real errors, respond with:
Error: "No errors found."
Fix: "No fix needed."`;

			// 3. Show loading state in the sidebar and make it visible
			analystProvider._view.webview.postMessage({ command: "startLoading" });
			analystProvider._view.show(true); // Bring the sidebar into focus

			let geminiError = "Could not get a response from Gemini.";
			let geminiFix = "Please check the extension log or your API key.";

			try {
				// 4. Call the Gemini API
				const response = await ai.models.generateContent({
					model,
					contents: [{ role: "user", parts: [{ text: prompt }] }],
					config: {
						// Force a low temperature for predictable, straight-to-the-point answers
						temperature: 0.1,
					},
				});

				const text = response.text.trim();

				// 5. Parse the straight-to-the-point response
				const errorMatch = text.match(/Error:\s*"(.*)"/s);
				const fixMatch = text.match(/Fix:\s*([\s\S]*)/s); // Match from 'Fix:' to the end

				if (errorMatch && fixMatch) {
					geminiError = errorMatch[1].trim();
					// Clean up the fix: remove code fences if Gemini added them, and trim
					geminiFix = fixMatch[1].replace(/```[\s\S]*?\n|```/g, "").trim();
				} else {
					// Fallback if parsing fails (e.g., if Gemini didn't follow the format)
					geminiError =
						"Gemini response could not be parsed. Raw response: " + text;
					geminiFix = cleanedCode; // Default to the original code
					vscode.window.showWarningMessage(
						"Gemini did not follow the required output format."
					);
				}
			} catch (e) {
				geminiError = `Gemini API Error: ${e.message}`;
				console.error("Gemini API Error:", e);
			}

			// 6. Post the final result to the Webview
			analystProvider.postAnalysisResult(geminiError, geminiFix);
		}
	);

	context.subscriptions.push(disposable);
}

/**
 * Called when the extension is deactivated.
 */
function deactivate() {}

module.exports = {
	activate,
	deactivate,
};

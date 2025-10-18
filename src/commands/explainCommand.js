const vscode = require("vscode");
const { runGeminiRequest } = require("../utils/runGeminiRequest");
const { GoogleGenAI } = require("@google/genai");
const { GEMINI_API_KEY } = require("../config");

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function explainCommand(sidebar) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage(
			"Open a file or terminal error to explain."
		);
		return;
	}

	// Try to get current diagnostic under cursor
	const pos = editor.selection.active;
	const diags = vscode.languages.getDiagnostics(editor.document.uri);
	const diag = diags.find((d) => d.range.contains(pos));
	let toExplain = "";

	if (diag) {
		toExplain = `Error message: ${diag.message}\nLocation: ${
			editor.document.fileName
		}:${diag.range.start.line + 1}`;
	} else {
		// fallback: ask user
		toExplain = await vscode.window.showInputBox({
			prompt: "Paste the error message to explain",
		});
		if (!toExplain) return;
	}

	sidebar._view?.webview.postMessage({
		command: "startLoading",
		message: "Asking Gemini to explain...",
	});

	const prompt = `Explain this error briefly and give probable causes and steps:
"${toExplain}"
Respond in plain text, no code fences.`;

	const { geminiError, geminiFix } = await runGeminiRequest(prompt, toExplain);
	// Use geminiFix as explanation body or geminiError if parse failed
	const explanation =
		geminiFix !== "Please check API key or logs." ? geminiFix : geminiError;
	sidebar.postExplanation(explanation);
}

module.exports = { explainCommand };

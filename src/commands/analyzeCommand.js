const vscode = require("vscode");
const { GoogleGenAI } = require("@google/genai");
const { retrieveRelevantChunks } = require("../utils/ragRetriever");
const { runGeminiRequest } = require("../utils/runGeminiRequest");
const { GEMINI_API_KEY } = require("../config");

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

async function analyzeCommand(sidebar) {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		vscode.window.showWarningMessage("Open a file and select code to analyze.");
		return;
	}
	let codeToAnalyze = editor.selection;
	if (codeToAnalyze.isEmpty) {
		codeToAnalyze = editor;
		return;
	}

	let analyzeCode = editor.document.getText(codeToAnalyze).trim();
	if (!analyzeCode) {
		vscode.window.showWarningMessage("Selected code is empty.");
		return;
	}

	// compute selection embedding and retrieve context via embeddings worker (already built)
	sidebar._view?.webview.postMessage({
		command: "startLoading",
		message: "Retrieving context...",
	});

	// Create embedding for selection
	const embRes = await ai.embeddings.create({
		model: "codeembedding-gecko-001",
		input: analyzeCode,
	});
	const queryVector = embRes.data[0].embedding;

	const relevant = retrieveRelevantChunks(queryVector, 6);

	// Build prompt
	const prompt = `Analyze selected code. Provide only:
Error: "concise error description"
Fix: concise code fix suggestion

Context:
${relevant.join("\n---\n")}

Selected:
${analyzeCode}`;

	sidebar._view?.webview.postMessage({
		command: "startLoading",
		message: "Analyzing with Gemini...",
	});

	const { geminiError, geminiFix } = await runGeminiRequest(
		prompt,
		analyzeCode
	);
	sidebar.postAnalysis(geminiError, geminiFix);
}

module.exports = { analyzeCommand };

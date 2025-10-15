const vscode = require("vscode");
const { runGeminiRequest } = require("./runGeminiRequest");
const { retrieveRelevantChunks } = require("./ragRetriever");

const ai = new (require("@google/genai").GoogleGenAI)({
	apiKey:
		process.env.GEMINI_API_KEY || "AIzaSyBVLGsOx2pL8za5bO7qACLkkPuLYPyyRDw",
});

async function analyzeCommand(analystProvider) {
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

	const cleanedCode = selectedCode.trim();
	if (cleanedCode.length === 0) {
		vscode.window.showWarningMessage(
			"Selected code is empty or only whitespace."
		);
		return;
	}

	const embeddingRes = await ai.embeddings.create({
		model: "codeembedding-gecko-001",
		input: selectedCode,
	});
	const queryVector = embeddingRes.data[0].embedding;

	// 2. Retrieve top 5 relevant chunks
	const relevantChunks = retrieveRelevantChunks(queryVector, 5);

	// Store the original selection for safe application later
	analystProvider._lastSelection = cleanedCode;

	// 2. Prepare the prompt
	const prompt = `Analyze the following code snippet for potential errors or bugs. Put the context into consideration. Respond strictly with two parts, without any extra explanation, formatting, or conversational text. The response must use the exact format provided below:

				Rules:
				- Always respond in the specified format.
				- errors should only be errors in the selected code snippet, not the full document.
				- If you identify an error, provide a concise description and a suggested fix.
				- If no errors are found, explicitly state that no errors were found and no fix is needed.
				- Do not include any additional commentary or explanations.
				- Use plain text only; do not use markdown or code blocks in your response.
				-the fix should be a direct code snippet that can replace all the selected code(code to analyse).

				Format:

				Error: "concise error description"
				Fix: concise code fix suggestion

				Code to analyze:\n\n\`\`\`\n${cleanedCode}\n\`\`\`
				context code(for reference):\n\n\`\`\`\n${relevantChunks.join(
					"\n---\n"
				)}\n\`\`\`
				--- End of code ---
				
				If there are no code errors, respond with:
				Error: "No errors found."
				Fix: "No fix needed."`;

	// 3. Show loading state in the sidebar and make it visible
	analystProvider._view.webview.postMessage({ command: "startLoading" });
	analystProvider._view.show(true); // Bring the sidebar into focus

	const { geminiError, geminiFix } = await runGeminiRequest(
		prompt,
		cleanedCode
	);
	// 6. Post the final result to the Webview
	analystProvider.postAnalysisResult(geminiError, geminiFix);
}

module.exports = { analyzeCommand };

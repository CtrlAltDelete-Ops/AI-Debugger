const vscode = require("vscode");
const path = require("path");

const { SidebarProvider } = require("./src/providers/SidebarProvider");
const { analyzeCommand } = require("./src/commands/analyzeCommand");
const { scanCommand } = require("./src/commands/scanCommand");
const { explainCommand } = require("./src/commands/explainCommand");
const { GeminiWarmUp } = require("./src/GeminiWarmUp");
const { buildEmbeddingsIfMissing } = require("./src/utils/embeddings");

/**
 * Activate the extension
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	console.log("Gemini RAG Code Assistant active");

	// --- Warm-up Gemini API asynchronously ---
	try {
		const warm = new GeminiWarmUp();
		warm
			.warmUp()
			.catch((e) => console.warn("Gemini warm-up failed:", e.message));
	} catch (e) {
		console.warn("Warm-up initialization error:", e.message);
	}

	// --- Initialize Sidebar Provider ---
	const sidebar = new SidebarProvider(context);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("geminiCodeSidebar", sidebar, {
			webviewOptions: { retainContextWhenHidden: true },
		})
	);

	// --- Prebuild embeddings asynchronously ---
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (workspaceRoot) {
		buildEmbeddingsIfMissing(workspaceRoot)
			.then((count) => console.log(`Embeddings ready: ${count} chunks`))
			.catch((e) => console.warn("Embedding build error:", e.message));
		3;
	}

	// --- Register Commands ---
	context.subscriptions.push(
		vscode.commands.registerCommand("geminiCode.analyzeSelected", () =>
			analyzeCommand(sidebar)
		)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("geminiCode.scanProject", () =>
			scanCommand(sidebar)
		)
	);
	context.subscriptions.push(
		vscode.commands.registerCommand("geminiCode.explainError", () =>
			explainCommand(sidebar)
		)
	);
}

/**
 * Deactivate the extension
 */
function deactivate() {
	console.log("Gemini RAG Code Assistant deactivated");
}

module.exports = { activate, deactivate };

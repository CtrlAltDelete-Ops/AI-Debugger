const vscode = require("vscode");
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const { GeminiAnalystProvider } = require("./src/GeminiAnalystProvider");
const { runGeminiRequest } = require("./src/runGeminiRequest");
const { analyzeCommand } = require("./src/analyzeCommand");
const { GeminiWormUp } = require("./src/GeminiWormUp");

/**
 * Main activation function for the extension.
 * @param {vscode.ExtensionContext} context
 */

function activate(context) {
	console.log("Gemini Code Analyst is now active!");

	// --- Warm-up Gemini API ---
	const wormUp = new GeminiWormUp();
	wormUp.warmUp();

	// Initialize the Webview provider
	const analystProvider = new GeminiAnalystProvider(context);

	// --- Command Registration ---
	let disposable = vscode.commands.registerCommand(
		"geminiCodeAnalyst.analyzeSelectedCode",
		() => analyzeCommand(analystProvider)
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

const { GoogleGenAI } = require("@google/genai");
const vscode = require("vscode");
const { GEMINI_API_KEY } = require("../config");

async function runGeminiRequest(prompt, fallback) {
	try {
		const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
		const res = await ai.models.generateContent({
			model: "gemini-2.5-flash",
			contents: prompt,
			config: { temperature: 0.1 },
		});
		const text = (res.text || "").trim();

		const errorMatch = text.match(/Error:\s*([\s\S]*?)\s*Fix:/);
		const fixMatch = text.match(/Fix:\s*([\s\S]*)/s);

		let geminiError = "No response";
		let geminiFix = fallback || "";

		if (errorMatch)
			geminiError = errorMatch[1].trim().replace(/^"(.*)"$/, "$1");
		if (fixMatch) geminiFix = fixMatch[1].trim().replace(/^"(.*)"$/, "$1");
		return { geminiError, geminiFix };
	} catch (e) {
		vscode.window.showErrorMessage(`Gemini error: ${e.message}`);
		console.error("runGeminiRequest error:", e);
		return {
			geminiError: `Gemini error: ${e.message}`,
			geminiFix: fallback || "",
		};
	}
}

module.exports = { runGeminiRequest };

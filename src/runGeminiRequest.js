const vscode = require("vscode");
const { GoogleGenAI } = require("@google/genai");

async function runGeminiRequest(prompt, code) {
	try {
		const apiKey =
			process.env.GEMINI_API_KEY || "AIzaSyBVLGsOx2pL8za5bO7qACLkkPuLYPyyRDw";
		if (!apiKey) {
			vscode.window.showErrorMessage(
				"GEMINI_API_KEY environment variable is not set. Please set it to use the Gemini Code Analyst extension."
			);
			return;
		}
		const ai = new GoogleGenAI({ apiKey });
		const model = "gemini-2.5-flash";

		const response = await ai.models.generateContent({
			model,
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			config: {
				temperature: 0.1,
			},
		});

		const text = response.text.trim();

		// 5. Parse the straight-to-the-point response
		const errorMatch = text.match(/Error:\s*([\s\S]*?)\s*Fix:/);
		const fixMatch = text.match(/Fix:\s*([\s\S]*)/s);

		let geminiError = "Could not get a response from Gemini.";
		let geminiFix = "Please check the extension log or your API key.";

		if (errorMatch && fixMatch) {
			geminiError = errorMatch[1].trim().replace(/^"(.*)"$/, "$1");
			// Clean up the fix: remove code fences if Gemini added them, and trim
			geminiFix = fixMatch[1]
				.replace(/```[\s\S]*?\n|```/g, "")
				.replace(/^"(.*)"$/, "$1")
				.trim();
		} else {
			// Fallback if parsing fails (e.g., if Gemini didn't follow the format)
			geminiError =
				"Gemini response could not be parsed. Raw response: " + text;
			geminiFix = code; // Default to the original code
			vscode.window.showWarningMessage(
				"Gemini did not follow the required output format."
			);
		}
		return { geminiError, geminiFix };
	} catch (e) {
		geminiError = `Gemini API Error: ${e.message}`;
		console.error("Gemini API Error:", e);
		return { geminiError, geminiFix: "No fix available due to API error." };
	}
}

module.exports = { runGeminiRequest };

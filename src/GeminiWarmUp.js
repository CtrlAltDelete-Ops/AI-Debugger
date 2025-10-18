const { GoogleGenAI } = require("@google/genai");
const { GEMINI_API_KEY } = require("./config");

class GeminiWarmUp {
	constructor() {
		this.apiKey = GEMINI_API_KEY;
		this.ai = new GoogleGenAI({ apiKey: this.apiKey });
	}

	async warmUp() {
		try {
			if (!this.apiKey) {
				console.warn("GEMINI_API_KEY not set; warm-up skipped");
				return;
			}
			await this.ai.models.generateContent({
				model: "gemini-2.5-flash",
				contents: "ping",
				config: { temperature: 0.1 },
			});
			console.log("Gemini warmed up");
		} catch (e) {
			console.warn("Warm-up failed:", e.message);
		}
	}
}

module.exports = { GeminiWarmUp };

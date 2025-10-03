const { GoogleGenAI } = require("@google/genai");

class GeminiWormUp {
	constructor() {
		this.apiKey =
			process.env.GEMINI_API_KEY || "AIzaSyBVLGsOx2pL8za5bO7qACLkkPuLYPyyRDw";
		this.ai = new GoogleGenAI({ apiKey: this.apiKey });
		this.model = "gemini-2.5-flash";
	}

	async warmUp() {
		try {
			const prompt = "Hello, Gemini!";
			await this.ai.models.generateContent({
				model: this.model,
				contents: [{ role: "user", parts: [{ text: prompt }] }],
				config: {
					temperature: 0.1,
				},
			});
			console.log("Gemini API warm-up completed.");
		} catch (e) {
			console.error("Gemini Warm-up Error:", e);
		}
	}
}

module.exports = { GeminiWormUp };

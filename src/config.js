const dotenv = require("dotenv");
const path = require("path");

// Load .env once globally (no need to call this anywhere else)
dotenv.config({
	path: path.join(__dirname, "..", ".env"),
});

// Optional: safety check
if (!process.env.GEMINI_API_KEY) {
	console.warn("⚠️ Warning: GEMINI_API_KEY not found in .env");
}

// Export useful values globally
module.exports = {
	GEMINI_API_KEY: process.env.GEMINI_API_KEY,
	GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-2.5-flash",
	NODE_ENV: process.env.NODE_ENV || "development",
};

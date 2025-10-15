const fs = require("fs");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");
const vscode = require("vscode");

const apiKey =
	process.env.GEMINI_API_KEY || "AIzaSyBVLGsOx2pL8za5bO7qACLkkPuLYPyyRDw";
if (!apiKey) console.warn("⚠️ GEMINI_API_KEY not set");

const ai = new GoogleGenAI({ apiKey });

// Store all code chunks in memory
let codeEmbeddings = [];

/**
 * Read all JS/TS files recursively
 */
function readAllCodeFiles(dir) {
	let results = [];
	const files = fs.readdirSync(dir, { withFileTypes: true });
	for (const file of files) {
		const fullPath = path.join(dir, file.name);
		if (file.isDirectory())
			results = results.concat(readAllCodeFiles(fullPath));
		else if (file.isFile() && /\.(js|ts|jsx|tsx)$/.test(file.name))
			results.push(fullPath);
	}
	return results;
}

/**
 * Chunk code with overlap for robust context
 */
function chunkCodeWithOverlap(content, chunkSize = 20, overlap = 10) {
	const lines = content.split("\n");
	const chunks = [];
	for (let i = 0; i < lines.length; i += chunkSize - overlap) {
		chunks.push(lines.slice(i, i + chunkSize).join("\n"));
		if (i + chunkSize >= lines.length) break;
	}
	return chunks;
}

/**
 * Build embeddings for entire project
 */
async function buildEmbeddings(projectRoot) {
	const files = readAllCodeFiles(projectRoot);
	for (const file of files) {
		const content = fs.readFileSync(file, "utf-8");
		const chunks = chunkCodeWithOverlap(content, 20, 10);

		for (const chunk of chunks) {
			const embedding = await ai.models.embedContent({
				model: "gemini-embedding-001",
				contents: chunk,
			});
			codeEmbeddings.push({
				file,
				chunk,
				vector: embedding.data[0].embedding,
				timestamp: Date.now(), // For weighting recent edits
			});
		}
	}
	console.log(`✅ Built ${codeEmbeddings.length} code embeddings`);
}

/**
 * Cosine similarity
 */
function cosineSimilarity(a, b) {
	const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
	const magA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
	const magB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
	return dot / (magA * magB);
}

module.exports = { buildEmbeddings, codeEmbeddings, cosineSimilarity };

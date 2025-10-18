// This worker creates embeddings for project files and writes a cache file
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const path = require("path");
const { GEMINI_API_KEY } = require("../config");

const apiKey = GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });

const CACHE_DIR = path.join(process.cwd(), ".vscode-gemini-cache");
const CACHE_FILE = path.join(CACHE_DIR, "embeddings.json");

function ensureCacheDir() {
	if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function readFilesRecursively(dir, exts = [".js", ".ts", ".jsx", ".tsx"]) {
	const res = [];
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const e of entries) {
		const full = path.join(dir, e.name);
		if (e.isDirectory()) res.push(...readFilesRecursively(full, exts));
		else if (e.isFile() && exts.includes(path.extname(e.name))) res.push(full);
	}
	return res;
}

function chunkCode(content, chunkSize = 20, overlap = 10) {
	const lines = content.split("\n");
	const chunks = [];
	for (let i = 0; i < lines.length; i += chunkSize - overlap) {
		chunks.push(lines.slice(i, i + chunkSize).join("\n"));
		if (i + chunkSize >= lines.length) break;
	}
	return chunks;
}

process.on("message", async (msg) => {
	if (msg.command !== "build") return;
	const root = msg.root;
	ensureCacheDir();
	const files = readFilesRecursively(root);
	const output = [];
	for (const file of files) {
		try {
			const content = fs.readFileSync(file, "utf8");
			const chunks = chunkCode(content);
			for (const chunk of chunks) {
				const embRes = await ai.embeddings.create({
					model: "codeembedding-gecko-001",
					input: chunk,
				});
				const vector = embRes.data[0].embedding;
				output.push({ file, chunk, vector, ts: Date.now() });
			}
		} catch (e) {
			// skip on error
		}
	}
	fs.writeFileSync(CACHE_FILE, JSON.stringify(output), "utf8");
	process.send({ type: "done", count: output.length, cacheFile: CACHE_FILE });
	process.exit(0);
});

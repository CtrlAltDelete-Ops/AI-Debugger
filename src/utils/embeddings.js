// Helper to load embeddings cache and expose retrieval-ready array
const fs = require("fs");
const path = require("path");

const CACHE_DIR = path.join(process.cwd(), ".vscode-gemini-cache");
const CACHE_FILE = path.join(CACHE_DIR, "embeddings.json");

function loadEmbeddings() {
	try {
		if (!fs.existsSync(CACHE_FILE)) return [];
		const raw = fs.readFileSync(CACHE_FILE, "utf8");
		return JSON.parse(raw);
	} catch (e) {
		return [];
	}
}

async function buildEmbeddingsIfMissing(projectRoot) {
	if (!fs.existsSync(CACHE_FILE)) {
		// spawn child worker to build
		const { fork } = require("child_process");
		const workerPath = path.join(__dirname, "..", "workers", "embedWorker.js");
		const cp = fork(workerPath);
		cp.send({ command: "build", root: projectRoot });
		return new Promise((resolve, reject) => {
			cp.on("message", (m) => {
				if (m.type === "done") resolve(m.count);
			});
			cp.on("error", reject);
			cp.on("exit", (code) => {
				if (code !== 0) reject(new Error("embed worker failed"));
			});
		});
	}
	return Promise.resolve(loadEmbeddings().length);
}

module.exports = { loadEmbeddings, buildEmbeddingsIfMissing, CACHE_FILE };

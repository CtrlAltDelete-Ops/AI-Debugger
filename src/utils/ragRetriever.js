const { loadEmbeddings } = require("./embeddings");

// cosine similarity
function cosine(a, b) {
	const dot = a.reduce((s, v, i) => s + v * b[i], 0);
	const ma = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
	const mb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
	return dot / (ma * mb) || 0;
}

function retrieveRelevantChunks(queryVector, topK = 5) {
	const all = loadEmbeddings();
	const now = Date.now();
	const scored = all.map((e) => {
		const base = cosine(queryVector, e.vector);
		const ageWeight =
			1 - Math.min((now - (e.ts || now)) / (1000 * 60 * 60 * 24), 1); // 0..1
		const score = base * (0.8 + 0.2 * ageWeight);
		return { ...e, score };
	});
	scored.sort((a, b) => b.score - a.score);
	return scored.slice(0, topK).map((s) => `// ${s.file}\n${s.chunk}`);
}

module.exports = { retrieveRelevantChunks };

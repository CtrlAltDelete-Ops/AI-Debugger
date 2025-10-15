const { codeEmbeddings, cosineSimilarity } = require("./embeddings");

/**
 * Retrieve the most relevant code chunks based on query embedding
 * Adds weighting for recently modified chunks
 */
function retrieveRelevantChunks(queryVector, topK = 5) {
	const now = Date.now();
	return codeEmbeddings
		.map((ce) => {
			// Weight recent edits slightly higher
			const ageFactor =
				1 - Math.min((now - ce.timestamp) / (1000 * 60 * 60 * 24), 1); // 0..1
			const score =
				cosineSimilarity(queryVector, ce.vector) * (0.8 + 0.2 * ageFactor);
			return { ...ce, score };
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, topK)
		.map((c) => c.chunk);
}

module.exports = { retrieveRelevantChunks };

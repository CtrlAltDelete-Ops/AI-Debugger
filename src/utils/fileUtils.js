const fs = require("fs");
const path = require("path");

function listCodeFiles(root) {
	const out = [];
	function walk(dir) {
		const entries = fs.readdirSync(dir, { withFileTypes: true });
		for (const e of entries) {
			const full = path.join(dir, e.name);
			if (e.isDirectory()) walk(full);
			else if (e.isFile() && /\.(js|ts|jsx|tsx)$/.test(e.name)) out.push(full);
		}
	}
	walk(root);
	return out;
}

module.exports = { listCodeFiles };

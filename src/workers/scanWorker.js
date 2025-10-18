// scanWorker: quick static scan using simple heuristics (you can extend with linters)
const fs = require("fs");
const path = require("path");

function readAllFiles(dir) {
	const out = [];
	const e = fs.readdirSync(dir, { withFileTypes: true });
	for (const f of e) {
		const full = path.join(dir, f.name);
		if (f.isDirectory()) out.push(...readAllFiles(full));
		else if (f.isFile() && /\.(js|ts|jsx|tsx)$/.test(f.name)) out.push(full);
	}
	return out;
}

function simpleScanFile(file) {
	const text = fs.readFileSync(file, "utf8");
	const issues = [];
	if (/console\.log/.test(text)) {
		issues.push({
			file,
			severity: "info",
			message: "console.log detected (remove for production)",
		});
	}
	if (/==[^=]/.test(text)) {
		issues.push({
			file,
			severity: "warning",
			message: "Non-strict equality used (==). Consider ===.",
		});
	}
	if (/TODO:/.test(text)) {
		issues.push({ file, severity: "info", message: "TODO found" });
	}
	return issues;
}

process.on("message", (msg) => {
	if (msg.command !== "scan") return;
	const root = msg.root;
	const files = readAllFiles(root);
	const results = [];
	for (const f of files) {
		try {
			const issues = simpleScanFile(f);
			if (issues.length) results.push(...issues);
		} catch (e) {}
	}
	process.send({ type: "scanResults", results });
	process.exit(0);
});

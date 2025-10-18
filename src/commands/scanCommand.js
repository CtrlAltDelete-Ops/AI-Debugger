const { fork } = require("child_process");
const path = require("path");
const vscode = require("vscode");

function scanCommand(sidebar) {
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
	if (!workspaceRoot) {
		vscode.window.showWarningMessage("Open a workspace first to scan project.");
		return;
	}

	// Spawn scan worker to avoid blocking
	const workerPath = path.join(__dirname, "..", "workers", "scanWorker.js");
	const cp = fork(workerPath);
	cp.send({ command: "scan", root: workspaceRoot });

	sidebar._view?.webview.postMessage({
		command: "startLoading",
		message: "Project scan started...",
	});

	cp.on("message", (msg) => {
		if (msg.type === "scanResults") {
			sidebar.postScanResults(msg.results);
			cp.kill();
		}
	});

	cp.on("error", (err) => {
		vscode.window.showErrorMessage("Scan worker error: " + err.message);
		cp.kill();
	});
}

module.exports = { scanCommand };

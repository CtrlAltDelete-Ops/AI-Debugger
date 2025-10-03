const vscode = acquireVsCodeApi();
let currentFix = "-- Fix code will appear here --";

function switchTab(tabName) {
	document.getElementById("error-tab").classList.remove("active");
	document.getElementById("fix-tab").classList.remove("active");
	document.getElementById("error-content").classList.add("hidden");
	document.getElementById("fix-content").classList.add("hidden");

	document.getElementById(tabName + "-tab").classList.add("active");
	document.getElementById(tabName + "-content").classList.remove("hidden");
}

// Handle messages from the extension (extension.js)
window.addEventListener("message", (event) => {
	const message = event.data;
	switch (message.command) {
		case "showAnalysis":
			document.getElementById("loading").classList.add("hidden");
			document.getElementById("errorMessage").innerHTML = message.error;
			document.getElementById("fixSuggestion").textContent = message.fix;
			currentFix = message.fix;

			const button = document.getElementById("applyFixButton");
			if (
				currentFix &&
				currentFix.trim() !== "-- Fix code will appear here --"
			) {
				button.disabled = false;
				button.style.opacity = "1";
			} else {
				button.disabled = true;
				button.style.opacity = "0.7";
			}

			// Automatically switch to the fix tab if there's a fix
			switchTab(currentFix ? "fix" : "error");
			break;
		case "startLoading":
			document.getElementById("loading").classList.remove("hidden");
			document.getElementById("errorMessage").innerHTML =
				"Sending code for analysis...";
			document.getElementById("fixSuggestion").textContent =
				"-- fix code will appear here --";
			document.getElementById("applyFixButton").disabled = true;
			document.getElementById("applyFixButton").style.opacity = "0.7";
			switchTab("error"); // Show error tab during loading
			break;
	}
});

document.getElementById("applyFixButton").addEventListener("click", () => {
	if (currentFix) {
		vscode.postMessage({
			command: "applyFix",
			fix: currentFix,
		});
	}
});

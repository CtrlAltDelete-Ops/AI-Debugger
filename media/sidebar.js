/* sidebar.js - controls UI behavior and messaging with the extension host */

const vscode = acquireVsCodeApi();

// UI elements
const tabs = {
	analyze: document.getElementById("tabAnalyze"),
	scan: document.getElementById("tabScan"),
	explain: document.getElementById("tabExplain"),
};
const panels = {
	analyze: document.getElementById("panel-analyze"),
	scan: document.getElementById("panel-scan"),
	explain: document.getElementById("panel-explain"),
};
const indicator = document.getElementById("tabIndicator");

const analyzeError = document.getElementById("analyzeError");
const analyzeFix = document.getElementById("analyzeFix");
const applyFixBtn = document.getElementById("applyFix");
const copyFixBtn = document.getElementById("copyFix");
const runAnalyzeBtn = document.getElementById("runAnalyze");
const runScanBtn = document.getElementById("runScan");
const runExplainBtn = document.getElementById("runExplain");
const scanList = document.getElementById("scanList");
const explainText = document.getElementById("explainText");

// helper: switch tabs with animated indicator
function switchTo(name) {
	Object.keys(tabs).forEach((k) => {
		const tab = tabs[k];
		if (k === name) {
			tab.classList.add("active");
			tab.setAttribute("aria-selected", "true");
		} else {
			tab.classList.remove("active");
			tab.setAttribute("aria-selected", "false");
		}
	});
	Object.keys(panels).forEach((k) => {
		panels[k].classList.toggle("hidden", k !== name);
	});
	// move indicator under active tab
	const active = tabs[name];
	if (!active) return;
	const rect = active.getBoundingClientRect();
	const parentRect = active.parentElement.getBoundingClientRect();
	const left = rect.left - parentRect.left + 8; // padding
	const width = rect.width - 16;
	indicator.style.transform = `translateX(${left}px)`;
	indicator.style.width = `${Math.max(40, width)}px`;
}
window.addEventListener("resize", () => {
	// keep indicator consistent
	const active = document.querySelector(".tab.active");
	if (active) {
		// recalc on resize
		const rect = active.getBoundingClientRect();
		const parentRect = active.parentElement.getBoundingClientRect();
		indicator.style.transform = `translateX(${
			rect.left - parentRect.left + 8
		}px)`;
		indicator.style.width = `${Math.max(40, rect.width - 16)}px`;
	}
});

// initial indicator placement after DOM load
setTimeout(() => switchTo("analyze"), 60);

// Tab click events
tabs.analyze.addEventListener("click", () => switchTo("analyze"));
tabs.scan.addEventListener("click", () => switchTo("scan"));
tabs.explain.addEventListener("click", () => switchTo("explain"));

// Button actions
applyFixBtn.addEventListener("click", () => {
	const fix = analyzeFix.textContent || "";
	vscode.postMessage({ command: "applyFix", fix });
});
copyFixBtn.addEventListener("click", async () => {
	try {
		await navigator.clipboard.writeText(analyzeFix.textContent || "");
	} catch (e) {
		// fallback
		vscode.postMessage({
			command: "copyFallback",
			text: analyzeFix.textContent || "",
		});
	}
});
runAnalyzeBtn.addEventListener("click", () =>
	vscode.postMessage({ command: "triggerAnalyze" })
);
runScanBtn.addEventListener("click", () =>
	vscode.postMessage({ command: "triggerScan" })
);
runExplainBtn.addEventListener("click", () =>
	vscode.postMessage({ command: "triggerExplain" })
);

// Receive messages from extension
window.addEventListener("message", (ev) => {
	const m = ev.data;
	if (!m || !m.command) return;

	switch (m.command) {
		case "startLoading":
			// show subtle loading placeholders
			analyzeError.textContent = "Analyzing…";
			analyzeFix.textContent = "";
			applyFixBtn.disabled = true;
			break;

		case "showAnalysis":
			analyzeError.textContent = m.error || "No error.";
			analyzeFix.textContent = m.fix || "";
			applyFixBtn.disabled = !m.fix || m.fix.trim() === "";
			switchTo("analyze");
			break;

		case "showScan":
			scanList.innerHTML = "";
			const results = m.results || [];
			if (results.length === 0) {
				scanList.innerHTML = `<div class="empty">No issues found.</div>`;
			} else {
				results.forEach((r) => {
					const item = document.createElement("div");
					item.className = "scan-item";
					const sev = document.createElement("div");
					sev.className = "scan-sev " + (r.severity || "info");
					const body = document.createElement("div");
					body.innerHTML = `<div style="font-weight:600">${(
						r.severity || "info"
					).toUpperCase()}</div><div class="muted" style="font-size:12px">${
						r.message
					}</div><div class="muted" style="font-size:11px">${r.file}</div>`;
					item.appendChild(sev);
					item.appendChild(body);
					item.addEventListener("click", () => {
						vscode.postMessage({
							command: "openFile",
							file: r.file,
							pos: r.line || 0,
						});
					});
					scanList.appendChild(item);
				});
			}
			switchTo("scan");
			break;

		case "showExplanation":
			explainText.textContent = m.text || "No explanation available.";
			switchTo("explain");
			break;

		default:
			console.warn("Unhandled message:", m);
	}
});

// Ask extension for last analysis when opening
vscode.postMessage({ command: "requestLast" });

// Expose for debugging (dev only)
window.__vscode = vscode;

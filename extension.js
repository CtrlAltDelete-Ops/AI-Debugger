const vscode = require("vscode");
const { GoogleGenAI } = require("@google/genai");
const dotenv = require("dotenv");

const ai = new GoogleGenAI({
	apiKey: process.env.GEMINI_API_KEY,
});

class AiDebuggerProvider {
	constructor(extensionUri) {
		this.extensionUri = extensionUri;
		this.webviewView = null;
		this.isDebugging = false; // Flag to prevent concurrent debugging
	}

	resolveWebviewView(webviewView) {
		this.webviewView = webviewView;
		this.webviewView.webview.options = {
			enableScripts: true,
			enableForms: true,
			localResourceRoots: [this.extensionUri],
		};
		this.webviewView.webview.html = this.getWebviewHtml(
			this.webviewView.webview
		);
		this.webviewView.webview.onDidReceiveMessage(
			this.onDidReceiveMessage.bind(this)
		);
	}

	async onDidReceiveMessage(message) {
		switch (message.kind) {
			case "runDebug":
				await this.safeRunDebug();
				break;
			case "applyFix":
				await this.applyFix(message.code);
				break;
			case "runFullDebug":
				await this.safeRunFullDebug();
				break;
		}
	}

	async safeRunDebug() {
		if (this.isDebugging) {
			this.postLogMessage("Already running a debug session.");
			return;
		}
		this.isDebugging = true;
		try {
			await this.runDebug();
		} finally {
			this.isDebugging = false;
		}
	}

	async safeRunFullDebug() {
		if (this.isDebugging) {
			this.postLogMessage("Already running a debug session.");
			return;
		}
		this.isDebugging = true;
		try {
			await this.runFullDebug();
		} finally {
			this.isDebugging = false;
		}
	}

	async runDebug() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			this.postLogMessage("No active editor found.");
			return;
		}

		const selection = editor.selection;
		const selectedText = editor.document.getText(selection);

		if (!selectedText) {
			this.postLogMessage("No code selected.");
			return;
		}

		this.webviewView.webview.postMessage({
			kind: "userMessage",
			text: "Please analyze this code.",
		});

		const prompt = this.buildPrompt(selectedText);
		this.webviewView.webview.postMessage({ kind: "loading" });

		try {
			const result = await ai.models.generateContent({
				model: "gemini-2.5-flash",
				contents: [{ role: "user", parts: [{ text: prompt }] }],
			});

			const text = result.text || "";
			const match = text.match(/~~~js\n([\s\S]*?)~~~/);
			const explanation = match ? text.replace(match[0], "").trim() : text;
			const code = match ? match[1].trim() : "";

			this.webviewView.webview.postMessage({
				kind: "aiResponse",
				explanation,
				code,
			});
		} catch (err) {
			this.postLogMessage("Error: " + String(err));
		}
	}

	async runFullDebug() {
		const editor = vscode.window.activeTextEditor;
		if (!editor) {
			this.postLogMessage("No active editor found.");
			return;
		}

		const fullText = editor.document.getText();

		this.webviewView.webview.postMessage({
			kind: "userMessage",
			text: "Please analyze this code.",
		});

		const prompt = this.buildPrompt(fullText);
		this.webviewView.webview.postMessage({ kind: "loading" });

		try {
			const result = await ai.models.generateContent({
				model: "gemini-2.5-flash",
				contents: [{ role: "user", parts: [{ text: prompt }] }],
			});

			const text =
				result.response?.candidates?.[0]?.content?.parts?.[0]?.text || "";
			const match = text.match(/~~~js\n([\s\S]*?)~~~/);
			const explanation = match ? text.replace(match[0], "").trim() : text;
			const code = match ? match[1].trim() : "";

			this.webviewView.webview.postMessage({
				kind: "aiResponse",
				explanation,
				code,
			});
		} catch (err) {
			this.postLogMessage("Error: " + String(err));
		}
	}

	async applyFix(code) {
		const editor = vscode.window.activeTextEditor;
		if (!editor || !code) return;

		const fullRange = new vscode.Range(
			editor.document.positionAt(0),
			editor.document.positionAt(editor.document.getText().length)
		);

		await editor.edit((editBuilder) => {
			editBuilder.replace(fullRange, code);
		});

		vscode.window.showInformationMessage("Fix applied!");
	}

	postLogMessage(text) {
		this.webviewView.webview.postMessage({ kind: "log", text });
	}

	buildPrompt(text) {
		return `You are an expert AI debugger integrated into VS Code.
Given the following code:

${text}

Your job is to find and fix any issues (errors, risks, performance problems).
- Provide a concise, clear explanation in a conversational tone.
- Follow the explanation with the full, corrected code.
- Always use a code block with '~~~js' and '~~~' delimiters.`;
	}

	getWebviewHtml(webview) {
		const nonce = (() => {
			let s = "";
			const chars =
				"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
			for (let i = 0; i < 32; i++)
				s += chars.charAt(Math.floor(Math.random() * chars.length));
			return s;
		})();

		return `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta http-equiv="Content-Security-Policy"
            content="default-src 'none'; img-src ${webview.cspSource} https: data:;
            style-src 'unsafe-inline' ${webview.cspSource};
            script-src 'nonce-${nonce}';">
          <meta name="viewport" content="width=device-width,initial-scale=1.0">
          <title>AI Debugger</title>
          <style>
            :root { color-scheme: light dark; }
            body { margin: 0; font-family: var(--vscode-font-family); font-size: var(--vscode-font-size); color: var(--vscode-foreground); background: var(--vscode-sideBar-background); display: flex; flex-direction: column; height: 100vh; }
            .container { display: flex; flex-direction: column; height: 100%; padding: 10px; }
            .chat-container { flex-grow: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; padding-bottom: 10px; }
            .chat-message { padding: 10px; border-radius: 8px; max-width: 90%; word-wrap: break-word; }
            .user-message { background: var(--vscode-input-background); align-self: flex-end; }
            .ai-message { background: var(--vscode-list-hoverBackground); align-self: flex-start; }
            .code-block-container { background: var(--vscode-editor-background); border-radius: 4px; padding: 10px; margin-top: 10px; white-space: pre-wrap; word-break: break-all; overflow-x: auto; }
            .code-block-container code { font-family: var(--vscode-editor-font-family); font-size: var(--vscode-editor-font-size); }
            .chat-actions { display: flex; align-items: center; justify-content: flex-end; margin-top: 10px; }
            .btn { background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; transition: background-color 0.2s; width: 100%; }
            .btn:hover { background: var(--vscode-button-hoverBackground); }
            .input-area { display: flex; flex-direction: column; padding: 10px; gap: 10px; border-top: 1px solid var(--vscode-editorGroup-border); }
            .btn-send { flex-grow: 1; }
            .loader {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid #cccccc;
  border-top-color: #0f62fe;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

            .typing-cursor { display: inline-block; animation: blink-animation 0.5s infinite; }
            @keyframes blink-animation { 50% { opacity: 0; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="chat-container" id="chatContainer">
              <div class="chat-message ai-message">Hi there! Select a code block and click "Analyze" to get started.</div>
            </div>
            <div class="input-area">
              <button class="btn btn-send" id="runBtn">Analyze Code</button>
              <button class="btn btn-send" id="runFullBtn">Analyze Full Code</button>
            </div>
          </div>
          <script nonce="${nonce}">
            const vscode = acquireVsCodeApi();
            const chatContainer = document.getElementById("chatContainer");
            const runBtn = document.getElementById("runBtn");
            const runFullBtn = document.getElementById("runFullBtn");

            const typeText = (element, text, delay = 10) => new Promise(resolve => {
                let i = 0;
                const interval = setInterval(() => {
                    if (i < text.length) {
                        element.textContent += text.charAt(i);
                        i++;
                    } else {
                        clearInterval(interval);
                        resolve();
                    }
                }, delay);
            });

            runBtn.addEventListener("click", () => {
                runBtn.disabled = true;
                vscode.postMessage({ kind: "runDebug" });
            });

            runFullBtn.addEventListener("click", () => {
                runFullBtn.disabled = true;
                vscode.postMessage({ kind: "runFullDebug" });
            });

            window.addEventListener("message", async (event) => {
                const message = event.data;
                if (message.kind === "userMessage") {
                    const el = document.createElement("div");
                    el.className = "chat-message user-message";
                    el.textContent = message.text;
                    chatContainer.appendChild(el);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
                
                if (message.kind === "loading") {
                    const el = document.createElement("div");
                    el.className = "chat-message ai-message";
                    el.innerHTML = '<span class="loader"></span> Analyzing...';
                    chatContainer.appendChild(el);
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }

                if (message.kind === "aiResponse") {
                    runBtn.disabled = false;
                    runFullBtn.disabled = false;
                    const loadingEl = chatContainer.lastChild;
                    loadingEl.remove();

                    const aiEl = document.createElement("div");
                    aiEl.className = "chat-message ai-message";
                    chatContainer.appendChild(aiEl);

                    await typeText(aiEl, message.explanation);
                    
                    if (message.code) {
                        const codeBlock = document.createElement("div");
                        codeBlock.className = "code-block-container";
                        const codeEl = document.createElement("code");
                        codeEl.textContent = message.code;
                        codeBlock.appendChild(codeEl);
                        
                        const applyBtnContainer = document.createElement("div");
                        applyBtnContainer.className = "chat-actions";
                        const applyBtn = document.createElement("button");
                        applyBtn.className = "btn";
                        applyBtn.textContent = "Apply Fix";
                        applyBtn.onclick = () => {
                            vscode.postMessage({ kind: "applyFix", code: message.code });
                        };
                        applyBtnContainer.appendChild(applyBtn);
                        
                        aiEl.appendChild(codeBlock);
                        aiEl.appendChild(applyBtnContainer);
                    }
                    chatContainer.scrollTop = chatContainer.scrollHeight;
                }
            });
          </script>
        </body>
        </html>`;
	}
}

function activate(context) {
	console.log("AI Debugger is now active!");
	const provider = new AiDebuggerProvider(context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider("ai-debugger-view", provider)
	);
}

function deactivate() {}

module.exports = { activate, deactivate };

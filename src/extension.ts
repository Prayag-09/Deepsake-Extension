import ollama from 'ollama';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "deepsake" is now active!');

	const disposable = vscode.commands.registerCommand('deepsake.start', () => {
		const panel = vscode.window.createWebviewPanel(
			'deepsake',
			'Talk to DeepSeek',
			vscode.ViewColumn.One,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		panel.webview.html = getWebviewContent();

		let isStreaming = false;

		panel.webview.onDidReceiveMessage(
			async (message: any) => {
				switch (message.command) {
					case 'chat':
						if (isStreaming) {
							panel.webview.postMessage({
								command: 'receiveMessage',
								text: 'Please wait for the current response to finish.',
							});
							return;
						}

						const prompt = message.text.trim();
						if (!prompt) {
							panel.webview.postMessage({
								command: 'receiveMessage',
								text: 'Please enter a message before sending.',
							});
							return;
						}

						isStreaming = true;

						// Show typing indicator
						panel.webview.postMessage({
							command: 'typing',
							isTyping: true,
						});

						try {
							const deepResponse = await ollama.chat({
								model: message.model || 'deepseek-r1:14b',
								messages: [{ role: 'user', content: prompt }],
								stream: true,
							});

							let messageBuffer = ''; // Buffer to collect all chunks
							for await (const part of deepResponse) {
								messageBuffer += part.message.content; // Collecting the parts
							}

							// Once all chunks are received, post the full message to the chat
							panel.webview.postMessage({
								command: 'receiveMessage',
								text: messageBuffer,
							});
						} catch (error) {
							console.error('Error communicating with Ollama:', error);
							panel.webview.postMessage({
								command: 'receiveMessage',
								text: 'Error: Failed to communicate with Ollama.',
							});
						} finally {
							isStreaming = false;
							panel.webview.postMessage({
								command: 'typing',
								isTyping: false,
							});
						}
						break;

					case 'clearChat':
						panel.webview.postMessage({
							command: 'clearChat',
						});
						break;

					case 'stopGeneration':
						isStreaming = false;
						panel.webview.postMessage({
							command: 'receiveMessage',
							text: 'Response generation stopped.',
						});
						break;
				}
			},
			undefined,
			context.subscriptions
		);
	});

	context.subscriptions.push(disposable);
}

export function deactivate() {}

function getWebviewContent(): string {
	return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Talk to DeepSeek</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    height: 100vh;
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                }
                header {
                    background-color: var(--vscode-titleBar-activeBackground);
                    color: var(--vscode-titleBar-activeForeground);
                    padding: 10px;
                    text-align: center;
                    font-size: 1.2em;
                    font-weight: bold;
                }
                #chat {
                    flex: 1;
                    padding: 10px;
                    overflow-y: auto;
                    border-bottom: 1px solid var(--vscode-editorWidget-border);
                }
                .message-container {
                    display: flex;
                    flex-direction: column;
                    margin-bottom: 10px;
                }
                .message {
                    padding: 8px 12px;
                    border-radius: 15px;
                    max-width: 80%;
                    position: relative;
                    margin-bottom: 4px;
                    font-size: 1em;
                    word-break: break-word;
                }
                .user-message {
                    background-color: #d0f0c0;
                    color: #000;
                    align-self: flex-end;
                }
                .bot-message {
                    background-color: #f0f0f0;
                    color: #000;
                    align-self: flex-start;
                }
                .timestamp {
                    font-size: 0.8em;
                    color: var(--vscode-descriptionForeground);
                    margin-top: 4px;
                }
                .copy-button {
                    position: absolute;
                    top: 5px;
                    right: 5px;
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: var(--vscode-descriptionForeground);
                }
                .copy-button:hover {
                    color: var(--vscode-button-foreground);
                }
                #inputArea {
                    display: flex;
                    padding: 10px;
                    background-color: var(--vscode-editorWidget-background);
                    border-top: 1px solid var(--vscode-editorWidget-border);
                }
                #messageInput {
                    flex: 1;
                    padding: 8px;
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 4px;
                    margin-right: 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                }
                #sendButton {
                    padding: 8px 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    cursor: pointer;
                }
                #sendButton:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                #clearButton {
                    padding: 8px 16px;
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    border-radius: 4px;
                    margin-top: 10px;
                    cursor: pointer;
                }
                #clearButton:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                #stopButton {
                    padding: 8px 16px;
                    background-color: #ff4444;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    margin-top: 10px;
                    cursor: pointer;
                }
                #stopButton:hover {
                    background-color: #cc0000;
                }
                .typing-indicator {
                    display: none;
                    font-style: italic;
                    color: var(--vscode-descriptionForeground);
                    padding: 10px;
                }
                .confirmation {
                    font-size: 0.9em;
                    color: green;
                    padding: 5px;
                }
            </style>
        </head>
        <body>
            <header>Talk to DeepSeek</header>
            <div id="chat"></div>
            <div class="typing-indicator" id="typingIndicator">DeepSeek is typing...</div>
            <div id="inputArea">
                <input id="messageInput" type="text" placeholder="Type your message here..." />
                <button id="sendButton">Send</button>
            </div>
            <button id="clearButton">Clear Chat</button>
            <button id="stopButton">Stop Generation</button>

            <script>
                const vscode = acquireVsCodeApi();
                const chatDiv = document.getElementById('chat');
                const messageInput = document.getElementById('messageInput');
                const sendButton = document.getElementById('sendButton');
                const clearButton = document.getElementById('clearButton');
                const stopButton = document.getElementById('stopButton');
                const typingIndicator = document.getElementById('typingIndicator');

                // Send message on button click
                sendButton.addEventListener('click', sendMessage);

                // Send message on Enter key
                messageInput.addEventListener('keypress', (event) => {
                    if (event.key === 'Enter') {
                        sendMessage();
                    }
                });

                function sendMessage() {
                    const message = messageInput.value.trim();
                    if (!message) {
                        appendMessage('bot', 'Please enter a message before sending.');
                        return;
                    }

                    appendMessage('user', message);
                    vscode.postMessage({
                        command: 'chat',
                        text: message,
                        model: 'deepseek-r1:14b', // Default model
                    });
                    messageInput.value = '';
                }

                function appendMessage(sender, text) {
                    const messageContainer = document.createElement('div');
                    messageContainer.classList.add('message-container');

                    const messageElement = document.createElement('div');
                    messageElement.classList.add('message', sender + '-message');
                    messageElement.textContent = text;

                    const timestamp = document.createElement('div');
                    timestamp.classList.add('timestamp');
                    timestamp.textContent = new Date().toLocaleTimeString();

                    const copyButton = document.createElement('button');
                    copyButton.classList.add('copy-button');
                    copyButton.textContent = '📋';
                    copyButton.addEventListener('click', () => {
                        navigator.clipboard.writeText(text);
                        showConfirmation('Copied to clipboard!');
                    });

                    messageElement.appendChild(timestamp);
                    messageElement.appendChild(copyButton);
                    messageContainer.appendChild(messageElement);
                    chatDiv.appendChild(messageContainer);
                    chatDiv.scrollTop = chatDiv.scrollHeight; // Auto-scroll to the latest message
                }

                // Handle streaming response chunks
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.command === 'receiveMessageChunk') {
                        appendMessage('bot', message.text);
                    } else if (message.command === 'receiveMessage') {
                        appendMessage('bot', message.text);
                    } else if (message.command === 'typing') {
                        typingIndicator.style.display = message.isTyping ? 'block' : 'none';
                    } else if (message.command === 'clearChat') {
                        chatDiv.innerHTML = '';
                        showConfirmation('Chat cleared!');
                    }
                });

                // Clear chat
                clearButton.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'clearChat',
                    });
                });
x
                // Stop generation
                stopButton.addEventListener('click', () => {
                    vscode.postMessage({
                        command: 'stopGeneration',
                    });
                });

                // Show confirmation message
                function showConfirmation(text) {
                    const confirmation = document.createElement('div');
                    confirmation.classList.add('confirmation');
                    confirmation.textContent = text;
                    document.body.appendChild(confirmation);
                    setTimeout(() => confirmation.remove(), 2000);
                }
            </script>
        </body>
        </html>
    `;
}

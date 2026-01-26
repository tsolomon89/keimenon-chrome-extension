# Keimenon Lite 

> **Extract your prompts. Copy clean. Keep it local.**

**Keimenon Lite** is a powerful, privacy-first Chrome extension designed for power users of AI chat interfaces (ChatGPT, Claude, Gemini, Grok). It allows you to instantly extract, filter, and archive your *own* prompt history without capturing AI responses or sending data to a third-party server.

Whether you're building a prompt library, auditing your interactions, or simply saving a conversation for later, Keimenon Lite gives you full control over your data with a premium, Material Design 3 interface.

![Keimenon Lite Banner](assets/banner-placeholder.png)

## ✨ Features

### 🔒 Uncompromising Privacy
-   **Local-Only Philosophy**: Every line of code runs directly in your browser.
-   **No Data Exfiltration**: We do not have servers. Your chats never leave your machine.
-   **Transient Memory**: Data is held in RAM only while the side panel is open and vanishes when closed.

### 🚀 Powerful Extraction
-   **Smart Radar Scanning**: Automatically scrolls through infinite-load chats (like long Claude sessions) to harvest every single message.
-   **Multi-Platform Support**: Seamlessly works on:
    -   **ChatGPT** (`chatgpt.com`, `chat.openai.com`)
    -   **Claude** (`claude.ai`)
    -   **Gemini** (`gemini.google.com`)
    -   **Grok** (`x.com`, `grok.com`)

### 🛠️ Advanced Tools
-   **Instant Search**: Filter hundreds of prompts in milliseconds with real-time highlighting.
-   **Length Filtering**: Sort by "Longest First" or hide short "continue" messages to find significant prompts.
-   **One-Click Copy**: Copy a single prompt or merge the entire filtered view into a clean markdown or text block for your notes.
-   **Auto-Sync**: Detects new messages instantly as you type them.

## 📖 Installation

### From Chrome Web Store
*(Coming Soon)*

### Manual Installation (Developer Mode)
1.  **Clone the Repository**:
    ```bash
    git clone https://github.com/tsolomon89/keimenon-lite.git
    cd keimenon-lite
    ```
2.  **Install & Build**:
    This project uses `esbuild` to package the content script for strict Content Security Policy (CSP) environments.
    ```bash
    npm install
    npm run build
    ```
3.  **Load in Chrome**:
    -   Navigate to `chrome://extensions/`
    -   Toggle **Developer mode** (top right).
    -   Click **Load unpacked**.
    -   Select the `keimenon-lite` directory.

## ⚡ Quick Start Guide

1.  **Pin It**: Pin the Keimenon Lite icon to your browser toolbar for easy access.
2.  **Open**: Navigate to a supported chat (e.g., [chatgpt.com](https://chatgpt.com)) and click the icon.
3.  **Extract**: The side panel will immediately populate with your messages.
    -   *Long Chat?* Click the **Radar Icon** in the header to initiate a "Full Scan" that scrolls back to the beginning of time.
4.  **Action**:
    -   **Search**: Type keywords to filter.
    -   **Copy**: Click the copy icon on any card, or use the **Copy All** button to grab the entire list.

## 🏗️ Development

### Project Structure
-   `src/content.js` - Main entry point. Handles DOM observation and extraction.
-   `src/ui/` - The Side Panel application (HTML/CSS/JS). Built with Vanilla JS and CSS variables for a lightweight footprint.
-   `src/adapters/` - Site-specific logic. Each `Adapter` defines how to find messages on a specific platform.

### Local Preview
You can iterate on the UI without loading the full extension:
1.  Open `src/ui/dev-preview.html` in your browser.
2.  This environment mocks the Chrome API with dummy data (`src/ui/dev-mocks.js`), allowing rapid CSS/JS development.

### Commands
-   `npm run build` - Transpile and bundle the content script.
-   `npm test` - Run unit tests for adapters (Vitest).

## 📄 Privacy & License

**Your data is yours.**
See our [Privacy Policy](PRIVACY_POLICY.md) for a detailed breakdown of our security practices.

**License**: MIT
Free to fork, modify, and use.

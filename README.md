# Keimenon Lite (Chrome Extension)

Keimenon Lite is a Chrome extension designed to **extract your own prompt history** from AI chat interfaces like ChatGPT and Claude. It parses the DOM to retrieve user-authored messages, allowing you to search, filter, and archive your conversations locally.

## ✨ Features
- **Privacy First**: operates 100% locally. No data leaves your machine.
- **Supported Platforms**:
  - **ChatGPT** (with "Scan Full Chat" for long history)
  - **Claude**
- **Search & Highlighting**: Instantly find prompts; matches are highlighted in yellow.
- **Smart Scanning**: unique "Radar" scanning mode harvests messages from infinite-scroll chats.
- **Visual Feedback**: Premium Material Design 3 UI with glassmorphism, animations, and "Scanning Beam" effects.
- **Export**: Copy individual prompts or the entire filtered list to clipboard.

## 🛠️ Installation

### Prerequisites
- Node.js (for building the bundle)
- Chrome / Edge / Brave

### Steps
1. **Clone** the repository.
   ```bash
   git clone <repo-url>
   cd keimenon-lite
   ```
2. **Install Dependencies** & **Build**:
   The extension uses `esbuild` to bundle the content script for compatibility with strict CSPs (like ChatGPT).
   ```bash
   npm install
   npm run build
   ```
3. **Load in Chrome**:
   - Go to `chrome://extensions`
   - Enable **Developer mode** (top right).
   - Click **Load unpacked**.
   - Select the `keimenon-lite` folder.

## 📖 Usage

1. **Pin the Extension**: Click the puzzle piece icon and pin Keimenon Lite.
2. **Open the Side Panel**: Click the icon to open the side panel. It works alongside your chat.
3. **Scan**:
   - For short chats, messages appear automatically.
   - For long chats, click the **Radar Icon** (header buttons) to start a "Full Scan". This will scroll the page to harvest older messages.
4. **Filter**:
   - Use the **Search Bar** to find keywords.
   - Use **Filters** to sort by length or hide short messages (e.g., "continue").

## 🏗️ Development

### Project Structure
- `src/ui/`: Side panel HTML/CSS/JS (Material Design 3).
- `src/adapters/`: Logic for specific sites (ChatGPTAdapter, ClaudeAdapter).
- `src/content.js`: Main entry point (bundled).
- `dist/`: Output folder for release zips.

### Commands
- `npm run build`: Bundles `src/content.js` -> `src/content.bundle.js`.
- `npm test`: Runs Vitest suite for adapters.
- `scripts/pack.ps1` (Windows): PowerShell script to build and zip for distribution.

## 🔒 Privacy Policy
See [PRIVACY_POLICY.md](PRIVACY_POLICY.md). In short: **Your data stays on your device.**

## License
MIT

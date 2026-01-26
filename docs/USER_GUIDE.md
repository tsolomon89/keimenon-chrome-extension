# Keimenon Lite: User Guide

Welcome to the detailed user guide for **Keimenon Lite**. This document provides an in-depth look at how to get the most out of the extension.

---

## 1. Core Concepts

### What is "Local Extraction"?
Most "save to" extensions work by sending your page content to a cloud server, which then processes it and saves it to a database. 
**Keimenon Lite is different.** It works like a "screen scraper" that runs entirely inside your browser. It reads the text you see on the screen, cleans it up (removing buttons, avatars, and noise), and hands it to you. This is why it requires zero account setup and has zero privacy risk.

### Supported Platforms
The extension automatically detects when you act on a supported site. Currently supported:
-   **ChatGPT** (`chatgpt.com`): Full support for standard chats.
-   **Claude** (`claude.ai`): Full support, including deep history scanning.
-   **Gemini** (`gemini.google.com`): Basic extraction support.
-   **Grok** (`x.com` / `grok.com`): Basic extraction support.

If you open the extension on an unsupported site (e.g., Google.com), it will display a "Ready" or "Unsupported" status and wait for you to navigate to a chat.

---

## 2. Feature Deep Dive

### 📡 Radar Mode (Deep Scanning)
Modern chat interfaces use "infinite scroll" or "virtualization." This means if you have a chat with 500 messages, the browser only actually "draws" the 20 or so you are currently looking at. The rest don't exist in the page code until you scroll to them.

**The Problem:** A simple scraper would only see the 20 visible messages.
**The Solution:** Keimenon's **Radar Mode**.

**How to use:**
1.  Open the Side Panel.
2.  Look for the **Radar Icon** (usually near the refresh button).
3.  Click it. The page will physically scroll upwards automatically.
4.  You will see a counter: *"Scanning... found 50, found 80..."*
5.  Once it hits the top or stops finding new messages, it will finish.

> **Tip:** Don't touch the mouse while Radar Mode is scanning. Let it do its work!

### 🔍 Advanced Search
The search bar isn't just a simple filter.
-   **Real-time:** As you type, the list updates instantly.
-   **Highlighting:** Matches are highlighted in yellow within the message cards.
-   **Context:** It searches the *entire* message content, not just the preview you see on the card.

### 📏 Length Filters & Sorting
Sometimes you want to find that *one specific complex prompt* you wrote, but you have 100 messages of "Continue" or "Yes."
1.  **Min Length**: Open the Filter menu and set "Min Length" to `100`. This hides all short messages.
2.  **Sort by Length**: Toggle the Sort button to "Longest First". Your most detailed prompts will bubble to the top.

### 🎭 Appearance & Themes
Keimenon Lite adapts to your aesthetic. 
1.  Click the **Menu** (three dots).
2.  Select **Theme**.
3.  Choose from a variety of presets including **Solid**, **Glass**, **Neon**, and **Outline** variants (Light/Dark).

### 👥 Author Filtering
While Keimenon Lite focuses on *User* messages, it can also act as a full conversation viewer.
-   **Toggle:** Use the segmented button in the header (👤 / 👥 / 🤖).
-   **Modes:**
    -   **Human Only** (Default): best for extracting prompts.
    -   **Both**: Good for reading the flow of conversation.
    -   **AI Only**: Useful if you just want to find a specific code snippet or answer provided by the AI.

---

## 3. Exporting Data

### Copy Single
Click the **Copy Icon** in the header of any message card. This puts the clean, raw text of that single prompt into your clipboard.

### Copy All (Bulk Export)
The **Copy All** button (bottom or top action bar) respects your current *view*.
-   If you have filtered the list to show only "5 matches", **Copy All** will copy *only those 5 matches*.
-   The format is a clean text block, with messages separated by a divider (`---`).
-   This is perfect for pasting into a Notion doc, Obsidian vault, or a new text file.

---

## 4. Troubleshooting

**Q: The extension says "Unsupported" but I'm on ChatGPT?**
A: Try refreshing the page. Sometimes single-page apps (SPAs) navigate without fully reloading, and the extension needs a nudge.

**Q: Radar Mode stopped halfway?**
A: Large chats can sometimes lag the browser. Stop the scan, scroll up manually a bit, and try scanning again.

**Q: Can I save AI responses too?**
A: **No.** By design, Keimenon Lite *only* extracts **your** messages. This is a deliberate choice to keep the tool focused on *prompt engineering extraction* rather than chat archiving.

---

## 5. Contact & Support

This is an open-source project. 
-   **Report Bugs**: Please file an issue on our GitHub repository.
-   **Security**: Email `security@keimenon.com`.

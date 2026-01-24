# Privacy & Security Documentation

## 1. Formal Privacy Policy

**Effective Date:** January 24, 2026

**Keimenon Lite** ("the Extension") is a browser extension designed to help users extract, format, and archive their own conversations from supported AI chat platforms (e.g., ChatGPT, Claude, Gemini, Grok). This policy outlines how unique data is handled.

### A. Data Processing & Storage
*   **Local Processing:** All chat extraction, formatting, and file generation occur locally within the user's browser.
*   **No Remote Server:** The Extension does not transmit, proxy, or store user content on any external server.
*   **No Model Inference:** The Extension does not perform AI inference or analysis on user data; it strictly formats existing text.
*   **Transient Memory:** Extracted data is held in the browser's volatile memory (RAM) only while the side panel is open and is cleared upon closure.

### B. Information We Do NOT Collect
*   **Chat Content:** We do not view, collect, or monetize the specific content of your conversations.
*   **Browsing History:** We do not track websites visited, except to detect if the *current* active tab is a supported chat platform within the extension's declared permissions.
*   **Personal Identifiers:** We do not collect names, IP addresses, or account credentials.

### C. Optional Data Collection
*   **Email Address:** Users may voluntarily provide an email address to subscribe to a mailing list. This is strictly opt-in.
*   **Diagnostics:** Users may opt-in to share minimal, anonymous reliability data (e.g., crash counts). This is disabled by default and contains no user content.

### D. Data Retention
Since we do not store your data on our servers, we have no data retention policy for user content. Any files downloaded by the Extension are stored on your local device and managed by you.

### E. User Rights & Control
*   **Opt-Out:** Users can decline all optional data collection.
*   **Data Removal:** Deleting the extension removes all local temporary data associated with it.

### F. Contact
For privacy inquiries or concerns, please report an issue on our public repository or contact us at `security@keimenon.com`.

---

## 2. In Plain English: A Human Note on Privacy

Hello, I am the developer of Keimenon Lite. I want to be crystal clear about my intentions with this software:

*   **I am not interested in your prompts or conversations.** I built this tool because I wanted a way to save my *own* chats, and I assume you want to keep yours private too.
*   **I do not spy on you.** The code runs entirely on your machine. I don't see what you type, and I don't see what the AI answers.
*   **No hidden uploads.** There is no "backend" server secretly collecting your logs.
*   **Opt-in means Opt-in.** If I ask for your email for a newsletter, it’s because I want to tell you about updates. I won't spam you or sell the list.
*   **Safety First.** I try to write secure code. If something ever looks wrong, suspicious, or unsafe, please contact me immediately. I will make a good-faith effort to fix security issues quickly.

The intent of the project is to remain local-first and respectful of user data.

---

## 3. Security & Vulnerability Reporting

We welcome responsible disclosure of security vulnerabilities.

*   **Contact:** Please email `security@keimenon.com`.
*   **Content:** Do not include sensitive personal data (e.g., actual private chat logs) in your report unless strictly necessary to reproduce a bug.
*   **Response:** We review all reports and will address confirmed vulnerabilities in good faith and as quickly as possible.

---

## 4. Chrome Web Store Disclosure Summary

Keimenon Lite processes all user data locally within the browser. It does not collect, transmit, or sell user chat content, browsing history, or personal identifiers. Optional email collection is strictly opt-in for newsletter updates only. No user data is stored on developer servers.
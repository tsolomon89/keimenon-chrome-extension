# Privacy Policy for Keimenon Lite

**Last Updated:** 2026-01-22

Keimenon Lite ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we handle your data when you use our Chrome Extension.

## 1. Data Collection
**We do not collect, store, or transmit any personal data.**

- **Local Processing**: All parsing and message extraction happens locally within your browser's execution context.
- **No External Servers**: The extension does not communicate with any external servers, APIs (other than the AI platforms you visit directly), or analytics providers controlled by us.
- **Usage Analytics**: The codebase contains placeholders for basic usage metrics (clicks, scan counts), but this feature is **disabled by default** and not configured to send data to any active endpoint in the distributed version.
- **No Cookies**: We do not set or read cookies for tracking purposes.

## 2. Permissions
The extension requests the following permissions for specific functionality:
- **Side Panel**: To display the user interface alongside your web content.
- **Scripting / ActiveTab**: To read the DOM of the supported chat pages (ChatGPT, Claude) solely for the purpose of identifying text within elements marked as "user messages".
- **Host Permissions**:
  - `*://chatgpt.com/*`
  - `*://claude.ai/*`
  - Used strictly to inject the content script that reads *your* own prompt history on that page.

## 3. Data Usage
The extracted text (your prompts) is stored temporarily in the extension's memory (RAM) while the side panel is open. It is **never** persisted to disk by us, nor sent anywhere. When you close the browser or the side panel, the data is cleared from memory.

## 4. Contact
If you have questions about this policy, please contact the developer via the repository issues page.

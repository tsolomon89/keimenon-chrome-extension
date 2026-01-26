# Privacy Policy for Keimenon Lite

**Effective Date:** January 24, 2026

At Keimenon, we believe that **privacy is a feature, not an option**. Keimenon Lite is architected from the ground up to ensure that your conversation data remains 100% under your control.

## 1. Zero-Knowledge Architecture

### Local-Only Processing
-   **No Remote Servers**: Keimenon Lite does not operate a backend server for data processing.
-   **Client-Side Execution**: All message extraction, filtering, and formatting logic executes directly within your browser's local JavaScript environment.
-   **No "Home Calling"**: The extension does not transmit usage data, extracted text, or metadata to Keimenon or any third party.

### Transient Memory Model
-   **Volatile Storage**: Extracted messages are stored in your browser’s Random Access Memory (RAM) only.
-   **Lifecycle**: Data exists only while the extension Side Panel is open. Closing the panel or the tab instantly wipes the extracted data from memory.
-   **No Persistent Storage**: We do not write your chat logs to `localStorage`, `IndexedDB`, or cookies.

## 2. Information We Do Not Collect

To be explicitly clear, we have **technically impossible** access to:
1.  **Your Chat Content**: We cannot see, read, or analyze your prompts or the AI's responses.
2.  **Your Identity**: We do not collect email addresses, user IDs, IP addresses, or browser fingerprints.
3.  **Your History**: We check the current URL *only* to determine if a compatible adapter should be loaded (e.g., "Is this ChatGPT?"). We do not track your browsing history across other sites.

## 3. Chrome Permissions Explained

We request the minimum set of permissions necessary to function:

| Permission | Justification |
| :--- | :--- |
| `sidePanel` | Required to display the user interface alongside your chat window. |
| `scripting` / `activeTab` | Required to inject the content script that reads the DOM of the *current* tab to extract user messages. |
| `storage` | Used strictly for **UI Preferences** (e.g., saving your "Dark Mode" setting or "Last Sort Order"). **Never** used for chat content. |

## 4. Third-Party Services

Since the extension runs locally, there are no third-party data processors involved in the core functionality.
-   **No Analytics**: We do not use Google Analytics, Mixpanel, or similar trackers.
-   **No Advertising**: The extension is ad-free and tracking-free.

## 5. Security Vulnerability Reporting

We value the security community's help in keeping our software safe. If you discover a vulnerability:
-   **Email**: `security@keimenon.com`
-   **Policy**: We pledge to investigate and remediate verified issues promptly. Please do not attach sensitive personal data to your reports.

## 6. Updates to This Policy

We may update this policy to reflect changes in our technical architecture or legal requirements. Since we do not collect contact info, we encourage users to check this repository for updates. Major changes will be highlighted in the extension's changelog.

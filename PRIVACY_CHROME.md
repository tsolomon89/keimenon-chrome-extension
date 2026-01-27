# Privacy Practices (Chrome Web Store Disclosure)

This document provides the specific disclosures required for the "Privacy Practices" tab of the Chrome Web Store listing.

## 1. Data Collection Disclosure

**Do you collect any user data?**
> **No.** The extension does not collect, transmit, or store user data on any external server. All processing is local.

**Data Usage:**
The extension accesses the following data purely for **local functionality**:

*   **Website Content (Page Content):**
    *   *Purpose*: The extension reads the DOM of specific chat websites (ChatGPT, Claude, etc.) to extract *user-authored* text for the sole purpose of displaying it in the Side Panel for the user to copy.
    *   *Retention*: Transient (in-memory only). Wiped immediately upon closing the side panel.

## 2. Permission Justifications

### `activeTab` & Host Permissions
*   **Why?**: Necessary to inject the `content.js` script into the active tab to perform the extraction logic.
*   **Scope**: Restricted strictly to the domains listed in `matches` (e.g., `chatgpt.com`, `claude.ai`).



### `sidePanel`
*   **Why?**: To render the application interface in the browser's side panel area, avoiding intrusion into the page content itself.

## 3. Compliance Certifications

-   **√ No Sale of Data**: We do not sell data to third parties.
-   **√ No Use for Lending/Credit**: Not used for creditworthiness.
-   **√ No Marketing**: Not used for marketing or advertising.
-   **√ Direct Benefit**: All data usage is for the direct, user-initiated benefit of the user (extracting their own notes).
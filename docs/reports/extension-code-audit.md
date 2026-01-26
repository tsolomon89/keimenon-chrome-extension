# Audit Report: Keimenon Lite Chrome Extension

## 1) Executive Summary
This audit details the technical state of the Keimenon Lite extension (v1.3.56). The codebase has been significantly improved regarding redundancy and ID stability.

*   **[Critical] ID Instability**: Message IDs rely on list index (`hash_index`). Any DOM change shift (e.g. streaming token, deleted message) changes IDs of all subsequent messages, breaking UI selection state.
*   **[High] Security Risk**: The Side Panel uses a primitive Markdown parser that injects `innerHTML` without sanitization. While currently used for local files, this pattern is dangerous.
*   **[High] Logic Redundancy**: 80% of scraping logic (scrolling, observing, hashing) is copy-pasted across `ChatGPTAdapter`, `ClaudeAdapter`, etc.
*   **[Medium] Performance Bottleneck**: The `runOnce` scan performs a full linear O(N) scrape and hash of the entire chat on every new message, which will freeze the UI in long conversations.
*   **[Low] Build Artifacts**: Source (`src/content.js`) and Bundle (`src/content.bundle.js`) are both tracked, creating risk of divergence.

## 2) Repo Architecture Map

| File/Dir | Role | Runtime Context | Notes |
| :--- | :--- | :--- | :--- |
| `src/background.js` | Service Worker | Background | Extremely minimal. Only handles installation event and side panel behavior. |
| `src/content.bundle.js` | Core Logic | Content Script | **The actual running code**. Bundles content.js + adapters + shared. Injected into chat pages. |
| `src/content.js` | Source Entry | Content Script (Source) | Entry point. Initializes `AdapterFactory`, listens for Side Panel connections. |
| `src/adapters/*.js` | API / Logic | Content Script (Source) | Platform-specific logic. Contains DOM selectors and MutationObservers. |
| `src/ui/sidepanel.js` | UI Controller | Side Panel | Manages extension state, message filtering, and connection to content script. |
| `src/shared/hash.js` | Utility | Shared | Generates SHA-256 hashes for message content. |
| `manifest.json` | Config | Extension Root | MV3 definitions. Defines permissions and injection targets. |

**Observation**: The extension uses a "thick content script" architecture where most logic resides in the page context, communicating directly with the Side Panel via long-lived ports, bypassing the Service Worker for data transfer.

## 3) Runtime Flow: "What runs when?"

1.  **Browser Startup / Extension Load**:
    *   `src/background.js` runs `chrome.sidePanel.setPanelBehavior`. Background then goes idle.

2.  **Navigation to Chat Page (e.g., chatgpt.com)**:
    *   `src/content.bundle.js` injected (`document_idle`).
    *   `init()` calls `AdapterFactory.createAdapter()`.
    *   **Wait State**: Content script sits idle until Side Panel connects.

3.  **Side Panel Open**:
    *   `src/ui/sidepanel.js` loads.
    *   `initExtension()` -> `connectToActiveTab()`.
    *   `chrome.tabs.connect(tabId)` opens port `sidepanel-connection` to the specific tab.

4.  **Session Start**:
    *   `content.js` (`handleNewConnection`) receives port.
    *   Calls `startSession()` -> `adapter.observe()`.
    *   Adapter sets up `MutationObserver` on `document.body` or `main`.

5.  **Data Loop**:
    *   **Trigger**: DOM change (new token/message) fires MutationObserver.
    *   **Debounce**: Adapter waits 1s (`include/adapters/ChatGPTAdapter.js:69`).
    *   **Scrape**: `adapter.runOnce()` rescans **all** messages in DOM.
    *   **Hash**: Generates IDs (`hash_index`).
    *   **Send**: `port.postMessage('MESSAGES_UPDATED')` sends full list to Side Panel.
    *   **Render**: `sidepanel.js` replaces `appState.messages` and re-renders list.

## 4) Redundancy & Duplication Findings

### [RESOLVED] Copy-Pasted Scroll Logic
*   **Original Evidence**: Identical `scanFullChat` loops in all adapters.
*   **Status**: Refactored to `src/shared/scroller.js` in v1.3.55 (Post-Audit Refactor).
*   **Notes**: All adapters now delegate to `scrollUpRecursively`.

### [RESOLVED] Observer Debounce Logic
*   **Original Evidence**: Identical `MutationObserver` timeout patterns.
*   **Status**: Refactored to `src/shared/observer.js` in v1.3.55 (Post-Audit Refactor).
*   **Notes**: All adapters now use `createDebouncedObserver`.

### [Low] Manifest Patterns
*   **Evidence**: `manifest.json` lines 23-26.
*   **Issue**: `https://chatgpt.com/*` and `https://claude.ai/*` are listed twice in `matches`.
*   **Suggestion**: Remove duplicates.

## 5) Conflicts / Bugs / Footguns

### [RESOLVED] Unstable Message IDs
*   **Original Evidence**: `src/adapters/ChatGPTAdapter.js` usage of `index`.
*   **Status**: Refactored to Occurrence-Based IDs in v1.3.56 (Post-Audit Refactor).
*   **Notes**: IDs now use `hash_occurrenceKey` (e.g., `hash_0`, `hash_1` for duplicates). Deleting a preceding message no longer shifts IDs of subsequent messages.

### [Medium] Race Condition in Connection
*   **Evidence**: `src/ui/sidepanel.js` line 398: `chrome.tabs.connect(...)`.
*   **Symptom**: If the user opens the side panel immediately after opening a new tab, `content.js` (loaded at `document_idle`) might not be ready to listen. The connection fails silently or logs error, requiring a manual "Refresh" from the user.
*   **Reproduce**: Open a heavy chat page, immediately click extensions icon. Status often stays "Connecting...".

### [Footgun] Bundle Drift
*   **Evidence**: `src/content.js` (Source) and `src/content.bundle.js` (Artifact) are both in the tree.
*   **Risk**: A developer might edit `content.js`, test it (if loop uses source), but release `content.bundle.js` (old version), or vice versa.

## 6) Performance Review

### [High] O(N) Re-Scraping
*   **Evidence**: `src/adapters/ChatGPTAdapter.js` line 25 (`runOnce`).
*   **Issue**: On every detected change (even a single cursor blink or token added), the extension:
    1.  QuerySelectors ALL message nodes.
    2.  Extracts text and normalizes.
    3.  Hashes ALL text (using SHA-256).
    4.  Sends broad JSON payload to Side Panel.
*   **Impact**: On a chat with 200 messages, typing one character triggers a re-hash of 200 messages. This causes CPU spikes and battery drain.

### [Medium] Heavy Observers
*   **Evidence**: `src/adapters/ChatGPTAdapter.js` line 85: `subtree: true` on `main` or `body`.
*   **Issue**: Monitoring the entire subtree of `body` for `childList` changes means the observer fires for *any* DOM change in the page (tooltips, invisible tracking pixels, sidebar changes), triggering the debounce loop constantly.
*   **Update**: Refactored to `createDebouncedObserver` but the *target* selector is still broad in some adapters.

## 7) Security & Privacy Review

### [High] Unsafe InnerHTML Injection
*   **Evidence**: `src/ui/sidepanel.js` line 164: `contentEl.innerHTML = html;`
*   **Context**: The app fetches `../../PRIVACY_POLICY.md` and runs a regex replacer, then sets innerHTML.
*   **Risk**: If `PRIVACY_POLICY.md` (or the fetch target) is spoofed or contains malicious HTML, it executes in the extension context. While risk is lower due to local file source, the *pattern* of "Fetch Text -> Regex -> InnerHTML" is a security anti-pattern (XSS sink).

### [Medium] Broad Host Permissions
*   **Evidence**: `manifest.json` matches: `https://x.com/*`.
*   **Justification**: Required for Grok.
*   **Note**: Access to `x.com/*` grants read access to user's feed, DMs, etc., not just Grok chat. Should be limited to `x.com/i/grok/*` if possible.

## 8) Maintainability & Code Health

*   **Implicit Any**: No TSConfig strict rules enforced on JS files. `scanFullChat` relies on `options` object structure without interface.
*   **Dead Code**:
    *   `src/content.js`: `scanController` variable structure is slightly different from how it's used in `scanFullChat`.
    *   `src/ui/sidepanel.js`: Commented out `sortSelect` code (line 48) and `hiddenCountEl` (line 717).

## 9) Packaging / Build / MV3 Compliance Notes

*   **Service Worker**: `background.js` is compliant (event-driven).
*   **Bundling**:
    *   `package.json` defines a build script: `npx esbuild ... --outfile=src/content.bundle.js`.
    *   **Risk**: There is no CI/CD or pre-commit hook enforcing that `content.bundle.js` matches `content.js`. A developer can change `src/content.js` and forget to run `npm run build`, committing potential mismatches. The repo tracks both the source and the build artifact.
    *   **Recommendation**: Add a git-hook or CI step to verify `content.bundle.js` is clean after a build.
*   **Remote Code**: `sidepanel.js` lines 130 (Stripe link) and 106 (Mailto) are safe (just links).

## 10) Recommended Actions (Prioritized)

1.  **[DONE] Fix ID Generation**: Refactored to use `hash + occurrenceMap` in all adapters.
2.  **[High / S] Sanitize HTML**: Replace `innerHTML` with `textContent` or use a proper sanitization library (DOMPurify) if HTML is strictly needed for the privacy policy.
3.  **[DONE] Consolidate Scrollers**: Logic moved to `src/shared/scroller.js` and `findScrollContainer`.
4.  **[Medium / M] Debounce/Throttle Performance**: `createDebouncedObserver` implemented, but `runOnce` is still O(N). Focus next on incremental scanning.
5.  **[Medium / S] Enforce Build Consistency**: Add a `pre-commit` hook or check to ensure `src/content.bundle.js` is up-to-date with `src/content.js`.
6.  **[DONE] Cleanup Manifest**: Remove duplicate host matches.
7.  **[DONE] Remove Dead Code**: Delete commented-out blocks in `sidepanel.js`.
8.  **[DONE] Strict Selectors**: Tightened `MutationObserver` targets to specific containers in all adapters.
9.  **[DONE] Incremental Updates**: Implemented `MESSAGES_APPEND` logic in `content.js` and `sidepanel.js` for append-only updates.


## Appendix A: Evidence Index

*   **Redundancy (Scroll)**: `src/adapters/ChatGPTAdapter.js:97`, `src/adapters/ClaudeAdapter.js:108`
*   **ID Instability**: `src/adapters/ChatGPTAdapter.js:42`, `src/adapters/ClaudeAdapter.js:71`
*   **Security (innerHTML)**: `src/ui/sidepanel.js:164`
*   **Performance (O(N))**: `src/adapters/ChatGPTAdapter.js:33` (loop over all nodes)
*   **Race Condition**: `src/ui/sidepanel.js:398` vs `src/content.js:165`
*   **Duplicate Manifest**: `manifest.json:23-26`
*   **Build Risk**: `package.json:11` vs `src/content.bundle.js` existence in repo.
*   **Test Gaps**: `tests/` contains only basic DOM unit tests; no integration/e2e tests for the full extension flow.

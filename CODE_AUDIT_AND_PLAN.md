# Keimenon Lite: Code Audit & Solution Plan

**Date:** 2026-01-27
**Scope:** Review of `src/` (Adapters, Content Script, UI) for reliability, consistency, and architecture improvements.

---

## 1. Workflow & Capability Scope

| Feature | Current Implementation Status | Reliability / Risk |
| :--- | :--- | :--- |
| **Platform Detection** | Implemented in `AdapterFactory.js` (URL regex). | **High**: Regex is robust for main domains. |
| **Chat Loading** | `content.js` retries `runOnce()` for ~5s (`MAX_STARTUP_RETRIES=10`). | **Low**: 5s is often too short for heavy chats, causing "No messages" empty state. |
| **Capture Logic** | `extraction.js` (Manual DOM walk). | **High**: Very robust, handles MathJax/Markdown well. |
| **SPA Navigation** | Polling (1s) + MutationObserver on `body` in `content.js`. | **Medium**: Poller is safe, but race conditions exist where adapter inits before DOM is ready. |
| **UI State** | SidePanel mimics connection state (Connecting -> Ready -> Loading). | **Medium**: Loader hides prematurely if partial messages arrive. |

---

## 2. Runtime Architecture Map

**Core Flow:**
1.  **Init**: `content.js` loads -> `AdapterFactory` picks strategy.
2.  **Connect**: `chrome.runtime.onConnect` -> `sidepanel-connection` established.
3.  **Detect**:
    *   `setInterval` checks `window.location.href`.
    *   If changed: `handleNavigation()` runs -> swaps Adapter -> `startSession()`.
4.  **Extract**:
    *   `startSession()` -> `attemptStartupExtraction()` loops (500ms intervals).
    *   Simultaneously, `adapter.observe()` triggers `extractAndSend()` on DOM mutations.
5.  **Render**: `sidepanel.js` receives `MESSAGES_UPDATED` -> Updates `appState` -> Renders DOM.

---

## 3. Adapter Audit

### General
*   **Gap**: No explicit `disconnect()` in `BaseAdapter` that cleans up internal observers (only `content.js` cleans up the `scanController`). Most adapters rely on `content.js` to just stop calling them, but `MutationObserver` on `body` (used in `ChatGPTAdapter` implicit observation) might leak if not disconnected.
*   **Gap**: No `isLoading()` method. Adapters return `[]` for both "Empty Chat" and "Loading", confusing the startup logic.

### Specifics

| Adapter | Selectors | Robustness | Notes |
| :--- | :--- | :--- | :--- |
| **ChatGPT** | `[data-message-author-role]` | **High** | Uses semantic data attributes. Fallbacks exist. |
| **Gemini** | `structured-content-container`, classes | **Medium** | Relies on custom element names and test IDs (`data-test-id`). Effective but prone to class changes. |
| **Claude** | `data-test-id`, `.font-user-message` | **High** | Robust data-attributes. uses `extractMessageContent` with `.font-ui` exclusion. |
| **Grok** | `.message-bubble` | **Low** | Relies on generic class `.message-bubble` and CSS color class `bg-surface-l1` for author detection. High risk of breaking. |

---

## 4. Risk Analysis (Root Causes)

### A. The "5-Second Timeout" (Reliability)
**Location:** `content.js:141` (`MAX_STARTUP_RETRIES = 10`)
**Issue:** Large chats or slow connections often take >5s to render.
**Effect:** `attemptStartupExtraction` exhausts retries -> sends `[]` -> SidePanel shows "No messages found".
**Fix:** Introduce `adapter.waitForChat()` or `adapter.isLoading()` to extend retries while the "Scanning / Thinking" UI is present.

### B. SPA Navigation State Contamination (Data Integrity)
**Location:** `content.js:30` (Polling) & `lastMessages` variable.
**Issue:** When switching chats (SPA), `handleNavigation` restarts session but does not explicitly clear `lastMessages` global in `content.js`.
**Effect:** If the new chat message IDs overlap (unlikely with UUIDs but possible with index-based IDs) or if logic flaws exist, `sendMessagesParams` might try to calculate a "delta" against the *previous* chat's messages.
**Fix:** Explicitly set `lastMessages = []` in `handleNavigation`.

### C. Loader "Flicker" (UI Polish)
**Location:** `sidepanel.js:459` (`checkAndHideLoader`)
**Issue:** Logic hides loader as soon as `domCount >= expectedMessageCount`.
**Effect:** If the adapter finds 2 messages initially (startup), loader hides. Then 50 more load in. User sees 2 msgs -> jump -> 52 msgs.
**Fix:** Keep loader "soft" active (e.g., small progress bar) if adapter indicates `isLoading`.

---

## 5. Proposed Solution Plan

### Phase 1: Stability (High Priority)
1.  **Fix Timeout**:
    *   Modify `attemptStartupExtraction` in `content.js`.
    *   If `adapter.hasLoadingIndicator()` is true, do not count against `startupRetries`.
    *   Implies adding `hasLoadingIndicator()` to `BaseAdapter`.
2.  **Fix Navigation Reset**:
    *   In `content.js`, add `lastMessages = []` inside `handleNavigation()`.
    *   Send `{ action: 'SESSION_RESET' }` to SidePanel to clear UI immediately on nav start.

### Phase 2: Adapter Hardening
1.  **Grok Improvement**:
    *   Investigate better attributes for Grok than `bg-surface-l1`.
2.  **Base Cleanup**:
    *   Add `disconnect()` to `BaseAdapter` and ensure all Observers are killed on adapter switch.

### Phase 3: UI Feedback
1.  **Empty State**:
    *   Distinguish between "Connected (Home Page)" vs "Connected (Chat Empty)" vs "Connected (Loading)".
    *   `content.js` currently sends `adapter: 'none'` for home. This is good.
    *   Need a specific `status: 'loading'` meta capability.

---

## 6. Verification Checklist

- [ ] Verify `content.js` handles rapid switching between multiple ChatGPT tabs without error.
- [ ] Verify Gemini "Thinking" state doesn't trigger "No messages found".
- [ ] Verify Grok messages are captured even if color themes change (testing `bg-surface-l1`).
- [ ] Confirm no data is retained in `lastMessages` after navigating to `about:blank` or another site.

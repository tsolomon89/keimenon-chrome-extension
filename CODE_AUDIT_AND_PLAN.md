# Code Audit & Verification Report

**Date:** 2026-01-27
**Target:** Keimenon Lite Extension Codebase (`src/`)

## 1. Executive Summary
This document verifies the accuracy of the proposed "Review & Solution Plan" against the actual codebase. It confirms that the runtime architecture and workflow descriptions are accurate to the current implementation. It also highlights specific code locations where improvements are needed to address reported reliability issues.

**Status:** `VERIFIED` - The previous analysis matches the code reality.

---

## 2. Current Implementation Verification

### A. Workflow & Platform Detection
*   **File:** `src/content.js`, `src/adapters/AdapterFactory.js`
*   **Verification:**
    *   `content.js` initializes `AdapterFactory` on load.
    *   **SPA Handling:** Use of `setInterval` (1s polling) and `MutationObserver` on `document.body` (lines 26-45 of `content.js`) is correctly implemented to detect URL changes.
    *   **Logic:** `handleNavigation()` (line 47) differentiates between same-platform navigation (re-scan) and cross-platform switching (new adapter).

### B. Adapter Architecture
*   **File:** `src/adapters/BaseAdapter.js`, `src/adapters/*Adapter.js`
*   **Verification:**
    *   **Base Class:** `BaseAdapter` handles the `MutationObserver` setup (`observe` method) using `createDebouncedObserver` (line 80).
    *   **Extraction:** Specific adapters (`ChatGPTAdapter`, `GeminiAdapter`) implement `runOnce()` which returns an array of messages.
    *   **State:** Adapters maintain a `nodeCache` (WeakMap) in `BaseAdapter` to prevent re-hashing unchanged nodes, which is a good performance optimization.

### C. UI & Loader State
*   **File:** `src/ui/sidepanel.js`
*   **Verification:**
    *   **Connection:** `connectToActiveTab` correctly establishes the port and listens for `onDisconnect`.
    *   **Loader Hiding:** The specific logic to hide the loader is in `handlePortMessage` -> `MESSAGES_UPDATED` (lines 456-481). It waits for the DOM element count to match the message count.
    *   **Empty State:** There is a graceful fallback for 0 messages (lines 486-496) to prevent flashing.

---

## 3. Identified Gaps & Opportunities (Code-Level)

The following areas are confirmed as "Current Logic" vs "Desired Behavior" gaps based on the code audit:

### 1. Robustness of Startup Loop
*   **Current Code:** `content.js` (lines 139-199) uses a hardcoded 10-retry loop (`MAX_STARTUP_RETRIES = 10` * 500ms = 5 seconds) in `attemptStartupExtraction`.
*   **Issue:** If a chat takes 6 seconds to load (common with large history or slow networks), the extension gives up and sends an empty state.
*   **Improvement Opportunity:** Replace fixed retries with a `waitForSelector` pattern in the Adapter interface to wait until the chat container actually exists before counting down a timeout.

### 2. State Contamination on SPA Navigation
*   **Current Code:** `content.js` defines `let lastMessages = []` at the top level (line 213).
*   **Issue:** inside `handleNavigation()`, while `isStartupPhase` is reset, `lastMessages` is **not** cleared.
*   **Effect:** If a user navigates from "Chat A" to "Chat B" on the same platform, the `sendMessagesParams` function might incorrectly calculate a "diff" against Chat A's messages, potentially resulting in zero messages being sent or weird "append" behavior if IDs happen to collide.
*   **Improvement Opportunity:** Explicitly set `lastMessages = []` inside `handleNavigation`.

### 3. Selector Specificity
*   **Current Code:** `GeminiAdapter.js` (lines 30-38) uses a mix of specific tags (`structured-content-container`) and generic classes (`.model-response-text`).
*   **Issue:** It does not explicitly exclude "shimmer" or "loading" placeholders, relying on `extractMessageContent` to return empty string for those.
*   **Improvement Opportunity:** Add explicit `:not(.loading)` pseudo-classes or check for specific content readiness attributes.

### 4. Adapter "Ready" Checks
*   **Current Code:** Adapters implement `isSupportedLocation(url)` but lack an `isReady()` or `hasLoaded()` method.
*   **Issue:** `content.js` assumes if `runOnce()` returns empty array, it's "loading". But it could be "empty chat".
*   **Improvement Opportunity:** Implement `isChatInterface()` on adapters to distinguish between a "Home Screen" (never has messages) and a "Chat Screen" (should eventually have messages).

## 4. Conclusion
The codebase is structured cleanly with a clear separation of concerns (Adapter Pattern). The "Flakiness" reported is directly traceable to the **Startup Retry Logic** and **State Reset** omissions identified above. The Architecture map in the solution plan is accurate.

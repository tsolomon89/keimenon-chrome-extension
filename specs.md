# Keimenon Lite — Chrome Extension Core Spec (MVP)

## 0) Product Definition

**Keimenon Lite** is a Chrome extension that extracts **user-authored messages only** from supported AI chat pages (ChatGPT + Claude) by reading the **current page DOM**. It renders these messages in a **Material Design 3 (M3)** side panel as copyable cards, with search and length filters.

**Privacy posture (hard requirement):**

* **Local-only** operation: reads DOM, transforms into text, presents for user copy/export.
* **No storage of conversation content** (no persistence).
* **No network calls** for transcript data.
* **No telemetry** tied to chat content.

**Future (optional, explicit, opt-in):**

* “Export to Keimenon” integration may exist later, but must be **explicit**, **user-initiated**, and **off by default**.

---

## 1) Supported Targets

### 1.1 Platforms (MVP)

* **ChatGPT**

  * URL match: `https://chatgpt.com/c/*`
  * Optional compatibility: `https://chat.openai.com/c/*`
* **Claude**

  * URL match: `https://claude.ai/chat/*`

### 1.2 Browser

* **Google Chrome**, Manifest V3.

---

## 2) Primary Use Cases

1. **Extract visible user messages** from the currently opened chat.
2. **Copy any single user message**.
3. **Copy all user messages** in the order shown.
4. **Filter** messages by character length.
5. **Search** within extracted messages (VS Code style find).
6. **Scan full chat** (when the site doesn’t have full history in the DOM) via user-triggered harvesting.

---

## 3) UX / UI Requirements (Material Design 3)

### 3.1 Surface

* Use **Chrome Side Panel** UI (preferred) to host the extension interface.
* M3 tokens and components:

  * Surfaces: `surface`, `surfaceContainer`, `surfaceContainerHigh`
  * Shape: rounded corners consistent with M3 (cards, input fields)
  * Typography: M3 type scale (Title/Body/Label)
  * Motion: subtle state transitions (hover/pressed), no excessive animation

### 3.2 Layout

**Top App Bar (M3)**

* Title: “Keimenon Chrome Extension"
* Status pill (right side):

  * Supported / Unsupported
  * Extracted count (e.g., “12 prompts”)

**Controls Row (M3)**

* Search field (leading icon)
* Filter button (opens filter sheet)
* Actions menu (3-dot):

  * Refresh
  * Copy All
  * Scan Full Chat

**Filter Sheet (M3 bottom sheet / modal)**

* Min length (number input)
* Max length (number input)
* Sort (segmented buttons):

  * Original order
  * Length

**Message List**

* Vertical list of M3 cards.

**Message Card (M3 card)**

* Header row:

  * Index badge (e.g., #7)
  * Character count (e.g., “842 chars”)
  * Copy icon button
* Body:

  * Message text preview
  * Expand/collapse for long messages (optional)

**Footer actions (optional)**

* Copy All (primary)
* Scan Full Chat (tonal)

### 3.3 Accessibility

* Keyboard navigable
* Proper ARIA labels for controls
* Clear focus states
* Copy buttons must be user-gesture initiated

---

## 4) Core Functional Requirements

### 4.1 Extraction: User Messages Only

* Extract **only** content authored by the user.
* Normalize extracted text:

  * Preserve paragraph breaks/newlines
  * Strip UI chrome (button labels, decorative text)
  * Trim whitespace

### 4.2 Copy

* **Copy one**: copies a single message text.
* **Copy all**: concatenates messages in the chosen order using a delimiter.

  * Default delimiter: `\n\n---\n\n`
  * Optional delimiter formats:

    * Plain text with separators
    * Markdown list
    * JSON array of strings

### 4.3 Search

* Case-insensitive substring search across messages.
* Updates list live.
* Optional highlight of matched terms in previews.

### 4.4 Length Filtering

* Min chars (inclusive)
* Max chars (inclusive)
* Character count computed from normalized text.

### 4.5 Ordering

* Default: DOM order as displayed (assumed chronological in UI).
* Alternate: sort by length.

### 4.6 Live Updates

* Observe DOM mutations to detect newly added user messages.
* Append new messages, dedupe by stable hash.

---

## 5) Full-History Handling & Harvesting

### 5.1 Default Behavior

* Always extract whatever is **currently available in the DOM**.
* Never block the UI waiting for “full chat.”

### 5.2 Scan Full Chat (Required)

A user-triggered action to load additional history (primarily for Claude, and for any future virtualization changes).

**Entry point:** Button/menu item: “Scan full chat”

**Behavior:**

* Identify the transcript scroll container.
* Smoothly scroll in small increments to trigger older message loading.
* Throttle scrolling to avoid page instability.
* After each increment, rescan for new user messages.

**Stop conditions:**

* No increase in message count after N attempts
* Reached top and no loader appears
* User presses “Stop scan”

**UX during scan:**

* Progress indicator: “Scanning… (X prompts found)”
* Provide “Stop” control
* Ensure scanning is cancelable at all times

### 5.3 Heuristic Detection of Incomplete DOM (Optional)

* If top-of-thread loader / “load more” indicator exists, mark as “partial history likely.”
* If scroll container can scroll further upward and triggers async load on approach, mark as “scan available.”

**Important:** Heuristics may be wrong; the UI must remain functional regardless.

---

## 6) Platform Adapter Architecture

### 6.1 Adapter Interface

Each supported site implements an adapter:

* `isSupportedLocation(url): boolean`
* `getConversationId(url): string`
* `getTranscriptRoot(): Element | null`
* `findUserMessageNodes(root): Element[]`
* `extractMessageText(node): string`
* `observeNewMessages(root, onNewNodes): void`
* `getScrollContainer(root): Element | null`
* `scanFullChat(root, options): Promise<void>`

### 6.2 Selector Policy (Maintainability)

* Prefer **semantic attributes**:

  * `data-*` role markers
  * `data-testid`
  * ARIA roles/labels
* Avoid brittle classnames as primary selectors.
* Always define **fallback selectors** (at least 2 strategies).

### 6.3 Dedupe Strategy

* Compute `messageHash = hash(normalizedText)`
* Key: `platform + conversationId + messageHash`
* Keep in-memory set for the session.

---

## 7) Data Model (In-Memory Only)

### 7.1 Message Object

* `id` (hash)
* `platform` (`chatgpt` | `claude`)
* `conversationId`
* `index` (DOM order)
* `text` (normalized)
* `charCount`
* `capturedAt` (local timestamp of extraction; not message-sent time)
* `meta` (optional; only if present in DOM)

### 7.2 State

* `allMessages: Message[]` (in memory)
* `filters: { query, minLen, maxLen, sortMode }`
* `scanState: { isScanning, progressCount }`

**Persistence:** none for transcript content.

---

## 8) Permissions & Privacy / GDPR

### 8.1 Extension Permissions (Minimum)

* `host_permissions` limited to:

  * `https://chatgpt.com/*`
  * `https://claude.ai/*`
  * Optional: `https://chat.openai.com/*`
* `storage` **only** for non-content settings (UI preferences), if needed.
* Clipboard write is executed only via user gestures.

### 8.2 Data Handling (Hard Rules)

* Do **not** store chat content in extension storage.
* Do **not** send chat content to any server.
* Do **not** log chat content.

### 8.3 Keimenon Brand Account Features (Allowed)

If you add authentication / registration:

* Allowed data: Google auth identity, basic profile, marketing consent toggles.
* Must be **fully separated** from transcript extraction.
* Consent UI must be explicit (GDPR-compliant).
* Chat content remains local-only regardless of login.

---

## 9) Non-Goals (MVP)

* Assistant-message extraction
* Reliable timestamp extraction (generally not present in DOM)
* Cloud sync / history storage
* Editing or interacting with the chat page content
* Working on “all sites” beyond ChatGPT + Claude

---

## 10) Acceptance Criteria

### ChatGPT

* On a `chatgpt.com/c/*` thread with ≥ 5 user messages:

  * Extracts all user messages present in DOM
  * Shows correct order
  * Copy single and copy all work
  * Search + length filter work
  * New user messages appear in panel via observer

### Claude

* On a `claude.ai/chat/*` thread:

  * Extracts all user messages present in DOM
  * “Scan full chat” increases extracted count if older messages exist
  * Scan is throttled and cancelable

### General

* No assistant messages appear
* No duplicates after refresh/scan
* No conversation content is persisted or transmitted

---

## 11) Naming & Positioning

* Product name: **Keimenon lite** or **Keimenon Chrome Extension**
* Tagline: “Extract your prompts. Copy clean. Keep it local.”
* Primary brand home: **keimenon.com**
* Product information page at **keimenon.com/products/chrome-extension**
* Future integration: optional “Export to Keimenon” (explicit opt-in)

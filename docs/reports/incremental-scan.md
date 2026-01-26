# Incremental Scanning Implementation

## Overview
To address performance concerns (O(N) operation on every DOM mutation), we implemented an incremental scanning strategy in all platform adapters.

## Strategy: WeakMap Caching
Instead of complex logic to detect only "new" nodes, which is fragile across different DOM structures (e.g., React re-renders), we opted for a **hashing cache**.

- **Mechanism**: `WeakMap<DOMNode, { text, hash }>`
- **Logic**:
    - During `runOnce()`, we iterate over all found message nodes (still O(N) DOM traversal, but fast).
    - For each node, we extract its text.
    - We check the cache:
        - If `cache.get(node).text === currentText`, we strictly reuse the calculated SHA-256 hash.
        - If not, we re-calculate the hash and update the cache.
- **Benefit**: 
    - `generateMessageHash` (SHA-256) is expensive. Reuse avoids it for 99% of nodes.
    - `WeakMap` ensures no memory leaks if nodes are removed from DOM.
    - Handles "streaming" implicitly: as text changes in the last node, `text !== cached.text`, so it re-hashes only that node.

## Adapters Updated
1.  **ChatGPTAdapter**: Added `this.nodeCache = new WeakMap()` and cache check logic.
2.  **ClaudeAdapter**: Added `this.nodeCache` and check logic. Note: Text extraction (including cloning and cleaning) is still performed to verify the text hash key.
3.  **GeminiAdapter**: Added `this.nodeCache` and check logic.
4.  **GrokAdapter**: Added `this.nodeCache` and check logic.

## Verification
- **Scenario 1: Append Only**:
    - Previous messages (N) match cache -> 0 re-hashes.
    - New message (1) -> 1 hash calculation.
    - Performance: significantly reduced for long threads.
- **Scenario 2: Streaming**:
    - Last message text updates -> Cache miss (text diff) -> Re-hash 1 node.
- **Scenario 3: Deletion**:
    - Deleted node is not found in traversal -> No action.
    - Remaining nodes match cache -> 0 re-hashes.
    - ID stability logic (occurrence map) runs on the list of *hashes*, ensuring IDs re-adjust correctly without re-calculating the crypto hashes.

## Fallback
The `content.js` script handles the final "Delta vs Full Update" logic for the side panel. The adapters simply provide the list of messages efficiently.

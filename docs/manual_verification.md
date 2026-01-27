
# Verification Plan

## Changes Made
1.  Created `src/shared/extraction.js`:
    *   Implements `extractMessageContent(root, options)`
    *   Handles `katex` elements by extracting the `annotation[encoding="application/x-tex"]` source.
    *   Handles `math/tex` script tags (MathJax).
    *   Handles block elements (`div`, `p`, etc.) to ensure proper newlines for Markdown structure.
    *   Supports `excludeSelectors` (e.g. for removing `.font-ui` in Claude).
2.  Updated Adapters:
    *   `ChatGPTAdapter.js`: Replaced `innerText` with `extractMessageContent`.
    *   `ClaudeAdapter.js`: Replaced `innerText` and manual cloning with `extractMessageContent`, using `excludeSelectors: ['.font-ui']`.
    *   `GeminiAdapter.js`: Replaced `innerText` with `extractMessageContent`.

## How to Verify
Since this involves interacting with live 3rd party websites (ChatGPT, Claude, Gemini) which we cannot easily mock with full fidelity of their rendering engine (especially KaTeX/MathJax dynamics) in a simple unit test without extensive DOM mocking, the best verification is manual usage or inspection of the `extractMessageContent` logic.

### Test Case 1: KaTeX Extraction
Create a file `test-extraction.html` with:
```html
<div class="katex">
  <span class="katex-mathml"><math>...</math></span>
  <span class="katex-html">...rendered garbage...</span>
  <annotation encoding="application/x-tex">E=mc^2</annotation>
</div>
```
Run `extractMessageContent` and assert output is `$E=mc^2$`.

### Test Case 2: Block Elements
```html
<p>Line 1</p>
<div>Line 2</div>
```
Run `extractMessageContent` and assert output has newline between "Line 1" and "Line 2".

### Action
Reload the extension and try to copy a chat with math expressions on ChatGPT or Gemini. Verify that the copied text contains valid Markdown math (e.g., `$E=mc^2$` or `$$...$$`) and preserves line breaks correctly.

# Agent Operating Rules

**Context**: This is a Vanilla JS + Material Design 3 project. We do NOT use React or MUI components. All styling is done via CSS variables in `src/ui/styles.css`.

## Workflow: Generating UI Code

When you are asked to create or modify UI, you **MUST** follow this sequence:

1.  **Stop & Read**: Do not hallucinate classes.
2.  **Query Design Tokens**:
    - Use your file reading tool to inspect `src/ui/styles.css`.
    - Look for `--md-sys-color-*` and `--md-ref-typeface-*` tokens.
3.  **Inspect Structure**:
    - Read `src/ui/sidepanel.html` to understand the existing HTML structure and glassmorphism hierarchy (`.header-group`, `.app-container`).
4.  **Implement**:
    - Write raw HTML/JS using the exact CSS variables found.
    - Do NOT import external libraries (React, Tailwind, Bootstrap) unless explicitly requested.

## Examples

### "Add a Primary Button"
**INCORRECT**: `<Button variant="contained">Click Me</Button>` (React/MUI)
**CORRECT**: 
1. Reads `styles.css`. Finds `.action-btn.primary`.
2. Generates: `<button class="action-btn primary">Click Me</button>`

### "Create a Card"
**INCORRECT**: `<Card><CardContent>...</CardContent></Card>`
**CORRECT**:
1. Reads `styles.css`. Finds `.card` and `.card-body`.
2. Generates:
```html
<div class="card">
  <div class="card-header">Title</div>
  <div class="card-body">Content</div>
</div>
```

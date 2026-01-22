# MCP Smoke Test

Copy and paste the following prompt into your MCP-enabled agent to verify it can read the repository context correctly.

---

**Prompt:**

> "I need to verify my connection to the Keimenon Lite repo. Please use your file reading tools to:
> 1. Read `src/ui/styles.css`.
> 2. Tell me the exact hex code for `--md-sys-color-primary` in the Light Theme.
> 3. Does the `.card` class have an animation defined? If so, which one?
> 
> Do not guess. Quote the code."

---

**Expected Output:**
1. Hex code: `#005ac1` (or whatever is current in styles.css).
2. Animation: `slideIn` (referenced as `animation: slideIn ...`).

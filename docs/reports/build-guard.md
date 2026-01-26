# Build Consistency Guard

## Overview
To prevent "drift" where the source code (`src/content.js` and modules) is modified but the bundled output (`src/content.bundle.js`) is not updated in the same commit, we have implemented a pre-commit guard.

## Components
1.  **Script**: `scripts/guard-content-bundle.mjs`
    - Uses `esbuild --metafile` to generate a dependency graph of the bundle.
    - Checks git staged files (`git diff --name-only --cached`).
    - If any staged file is in the bundle's input graph, but `src/content.bundle.js` is NOT staged, it fails the check.

2.  **Git Hook**: `.githooks/pre-commit`
    - Runs `npm run -s check:bundle-guard`.
    - Must be enabled via `git config core.hooksPath .githooks`.

3.  **NPM Script**: `npm run check:bundle-guard`

## Verification
We verified the guard with the following test case:
1.  **Modify Source**: Added a comment to `src/adapters/ChatGPTAdapter.js`.
2.  **Stage Source**: `git add src/adapters/ChatGPTAdapter.js`.
3.  **Run Guard**: `npm run check:bundle-guard`.
4.  **Result**: 
    ```
    [Guard] BLOCKED: Bundled source files changed, but bundle is not staged.
    The following staged files affect the bundle:
     - src/adapters/ChatGPTAdapter.js
    ```
    The check correctly failed, preventing the commit.

## Usage
If the commit is blocked:
1.  Run `npm run build` to update the bundle.
2.  Stage the bundle: `git add src/content.bundle.js`.
3.  Commit again.

import { execSync } from 'child_process';
import { readFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const TMP_DIR = 'tmp';
const METAFILE = join(TMP_DIR, 'meta.json');
const DRY_RUN_BUNDLE = join(TMP_DIR, 'dry-run.js');

function run(command) {
    try {
        return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch (e) {
        return '';
    }
}

function main() {
    console.log('[Guard] Checking for bundle drift...');

    // 1. Get Staged Files
    const stagedOutput = run('git diff --name-only --cached');
    if (!stagedOutput) {
        console.log('[Guard] No staged files. Skipping.');
        process.exit(0);
    }
    const stagedFiles = new Set(stagedOutput.split('\n').map(f => f.trim()).filter(Boolean));

    // Check if bundle itself is staged
    const isBundleStaged = stagedFiles.has('src/content.bundle.js');

    // 2. Generate Metafile to find connection graph
    if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR);

    try {
        // Run esbuild to get the metafile
        // We use the same entry point as the build script: src/content.js
        execSync(`npx esbuild src/content.js --bundle --outfile=${DRY_RUN_BUNDLE} --format=iife --metafile=${METAFILE}`, { stdio: 'ignore' });
    } catch (e) {
        console.error('[Guard] Failed to generate build metafile. Is esbuild installed?');
        process.exit(1);
    }

    // 3. Parse Metafile
    let meta;
    try {
        meta = JSON.parse(readFileSync(METAFILE, 'utf8'));
    } catch (e) {
        console.error('[Guard] Failed to parse metafile.');
        process.exit(1);
    }

    // 4. Check for Drift
    const inputs = Object.keys(meta.inputs).map(path => path.replace(/^\\/,'').replace(/\//g, '/')); // Normalize paths
    
    // Normalize staged files to be safe (git usually returns forward slashes)
    const stagedSet = new Set([...stagedFiles].map(p => p.replace(/\\/g, '/')));

    let driftDetected = false;
    const driftedFiles = [];

    for (const input of inputs) {
        // Input path from esbuild is relative to CWD, e.g., "src/content.js"
        if (stagedSet.has(input)) {
            driftedFiles.push(input);
            driftDetected = true;
        }
    }

    // 5. Cleanup
    try {
        rmSync(TMP_DIR, { recursive: true, force: true });
    } catch (e) {}

    // 6. Verdict
    if (driftDetected && !isBundleStaged) {
        console.error('\n\x1b[31m[Guard] BLOCKED: Bundled source files changed, but bundle is not staged.\x1b[0m');
        console.error('The following staged files affect the bundle:');
        driftedFiles.forEach(f => console.error(` - ${f}`));
        console.error('\n\x1b[33mAction Required:\x1b[0m');
        console.error('1. Run: npm run build');
        console.error('2. Stage: src/content.bundle.js');
        process.exit(1);
    }

    console.log('[Guard] Check passed.');
    process.exit(0);
}

main();

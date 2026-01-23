
import { describe, it, expect, beforeEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Local Preview Theme Toggle', () => {
    let htmlContent;
    let scriptContent;

    beforeEach(() => {
        // Load the HTML file
        const filePath = path.resolve(__dirname, '../../src/ui/dev-preview.html');
        htmlContent = fs.readFileSync(filePath, 'utf-8');
        
        // Extract the script logic (the last script tag which contains the toggle logic)
        // We look for the block containing 'themeToggle.addEventListener'
        const scriptMatch = htmlContent.match(/<script>([\s\S]*?themeToggle\.addEventListener[\s\S]*?)<\/script>/);
        if (scriptMatch) {
            scriptContent = scriptMatch[1];
        }

        // Set up JSDOM
        document.body.innerHTML = htmlContent;
        // JSDOM doesn't execute scripts by default when setting innerHTML. 
        // We need to verify the ELEMENTS exist first.
    });

    it('should have the toggle button', () => {
        const btn = document.getElementById('themeToggle');
        expect(btn).not.toBeNull();
    });

    it('should toggle classes when clicked', () => {
        // We need to execution the script logic effectively. 
        // Since we can't easily eval the script in this scope without access to the specific DOM references it closes over (const handle...),
        // We will mock the behavior to VERIFY the logic we intend to verify:
        // "If body has force-dark, swap to force-light, else swap to force-dark"
        
        // Let's create a function that mimics the exact logic present in the file to test IT against the DOM.
        // Or even better, let's try to 'eval' the script content if it's clean enough.
        // The script defines constants at top level: handle, panel, themeToggle.
        // We need to make sure those exist before eval.
        
        expect(scriptContent).toBeDefined();

        // Execute the script in the current context (window/document are available via jsdom)
        // We wrap it in a function to avoid redeclaration errors if we ran it multiple times
        // and to handle the fact it's top-level code.
        
        // We need to be careful about 'const handle' redeclaration if we run multiple tests.
        // Ideally we run this once.
        
        // Just eval-ing it:
        // We need to suppress 'dev-mocks.js' and 'sidepanel.js' imports or errors? No, the regex only captured the inline script.
        
        window.eval(scriptContent);

        const btn = document.getElementById('themeToggle');
        
        // Initial State: No classes (or empty)
        expect(document.body.classList.contains('force-dark')).toBe(false);
        expect(document.body.classList.contains('force-light')).toBe(false);

        // Click 1 (Should go to Default -> Force Dark)
        btn.click();
        expect(document.body.classList.contains('force-light')).toBe(false);
        expect(document.body.classList.contains('force-dark')).toBe(true);

        // Click 2 (Force Dark -> Force Light)
        btn.click();
        expect(document.body.classList.contains('force-dark')).toBe(false);
        expect(document.body.classList.contains('force-light')).toBe(true);
        
        // Click 3 (Force Light -> Force Dark)
        btn.click();
        expect(document.body.classList.contains('force-light')).toBe(false);
        expect(document.body.classList.contains('force-dark')).toBe(true);
    });
});

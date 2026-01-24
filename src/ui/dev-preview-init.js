const handle = document.getElementById('resizeHandle');
const panel = document.getElementById('appContainer');
const themeToggle = document.getElementById('themeToggle');
const iframe = document.getElementById('sidepanelFrame');

// Inject Mock into Iframe
// We must do this before the iframe loads the source so the scripts in it see the mock
// Note: This relies on the iframe being same-origin (file:// or localhost)
try {
    // Initialize mock in parent first (dev-mocks.js ran)
    if (!window.chrome) console.error("Mock chrome not found in parent!");

    // Write content document for immediate script availability if src doesn't work synchronously
    // or just set the property on the window if accessible

    // Actually, simply setting src might be enough if we hook the window first?
    // But we can't hook window of purely empty src easily before navigating.

    // Better approach: src="sidepanel.html" but we define it AFTER we try to inject?
    // But we can't access contentWindow of cross-origin before load?
    // Since it is same folder, it should be fine.

    iframe.addEventListener('load', () => {
       // This might be too late for module scripts, but let's try injecting ASAP
       console.log("Iframe loaded");
    });

    // Force src assignment now
    iframe.src = "sidepanel.html?mock=true";

    // Critical: We need to inject window.chrome into the iframe's window environment
    // The most reliable way for local dev handling here is to poll or hook.
    // However, simpler is to ensure sidepanel.js checks for existence?

    // Let's try attempting to set it immediately after src assignment (synchronous access capability check)
    // iframe.contentWindow.chrome = window.chrome;

    // Wait, if we set src, the browser navigates. 
    // A robust way is to use document.write or similar, but sidepanel.html is an external file.

    // Let's use the 'load' event to inject just in case, BUT sidepanel.js is a module, it runs deferred.
    // So we have a race.

    // Hack: we can inject it by overwriting the contentWindow properties repeatedly or just hope module loads slowly?
    // No, that's flaky.

    // BETTER FIX: Make `sidepanel.js` safe.
    // But user wants `dev-preview` to work.

    // Creating the iframe dynamically:
} catch (e) {
    console.error(e);
}

// Dynamic Iframe Creation to ensure environment?

let isDragging = false;

handle.addEventListener('mousedown', (e) => {
    isDragging = true;
    handle.classList.add('dragging');
    e.preventDefault();
});

document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const newWidth = document.body.clientWidth - e.clientX;
    if (newWidth > 300 && newWidth < 800) {
        panel.style.width = newWidth + 'px';
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    handle.classList.remove('dragging');
});

themeToggle.addEventListener('click', () => {
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    if (!doc) return;
    
    if (doc.body.classList.contains('force-dark')) {
        doc.body.classList.remove('force-dark');
        doc.body.classList.add('force-light');
        console.log('[Preview] Switched to Force Light');
    } else {
        doc.body.classList.remove('force-light');
        doc.body.classList.add('force-dark');
        console.log('[Preview] Switched to Force Dark');
    }
});

// Inject mock immediately on load (before modules execute if possible, or use polling)
iframe.onload = () => {
    console.log("Iframe loaded - mock injection fallback");
    try {
       if (!iframe.contentWindow.chrome) iframe.contentWindow.chrome = window.chrome;
    } catch(e) { console.error(e); }
};

// Trigger load with mock param
iframe.src = "sidepanel.html?mock=true";

// AGGRESSIVE INJECTION: Race to inject 'chrome' before sidepanel.js (module) initializes.
// Since sidepanel.js is a module, it runs deferred, but file:// IO is fast.
const injectionParams = {
    maxAttempts: 50,
    interval: 10
};

let attempts = 0;
const injector = setInterval(() => {
    try {
        if (iframe.contentWindow) {
            // Ensure chrome is set
            if (!iframe.contentWindow.chrome) {
                iframe.contentWindow.chrome = window.chrome;
                console.log(`[Preview] Injected mock chrome (Attempt ${attempts})`);
            } else {
                // Already set, could verify if it's ours?
            }
        }
    } catch (e) {
        // Ignore cross-origin errors if they occur temporarily
    }
    
    attempts++;
    if (attempts > injectionParams.maxAttempts) {
        clearInterval(injector);
    }
}, injectionParams.interval); // Every 10ms

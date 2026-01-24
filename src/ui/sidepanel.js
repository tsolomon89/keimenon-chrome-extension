

import { authService } from '../services/auth.js';

// Mock Injection for Dev Preview
if (new URLSearchParams(window.location.search).has('mock')) {
    import('./dev-mocks.js').then(() => {
        console.log('[SidePanel] Injected dev-mocks.js');
    }).catch(e => console.error('[SidePanel] Failed to inject mock:', e));
}

import { analytics } from '../services/analytics.js';
import { filterMessages } from '../shared/filter.js';

// --- State Management ---
const appState = {
    messages: [],           // All raw messages
    hiddenIds: new Set(),   // IDs of hidden messages
    selectedIds: new Set(), // IDs of checked messages
    showHidden: false,      // User toggle state
    filter: {
        search: '',
        minLen: 0,
        sort: 'original',
        author: 'both' // 'user', 'assistant', 'both'
    }
};

let currentAdapterName = '';

// UI Elements
const messageListEl = document.getElementById('messageList');
const statusBadgeEl = document.getElementById('statusBadge');
const versionDisplayEl = document.getElementById('versionDisplay');

// Set Version
if (versionDisplayEl) {
    // In actual extension
    if (chrome && chrome.runtime && chrome.runtime.getManifest) {
        versionDisplayEl.textContent = `v${chrome.runtime.getManifest().version}`;
    } else {
        // Fallback for preview
        versionDisplayEl.textContent = 'v1.2.0 (Preview)';
    }
}

const searchInput = document.getElementById('searchInput');

// Controls
const filterBtn = document.getElementById('filterBtn');
const copyAllBtn = document.getElementById('copyAllBtn');
const selectAllBtn = document.getElementById('selectAllBtn');
const selectAllIcon = document.getElementById('selectAllIcon');

// Filter Sheet
const filterSheet = document.getElementById('filterSheet');
const filterOverlay = document.getElementById('filterOverlay');
const closeFilterBtn = document.getElementById('closeFilterBtn');
const clearFilterBtn = document.getElementById('clearFilterBtn');
const minLenInput = document.getElementById('minLenInput');
const sortSelect = document.getElementById('sortSelect');

// Menu
const menuBtn = document.getElementById('menuBtn');
const actionsMenu = document.getElementById('actionsMenu');
const menuAuthAction = document.getElementById('menuAuthAction');

// Scanning
const scanProgressEl = document.getElementById('scanProgress');
const stopScanBtn = document.getElementById('stopScanBtn');
const quickScanBtn = document.getElementById('quickScanBtn');
const quickRefreshBtn = document.getElementById('quickRefreshBtn');

// Login
const loginScreen = document.getElementById('loginScreen');
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Settings / Stats (Features: Task RED, BLUE, GREEN, PURPLE)
const analyticsToggle = document.getElementById('analyticsToggle');
const showHiddenBtn = document.getElementById('showHiddenBtn');
const showHiddenIcon = document.getElementById('showHiddenIcon');
const statCharsVal = document.getElementById('statCharsVal');
const statTokensVal = document.getElementById('statTokensVal');


// --- Initialization ---

// 1. Analytics
analytics.init().then(() => {
    analyticsToggle.checked = analytics.enabled;
    analytics.trackEvent('panel_open');
});

analyticsToggle.addEventListener('change', (e) => {
    analytics.setEnabled(e.target.checked);
});

// 2. Auth Integration
authService.onAuthStateChanged = (state) => {
    const { user, authEnabled } = state;
    if (!authEnabled || user) {
        loginScreen.classList.add('hidden');
        menuAuthAction.textContent = user ? 'Sign Out' : (authEnabled ? 'Sign In' : 'Auth Disabled');
        menuAuthAction.disabled = !authEnabled;
    } else {
        loginScreen.classList.remove('hidden');
    }
};

googleSignInBtn.addEventListener('click', () => {
    authService.signIn();
});

menuAuthAction.addEventListener('click', () => {
    if (authService.user) {
        authService.signOut();
    } else {
        authService.signIn();
    }
    actionsMenu.classList.remove('open');
});

// --- UI Logic ---

// Sheet Logic
function openSheet() {
    filterSheet.classList.add('open');
    filterOverlay.classList.add('open');
}
function closeSheet() {
    filterSheet.classList.remove('open');
    filterOverlay.classList.remove('open');
}

filterBtn.addEventListener('click', openSheet);
closeFilterBtn.addEventListener('click', closeSheet);
filterOverlay.addEventListener('click', closeSheet);

// Clear Filter
clearFilterBtn.addEventListener('click', () => {
    appState.filter.search = '';
    appState.filter.minLen = 0;
    appState.filter.sort = 'original';
    
    // Reset Inputs
    searchInput.value = '';
    minLenInput.value = 0;
    sortSelect.value = 'original';
    
    updateUI();
});

// Menu Logic
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    actionsMenu.classList.toggle('open');
});
document.addEventListener('click', () => {
    actionsMenu.classList.remove('open');
});


// --- Core Event Listeners ---

// --- Chrome API Initialization ---

function initExtension() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs) {
        // Retry for dev mode injection (race condition with dev-preview)
        console.log('[SidePanel] Waiting for chrome injection...');
        setTimeout(initExtension, 50);
        return;
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'MESSAGES_UPDATED') {
            const { messages } = request.payload;
            const { adapter, capabilities } = request.meta;
            
            appState.messages = messages;
            // UX Improvement: Default select all messages
            messages.forEach(m => appState.selectedIds.add(m.id));
            
            currentAdapterName = adapter;
            updateScanButton(capabilities?.scan);
            updateUI();
            
        } else if (request.action === 'SCAN_COMPLETE') {
            setLoading(false);
            scanProgressEl.classList.remove('active');
            scanProgressEl.style.display = 'none';
            analytics.trackEvent('scan_complete', { count: appState.messages.length });
            
        } else if (request.action === 'EXTENSION_READY') {
            setLoading(false);
            const { adapter, capabilities } = request.meta;
            currentAdapterName = adapter;
            updateScanButton(capabilities?.scan);
            requestMessages();
        }
    });

    // Initial Connection
    ensureConnection();
}

// Start Initialization
initExtension();


function requestMessages() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
             chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_MESSAGES' })
                .then(() => {
                    if (statusBadgeEl.textContent === 'Unsupported Tab') {
                         statusBadgeEl.textContent = 'Ready';
                         statusBadgeEl.style.backgroundColor = ''; 
                    }
                })
                .catch(() => {});
        }
    });
}

// Connection Retry Logic
let retryCount = 0;
const MAX_RETRIES = 5;

function ensureConnection() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) return;
        
        chrome.tabs.sendMessage(tabs[0].id, { action: 'PING' })
            .then((response) => {
                if (response && response.status === 'pong') {
                    currentAdapterName = response.adapter;
                    requestMessages(); 
                }
            })
            .catch(() => {
                if (retryCount < MAX_RETRIES) {
                    retryCount++;
                    setTimeout(ensureConnection, 1000);
                } else {
                    statusBadgeEl.textContent = 'Unsupported Tab';
                    statusBadgeEl.style.backgroundColor = 'var(--md-sys-color-outline-variant)';
                }
            });
    });
}

// Initial Load
// ensureConnection(); // Moved to initExtension

// Header Loading State
const headerGroup = document.getElementById('headerGroup');

function setLoading(isLoading) {
    if (isLoading) {
        headerGroup.classList.add('loading');
    } else {
        headerGroup.classList.remove('loading');
    }
}

quickScanBtn?.addEventListener('click', () => {
     chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
             setLoading(true);
             chrome.tabs.sendMessage(tabs[0].id, { action: 'SCAN_FULL_CHAT' })
                .then(() => {
                     scanProgressEl.classList.add('active');
                     scanProgressEl.style.display = 'block';
                     analytics.trackEvent('scan_start', { platform: currentAdapterName });
                })
                .catch(() => {
                    setLoading(false);
                    alert("Could not start scan. Try refreshing the page.");
                });
        }
    });
});

stopScanBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
             chrome.tabs.sendMessage(tabs[0].id, { action: 'STOP_SCAN' });
             analytics.trackEvent('scan_cancel');
        }
    });
});

quickRefreshBtn?.addEventListener('click', () => {
    setLoading(true);
    chrome.tabs.reload();
    setTimeout(() => setLoading(false), 2000);
});

// --- Feature Logic (Copy, Select, Hide) ---

// Toggle Hide/Show
// Toggle Hide/Show Button (Task PURPLE)
// SVG Paths (Material Symbols 24px)
// SVG Paths (User Provided)
const SVG_VISIBLE = '<g transform="translate(0.295 0.195)"><path d="M43.679-795.33a4.3,4.3,0,0,0,3.16-1.3,4.3,4.3,0,0,0,1.3-3.16,4.3,4.3,0,0,0-1.3-3.16,4.3,4.3,0,0,0-3.16-1.3,4.3,4.3,0,0,0-3.16,1.3,4.3,4.3,0,0,0-1.3,3.16,4.3,4.3,0,0,0,1.3,3.16A4.3,4.3,0,0,0,43.679-795.33Zm0-1.909a2.463,2.463,0,0,1-1.808-.744,2.459,2.459,0,0,1-.745-1.807,2.463,2.463,0,0,1,.744-1.808,2.459,2.459,0,0,1,1.807-.745,2.463,2.463,0,0,1,1.808.744,2.459,2.459,0,0,1,.745,1.807,2.464,2.464,0,0,1-.744,1.808A2.459,2.459,0,0,1,43.68-797.238Zm0,5.067a11.562,11.562,0,0,1-6.708-2.079,11.835,11.835,0,0,1-4.381-5.54,11.834,11.834,0,0,1,4.381-5.54,11.561,11.561,0,0,1,6.708-2.079,11.561,11.561,0,0,1,6.708,2.079,11.834,11.834,0,0,1,4.381,5.54,11.835,11.835,0,0,1-4.381,5.54A11.562,11.562,0,0,1,43.679-792.172Z" transform="translate(-32.59 811.41)" fill="currentColor"/></g>';
const SVG_HIDDEN = '<g transform="translate(0.295 0.195)"><path d="M52.472-830.373l-4.3-4.256a11.92,11.92,0,0,1-1.853.443,12.739,12.739,0,0,1-1.969.148,12.1,12.1,0,0,1-7.167-2.232,12.809,12.809,0,0,1-4.591-5.847,12.727,12.727,0,0,1,1.393-2.6,12.987,12.987,0,0,1,1.912-2.189l-2.866-2.906,1.541-1.541,19.436,19.443Zm-8.124-7.013a4.732,4.732,0,0,0,.482-.023,2.884,2.884,0,0,0,.482-.1l-5.589-5.576a3.021,3.021,0,0,0-.086.485q-.02.228-.02.479A4.561,4.561,0,0,0,41-838.766,4.562,4.562,0,0,0,44.348-837.386Zm7.875.542-3.507-3.487a4.974,4.974,0,0,0,.267-.866,4.415,4.415,0,0,0,.1-.92,4.562,4.562,0,0,0-1.38-3.351,4.562,4.562,0,0,0-3.351-1.38,4.293,4.293,0,0,0-.92.1,4.426,4.426,0,0,0-.866.287L39.725-849.3a11.528,11.528,0,0,1,2.232-.67,12.57,12.57,0,0,1,2.39-.223,12.118,12.118,0,0,1,7.16,2.226,12.8,12.8,0,0,1,4.6,5.853,12.444,12.444,0,0,1-1.6,2.915A12.107,12.107,0,0,1,52.223-836.844Zm-5.308-5.288-2.575-2.575a2,2,0,0,1,1.105.093,2.365,2.365,0,0,1,.866.591,2.36,2.36,0,0,1,.527.9A2.046,2.046,0,0,1,46.915-842.132Z" transform="translate(-32.59 852.35)" fill="currentColor"/></g>';

const SVG_CHECKBOX_CHECKED = '<path d="M19 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.11 0 2-.9 2-2V5c0-1.1-.89-2-2-2zm-9 14l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>';
const SVG_CHECKBOX_EMPTY = '<path d="M19 5v14H5V5h14m0-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>';
const SVG_CHECKBOX_INDETERMINATE = '<path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10H7v-2h10v2z"/>'; // Standard Dash

// Icon Copy (Small)
const SVG_COPY_SMALL = '<g transform="translate(0.121 0.195)"><path d="M113.991-874.541a2.552,2.552,0,0,1-1.873-.774,2.551,2.551,0,0,1-.774-1.873v-13.8a2.551,2.551,0,0,1,.774-1.873,2.551,2.551,0,0,1,1.873-.774h10.3a2.551,2.551,0,0,1,1.873.774,2.551,2.551,0,0,1,.774,1.873v13.8a2.551,2.551,0,0,1-.774,1.873,2.552,2.552,0,0,1-1.873.774Zm0-2.647h10.3v-13.8h-10.3Zm-4.974,7.621a2.551,2.551,0,0,1-1.873-.774,2.551,2.551,0,0,1-.774-1.873v-16.442h2.647v16.442h12.952v2.647Zm4.974-7.621v0Z" transform="translate(-104.364 893.63)" fill="currentColor"/></g>';

// Toggle Hide/Show Button (Task PURPLE)
showHiddenBtn.addEventListener('click', () => {
    appState.showHidden = !appState.showHidden;
    updateUI(); 
});

// Select All Toggle
selectAllBtn?.addEventListener('click', () => {
    const visibleMessages = getFilteredMessages();
    const allSelected = visibleMessages.every(m => appState.selectedIds.has(m.id)) && visibleMessages.length > 0;
    
    if (allSelected) {
        // Deselect current visible set
        visibleMessages.forEach(m => appState.selectedIds.delete(m.id));
    } else {
        // Select current visible set
        visibleMessages.forEach(m => appState.selectedIds.add(m.id));
    }
    updateUI();
});

// Copy Logic
copyAllBtn.addEventListener('click', () => {
    const visibleMessages = getFilteredMessages();
    const selectedMsgs = visibleMessages.filter(m => appState.selectedIds.has(m.id));
    
    if (selectedMsgs.length === 0) return;

    const textToCopy = selectedMsgs.map(m => m.text).join('\n\n---\n\n');
    analytics.trackEvent('copy_selected', { count: selectedMsgs.length });
    
    navigator.clipboard.writeText(textToCopy);
    
    navigator.clipboard.writeText(textToCopy);
    analytics.trackEvent('copy_selected', { count: selectedMsgs.length });
    
    // Visual Feedback (Icon Checkmark)
    const originalIconContent = copyAllBtn.innerHTML;
    copyAllBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">${SVG_CHECKBOX_CHECKED}</svg>`;
    copyAllBtn.style.color = 'var(--md-sys-color-primary)'; // Green/Primary color for success
    
    setTimeout(() => {
        copyAllBtn.innerHTML = originalIconContent;
        copyAllBtn.style.color = '';
    }, 1500);
});

function updateCopyButtonLabel() {
    const visibleMessages = getFilteredMessages();
    const selectedCount = visibleMessages.filter(m => appState.selectedIds.has(m.id)).length;
    
    if (selectedCount > 0) {
        // copyAllBtn.textContent = `Copy`; // REMOVED: Destroys icon
        copyAllBtn.disabled = false;
        copyAllBtn.style.opacity = '1';
        copyAllBtn.title = `Copy ${selectedCount} Selected`;
    } else {
        // copyAllBtn.textContent = `Copy`; // REMOVED: Destroys icon
        copyAllBtn.disabled = true;
        copyAllBtn.style.opacity = '0.5';
        copyAllBtn.title = 'Copy Selected (None)';
    }
}


// Filter Inputs
searchInput.addEventListener('input', (e) => { appState.filter.search = e.target.value; updateUI(); });
minLenInput.addEventListener('input', (e) => { appState.filter.minLen = e.target.value; updateUI(); });
sortSelect.addEventListener('change', (e) => { appState.filter.sort = e.target.value; updateUI(); });


function getFilteredMessages() {
    // 0. Exclude hidden (unless showHidden is true)
    let activeSet = appState.messages;
    if (!appState.showHidden) {
        activeSet = activeSet.filter(m => !appState.hiddenIds.has(m.id));
    }
    
    // 1. Basic Filters
    let msgs = filterMessages(activeSet, appState.filter.search, appState.filter.minLen);
    
    // 3. Author Filter
    const authorMode = appState.filter.author;
    if (authorMode !== 'both') {
        msgs = msgs.filter(m => m.author === authorMode);
    }

    // 2. Sort
    const sortMode = appState.filter.sort;
    if (sortMode === 'lengthDesc') {
        msgs.sort((a, b) => b.charCount - a.charCount);
    } else if (sortMode === 'lengthAsc') {
        msgs.sort((a, b) => a.charCount - b.charCount);
    } 
    
    return msgs;
}

// Author Toggle Logic
const toggleButtons = document.querySelectorAll('.segment-btn');
const glidingPill = document.querySelector('.gliding-pill');

function updateGlidingPill(index) {
    if (glidingPill) {
        // Assuming buttons are roughly equal width and container is relative
        // We translate by index * 100% of the pill's own width (which matches button width)
        // Or better: index * 36px (fixed width) + some gap if any.
        // The CSS defines distinct buttons. Let's assume buttons are contiguous.
        // Actually best generic way:
        glidingPill.style.transform = `translateX(${index * 100}%)`;
    }
}

// Initialize Pill Position based on default 'both' (index 1)
// We need to find the index of the active button initially
const initialActiveIndex = Array.from(toggleButtons).findIndex(b => b.classList.contains('active'));
if (initialActiveIndex !== -1) updateGlidingPill(initialActiveIndex);


toggleButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => {
        // Update State
        appState.filter.author = btn.dataset.value;
        
        // Update UI Visuals
        toggleButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Animate Pill
        updateGlidingPill(index);
        
        // Re-render
        updateUI();
    });
});

// Helper: Escape HTML
function safeTextWithHighlight(text, term) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    let safeHtml = div.innerHTML;
    if (term && term.length > 1) {
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        safeHtml = safeHtml.replace(regex, '<mark>$1</mark>');
    }
    return safeHtml;
}

function updateUI() {
    statusBadgeEl.textContent = currentAdapterName ? `${currentAdapterName}` : 'Ready';

    const visibleMessages = getFilteredMessages();
    const searchTerm = appState.filter.search.trim();

    // Filter Active State & Clear Button Visibility
    const hasActiveFilters = appState.filter.minLen > 0 || appState.filter.search.length > 0 || appState.filter.sort !== 'original';
    
    if (hasActiveFilters) {
        filterBtn.classList.add('active');
        clearFilterBtn.style.visibility = 'visible';
    } else {
        filterBtn.classList.remove('active');
        clearFilterBtn.style.visibility = 'hidden';
    }
    const hiddenCount = appState.hiddenIds.size;
    const hiddenCountEl = document.getElementById('hiddenCount');
    
    // Fix: Ensure viewBox matches the paths (24x24)
    if (showHiddenIcon && showHiddenIcon.getAttribute('viewBox') !== '0 0 24 24') {
        showHiddenIcon.setAttribute('viewBox', '0 0 24 24');
    }
    
    // 1. Show/Hide Button Visibility & State
    showHiddenBtn.style.display = 'flex'; // Always visible
    hiddenCountEl.textContent = hiddenCount;

    if (hiddenCount > 0) {
        if (appState.showHidden) {
            showHiddenBtn.classList.add('active');
            showHiddenBtn.title = `Hide Hidden Messages (${hiddenCount})`;
            showHiddenIcon.innerHTML = SVG_HIDDEN; 
        } else {
            showHiddenBtn.classList.remove('active');
            showHiddenBtn.title = `Show Hidden Messages (${hiddenCount})`;
            showHiddenIcon.innerHTML = SVG_VISIBLE; 
        }
    } else {
        // Default state when 0
        showHiddenBtn.classList.remove('active');
        showHiddenBtn.title = `Show Hidden Messages (0)`;
        showHiddenIcon.innerHTML = SVG_VISIBLE; 
        
        if(appState.showHidden) {
             appState.showHidden = false; 
        }
    }

    // 2. Stats Rows
    const selectedMsgs = visibleMessages.filter(m => appState.selectedIds.has(m.id));
    
    // Calculate Stats
    // 1. Total (All messages)
    const totalChars = appState.messages.reduce((sum, m) => sum + m.charCount, 0);
    const totalTokens = Math.round(totalChars / 4);
    
    // 2. Visible (Filtered)
    const visibleChars = visibleMessages.reduce((sum, m) => sum + m.charCount, 0);
    const visibleTokens = Math.round(visibleChars / 4);
    
    // 3. Selected (Checked)
    const selectedChars = selectedMsgs.reduce((sum, m) => sum + m.charCount, 0);
    const selectedTokens = Math.round(selectedChars / 4);
    
    // Format: Selected / Visible / Total
    statCharsVal.textContent = `${selectedChars.toLocaleString()} / ${visibleChars.toLocaleString()} / ${totalChars.toLocaleString()}`;
    statTokensVal.textContent = `~${selectedTokens.toLocaleString()} / ~${visibleTokens.toLocaleString()} / ~${totalTokens.toLocaleString()}`;
    
    // Fix: Update Selected Pill Count (now 3 stats: Selected / Visible / Total Messages)
    const selectedCountValueEl = document.getElementById('selectedCountValue');
    if (selectedCountValueEl) {
        const totalMsgs = appState.messages.length;
        const visibleMsgs = visibleMessages.length;
        const selectedCount = selectedMsgs.length;
        selectedCountValueEl.textContent = `${selectedCount} / ${visibleMsgs} / ${totalMsgs}`;
    }

    updateCopyButtonLabel();
    
    // Update Select All Icon (with Indeterminate Support)
    if (selectAllIcon) {
        const totalVisible = visibleMessages.length;
        const selectedCount = selectedMsgs.length;
        
        // Ensure viewBox is 24x24 for the 24x24 paths
        if (selectAllIcon.getAttribute('viewBox') !== '0 0 24 24') {
             selectAllIcon.setAttribute('viewBox', '0 0 24 24');
        }

        if (totalVisible > 0 && selectedCount === totalVisible) {
             selectAllIcon.innerHTML = SVG_CHECKBOX_CHECKED;
             selectAllBtn.title = 'Deselect All';
        } else if (selectedCount > 0 && selectedCount < totalVisible) {
             selectAllIcon.innerHTML = SVG_CHECKBOX_INDETERMINATE;
             selectAllBtn.title = 'Deselect All';
        } else {
             selectAllIcon.innerHTML = SVG_CHECKBOX_EMPTY;
             selectAllBtn.title = 'Select All';
        }
    }


    // Smart Re-render
    const renderSignature = JSON.stringify({
        ids: visibleMessages.map(m => m.id),
        hidden: Array.from(appState.hiddenIds).sort(),
        selected: Array.from(appState.selectedIds).sort(),
        search: searchTerm,
        showHidden: appState.showHidden
    });

    if (renderSignature === updateUI.lastSignature) return;
    updateUI.lastSignature = renderSignature;
    
    if (visibleMessages.length === 0) {
        messageListEl.innerHTML = '<div class="empty-state">No messages found.</div>';
        return;
    }

    messageListEl.innerHTML = '';
    visibleMessages.forEach((msg) => { 
        const isHidden = appState.hiddenIds.has(msg.id);
        const isSelected = appState.selectedIds.has(msg.id);
        
        const card = document.createElement('div');
        card.className = `card ${isHidden ? 'hidden-message' : ''}`;
        
        const isLong = msg.text.length > 300;
        const previewText = msg.text.substring(0, 300) + (isLong ? '...' : '');
        const finalHtml = safeTextWithHighlight(isLong ? previewText : msg.text, searchTerm);

        // Icon Logic:
        // If hidden: Show "Unhide" (Eye) -> SVG_VISIBLE
        // If visible: Show "Hide" (Crossed Eye) -> SVG_HIDDEN
        // User requested: "icons here to updated with the material ones"
        const toggleIcon = isHidden ? SVG_VISIBLE : SVG_HIDDEN;
        const toggleTitle = isHidden ? 'Unhide' : 'Hide';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-header-actions">
                     <input type="checkbox" class="select-checkbox" data-id="${msg.id}" ${isSelected ? 'checked' : ''}>
                     <span>#${msg.index + 1} • ${msg.charCount} chars</span>
                </div>
                <div class="card-header-actions">
                     <button class="hide-btn" data-id="${msg.id}" title="${toggleTitle}">
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">${toggleIcon}</svg>
                     </button>
                     <button class="copy-btn-small icon-only" data-id="${msg.id}" title="Copy">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">${SVG_COPY_SMALL}</svg>
                     </button>
                </div>
            </div>
            <div class="card-body">${finalHtml}</div>
            ${isLong ? `<button class="expand-btn">Show More</button>` : ''}
        `;
        
        // Listeners for this card
        
        // 1. Expand
        if (isLong) {
            const expandBtn = card.querySelector('.expand-btn');
            const bodyEl = card.querySelector('.card-body');
            let expanded = false;
            expandBtn.addEventListener('click', () => {
                expanded = !expanded;
                if (expanded) {
                    bodyEl.innerHTML = safeTextWithHighlight(msg.text, searchTerm);
                    expandBtn.textContent = 'Show Less';
                    card.classList.add('expanded');
                } else {
                    bodyEl.innerHTML = safeTextWithHighlight(previewText, searchTerm);
                    expandBtn.textContent = 'Show More';
                    card.classList.remove('expanded');
                }
            });
        }
        
        // 2. Single Copy
        const btn = card.querySelector('.copy-btn-small');
        btn?.addEventListener('click', () => {
            navigator.clipboard.writeText(msg.text);
            analytics.trackEvent('copy_single', { charCount: msg.text.length });
            
            // Visual Feedback (Checkmark)
            const originalIcon = btn.innerHTML;
            btn.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">${SVG_CHECKBOX_CHECKED}</svg>`;
            btn.style.color = 'var(--md-sys-color-primary)';
            
            setTimeout(() => {
                btn.innerHTML = originalIcon;
                btn.style.color = '';
            }, 1000);
        });
        
        // 3. Select Checkbox
        const checkbox = card.querySelector('.select-checkbox');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) appState.selectedIds.add(msg.id);
            else appState.selectedIds.delete(msg.id);
            updateCopyButtonLabel(); // Update button immediately without full re-render check, or trigger updateUI?
            // Triggering updateUI might be heavy if list is long. 
            // Better to just update the button.
            updateCopyButtonLabel();
            // Also need to update signature if we rely on it. 
            // Ideally we re-run updateUI but with minimal DOM diffing... 
            // My cheap re-render will re-draw everything. 
            // For now, let's re-draw to be safe on state sync.
            // Optimized: updateUI() is debounced by signature, but we CHANGED state, so signature changed.
            updateUI(); 
        });

        // 4. Hide Button
        const hideBtn = card.querySelector('.hide-btn');
        hideBtn.addEventListener('click', () => {
            if (isHidden) appState.hiddenIds.delete(msg.id);
            else appState.hiddenIds.add(msg.id);
            updateUI();
        });

        messageListEl.appendChild(card);
    });
}

function updateScanButton(canScan) {
    if (quickScanBtn) {
        quickScanBtn.style.display = canScan ? 'flex' : 'none';
        // Force flex if it was hidden
    }
}
updateUI.lastSignature = '';

// Start
authService.init();


import { authService } from '../services/auth.js';
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
        sort: 'original'
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
const SVG_VISIBLE = '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>';
const SVG_HIDDEN = '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z"/>';

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
    
    // 2. Sort
    const sortMode = appState.filter.sort;
    if (sortMode === 'lengthDesc') {
        msgs.sort((a, b) => b.charCount - a.charCount);
    } else if (sortMode === 'lengthAsc') {
        msgs.sort((a, b) => a.charCount - b.charCount);
    } 
    
    return msgs;
}

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

    // Features: Stats & Visibility Toggle
    const hiddenCount = appState.hiddenIds.size;
    const hiddenCountEl = document.getElementById('hiddenCount');
    
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
    const totalSetChars = visibleMessages.reduce((sum, m) => sum + m.charCount, 0);
    const totalSetTokens = Math.round(totalSetChars / 4);
    const selectedSetChars = selectedMsgs.reduce((sum, m) => sum + m.charCount, 0);
    const selectedSetTokens = Math.round(selectedSetChars / 4);
    
    // Fix: Always update text content for counts
    statCharsVal.textContent = `${selectedSetChars.toLocaleString()} / ${totalSetChars.toLocaleString()}`;
    statTokensVal.textContent = `~${selectedSetTokens.toLocaleString()} / ~${totalSetTokens.toLocaleString()}`;
    
    // Fix: Update Selected Pill Count
    const selectedCountValueEl = document.getElementById('selectedCountValue');
    if (selectedCountValueEl) {
        selectedCountValueEl.textContent = `${selectedMsgs.length} / ${visibleMessages.length}`;
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

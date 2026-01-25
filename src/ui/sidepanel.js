

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
const selectAllActionBtn = document.getElementById('selectAllActionBtn');
const selectAllIcon = document.getElementById('selectAllIcon');

// Filter Sheet
const filterSheet = document.getElementById('filterSheet');
const filterOverlay = document.getElementById('filterOverlay');
const closeFilterBtn = document.getElementById('closeFilterBtn');
const clearFilterBtn = document.getElementById('clearFilterBtn');
const minLenInput = document.getElementById('minLenInput');
// const sortSelect = document.getElementById('sortSelect'); // REMOVED

// Menu
const menuBtn = document.getElementById('menuBtn');
const actionsMenu = document.getElementById('actionsMenu');
const menuAuthAction = document.getElementById('menuAuthAction');
const menuPrivacyBtn = document.getElementById('menuPrivacyBtn');
const menuContactBtn = document.getElementById('menuContactBtn');
const menuDonateBtn = document.getElementById('menuDonateBtn');

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
const visibilityActionBtn = document.getElementById('visibilityActionBtn');
const visibilityIcon = document.getElementById('visibilityIcon');
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

// Sheet Logic (Generic)
let currentOpenSheet = null;

function openSheet(sheetId) {
    const sheet = document.getElementById(sheetId);
    if (!sheet) return;
    
    currentOpenSheet = sheet;
    sheet.classList.add('open');
    filterOverlay.classList.add('open'); // Use generic overlay
    actionsMenu.classList.remove('open'); // Close menu if open
}

function closeSheet() {
    if (currentOpenSheet) {
        currentOpenSheet.classList.remove('open');
        currentOpenSheet = null;
    }
    // Also close filterSheet specifically just in case (legacy ref)
    filterSheet.classList.remove('open');
    
    // Close other specific sheets if they were manually managed? 
    document.querySelectorAll('.bottom-sheet.open').forEach(s => s.classList.remove('open'));
    
    filterOverlay.classList.remove('open');
}

filterBtn.addEventListener('click', () => openSheet('filterSheet'));
closeFilterBtn.addEventListener('click', closeSheet);
filterOverlay.addEventListener('click', closeSheet);

// New Menu Actions
menuPrivacyBtn?.addEventListener('click', () => {
    openSheet('privacySheet');
    loadPrivacyContent();
});
document.getElementById('closePrivacyBtn')?.addEventListener('click', closeSheet);

menuContactBtn?.addEventListener('click', () => openSheet('contactSheet'));
document.getElementById('closeContactBtn')?.addEventListener('click', closeSheet);

menuDonateBtn?.addEventListener('click', () => openSheet('donateSheet'));
document.getElementById('closeDonateBtn')?.addEventListener('click', closeSheet);


// Privacy Loader
async function loadPrivacyContent() {
    const contentEl = document.getElementById('privacyContent');
    if (!contentEl || contentEl.dataset.loaded) return;
    
    try {
        const response = await fetch('../../PRIVACY.md'); 
        // Try relative path up two levels if serving from src/ui, 
        // OR just try root relative if http-server is at root.
        // http-server root is ./, file is at ./PRIVACY.md. 
        // Browser URL is src/ui/sidepanel.html. 
        // So fetch needs "../../PRIVACY.md".
        
        if (!response.ok) throw new Error('Not found');
        const text = await response.text();
        
        // Simple Markdown Parser
        const html = text
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/\*\*(.*)\*\*/gim, '<b>$1</b>')
            .replace(/\n$/gim, '<br />')
            .replace(/\n\n/gim, '<p></p>');

        contentEl.innerHTML = html;
        contentEl.dataset.loaded = 'true';
    } catch (e) {
        contentEl.innerHTML = '<p>Could not load privacy policy. Please check the repo.</p>';
    }
}

// Clear Filter
clearFilterBtn.addEventListener('click', () => {
    appState.filter.search = '';
    appState.filter.minLen = 0;
    appState.filter.sort = 'original';
    
    // Reset Inputs
    searchInput.value = '';
    minLenInput.value = 0;
    // reset sort state to 'original'
    appState.filter.sort = 'original';
    updateSortUI(); // Update icon helper
    
    updateUI();
});

// Sort Toggle Logic
// Cycle: original -> lengthDesc -> lengthAsc -> original
const sortToggleBtn = document.getElementById('sortToggleBtn');
const sortIcon = document.getElementById('sortIcon');

const SORT_STATES = ['original', 'lengthDesc', 'lengthAsc'];
const SORT_ICONS = {
    'original': 'icon-arrow-indeterminate',
    'lengthDesc': 'icon-arrow-down',
    'lengthAsc': 'icon-arrow-up'
};
const SORT_TITLES = {
    'original': 'Sort: Original',
    'lengthDesc': 'Sort: Longest First',
    'lengthAsc': 'Sort: Shortest First'
};

sortToggleBtn?.addEventListener('click', () => {
    const currentIndex = SORT_STATES.indexOf(appState.filter.sort);
    const nextIndex = (currentIndex + 1) % SORT_STATES.length;
    appState.filter.sort = SORT_STATES[nextIndex];
    
    updateSortUI();
    updateUI();
});

function updateSortUI() {
    if (!sortIcon || !sortToggleBtn) return;
    const mode = appState.filter.sort;
    sortIcon.className = 'svg-icon ' + SORT_ICONS[mode];
    sortToggleBtn.title = SORT_TITLES[mode];
}

// Menu Logic
menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    actionsMenu.classList.toggle('open');
});
document.addEventListener('click', () => {
    actionsMenu.classList.remove('open');
});

// Author Toggle Logic (Segmented Control)
const authorToggleGroup = document.getElementById('authorToggleGroup');
const authorBtns = authorToggleGroup ? authorToggleGroup.querySelectorAll('.segment-btn') : [];
const glidingPill = authorToggleGroup ? authorToggleGroup.querySelector('.gliding-pill') : null;

function updateAuthorToggleUI() {
    if (!authorBtns.length || !glidingPill) return;
    
    const currentVal = appState.filter.author;
    
    authorBtns.forEach(btn => {
        if (btn.dataset.value === currentVal) {
            btn.classList.add('active');
            // Move Pill
            // Since we added gap, we must rely on offsetLeft from the parent
            // But offsetLeft is relative to the offsetParent (the group, which has position:relative).
            glidingPill.style.left = `${btn.offsetLeft}px`;
            glidingPill.style.width = `${btn.offsetWidth}px`;
        } else {
            btn.classList.remove('active');
        }
    });
}

if (authorToggleGroup) {
    authorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            appState.filter.author = btn.dataset.value;
            updateAuthorToggleUI();
            updateUI(); // Re-filter messages
        });
    });
    // Init
    // Wait for layout? 
    setTimeout(updateAuthorToggleUI, 100); 
}


// --- Core Event Listeners ---

// --- Chrome API Initialization ---

function initExtension() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs) {
        console.warn('[SidePanel] Chrome API not available (running in browser mode?)');
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
// SVG Class Constants (Task PURPLE)
const CLS_VISIBLE = 'icon-visibility-on';
const CLS_HIDDEN = 'icon-visibility-off'; // Use 'off' icon when state is showing (click to hide)? 
// Logic: 
// showHidden = true (Users sees hidden msgs) -> Button should say "Hide" -> Icon Eye Crossed (off)
// showHidden = false (Hidden msgs invisible) -> Button says "Show" -> Icon Eye (on)

const CLS_CHECKBOX_CHECKED = 'icon-check-full';
const CLS_CHECKBOX_EMPTY = 'icon-check-empty';
const CLS_CHECKBOX_INDETERMINATE = 'icon-check-indeterminate';

const CLS_COPY_SMALL = 'icon-copy small';


// Toggle Hide/Show Button (Task PURPLE)
visibilityActionBtn.addEventListener('click', () => {
    appState.showHidden = !appState.showHidden;
    updateUI(); 
});

// Select All Toggle
selectAllActionBtn?.addEventListener('click', () => {
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
    const iconDiv = copyAllBtn.querySelector('.svg-icon');
    if (iconDiv) {
        const originalClass = iconDiv.className;
        iconDiv.className = 'svg-icon ' + CLS_CHECKBOX_CHECKED;
        copyAllBtn.style.color = 'var(--md-sys-color-primary)'; 
        
        setTimeout(() => {
            iconDiv.className = originalClass;
            copyAllBtn.style.color = '';
        }, 1500);
    }
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

minLenInput.addEventListener('input', (e) => { 
    // Enforce numbers (positive integers)
    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    
    // Update State
    appState.filter.minLen = val;
    
    // Optional: Update input value if it was invalid characters (though type="number" blocks most)
    // e.target.value = val; 
    
    updateUI(); 
});

// REMOVED: sortSelect listener replaced by sortToggleBtn logic


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
    // const hiddenCountEl = document.getElementById('hiddenCount'); // REMOVED
    
    // Fix: Ensure viewBox matches the paths (24x24)
    if (visibilityIcon && visibilityIcon.getAttribute('viewBox') !== '0 0 24 24') {
        visibilityIcon.setAttribute('viewBox', '0 0 24 24');
    }
    
    // 1. Show/Hide Button Visibility & State
    // showHiddenBtn reference replaced by visibilityActionBtn in toolbar
    visibilityActionBtn.style.display = 'flex'; // Always visible
    // hiddenCountEl.textContent = hiddenCount; // REMOVED

    if (hiddenCount > 0) {
        if (appState.showHidden) {
            visibilityActionBtn.classList.add('active');
            visibilityActionBtn.title = `Hide Hidden Messages (${hiddenCount})`;
            visibilityIcon.className = 'svg-icon ' + CLS_HIDDEN; 
        } else {
            visibilityActionBtn.classList.remove('active');
            visibilityActionBtn.title = `Show Hidden Messages (${hiddenCount})`;
            visibilityIcon.className = 'svg-icon ' + CLS_VISIBLE;
        }
    } else {
        // Default state when 0
        // Default state when 0
        visibilityActionBtn.classList.remove('active');
        visibilityActionBtn.title = `Show Hidden Messages (0)`;
        visibilityIcon.className = 'svg-icon ' + CLS_VISIBLE;
        
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
             selectAllIcon.className = 'svg-icon ' + CLS_CHECKBOX_CHECKED;
             selectAllActionBtn.title = 'Deselect All';
        } else if (selectedCount > 0 && selectedCount < totalVisible) {
             selectAllIcon.className = 'svg-icon ' + CLS_CHECKBOX_INDETERMINATE;
             selectAllActionBtn.title = 'Deselect All';
        } else {
             selectAllIcon.className = 'svg-icon ' + CLS_CHECKBOX_EMPTY;
             selectAllActionBtn.title = 'Select All';
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
        // Use classes
        const toggleIconClass = isHidden ? CLS_VISIBLE : CLS_HIDDEN;
        const toggleTitle = isHidden ? 'Unhide' : 'Hide';

        card.innerHTML = `
            <div class="card-header">
                <div class="card-header-actions">
                     <input type="checkbox" class="select-checkbox" data-id="${msg.id}" ${isSelected ? 'checked' : ''}>
                     <span>#${msg.index + 1} • ${msg.charCount} chars</span>
                </div>
                <div class="card-header-actions">
                     <button class="hide-btn" data-id="${msg.id}" title="${toggleTitle}">
                        <div class="svg-icon ${toggleIconClass}"></div>
                     </button>
                     <button class="copy-btn-small icon-only" data-id="${msg.id}" title="Copy">
                        <div class="svg-icon ${CLS_COPY_SMALL}"></div>
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
            const iconDiv = btn.querySelector('.svg-icon');
            if (iconDiv) {
                const originalClass = iconDiv.className;
                iconDiv.className = 'svg-icon ' + CLS_CHECKBOX_CHECKED;
                btn.style.color = 'var(--md-sys-color-primary)';
                
                setTimeout(() => {
                    iconDiv.className = originalClass;
                    btn.style.color = '';
                }, 1000);
            }
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

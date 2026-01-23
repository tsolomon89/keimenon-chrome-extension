
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
ensureConnection();

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
// SVG Paths (Material Symbols)
const SVG_VISIBLE = '<path d="M480-320q75 0 127.5-52.5T660-500q0-75-52.5-127.5T480-680q-75 0-127.5 52.5T300-500q0 75 52.5 127.5T480-320Zm.04-77.02q-42.89 0-72.95-30.02-30.07-30.03-30.07-72.92t30.02-72.95q30.03-30.07 72.92-30.07t72.95 30.02q30.07 30.03 30.07 72.92t-30.02 72.95q-30.03 30.07-72.92 30.07ZM480-192.59q-148.87 0-270.66-83.89Q87.54-360.37 32.59-500q54.95-139.63 176.75-223.52Q331.13-807.41 480-807.41t270.66 83.89Q872.46-639.63 927.41-500q-54.95 139.63-176.75 223.52Q628.87-192.59 480-192.59ZM480-500Zm.02 220q112.74 0 207-59.62T831.28-500q-50-100.76-144.28-160.38Q592.72-720 479.98-720q-112.74 0-207 59.62T128.72-500q50 100.76 144.28 160.38Q367.28-280 480.02-280Z"/>';
const SVG_HIDDEN = '<path d="m789.13-53.13-163.7-161.94q-34.52 11.24-70.5 16.86-35.97 5.62-74.93 5.62-152.67 0-272.71-84.93Q87.26-362.46 32.59-500q20.76-52.52 53-98.86 32.24-46.34 72.76-83.29L49.3-792.72l58.63-58.63 739.59 739.83-58.39 58.39ZM480-320q9.8 0 18.35-.88 8.54-.88 18.35-3.64L304.04-536.7q-2.52 9.81-3.28 18.47-.76 8.66-.76 18.23 0 75 52.5 127.5T480-320Zm299.65 20.63L646.2-432.07q6.52-15.8 10.16-32.94Q660-482.15 660-500q0-75-52.5-127.5T480-680q-18.33 0-34.99 3.64-16.66 3.64-32.94 10.93L304.09-773.41q41-17 84.95-25.5 43.96-8.5 90.96-8.5 152.43 0 272.47 84.69Q872.5-638.02 927.41-500q-23 59.48-60.98 110.93-37.97 51.46-86.78 89.7ZM577.67-500.59l-98-98q22.98-4.04 42.06 3.55 19.07 7.58 32.97 22.47 13.89 14.9 20.07 34.09 6.19 19.2 2.9 37.89Z"/>';

const SVG_CHECKBOX_CHECKED = '<path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Zm224-168L696-620l-56-57-216 216-112-112-56 57 168 168Z"/>';
const SVG_CHECKBOX_EMPTY = '<path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v560q0 33-23.5 56.5T760-120H200Zm0-80h560v-560H200v560Z"/>';
const SVG_CHECKBOX_INDETERMINATE = '<path d="M114.342-828.13a2.383,2.383,0,0,1-1.749-.723,2.383,2.383,0,0,1-.723-1.749v-15.056a2.382,2.382,0,0,1,.723-1.749,2.383,2.383,0,0,1,1.749-.723H129.4a2.383,2.383,0,0,1,1.749.723,2.382,2.382,0,0,1,.723,1.749V-830.6a2.383,2.383,0,0,1-.723,1.749,2.383,2.383,0,0,1-1.749.723Zm0-2.472H129.4v-15.056H114.342Z" transform="translate(-109.87 850.13)" fill="currentColor"/> <path d="M116.437-836.946H127.3v-2.368H116.437Zm-2.1,8.816a2.383,2.383,0,0,1-1.749-.723,2.383,2.383,0,0,1-.723-1.749v-15.056a2.383,2.383,0,0,1,.723-1.749,2.383,2.383,0,0,1,1.749-.723H129.4a2.383,2.383,0,0,1,1.749.723,2.383,2.383,0,0,1,.723,1.749V-830.6a2.383,2.383,0,0,1-.723,1.749,2.383,2.383,0,0,1-1.749.723Z" transform="translate(-109.87 850.13)" fill="currentColor"/>';

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
    
    copyAllBtn.textContent = 'Copied!';
    setTimeout(() => updateCopyButtonLabel(), 1500);
});

function updateCopyButtonLabel() {
    const visibleMessages = getFilteredMessages();
    const selectedCount = visibleMessages.filter(m => appState.selectedIds.has(m.id)).length;
    
    if (selectedCount > 0) {
        copyAllBtn.textContent = `Copy`;
        copyAllBtn.disabled = false;
        copyAllBtn.style.opacity = '1';
    } else {
        copyAllBtn.textContent = `Copy`;
        copyAllBtn.disabled = true; // UX: Disable if nothing to copy
        copyAllBtn.style.opacity = '0.5';
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
    if (hiddenCount > 0) {
        showHiddenBtn.style.display = 'flex';
        hiddenCountEl.textContent = hiddenCount;
        
        if (appState.showHidden) {
            showHiddenBtn.classList.add('active');
            showHiddenBtn.title = `Hide Hidden Messages (${hiddenCount})`;
            showHiddenIcon.innerHTML = SVG_HIDDEN; // "Crossed Eye" to imply action "Hide them"
        } else {
            showHiddenBtn.classList.remove('active');
            showHiddenBtn.title = `Show Hidden Messages (${hiddenCount})`;
            showHiddenIcon.innerHTML = SVG_VISIBLE; // "Eye" to imply action "Show them"
        }
    } else {
        // Fix: Always show visibility pill
        showHiddenBtn.style.display = 'flex';
        // Reset state only if needed logic
        if(appState.showHidden && hiddenCount === 0) {
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
        selectedCountValueEl.textContent = selectedMsgs.length;
    }

    updateCopyButtonLabel();
    
    // Update Select All Icon (with Indeterminate Support)
    if (selectAllIcon) {
        const totalVisible = visibleMessages.length;
        const selectedCount = selectedMsgs.length;
        
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
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">${toggleIcon === SVG_HIDDEN ? '<path d="m20.665 18.796-1.512-1.512q-.312.115-.65.202-.338.086-.744.086-1.42 0-2.524-.806Q14.131 15.96 13.626 14.654q.192-.48.494-.902.302-.423.682-.759l-5.717-5.716-.547-.547L1.644.836l2.16-2.16 23.328 23.328-2.155 2.155ZM12 11.231Zm6.566 2.506-1.325-1.325q.067-.144.096-.298.029-.153.029-.313 0-.691-.49-1.181t-1.18-.49q-.173 0-.327.034-.153.033-.307.101L9.673 4.87q.394-.153.806-.23.413-.077.85-.077 1.42 0 2.524.797Q14.957 6.157 15.461 7.462q-.211.537-.566 1.017-.355.48-.76 837ZM10.592 5.79l-2.025-2.025q.557-.365 1.157-.591Q10.323 2.947 11 2.947q2.717 0 5.091 1.488Q18.466 5.923 19.646 8.538q-.336 1.104-1.027 2.05-.71.945-1.853 1.637l-1.008-1.008q.835-.49 1.34-1.139.503-.648.783-1.426-.506-1.307-1.574-2.16Q15.24 5.638 13.933 5.638q-.806 0-1.632.192-.825.192-1.709.601v-.64Z" transform="translate(2 3)" />' : '<path d="M11 11.231a1.692 1.692 0 0 1 1.23-.51 1.693 1.693 0 0 1 1.231.51 1.693 1.693 0 0 1 .51 1.23 1.692 1.692 0 0 1-.51 1.231 1.692 1.692 0 0 1-1.23.51 1.693 1.693 0 0 1-1.231-.51 1.693 1.693 0 0 1-.51-1.23 1.692 1.692 0 0 1 .51-1.231Zm6.566 2.506-1.325-1.325q.067-.144.096-.298.029-.153.029-.313 0-.691-.49-1.181t-1.18-.49q-.173 0-.327.034-.153.033-.307.101L9.673 4.87q.394-.153.806-.23.413-.077.85-.077 1.42 0 2.524.797Q14.957 6.157 15.461 7.462q-.211.537-.566 1.017-.355.48-.76 837ZM10.592 5.79l-2.025-2.025q.557-.365 1.157-.591Q10.323 2.947 11 2.947q2.717 0 5.091 1.488Q18.466 5.923 19.646 8.538q-.336 1.104-1.027 2.05-.71.945-1.853 1.637l-1.008-1.008q.835-.49 1.34-1.139.503-.648.783-1.426-.506-1.307-1.574-2.16Q15.24 5.638 13.933 5.638q-.806 0-1.632.192-.825.192-1.709.601v-.64Z" transform="translate(2 3)" />'}</svg>
                     </button>
                     <button class="copy-btn-small" data-id="${msg.id}">
                        <svg viewBox="0 0 24 24.258" width="16" height="16" fill="currentColor">${SVG_COPY_SMALL}</svg>
                        Copy
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
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 1000);
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

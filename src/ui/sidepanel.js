
import { authService } from '../services/auth.js';
import { analytics } from '../services/analytics.js';
import { filterMessages } from '../shared/filter.js';

let allMessages = [];
let currentAdapterName = '';

// UI Elements
const messageListEl = document.getElementById('messageList');
const statusBadgeEl = document.getElementById('statusBadge');
const searchInput = document.getElementById('searchInput');

// Controls
const filterBtn = document.getElementById('filterBtn');
const copyAllBtn = document.getElementById('copyAllBtn');

// Filter Sheet
const filterSheet = document.getElementById('filterSheet');
const filterOverlay = document.getElementById('filterOverlay');
const closeFilterBtn = document.getElementById('closeFilterBtn');
const minLenInput = document.getElementById('minLenInput');
const sortSelect = document.getElementById('sortSelect');

// Menu
const menuBtn = document.getElementById('menuBtn');
const actionsMenu = document.getElementById('actionsMenu');
const menuRefresh = document.getElementById('menuRefresh');
const menuScan = document.getElementById('menuScan');
const menuAuthAction = document.getElementById('menuAuthAction');

// Scanning
const scanProgressEl = document.getElementById('scanProgress');
const stopScanBtn = document.getElementById('stopScanBtn');
const scanLog = document.getElementById('scanLog');

// Login
const loginScreen = document.getElementById('loginScreen');
const googleSignInBtn = document.getElementById('googleSignInBtn');

// Settings
const analyticsToggle = document.getElementById('analyticsToggle');

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


// --- Core Event Listeners ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'MESSAGES_UPDATED') {
        const { messages } = request.payload;
        const { adapter, capabilities } = request.meta;
        allMessages = messages;
        currentAdapterName = adapter;
        updateScanButton(capabilities?.scan);
        updateUI();
    } else if (request.action === 'SCAN_COMPLETE') {
        setLoading(false);
        scanProgressEl.classList.remove('active');
        scanProgressEl.style.display = 'none'; // Ensure hidden
        analytics.trackEvent('scan_complete', { count: allMessages.length });
    } else if (request.action === 'EXTENSION_READY') {
        // Content script just loaded/reloaded
        setLoading(false); // Page ready
        const { adapter, capabilities } = request.meta;
        currentAdapterName = adapter;
        updateScanButton(capabilities?.scan);
        // Request immediate data
        requestMessages();
    }
});


function requestMessages() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
             chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_MESSAGES' })
                .then(() => {
                    // Success, verify UI (optional)
                    if (statusBadgeEl.textContent === 'Unsupported Tab') {
                         statusBadgeEl.textContent = 'Ready';
                         statusBadgeEl.style.backgroundColor = ''; // Reset
                    }
                })
                .catch(() => {
                    // Still failing, or content script not ready
                    // We rely on EXTENSION_READY or retry
                });
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
                    // Connected
                    currentAdapterName = response.adapter;
                    requestMessages(); // Get real data
                }
            })
            .catch(() => {
                // Failed
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
                     // Keep loading true while scanning? 
                     // Or rely on SCAN_COMPLETE?
                     // Let's keep it 'loading' visually as "active"
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
             // Loading state cleared in SCAN_COMPLETE
        }
    });
});

quickRefreshBtn?.addEventListener('click', () => {
    setLoading(true);
    chrome.tabs.reload();
    // Reset loading after a delay or rely on reload to clear extension context?
    // Extension context might reload if it's sidepanel, but usually sidepanel stays.
    // If page reloads, we get EXTENSION_READY later.
    setTimeout(() => setLoading(false), 2000); // Fallback
});

// Copy Handler
copyAllBtn.addEventListener('click', () => {
    const visibleMessages = getFilteredMessages();
    if (visibleMessages.length === 0) return;
    
    const text = visibleMessages.map(m => m.text).join('\n\n---\n\n');
    navigator.clipboard.writeText(text);
    
    analytics.trackEvent('copy_all', { count: visibleMessages.length });
    
    const originalText = copyAllBtn.textContent;
    copyAllBtn.textContent = 'Copied!';
    setTimeout(() => copyAllBtn.textContent = originalText, 1500);
});

// Filter Inputs
searchInput.addEventListener('input', updateUI);
minLenInput.addEventListener('input', updateUI);
sortSelect.addEventListener('change', updateUI);

function getFilteredMessages() {
    // Basic filter first
    let msgs = filterMessages(allMessages, searchInput.value, minLenInput.value);
    
    // Sort
    const sortMode = sortSelect.value;
    if (sortMode === 'lengthDesc') {
        msgs.sort((a, b) => b.charCount - a.charCount);
    } else if (sortMode === 'lengthAsc') {
        msgs.sort((a, b) => a.charCount - b.charCount);
    } 
    
    return msgs;
}

// Helper: Escape HTML but allow <mark> if we did highlighting
function safeTextWithHighlight(text, term) {
    if (!text) return '';
    
    // Safety escape first
    const div = document.createElement('div');
    div.textContent = text;
    let safeHtml = div.innerHTML;

    // Apply highlight if term exists
    if (term && term.length > 1) {
        const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        safeHtml = safeHtml.replace(regex, '<mark>$1</mark>');
    }
    
    return safeHtml;
}

function updateUI() {
    statusBadgeEl.textContent = currentAdapterName ? `${currentAdapterName} (${allMessages.length})` : 'Ready';
    
    // Update scan button visibility
    if (quickScanBtn) {
        // We need 'scan' capability. Usually updated in MESSAGES_UPDATED or EXTENSION_READY
        // This is handled by updateScanButton but we need to ensure it targets quickScanBtn
    }

    const relevantMessages = getFilteredMessages();
    const searchTerm = searchInput.value.trim();
    
    if (relevantMessages.length === 0) {
        messageListEl.innerHTML = '<div class="empty-state">No messages found.</div>';
        return;
    }

    messageListEl.innerHTML = '';
    relevantMessages.forEach((msg) => { 
        const card = document.createElement('div');
        card.className = 'card';
        
        // Expand/Collapse Logic
        const isLong = msg.text.length > 300;
        const previewText = msg.text.substring(0, 300) + (isLong ? '...' : '');
        
        // Initial State
        const finalHtml = safeTextWithHighlight(isLong ? previewText : msg.text, searchTerm);

        card.innerHTML = `
            <div class="card-header">
                <span>#${msg.index + 1} • ${msg.charCount} chars</span>
                <button class="copy-btn-small" data-id="${msg.id}">Copy</button>
            </div>
            <div class="card-body">${finalHtml}</div>
            ${isLong ? `<button class="expand-btn">Show More</button>` : ''}
        `;
        
        // Bind Expand
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
        
        const btn = card.querySelector('.copy-btn-small');
        btn?.addEventListener('click', () => {
            navigator.clipboard.writeText(msg.text);
            analytics.trackEvent('copy_single', { charCount: msg.text.length });
            btn.textContent = 'Copied!';
            setTimeout(() => btn.textContent = 'Copy', 1000);
        });

        messageListEl.appendChild(card);
    });
}

function updateScanButton(canScan) {
    if (quickScanBtn) {
        quickScanBtn.style.display = canScan ? 'flex' : 'none';
    }
}

// Start
authService.init();

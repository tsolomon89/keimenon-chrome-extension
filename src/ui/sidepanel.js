import { filterMessages } from '../shared/filter.js';

const appState = {
    messages: [],           // All raw messages
    hiddenIds: new Set(),   // IDs of hidden messages
    selectedIds: new Set(), // IDs of checked messages
    showHidden: false,      // User toggle state
    filter: {
        search: '',
        minLen: 0,
        maxLen: 0,
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
const maxLenInput = document.getElementById('maxLenInput');

// Menu
const menuBtn = document.getElementById('menuBtn');
const actionsMenu = document.getElementById('actionsMenu');
const menuPrivacyBtn = document.getElementById('menuPrivacyBtn');
const menuContactBtn = document.getElementById('menuContactBtn');
const menuDonateBtn = document.getElementById('menuDonateBtn');

// Scanning
const quickScanBtn = document.getElementById('quickScanBtn');
const quickRefreshBtn = document.getElementById('quickRefreshBtn');
const platformList = document.getElementById('platformList');
const platformItems = document.querySelectorAll('.platform-item');

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

document.getElementById('sendEmailBtn')?.addEventListener('click', () => {
    const subjectSelect = document.getElementById('contactSubject');
    const subjectVal = subjectSelect ? subjectSelect.value : 'General Support';

    // Route each subject to its dedicated inbox
    const EMAIL_MAP = {
        'Bug / Error Report': 'error@keimenon.com',
        'Feature Requests':   'requests@keimenon.com',
        'General Support':    'support@keimenon.com',
    };
    const toEmail = EMAIL_MAP[subjectVal] || 'support@keimenon.com';
    const finalSubject = `Keimenon Lite - ${subjectVal}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(finalSubject)}`;
    
    if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: gmailUrl, active: true });
    } else {
        window.open(gmailUrl, '_blank');
    }
    
    closeSheet();
});

menuDonateBtn?.addEventListener('click', () => openSheet('donateSheet'));
document.getElementById('closeDonateBtn')?.addEventListener('click', closeSheet);

document.getElementById('confirmDonateBtn')?.addEventListener('click', () => {
    const donateUrl = 'https://donate.stripe.com/5kQdR9gpZ7N7aSh5zh4ZG00';
    if (chrome && chrome.tabs && chrome.tabs.create) {
        chrome.tabs.create({ url: donateUrl });
    } else {
        window.open(donateUrl, '_blank');
    }
});


// Privacy Loader
async function loadPrivacyContent() {
    const contentEl = document.getElementById('privacyContent');
    if (!contentEl || contentEl.dataset.loaded) return;
    
    try {
        const response = await fetch('../../PRIVACY_POLICY.md'); 
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
    appState.filter.maxLen = 0;
    appState.filter.sort = 'original';
    
    // Reset Inputs
    searchInput.value = '';
    minLenInput.value = '';
    if (maxLenInput) maxLenInput.value = '';
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

// Author Toggle Logic (New Toggle System)
const authorToggleGroup = document.getElementById('authorToggleGroup');
const authorBtns = authorToggleGroup ? authorToggleGroup.querySelectorAll('.toggle-btn') : [];

if (authorToggleGroup) {
    authorBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const val = btn.dataset.value;
            appState.filter.author = val;
            
            // UI Update
            authorToggleGroup.dataset.active = val;
            authorBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            updateUI(); // Re-filter messages
        });
    });
}

function updateAuthorToggleUI() {
    if (!authorToggleGroup || !authorBtns.length) return;
    const currentVal = appState.filter.author;
    
    authorToggleGroup.dataset.active = currentVal;
    authorBtns.forEach(btn => {
        if (btn.dataset.value === currentVal) btn.classList.add('active');
        else btn.classList.remove('active');
    });
}

// --- Theme System Logic ---
const menuThemeBtn = document.getElementById('menuThemeBtn');
const closeThemeBtn = document.getElementById('closeThemeBtn');
const themeOptions = document.querySelectorAll('.theme-option-btn');

// Determine default theme based on system preference if not saved
const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
const defaultTheme = systemPrefersDark ? 'outline-dark' : 'outline-light';

const savedTheme = localStorage.getItem('keimenon-theme') || defaultTheme;

// Apply saved theme immediately
document.body.dataset.theme = savedTheme;

// Menu Action
menuThemeBtn?.addEventListener('click', () => {
    openSheet('themeSheet');
    updateThemeSelectionUI();
});
closeThemeBtn?.addEventListener('click', closeSheet);

// Theme Selection
themeOptions.forEach(btn => {
    btn.addEventListener('click', () => {
        const newTheme = btn.dataset.theme;
        document.body.dataset.theme = newTheme;
        localStorage.setItem('keimenon-theme', newTheme);
        updateThemeSelectionUI();
    });
});

function updateThemeSelectionUI() {
    const currentTheme = document.body.dataset.theme;
    themeOptions.forEach(btn => {
        if (btn.dataset.theme === currentTheme) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}


// Platform Item Logic
if (platformItems) {
    platformItems.forEach(item => {
        item.addEventListener('click', (e) => {
            const url = item.dataset.url;
            if (!url) return;

            // Check for modifier keys for new tab
            if (e.ctrlKey || e.metaKey || e.button === 1) {
                chrome.tabs.create({ url });
            } else {
                chrome.tabs.update(undefined, { url });
            }
        });
        // Middle click support? (Usually auxclick)
        item.addEventListener('auxclick', (e) => {
             if (e.button === 1) { // Middle
                 const url = item.dataset.url;
                 if (url) chrome.tabs.create({ url });
             }
        });
    });
}


// --- Core Event Listeners ---

// --- Chrome API Initialization ---

// --- Chrome API Initialization ---

let activePort = null;
let currentTabId = null;

function initExtension() {
    if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.tabs) {
        console.warn('[SidePanel] Chrome API not available (running in browser mode?)');
        return;
    }

    // Initial Connection
    connectToActiveTab();

    // Re-connect on tab switch
    chrome.tabs.onActivated.addListener(() => {
        connectToActiveTab();
    });

    // Re-connect on URL change (navigation)
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
        if (changeInfo.status === 'complete' && tabId === currentTabId) {
            connectToActiveTab();
        }
    });
}

function connectToActiveTab() {
    // Cleanup old connection
    if (activePort) {
        try { activePort.disconnect(); } catch(e) {}
        activePort = null;
    }

    // Clear old chat data
    appState.messages = [];
    appState.hiddenIds.clear();
    appState.selectedIds.clear();

    // IMPORTANT: Reset the render-signature cache so updateUI() always does a
    // full re-render after a tab switch, even if the new chat has the same
    // message IDs as the previous one. Without this, the list stays blank
    // while stats (which run before the signature check) show the correct count.
    updateUI.lastSignature = null;

    // Clear UI - leave empty while loading
    messageListEl.innerHTML = '';

    // Reset UI State while connecting
    updateConnectionState(false);
    statusBadgeEl.textContent = 'Connecting...';
    statusBadgeEl.style.backgroundColor = '';
    statusBadgeEl.style.color = '';

    // Show loader
    showLoader();

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]?.id) {
             statusBadgeEl.textContent = 'No Tab';
             hideLoader();
             return;
        }
        
        const tab = tabs[0];
        currentTabId = tab.id;
        
        // Use URL detection for immediate feedback even before port connects
        if (tab.url) appState.currentUrl = tab.url;

        try {
            // Establish long-lived connection
            const port = chrome.tabs.connect(currentTabId, { name: 'sidepanel-connection' });
            
            // Listen for Disconnect
            port.onDisconnect.addListener(() => {
                const err = chrome.runtime.lastError;
                console.log('[SidePanel] Port disconnected', err);
                activePort = null;
                updateConnectionState(false);
                hideLoader();
                // Usually means content script doesn't exist (e.g. system page)
                // or page closed. We stand by for next tab event.
            });

            // Listen for Messages
            port.onMessage.addListener(handlePortMessage);

            activePort = port;
            console.log('[SidePanel] Connected to tab', currentTabId);

        } catch (e) {
            console.error('[SidePanel] Connection failed', e);
            updateConnectionState(false);
            hideLoader();
        }
    });
}

// Loader Functions
function showLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.add('visible');
    }
}

function hideLoader() {
    const loader = document.getElementById('pageLoader');
    if (loader) {
        loader.classList.remove('visible');
    }
}

function handlePortMessage(msg) {
    if (msg.action === 'MESSAGES_UPDATED') {
        const { messages } = msg.payload;
        // const { adapter, capabilities } = msg.meta; // Meta usually present

        appState.messages = messages;
        // UX: Select all by default
        messages.forEach(m => appState.selectedIds.add(m.id));

        if (msg.meta) {
             updateConnectionState(true, msg.meta.adapter, msg.meta.capabilities);
        }

        // Update UI first
        updateUI();
        setLoading(false);

        // Wait for DOM to fully render all messages before hiding loader
        // Use filtered count since updateUI() only renders filtered messages
        const filteredMessages = getFilteredMessages();
        const expectedMessageCount = filteredMessages.length;
        const checkAndHideLoader = () => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Verify all messages are in the DOM
                        const renderedCards = messageListEl.querySelectorAll('.card');
                        const domCount = renderedCards.length;
                        
                        // Check if we met the expectation OR if expectation was 0 (and we rendered 0)
                        // Note: If expectation is 0, renderedCards is 0 (empty-state div is not a card)
                        if (domCount >= expectedMessageCount) {
                            // Additional small delay to ensure paint is complete
                            setTimeout(() => {
                                hideLoader();
                            }, 100);
                        } else {
                            // If not all messages rendered, check again
                            setTimeout(checkAndHideLoader, 50);
                        }
                    });
                });
            });
        };

        // UX Fix: If 0 messages, apply a grace period (2s) because content script often sends
        // an initial empty state before the actual scan completes. This prevents "No Messages" flash.
        // NOTE: With new Robust Loading in content.js, we shouldn't get empty updates unless it REALLY is empty.
        if (expectedMessageCount === 0) {
             messageListEl.innerHTML = `
                <div class="empty-state" style="padding: 20px; text-align: center; color: var(--color-text-muted);">
                    <p>No messages found.</p>
                    <p style="font-size: 0.9em; margin-top: 8px;">Write a message or click the refresh button.</p>
                </div>
             `;
             hideLoader();
        } else {
            checkAndHideLoader();
        }

    } else if (msg.action === 'MESSAGES_APPEND') {
        if (msg.payload && msg.payload.messages) {
            // Optimized: just push new items
            appState.messages.push(...msg.payload.messages);
            updateUI();
        }
    } else if (msg.action === 'SCAN_COMPLETE') {
        setLoading(false);
        // Keep loader visible during scan complete - messages will update next
        // Loader will be hidden when MESSAGES_UPDATED arrives

    } else if (msg.action === 'EXTENSION_READY') {
        const { adapter, capabilities, status } = msg.meta;

        // Active Load started - Clear previous session data immediately
        appState.messages = [];
        appState.hiddenIds.clear();
        appState.selectedIds.clear();
        messageListEl.innerHTML = '';
        
        // Ensure Page Loader is visible for the new session
        showLoader();

        if (status === 'idle') {
             setLoading(false);
             // Adapted connected but on unsupported page (e.g. Home)
             statusBadgeEl.textContent = 'Ready (Idle)';
             statusBadgeEl.style.backgroundColor = '';
             statusBadgeEl.style.color = '';
             messageListEl.innerHTML = '<div class="empty-state">Select a chat</div>';
             
             updateUI();

             // But simpler: just treat as connected but maybe restricted capabilities
             updateConnectionState(true, adapter, { scan: false }); // Disable scan on home
             hideLoader();
        } else {
            // Active Session
            updateConnectionState(true, adapter, capabilities);
            requestMessages();
            // Loader will be hidden when MESSAGES_UPDATED arrives
        }
    }
}


function requestMessages() {
    if (activePort) {
        try {
            activePort.postMessage({ action: 'GET_MESSAGES' });
        } catch(e) { console.warn('Failed to request messages', e); }
    }
}

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
     if (activePort) {
         setLoading(true);
         activePort.postMessage({ action: 'SCAN_FULL_CHAT' });
         // We rely on async handlers for success/fail feedback
     } else {
         alert("Not connected to a chat page.");
     }
});


quickRefreshBtn?.addEventListener('click', () => {
    setLoading(true);
    chrome.tabs.reload();
    // Re-connection will happen automatically via onUpdated listener
    setTimeout(() => setLoading(false), 2000); // Failsafe
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

    const hasUser = selectedMsgs.some(m => m.author === 'user');
    const hasAI   = selectedMsgs.some(m => m.author === 'assistant');
    const mixedAuthors = hasUser && hasAI;

    const textToCopy = selectedMsgs.map(m => {
        if (!mixedAuthors) return m.text; // single-author export — no labels
        const isUser = m.author === 'user';
        const platformName = m.platform
            ? m.platform.charAt(0).toUpperCase() + m.platform.slice(1)
            : 'AI';
        const label = isUser ? '**User**' : `**AI - ${platformName}**`;
        return `${label}\n${m.text}`;
    }).join('\n\n---\n\n');
    
    navigator.clipboard.writeText(textToCopy);
    
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
    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    appState.filter.minLen = val;
    updateUI(); 
});

maxLenInput?.addEventListener('input', (e) => { 
    let val = parseInt(e.target.value);
    if (isNaN(val) || val < 0) val = 0;
    appState.filter.maxLen = val;
    // maxLen = 0 means no limit (disabled)
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
    let msgs = filterMessages(activeSet, appState.filter.search, appState.filter.minLen, appState.filter.maxLen);
    
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
    const hasActiveFilters = appState.filter.minLen > 0 || appState.filter.maxLen > 0 || appState.filter.search.length > 0 || appState.filter.sort !== 'original';
    
    if (hasActiveFilters) {
        filterBtn.classList.add('active');
        clearFilterBtn.style.visibility = 'visible';
    } else {
        filterBtn.classList.remove('active');
        clearFilterBtn.style.visibility = 'hidden';
    }
    const hiddenCount = appState.hiddenIds.size;
    
    // Fix: Ensure viewBox matches the paths (24x24)
    if (visibilityIcon && visibilityIcon.getAttribute('viewBox') !== '0 0 24 24') {
        visibilityIcon.setAttribute('viewBox', '0 0 24 24');
    }
    
    // 1. Show/Hide Button Visibility & State
    // showHiddenBtn reference replaced by visibilityActionBtn in toolbar
    visibilityActionBtn.style.display = 'flex'; // Always visible

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
    statCharsVal.value = `${selectedChars.toLocaleString()} / ${visibleChars.toLocaleString()} / ${totalChars.toLocaleString()}`;
    statTokensVal.value = `~${selectedTokens.toLocaleString()} / ~${visibleTokens.toLocaleString()} / ~${totalTokens.toLocaleString()}`;
    
    // Fix: Update Selected Pill Count (now 3 stats: Selected / Visible / Total Messages)
    const selectedCountValueEl = document.getElementById('selectedCountValue');
    if (selectedCountValueEl) {
        const totalMsgs = appState.messages.length;
        const visibleMsgs = visibleMessages.length;
        const selectedCount = selectedMsgs.length;
        selectedCountValueEl.value = `${selectedCount} / ${visibleMsgs} / ${totalMsgs}`;
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
    
    // Update List Container Mode
    messageListEl.className = `message-list mode-${appState.filter.author}`;

    if (visibleMessages.length === 0) {
        messageListEl.innerHTML = '<div class="empty-state">No messages found.</div>';
        return;
    }

    messageListEl.innerHTML = '';
    visibleMessages.forEach((msg) => { 
        const isHidden = appState.hiddenIds.has(msg.id);
        const isSelected = appState.selectedIds.has(msg.id);
        
        // Author Logic
        const isUser = msg.author === 'user';
        const typeClass = isUser ? 'type-user' : 'type-ai';
        const authorLabel = isUser ? 'User' : 'AI';
        
        const card = document.createElement('div');
        card.className = `card ${typeClass} ${isHidden ? 'hidden-message' : ''}`;
        
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
                     <span class="author-label">${authorLabel}</span>
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

function updateConnectionState(isConnected, adapter = '', capabilities = {}) {
    // 1. Badge & Adapter Name
    if (isConnected) {
        statusBadgeEl.textContent = adapter || 'Ready';
        // Clear inline styles to use theme defaults
        statusBadgeEl.style.backgroundColor = '';
        statusBadgeEl.style.color = '';
        currentAdapterName = adapter;
    } else {
        statusBadgeEl.textContent = 'Unsupported Tab';
        statusBadgeEl.style.backgroundColor = 'var(--color-border)';
        statusBadgeEl.style.color = 'var(--color-text-muted)';
        currentAdapterName = '';
    }

    // 2. Buttons Visibility
    // Helper to toggle hidden class
    const toggleBtn = (btn, show) => {
        if (!btn) return;
        if (show) {
            btn.classList.remove('hidden');
            btn.style.display = 'flex';
        } else {
            btn.classList.add('hidden');
            btn.style.display = 'none';
        }
    };

    // Refresh: Always show (removed condition)
    // toggleBtn(quickRefreshBtn, isConnected);

    // Scan: Show if connected AND capable
    toggleBtn(quickScanBtn, isConnected && capabilities?.scan);

    // 3. Platform List vs Message List (Unsupported State OR Home Page)
    // Logic: Show Platform List if NOT connected OR (Connected but on Home Page)
    let isHomePage = false;
    if (isConnected && appState.currentUrl) {
        try {
            const urlObj = new URL(appState.currentUrl);
            // Check if path is empty or just slash
            // e.g. https://chatgpt.com/ -> /
            isHomePage = urlObj.pathname === '/' || urlObj.pathname === '';
        } catch (e) { console.error(e); }
    }

    if (isConnected && !isHomePage) {
        // Connected AND NOT Home Page -> Show Messages (Chat view)
        if (platformList) platformList.classList.add('hidden');
        if (messageListEl) messageListEl.classList.remove('hidden');
    } else {
        // Unsupported OR Home Page -> Show Platform List
        if (platformList) platformList.classList.remove('hidden');
        if (messageListEl) messageListEl.classList.add('hidden');
        
        // If connected but home page, update badge and empty message
        if (isConnected && isHomePage) {
             statusBadgeEl.textContent = 'Ready (Home)';
             statusBadgeEl.style.backgroundColor = '';
             statusBadgeEl.style.color = '';
             messageListEl.innerHTML = '<div class="empty-state">Select a chat</div>';
        }
    }
}

// Deprecated: updateScanButton merged into updateConnectionState
// function updateScanButton(canScan) { ... } 
updateUI.lastSignature = '';

// Start
initExtension();
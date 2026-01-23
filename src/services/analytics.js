
// GA4 Measurement Protocol
const GA_ENDPOINT = 'https://www.google-analytics.com/mp/collect';
const MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Placeholder
const API_SECRET = 'XXXXXXXXXXXXXXXXXXXX'; // Placeholder

export class AnalyticsService {
    constructor() {
        this.enabled = false; // Default off for privacy
        this.clientId = null;
        this.sessionId = null;
    }

    async init() {
        // Load settings
        const store = await chrome.storage.local.get(['analyticsEnabled', 'clientId']);
        this.enabled = store.analyticsEnabled !== false;
        
        if (store.clientId) {
            this.clientId = store.clientId;
        } else {
            this.clientId = crypto.randomUUID();
            await chrome.storage.local.set({ clientId: this.clientId });
        }
        
        // Session management (simple: one per load)
        this.sessionId = Date.now().toString();
    }

    setEnabled(enabled) {
        this.enabled = enabled;
        chrome.storage.local.set({ analyticsEnabled: enabled });
    }

    async trackEvent(eventName, params = {}) {
        if (!this.enabled) return;

        // SANITIZATION: Hardblock sensitive keys
        const cleanParams = { ...params };
        const blockedKeys = ['text', 'content', 'email', 'url', 'path'];
        for (const key of Object.keys(cleanParams)) {
            if (blockedKeys.some(bk => key.toLowerCase().includes(bk))) {
                delete cleanParams[key];
            }
        }
        
        // Basic payload
        const payload = {
            client_id: this.clientId,
            events: [{
                name: eventName,
                params: {
                    ...cleanParams,
                    session_id: this.sessionId,
                    engagement_time_msec: 100
                }
            }]
        };

        // Fire and forget (Measurement protocol)
        // Note: In real prod, this requires API Secret for some streams, or just Measurement ID for web.
        // For Extension, usually just query params: ?measurement_id=ID&api_secret=SECRET
        const url = `${GA_ENDPOINT}?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`;
        
        try {
            await fetch(url, {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        } catch (e) {
            // Ignore analytics errors
        }
    }
}

export const analytics = new AnalyticsService();

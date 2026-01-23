

const ENABLE_AUTH_FEATURE = false; // Feature Flag: Set to true when Auth is ready for release

export class AuthService {
    constructor() {
        this.token = null;
        this.user = null;
        this.onAuthStateChanged = null;
        this.authEnabled = this.checkAuthConfiguration();
    }

    checkAuthConfiguration() {
        if (!ENABLE_AUTH_FEATURE) return false;

        const manifest = chrome.runtime.getManifest();
        const clientId = manifest.oauth2?.client_id;
        // If missing or placeholder, disable auth features
        if (!clientId || clientId === '<YOUR_CLIENT_ID>') {
            console.log("[AuthService] Auth disabled: No valid Client ID found.");
            return false;
        }
        return true;
    }

    async init() {
        if (!this.authEnabled) {
            this.notify(); // Notify immediately so UI knows we are "ready" (bypassed)
            return;
        }

        // Attempt strict silence check
        try {
            const token = await this.getToken(false);
            if (token) {
                this.token = token;
                await this.fetchUserInfo();
            }
        } catch (e) { 
            // Not signed in
        }
        this.notify();
    }

    async signIn() {
        if (!this.authEnabled) return true; // Bypass

        try {
            this.token = await this.getToken(true);
            await this.fetchUserInfo();
            this.notify();
            return true;
        } catch (e) {
            console.error("Sign in failed", e);
            return false;
        }
    }

    async signOut() {
        if (!this.authEnabled) return;

        if (this.token) {
            await new Promise(resolve => {
                chrome.identity.removeCachedAuthToken({ token: this.token }, resolve);
            });
        }
        this.token = null;
        this.user = null;
        this.notify();
    }

    getToken(interactive) {
        return new Promise((resolve, reject) => {
            chrome.identity.getAuthToken({ interactive }, (token) => {
                if (chrome.runtime.lastError || !token) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(token);
                }
            });
        });
    }

    async fetchUserInfo() {
        if (!this.token) return;
        const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: {
                'Authorization': `Bearer ${this.token}`
            }
        });
        if (response.ok) {
            this.user = await response.json();
        }
    }

    notify() {
        if (this.onAuthStateChanged) {
            this.onAuthStateChanged({
                user: this.user,
                authEnabled: this.authEnabled
            });
        }
    }

    isAuthenticated() {
        if (!this.authEnabled) return true; // Always "authed" if disabled
        return !!this.token;
    }
}

export const authService = new AuthService();


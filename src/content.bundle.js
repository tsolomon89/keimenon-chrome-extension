"use strict";
(() => {
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __commonJS = (cb, mod) => function __require() {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  };

  // src/shared/hash.js
  async function generateMessageHash(normalizedText) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedText);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hashHex.substring(0, 16);
  }
  function generateOccurrenceKey(hash, index) {
    return `${hash}_${index}`;
  }
  var init_hash = __esm({
    "src/shared/hash.js"() {
      "use strict";
    }
  });

  // src/shared/normalize.js
  function normalizeText(rawText) {
    if (!rawText) return "";
    let normalized = rawText.replace(/\u00A0/g, " ");
    normalized = normalized.replace(/\r\n/g, "\n");
    normalized = normalized.trim();
    return normalized;
  }
  var init_normalize = __esm({
    "src/shared/normalize.js"() {
      "use strict";
    }
  });

  // src/shared/dom.js
  function findScrollContainer(context = document) {
    const candidates = context.querySelectorAll('div[class*="react-scroll-to-bottom"]');
    for (const c of candidates) {
      if (c.scrollHeight > c.clientHeight) return c;
    }
    const generic = context.querySelectorAll(".overflow-y-auto");
    for (const g of generic) {
      if (g.scrollHeight > g.clientHeight && g.innerText.length > 200) {
        return g;
      }
    }
    const scrollers = context.querySelectorAll('[class*="scroller"], [class*="ChatMessageList"]');
    for (const s of scrollers) {
      if (s.scrollHeight > s.clientHeight) return s;
    }
    return context.querySelector("main") || context.documentElement;
  }
  var init_dom = __esm({
    "src/shared/dom.js"() {
      "use strict";
      init_normalize();
    }
  });

  // src/shared/observer.js
  function createDebouncedObserver(target, callback, options = { childList: true, subtree: true }, delayMs = 1e3) {
    let timeoutId;
    const debouncedCallback = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        callback();
      }, delayMs);
    };
    const observer = new MutationObserver((mutations) => {
      let shouldTrigger = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0 || mutation.type === "characterData") {
          shouldTrigger = true;
          break;
        }
      }
      if (shouldTrigger) {
        debouncedCallback();
      }
    });
    observer.observe(target, options);
    return observer;
  }
  var init_observer = __esm({
    "src/shared/observer.js"() {
      "use strict";
    }
  });

  // src/shared/scroller.js
  async function scrollUpRecursively(scrollContainer, options) {
    const stepPx = options.stepPx || 500;
    const sleepMs = options.sleepMs || 800;
    const maxNoChange = options.maxNoChange || 5;
    let noChangeCount = 0;
    let lastScrollHeight = scrollContainer.scrollHeight;
    let safetyLimit = 100;
    while (!options.shouldStop() && noChangeCount < maxNoChange && safetyLimit > 0) {
      safetyLimit--;
      if (scrollContainer.scrollTop > 0) {
        scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - stepPx);
      }
      await new Promise((r) => setTimeout(r, sleepMs));
      const newScrollHeight = scrollContainer.scrollHeight;
      if (Math.abs(newScrollHeight - lastScrollHeight) < 10) {
        noChangeCount++;
      } else {
        noChangeCount = 0;
        lastScrollHeight = newScrollHeight;
      }
      if (scrollContainer.scrollTop <= 50) {
        await new Promise((r) => setTimeout(r, 1e3));
        if (scrollContainer.scrollTop <= 50 && Math.abs(scrollContainer.scrollHeight - lastScrollHeight) < 10) {
          break;
        }
      }
    }
  }
  var init_scroller = __esm({
    "src/shared/scroller.js"() {
      "use strict";
    }
  });

  // src/adapters/BaseAdapter.js
  var BaseAdapter;
  var init_BaseAdapter = __esm({
    "src/adapters/BaseAdapter.js"() {
      "use strict";
      init_hash();
      init_dom();
      init_observer();
      init_scroller();
      BaseAdapter = class {
        /**
         * @param {string} name - The unique name of the platform (e.g., 'chatgpt').
         * @param {Document|Element} context - The context to scan (defaults to document).
         */
        constructor(name, context = document) {
          this.name = name;
          this.context = context;
          this.observer = null;
          this.isScanning = false;
          this.nodeCache = /* @__PURE__ */ new WeakMap();
        }
        /**
         * Checks if the current URL is supported by this adapter.
         * @abstract
         * @param {string} url 
         * @returns {boolean}
         */
        isSupportedLocation(url) {
          throw new Error("isSupportedLocation must be implemented by subclass");
        }
        /**
         * @abstract
         * @returns {Promise<Array<import('../shared/types').Message>>}
         */
        async runOnce() {
          throw new Error("runOnce must be implemented by subclass");
        }
        /**
         * Checks if the current page is an active chat interface.
         * Used to differentiate "Home Screen" from "Chat Screen".
         * @abstract
         * @returns {Promise<boolean>|boolean}
         */
        isChatPage() {
          return true;
        }
        /**
         * Waits for the chat interface to be fully loaded (e.g. input box visible).
         * @returns {Promise<boolean>}
         */
        async waitForReady() {
          return true;
        }
        /**
         * Waits for a specific condition or selector to be present.
         * @param {string|Function} selectorOrFn - CSS selector or predicate function
         * @param {number} timeout - ms
         * @returns {Promise<boolean>}
         */
        async waitForContent(selectorOrFn, timeout = 5e3) {
          return new Promise((resolve) => {
            const check = () => {
              if (typeof selectorOrFn === "string") {
                if (this.context.querySelector(selectorOrFn)) return true;
              } else {
                if (selectorOrFn()) return true;
              }
              return false;
            };
            if (check()) return resolve(true);
            const observer = new MutationObserver(() => {
              if (check()) {
                observer.disconnect();
                resolve(true);
              }
            });
            observer.observe(this.context.body || this.context.documentElement, {
              childList: true,
              subtree: true
            });
            setTimeout(() => {
              observer.disconnect();
              resolve(false);
            }, timeout);
          });
        }
        /**
         * Shared helper to resolve message hash from cache or generate new one.
         * @param {Element} node 
         * @param {string} text 
         * @returns {Promise<string>}
         */
        async getMessageHash(node, text) {
          const cached = this.nodeCache.get(node);
          if (cached && cached.text === text) {
            return cached.hash;
          }
          const hash = await generateMessageHash(text);
          this.nodeCache.set(node, { text, hash });
          return hash;
        }
        /**
         * Generates a unique ID for a message based on its hash and occurrence index.
         * @param {Map<string, number>} occurrenceMap 
         * @param {string} hash 
         * @returns {string}
         */
        getUniqueId(occurrenceMap, hash) {
          const occurrenceIndex = occurrenceMap.get(hash) || 0;
          occurrenceMap.set(hash, occurrenceIndex + 1);
          return generateOccurrenceKey(hash, occurrenceIndex);
        }
        /**
         * Sets up a debounced observer on the scroll container.
         * @param {Function} callback 
         */
        observe(callback) {
          if (this.observer) return;
          const target = this.getScrollContainer() || this.context.querySelector("main") || this.context.body;
          console.log(`[Keimenon] ${this.name}Adapter.observe starting on target:`, target);
          this.observer = createDebouncedObserver(target, callback);
          if (typeof callback === "function") callback();
        }
        /**
         * Cleans up the observer.
         */
        disconnect() {
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
          this.isScanning = false;
        }
        /**
         * Performs a full history scan by scrolling up.
         * @param {Object} options 
         */
        async scanFullChat(options) {
          if (this.isScanning) return;
          this.isScanning = true;
          const scrollContainer = this.getScrollContainer();
          if (!scrollContainer) {
            console.warn(`Keimenon: Could not find scroll container for ${this.name}.`);
            this.isScanning = false;
            return;
          }
          try {
            await scrollUpRecursively(scrollContainer, {
              shouldStop: options.shouldStop
            });
          } finally {
            this.isScanning = false;
          }
        }
        /**
         * Helper to find the scroll container.
         * can be overridden if a platform needs specific logic.
         * @returns {Element|null}
         */
        getScrollContainer() {
          return findScrollContainer(this.context);
        }
      };
    }
  });

  // src/shared/extraction.js
  function extractMessageContent(root, options = {}) {
    if (!root) return "";
    const excludeSelectors = options.excludeSelectors || /* @__PURE__ */ new Set();
    let buffer = "";
    function append(str) {
      buffer += str;
    }
    function ensureNewline(count = 1) {
      let currentNewlines = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        if (buffer[i] === "\n") currentNewlines++;
        else break;
      }
      const needed = count - currentNewlines;
      if (needed > 0) {
        buffer += "\n".repeat(needed);
      }
    }
    function walk(node, context = {}) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        let val = node.nodeValue;
        if (context.isPre) {
          append(val);
          return;
        }
        val = val.replace(/[\r\n]+/g, " ");
        append(val);
        return;
      }
      if (node.nodeType === Node.ELEMENT_NODE) {
        for (const selector of excludeSelectors) {
          if (node.matches && node.matches(selector)) return;
        }
        const tagName = node.tagName.toLowerCase();
        if (node.classList && node.classList.contains("katex-html")) {
          return;
        }
        if (tagName === "math" || node.classList && node.classList.contains("katex")) {
          const annotation = node.querySelector("annotation");
          if (annotation) {
            const isDisplay = node.getAttribute("display") === "block" || node.classList && node.classList.contains("katex-display") || node.parentNode && node.parentNode.classList && node.parentNode.classList.contains("katex-display") || node.parentNode && node.parentNode.classList && node.parentNode.classList.contains("math-display");
            const tex = annotation.textContent.trim();
            if (isDisplay) {
              ensureNewline(2);
              append("$$" + tex + "$$");
              ensureNewline(2);
            } else {
              append("$" + tex + "$");
            }
            return;
          }
        }
        if (tagName === "script" && node.type && node.type.includes("math/tex")) {
          const tex = node.textContent;
          const isDisplay = node.type.includes("mode=display");
          if (isDisplay) {
            ensureNewline(2);
            append("$$" + tex + "$$");
            ensureNewline(2);
          } else {
            append("$" + tex + "$");
          }
          return;
        }
        if (tagName === "br") {
          append("\n");
          return;
        }
        if (["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName)) {
          ensureNewline(2);
          const level = parseInt(tagName.substring(1));
          append("#".repeat(level) + " ");
        }
        if (tagName === "p" || tagName === "div") {
          const isFirstInLi = context.inLi && !context.hasContentInLi;
          if (!isFirstInLi && buffer.length > 0) {
            ensureNewline(1);
          }
        }
        if (tagName === "ul" || tagName === "ol") {
          ensureNewline(2);
        }
        if (tagName === "li") {
          ensureNewline(1);
          const depth = context.listDepth || 0;
          const indent = "  ".repeat(depth);
          let marker = "*";
          if (node.parentNode && node.parentNode.tagName.toLowerCase() === "ol") {
            let index = 1;
            let sibling = node.previousElementSibling;
            while (sibling) {
              if (sibling.tagName.toLowerCase() === "li") {
                index++;
              }
              sibling = sibling.previousElementSibling;
            }
            const startAttr = node.parentNode.getAttribute("start");
            if (startAttr) {
              const startVal = parseInt(startAttr, 10);
              if (!isNaN(startVal)) {
                index += startVal - 1;
              }
            }
            marker = `${index}.`;
          }
          append(`${indent}${marker} `);
        }
        if (tagName === "pre") {
          ensureNewline(2);
          let lang = "";
          const codeChild = node.querySelector("code");
          if (codeChild) {
            for (const cls of codeChild.classList) {
              if (cls.startsWith("language-") || cls.startsWith("lang-")) {
                lang = cls.replace(/^(language-|lang-)/, "");
                break;
              }
            }
          }
          append("```" + lang);
          ensureNewline(1);
        }
        const isInlineCode = tagName === "code" && !context.isPre && node.parentNode.tagName.toLowerCase() !== "pre";
        if (isInlineCode) {
          append("`");
        }
        const isBold = tagName === "b" || tagName === "strong";
        const isItalic = tagName === "i" || tagName === "em";
        if (isBold) append("**");
        if (isItalic) append("*");
        if (tagName === "blockquote") {
          ensureNewline(2);
          append("> ");
        }
        if (tagName === "a") {
          append("[");
        }
        const newContext = { ...context };
        if (tagName === "ul" || tagName === "ol") {
          newContext.listDepth = (newContext.listDepth || 0) + 1;
        }
        if (tagName === "pre") {
          newContext.isPre = true;
        }
        if (tagName === "li") {
          newContext.inLi = true;
          newContext.hasContentInLi = false;
        }
        if (tagName === "p" || tagName === "div") {
        }
        let child = node.firstChild;
        while (child) {
          walk(child, newContext);
          if (context.inLi) {
            context.hasContentInLi = true;
          }
          child = child.nextSibling;
        }
        if (tagName === "a") {
          const href = node.getAttribute("href") || "";
          append(`](${href})`);
        }
        if (isBold) append("**");
        if (isItalic) append("*");
        if (isInlineCode) append("`");
        if (tagName === "pre") {
          ensureNewline(1);
          append("```");
          ensureNewline(2);
        }
      }
    }
    walk(root);
    return buffer.trim();
  }
  var init_extraction = __esm({
    "src/shared/extraction.js"() {
      "use strict";
    }
  });

  // src/adapters/ChatGPTAdapter.js
  var ChatGPTAdapter;
  var init_ChatGPTAdapter = __esm({
    "src/adapters/ChatGPTAdapter.js"() {
      "use strict";
      init_BaseAdapter();
      init_dom();
      init_extraction();
      ChatGPTAdapter = class extends BaseAdapter {
        constructor(context = document) {
          super("chatgpt", context);
        }
        isSupportedLocation(url) {
          if (!url.includes("chatgpt.com") && !url.includes("chat.openai.com")) {
            return false;
          }
          try {
            const urlObj = new URL(url);
            if (urlObj.pathname === "/" || urlObj.pathname === "") {
              return false;
            }
            return urlObj.pathname.startsWith("/c/") || urlObj.pathname.startsWith("/g/") || urlObj.pathname.startsWith("/share/") || urlObj.pathname.startsWith("/chat");
          } catch (e) {
            return false;
          }
        }
        getConversationId(url) {
          const match = url.match(/\/c\/([a-f0-9-]+)/);
          return match ? match[1] : null;
        }
        isChatPage() {
          return true;
        }
        async waitForReady() {
          return this.waitForContent(() => {
            return !!(this.context.getElementById("prompt-textarea") || this.context.querySelector("[data-message-author-role]") || this.context.querySelector('[data-testid^="conversation-turn-"]') || this.context.querySelector("form textarea"));
          }, 1e4);
        }
        async runOnce() {
          const messages = [];
          const conversationId = this.context.location ? this.getConversationId(this.context.location.href) : "mock-conversation";
          let nodes = Array.from(this.context.querySelectorAll("[data-message-author-role]"));
          if (nodes.length === 0) {
            nodes = Array.from(this.context.querySelectorAll('.text-message, .message-content, [class*="conversation-turn"]'));
            if (nodes.length > 0) {
              console.log("[Keimenon] Found nodes via fallback selectors:", nodes.length);
            }
          }
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of nodes.entries()) {
            const rawText = extractMessageContent(node);
            const text = normalizeText(rawText);
            if (!text) continue;
            const hash = await this.getMessageHash(node, text);
            const role = node.getAttribute("data-message-author-role");
            let author = "assistant";
            if (role === "user") {
              author = "user";
            } else if (!role) {
              if (node.querySelector(".font-user-message") || node.matches(".font-user-message")) {
                author = "user";
              }
            }
            const id = this.getUniqueId(occurrenceMap, hash);
            messages.push({
              id,
              platform: "chatgpt",
              conversationId,
              index,
              text,
              charCount: text.length,
              capturedAt: Date.now(),
              author
            });
          }
          return messages;
        }
      };
    }
  });

  // src/adapters/ClaudeAdapter.js
  var ClaudeAdapter;
  var init_ClaudeAdapter = __esm({
    "src/adapters/ClaudeAdapter.js"() {
      "use strict";
      init_BaseAdapter();
      init_dom();
      init_extraction();
      ClaudeAdapter = class extends BaseAdapter {
        constructor(context = document) {
          super("claude", context);
        }
        isSupportedLocation(url) {
          return url.includes("claude.ai/chat/");
        }
        getConversationId(url) {
          const match = url.match(/\/chat\/([a-f0-9-]+)/);
          return match ? match[1] : null;
        }
        isChatPage() {
          return true;
        }
        async waitForReady() {
          return this.waitForContent('div[contenteditable="true"]');
        }
        async runOnce() {
          const messages = [];
          const conversationId = this.getConversationId(window.location.href) || "unknown";
          const selectorString = [
            ".font-user-message",
            ".\\!font-user-message",
            '[data-testid="user-message"]',
            ".font-claude-response",
            '[data-testid="claude-message"]',
            "[data-message-author]"
          ].join(", ");
          const nodes = Array.from(this.context.querySelectorAll(selectorString));
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of nodes.entries()) {
            let text;
            const rawText = extractMessageContent(node, {
              excludeSelectors: /* @__PURE__ */ new Set([".font-ui"])
            });
            text = normalizeText(rawText);
            if (!text) continue;
            const hash = await this.getMessageHash(node, text);
            let author = "assistant";
            if (node.getAttribute("data-message-author") === "user" || node.classList.contains("font-user-message") || node.classList.contains("!font-user-message") || node.matches('[data-testid="user-message"]')) {
              author = "user";
            } else if (node.classList.contains("font-claude-response")) {
              author = "assistant";
            }
            const id = this.getUniqueId(occurrenceMap, hash);
            messages.push({
              id,
              platform: "claude",
              conversationId,
              index,
              text,
              charCount: text.length,
              capturedAt: Date.now(),
              author
            });
          }
          return messages;
        }
      };
    }
  });

  // src/adapters/GrokAdapter.js
  var GrokAdapter;
  var init_GrokAdapter = __esm({
    "src/adapters/GrokAdapter.js"() {
      "use strict";
      init_BaseAdapter();
      init_dom();
      init_extraction();
      GrokAdapter = class extends BaseAdapter {
        constructor(context = document) {
          super("grok", context);
        }
        isSupportedLocation(url) {
          return url.includes("grok.com");
        }
        getConversationId(url) {
          const chatMatch = url.match(/\/c\/([a-zA-Z0-9-]+)/);
          if (chatMatch) return chatMatch[1];
          const projectChatMatch = url.match(/[?&]chat=([a-zA-Z0-9-]+)/);
          if (projectChatMatch) return projectChatMatch[1];
          return "current-session";
        }
        isChatPage() {
          return true;
        }
        async waitForReady() {
          return this.waitForContent("textarea");
        }
        async runOnce() {
          const messages = [];
          const conversationId = this.getConversationId(window.location.href);
          const bubbles = Array.from(this.context.querySelectorAll(".message-bubble"));
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of bubbles.entries()) {
            const markdownContainer = node.querySelector(".response-content-markdown");
            let text = "";
            if (markdownContainer) {
              text = normalizeText(extractMessageContent(markdownContainer));
            } else {
              text = normalizeText(extractMessageContent(node));
            }
            if (!text) continue;
            const hash = await this.getMessageHash(node, text);
            const author = node.classList.contains("bg-surface-l1") ? "user" : "assistant";
            const id = this.getUniqueId(occurrenceMap, hash);
            messages.push({
              id,
              platform: "grok",
              conversationId,
              index,
              text,
              charCount: text.length,
              capturedAt: Date.now(),
              author
            });
          }
          return messages;
        }
      };
    }
  });

  // src/adapters/GeminiAdapter.js
  var GeminiAdapter;
  var init_GeminiAdapter = __esm({
    "src/adapters/GeminiAdapter.js"() {
      "use strict";
      init_BaseAdapter();
      init_dom();
      init_extraction();
      GeminiAdapter = class extends BaseAdapter {
        constructor(context = document) {
          super("gemini", context);
        }
        isSupportedLocation(url) {
          return url.includes("gemini.google.com/app/");
        }
        getConversationId(url) {
          const match = url.match(/\/app\/([a-zA-Z0-9-]+)/);
          return match ? match[1] : "current-session";
        }
        isChatPage() {
          if (this.context.location.href.endsWith("/app") || this.context.location.href.endsWith("/app/")) {
            return false;
          }
          return true;
        }
        async waitForReady() {
          return this.waitForContent('.rich-textarea, [role="textbox"]');
        }
        async runOnce() {
          const messages = [];
          const conversationId = this.getConversationId(window.location.href);
          let nodes = [];
          const allNodes = this.context.querySelectorAll(
            'structured-content-container.model-response-text, .user-query, .model-response, .query-text, .response-text, [data-test-id="user-message"], [data-test-id="model-message"]'
          );
          if (allNodes.length > 0) {
            nodes = Array.from(allNodes).filter((node) => {
              for (const other of allNodes) {
                if (other !== node && other.contains(node)) {
                  return false;
                }
              }
              return true;
            });
          } else {
            nodes = Array.from(this.context.querySelectorAll("[data-message-id]"));
          }
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of nodes.entries()) {
            const rawText = extractMessageContent(node);
            const text = normalizeText(rawText);
            if (!text) continue;
            const hash = await this.getMessageHash(node, text);
            let author = "assistant";
            if (node.classList.contains("user-query") || node.classList.contains("query-text") || node.matches('[data-test-id="user-message"]') || node.getAttribute("data-is-user") === "true") {
              author = "user";
            }
            if (node.tagName.toLowerCase() === "structured-content-container" || node.tagName.toLowerCase() === "message-content" || node.classList.contains("model-response-text") || node.classList.contains("model-response") || node.classList.contains("response-text") || node.matches('[data-test-id="model-message"]')) {
              author = "assistant";
            }
            const id = this.getUniqueId(occurrenceMap, hash);
            messages.push({
              id,
              platform: "gemini",
              conversationId,
              index,
              text,
              charCount: text.length,
              capturedAt: Date.now(),
              author
            });
          }
          return messages;
        }
      };
    }
  });

  // src/adapters/AdapterFactory.js
  var AdapterFactory;
  var init_AdapterFactory = __esm({
    "src/adapters/AdapterFactory.js"() {
      "use strict";
      init_ChatGPTAdapter();
      init_ClaudeAdapter();
      init_GrokAdapter();
      init_GeminiAdapter();
      AdapterFactory = class {
        static createAdapter(url) {
          if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
            return new ChatGPTAdapter();
          }
          if (url.includes("claude.ai")) {
            return new ClaudeAdapter();
          }
          if (url.includes("grok.com")) {
            return new GrokAdapter();
          }
          if (url.includes("gemini.google.com")) {
            return new GeminiAdapter();
          }
          return null;
        }
      };
    }
  });

  // src/content.js
  var require_content = __commonJS({
    "src/content.js"() {
      init_AdapterFactory();
      var activePort = null;
      var adapter = null;
      var isScanning = false;
      var scanController = null;
      function init() {
        adapter = AdapterFactory.createAdapter(window.location.href);
        if (!adapter) console.log("[Keimenon] No adapter for this page.");
        else console.log(`[Keimenon] Initialized adapter: ${adapter.name}`);
        chrome.runtime.onConnect.addListener((port) => {
          if (port.name === "sidepanel-connection") {
            console.log("[Keimenon] Sidepanel connected.");
            handleNewConnection(port);
          }
        });
        let lastUrl = window.location.href;
        setInterval(() => {
          const currentUrl = window.location.href;
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            handleNavigation();
          }
        }, 1e3);
        const bodyObserver = new MutationObserver(() => {
          const currentUrl = window.location.href;
          if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            handleNavigation();
          }
        });
        bodyObserver.observe(document.body, { childList: true });
      }
      function handleNavigation() {
        const currentUrl = window.location.href;
        const newAdapter = AdapterFactory.createAdapter(currentUrl);
        if (adapter && newAdapter && adapter.name === newAdapter.name) {
          if (adapter.isSupportedLocation(currentUrl)) {
            console.log("[Keimenon] SPA Navigation within same platform.");
            lastMessages = [];
            if (adapter.disconnect) adapter.disconnect();
            if (activePort) startSession();
          } else {
            console.log("[Keimenon] Navigated to unsupported area of same platform.");
            if (adapter.disconnect) adapter.disconnect();
            if (activePort) {
              activePort.postMessage({
                action: "EXTENSION_READY",
                meta: { adapter: adapter.name, status: "idle" }
              });
            }
          }
        } else if (newAdapter) {
          console.log(`[Keimenon] Platform switched to ${newAdapter.name}`);
          if (adapter && adapter.disconnect) adapter.disconnect();
          lastMessages = [];
          adapter = newAdapter;
          if (activePort) startSession();
        } else {
          console.log("[Keimenon] Navigated to unsupported platform.");
          if (adapter && adapter.disconnect) adapter.disconnect();
          adapter = null;
          if (activePort) {
            activePort.postMessage({
              action: "EXTENSION_READY",
              meta: { adapter: "none", status: "idle" }
            });
          }
        }
      }
      function handleNewConnection(port) {
        if (activePort) {
          activePort.disconnect();
          cleanupSession();
        }
        activePort = port;
        if (adapter && adapter.isSupportedLocation(window.location.href)) {
          startSession();
        } else {
          console.log("[Keimenon] Connected but idle (Home Page or Unsupported View).");
          port.postMessage({
            action: "EXTENSION_READY",
            meta: { adapter: adapter ? adapter.name : "none", capabilities: {}, status: "idle" }
          });
        }
        port.onDisconnect.addListener(() => {
          console.log("[Keimenon] Sidepanel disconnected.");
          cleanupSession();
          activePort = null;
        });
        port.onMessage.addListener((msg) => {
          if (msg.action === "GET_MESSAGES") {
            extractAndSend();
          } else if (msg.action === "SCAN_FULL_CHAT") {
            startScan();
          } else if (msg.action === "STOP_SCAN") {
            stopScan();
          } else if (msg.action === "PING") {
            port.postMessage({ status: "pong" });
          }
        });
      }
      var isStartupPhase = false;
      var startupRetries = 0;
      var MAX_STARTUP_RETRIES = 30;
      function startSession() {
        if (!adapter) return;
        console.log("[Keimenon] Starting observation session.");
        if (activePort) {
          activePort.postMessage({
            action: "EXTENSION_READY",
            meta: {
              adapter: adapter.name,
              capabilities: {
                scan: typeof adapter.scanFullChat === "function"
              }
            }
          });
        }
        isStartupPhase = true;
        startupRetries = 0;
        attemptStartupExtraction();
        adapter.observe(() => {
          extractAndSend(true);
        });
      }
      async function attemptStartupExtraction() {
        if (!adapter || !activePort) return;
        if (!isStartupPhase) return;
        const isChat = await Promise.resolve(adapter.isChatPage());
        if (!isChat) {
          console.log("[Keimenon] Not a chat page (Home/Other). Sending IDLE.");
          isStartupPhase = false;
          activePort.postMessage({
            action: "EXTENSION_READY",
            meta: { adapter: adapter.name, status: "idle" }
          });
          return;
        }
        const isReady = await adapter.waitForReady();
        if (!isReady) {
          console.log("[Keimenon] Timed out waiting for chat interface ready state.");
        }
        const messages = await adapter.runOnce();
        if (messages.length > 0) {
          console.log("[Keimenon] Startup success: found messages.");
          isStartupPhase = false;
          sendMessagesParams(messages);
        } else {
          if (startupRetries >= MAX_STARTUP_RETRIES) {
            console.log("[Keimenon] Startup exhausted (Time limit). Sending empty state.");
            isStartupPhase = false;
            sendMessagesParams([]);
          } else {
            const waitTime = 500;
            console.log(`[Keimenon] Startup retry ${startupRetries + 1}/${MAX_STARTUP_RETRIES} (Messages: 0)... waiting ${waitTime}ms`);
            startupRetries++;
            setTimeout(attemptStartupExtraction, waitTime);
          }
        }
      }
      function cleanupSession() {
        console.log("[Keimenon] Cleaning up session.");
        if (adapter) {
          adapter.disconnect();
        }
        if (extractTimeout) clearTimeout(extractTimeout);
        isScanning = false;
        isStartupPhase = false;
        stopScan();
      }
      var extractTimeout;
      var lastMessages = [];
      async function extractAndSend(fromObserver = false) {
        if (!adapter || !activePort) return;
        if (extractTimeout) clearTimeout(extractTimeout);
        extractTimeout = setTimeout(async () => {
          const messages = await adapter.runOnce();
          if (messages.length > 0 && isStartupPhase) {
            isStartupPhase = false;
          }
          if (isStartupPhase && messages.length === 0) {
            return;
          }
          sendMessagesParams(messages);
        }, 200);
      }
      function sendMessagesParams(messages) {
        if (!activePort) return;
        try {
          let isAppendOnly = false;
          let delta = [];
          if (messages.length > lastMessages.length && lastMessages.length > 0) {
            const prefixLength = lastMessages.length;
            const prefixMatch = lastMessages.every((m, i) => m.id === messages[i].id);
            if (prefixMatch) {
              isAppendOnly = true;
              delta = messages.slice(prefixLength);
            }
          }
          if (isAppendOnly && delta.length > 0) {
            activePort.postMessage({
              action: "MESSAGES_APPEND",
              payload: { messages: delta },
              meta: {
                count: messages.length,
                adapter: adapter.name,
                capabilities: {
                  scan: typeof adapter.scanFullChat === "function"
                }
              }
            });
          } else {
            activePort.postMessage({
              action: "MESSAGES_UPDATED",
              payload: { messages },
              meta: {
                count: messages.length,
                adapter: adapter.name,
                capabilities: {
                  scan: typeof adapter.scanFullChat === "function"
                }
              }
            });
          }
          lastMessages = messages;
        } catch (e) {
          console.warn("[Keimenon] Failed to post message (disconnected?)");
          cleanupSession();
        }
      }
      async function startScan() {
        if (!adapter || typeof adapter.scanFullChat !== "function") return;
        if (isScanning) return;
        isScanning = true;
        let shouldStop = false;
        scanController = {
          stop: () => {
            shouldStop = true;
          }
        };
        try {
          if (activePort) activePort.postMessage({ action: "SCAN_STARTED" });
          await adapter.scanFullChat({
            onProgress: (count) => {
            },
            shouldStop: () => shouldStop
          });
        } catch (err) {
          console.error("Scan failed", err);
        } finally {
          isScanning = false;
          scanController = null;
          extractAndSend();
          if (activePort) activePort.postMessage({ action: "SCAN_COMPLETE" });
        }
      }
      function stopScan() {
        if (scanController) {
          scanController.stop();
        }
      }
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
      } else {
        init();
      }
    }
  });
  require_content();
})();

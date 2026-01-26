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

  // src/adapters/ChatGPTAdapter.js
  var ChatGPTAdapter;
  var init_ChatGPTAdapter = __esm({
    "src/adapters/ChatGPTAdapter.js"() {
      "use strict";
      init_hash();
      init_dom();
      init_observer();
      init_scroller();
      ChatGPTAdapter = class {
        constructor(context = document) {
          this.name = "chatgpt";
          this.observer = null;
          this.isScanning = false;
          this.context = context;
        }
        isSupportedLocation(url) {
          return url.includes("chatgpt.com/c/") || url.includes("chat.openai.com/c/");
        }
        getConversationId(url) {
          const match = url.match(/\/c\/([a-f0-9-]+)/);
          return match ? match[1] : null;
        }
        async runOnce() {
          const messages = [];
          const conversationId = this.context.location ? this.getConversationId(this.context.location.href) : "mock-conversation";
          let nodes = Array.from(this.context.querySelectorAll("[data-message-author-role]"));
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of nodes.entries()) {
            const rawText = node.innerText || node.textContent;
            const text = normalizeText(rawText);
            if (!text) continue;
            const role = node.getAttribute("data-message-author-role");
            const author = role === "user" ? "user" : "assistant";
            const hash = await generateMessageHash(text);
            const occurrenceIndex = occurrenceMap.get(hash) || 0;
            occurrenceMap.set(hash, occurrenceIndex + 1);
            const id = generateOccurrenceKey(hash, occurrenceIndex);
            messages.push({
              id,
              platform: "chatgpt",
              conversationId,
              index,
              // Keep global index for sorting/ordering if needed
              text,
              charCount: text.length,
              capturedAt: Date.now(),
              author
            });
          }
          return messages;
        }
        observe(callback) {
          if (this.observer) return;
          const target = this.findScrollContainer() || this.context.querySelector("main") || this.context.body;
          this.observer = createDebouncedObserver(target, callback);
        }
        disconnect() {
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
          this.isScanning = false;
        }
        async scanFullChat(options) {
          if (this.isScanning) return;
          this.isScanning = true;
          const scrollContainer = findScrollContainer(this.context);
          if (!scrollContainer) {
            console.warn("Keimenon: Could not find scroll container for ChatGPT.");
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
      };
    }
  });

  // src/adapters/ClaudeAdapter.js
  var ClaudeAdapter;
  var init_ClaudeAdapter = __esm({
    "src/adapters/ClaudeAdapter.js"() {
      "use strict";
      init_hash();
      init_dom();
      init_observer();
      init_scroller();
      ClaudeAdapter = class {
        constructor() {
          this.name = "claude";
          this.observer = null;
          this.isScanning = false;
        }
        isSupportedLocation(url) {
          return url.includes("claude.ai/chat/");
        }
        getConversationId(url) {
          const match = url.match(/\/chat\/([a-f0-9-]+)/);
          return match ? match[1] : null;
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
          const nodes = document.querySelectorAll(selectorString);
          const messageNodes = Array.from(nodes);
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of messageNodes.entries()) {
            const clone = node.cloneNode(true);
            const thinkingBlocks = clone.querySelectorAll(".font-ui");
            thinkingBlocks.forEach((block) => block.remove());
            const rawText = clone.innerText || clone.textContent;
            const text = normalizeText(rawText);
            if (!text) continue;
            let author = "assistant";
            if (node.getAttribute("data-message-author") === "user" || node.classList.contains("font-user-message") || node.classList.contains("!font-user-message") || node.matches('[data-testid="user-message"]')) {
              author = "user";
            } else if (node.classList.contains("font-claude-response")) {
              author = "assistant";
            }
            const hash = await generateMessageHash(text);
            const occurrenceIndex = occurrenceMap.get(hash) || 0;
            occurrenceMap.set(hash, occurrenceIndex + 1);
            const id = generateOccurrenceKey(hash, occurrenceIndex);
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
        observe(callback) {
          if (this.observer) return;
          const target = this.findScrollContainer() || document.querySelector('[class*="ChatMessageList"], [class*="scroller"]') || document.body;
          this.observer = createDebouncedObserver(target, callback);
        }
        async scanFullChat(options) {
          if (this.isScanning) return;
          this.isScanning = true;
          const scrollContainer = findScrollContainer(document);
          if (!scrollContainer) {
            console.warn("Keimenon: Could not find scroll container for Claude.");
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
        disconnect() {
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
          this.isScanning = false;
        }
      };
    }
  });

  // src/adapters/GrokAdapter.js
  var GrokAdapter;
  var init_GrokAdapter = __esm({
    "src/adapters/GrokAdapter.js"() {
      "use strict";
      init_hash();
      init_dom();
      init_observer();
      init_scroller();
      GrokAdapter = class {
        constructor() {
          this.name = "grok";
          this.observer = null;
          this.isScanning = false;
        }
        isSupportedLocation(url) {
          return url.includes("grok.com/c/") || url.includes("x.com/i/grok");
        }
        getConversationId(url) {
          const match = url.match(/\/chat\/([a-zA-Z0-9-]+)/);
          if (match) return match[1];
          return "current-session";
        }
        async runOnce() {
          const messages = [];
          const conversationId = this.getConversationId(window.location.href);
          const bubbles = Array.from(document.querySelectorAll(".message-bubble"));
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of bubbles.entries()) {
            const markdownContainer = node.querySelector(".response-content-markdown");
            let text = "";
            if (markdownContainer) {
              text = normalizeText(markdownContainer.innerText);
            } else {
              text = normalizeText(node.innerText);
            }
            if (!text) continue;
            const author = node.classList.contains("bg-surface-l1") ? "user" : "assistant";
            const hash = await generateMessageHash(text);
            const occurrenceIndex = occurrenceMap.get(hash) || 0;
            occurrenceMap.set(hash, occurrenceIndex + 1);
            const id = generateOccurrenceKey(hash, occurrenceIndex);
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
        observe(callback) {
          if (this.observer) return;
          const target = findScrollContainer(document) || document.querySelector("main") || document.body;
          this.observer = createDebouncedObserver(target, callback);
        }
        async scanFullChat(options) {
          if (this.isScanning) return;
          this.isScanning = true;
          const scrollContainer = findScrollContainer(document);
          try {
            await scrollUpRecursively(scrollContainer, {
              shouldStop: options.shouldStop
            });
          } finally {
            this.isScanning = false;
          }
        }
        disconnect() {
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
          this.isScanning = false;
        }
      };
    }
  });

  // src/adapters/GeminiAdapter.js
  var GeminiAdapter;
  var init_GeminiAdapter = __esm({
    "src/adapters/GeminiAdapter.js"() {
      "use strict";
      init_hash();
      init_dom();
      init_observer();
      init_scroller();
      GeminiAdapter = class {
        constructor() {
          this.name = "gemini";
          this.observer = null;
          this.isScanning = false;
        }
        isSupportedLocation(url) {
          return url.includes("gemini.google.com/app/");
        }
        getConversationId(url) {
          const match = url.match(/\/app\/([a-zA-Z0-9-]+)/);
          return match ? match[1] : "current-session";
        }
        async runOnce() {
          const messages = [];
          const conversationId = this.getConversationId(window.location.href);
          let nodes = [];
          const allNodes = document.querySelectorAll(
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
            nodes = Array.from(document.querySelectorAll("[data-message-id]"));
          }
          const occurrenceMap = /* @__PURE__ */ new Map();
          for (const [index, node] of nodes.entries()) {
            const rawText = node.innerText || node.textContent;
            const text = normalizeText(rawText);
            if (!text) continue;
            let author = "assistant";
            if (node.classList.contains("user-query") || node.classList.contains("query-text") || node.matches('[data-test-id="user-message"]') || node.getAttribute("data-is-user") === "true") {
              author = "user";
            }
            if (node.tagName.toLowerCase() === "structured-content-container" || node.tagName.toLowerCase() === "message-content" || node.classList.contains("model-response-text") || node.classList.contains("model-response") || node.classList.contains("response-text") || node.matches('[data-test-id="model-message"]')) {
              author = "assistant";
            }
            const hash = await generateMessageHash(text);
            const occurrenceIndex = occurrenceMap.get(hash) || 0;
            occurrenceMap.set(hash, occurrenceIndex + 1);
            const id = generateOccurrenceKey(hash, occurrenceIndex);
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
        observe(callback) {
          if (this.observer) return;
          const target = findScrollContainer(document) || document.querySelector("main") || document.body;
          this.observer = createDebouncedObserver(target, callback);
        }
        async scanFullChat(options) {
          if (this.isScanning) return;
          this.isScanning = true;
          const scrollContainer = findScrollContainer(document);
          try {
            await scrollUpRecursively(scrollContainer, {
              shouldStop: options.shouldStop
            });
          } finally {
            this.isScanning = false;
          }
        }
        disconnect() {
          if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
          }
          this.isScanning = false;
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
          if (url.includes("x.com/i/grok") || url.includes("grok.com")) {
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
        if (!adapter) return console.log("[Keimenon] No adapter for this page.");
        console.log(`[Keimenon] Initialized adapter: ${adapter.name}`);
        chrome.runtime.onConnect.addListener((port) => {
          if (port.name === "sidepanel-connection") {
            console.log("[Keimenon] Sidepanel connected.");
            handleNewConnection(port);
          }
        });
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
            meta: { adapter: adapter.name, capabilities: {}, status: "idle" }
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
        extractAndSend();
        adapter.observe(() => {
          extractAndSend();
        });
      }
      function cleanupSession() {
        console.log("[Keimenon] Cleaning up session.");
        if (adapter) {
          adapter.disconnect();
        }
        if (extractTimeout) clearTimeout(extractTimeout);
        isScanning = false;
        stopScan();
      }
      var extractTimeout;
      var lastMessages = [];
      async function extractAndSend() {
        if (!adapter || !activePort) return;
        if (extractTimeout) clearTimeout(extractTimeout);
        extractTimeout = setTimeout(async () => {
          const messages = await adapter.runOnce();
          if (activePort) {
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
        }, 200);
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

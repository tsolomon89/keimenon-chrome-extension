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

  // src/adapters/ChatGPTAdapter.js
  var ChatGPTAdapter;
  var init_ChatGPTAdapter = __esm({
    "src/adapters/ChatGPTAdapter.js"() {
      "use strict";
      init_hash();
      init_normalize();
      ChatGPTAdapter = class {
        constructor() {
          this.name = "chatgpt";
          this.observer = null;
          this.isScanning = false;
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
          const conversationId = this.getConversationId(window.location.href) || "unknown";
          let nodes = Array.from(document.querySelectorAll('[data-message-author-role="user"]'));
          for (const [index, node] of nodes.entries()) {
            const rawText = node.innerText || node.textContent;
            const text = normalizeText(rawText);
            if (!text) continue;
            const hash = await generateMessageHash(text);
            const id = generateOccurrenceKey(hash, index);
            messages.push({
              id,
              platform: "chatgpt",
              conversationId,
              index,
              text,
              charCount: text.length,
              capturedAt: Date.now(),
              author: "user"
            });
          }
          return messages;
        }
        observe(callback) {
          if (this.observer) return;
          const target = document.querySelector("main") || document.body;
          this.observer = new MutationObserver((mutations) => {
            let shouldTrigger = false;
            for (const mutation of mutations) {
              if (mutation.addedNodes.length > 0) {
                shouldTrigger = true;
                break;
              }
            }
            if (shouldTrigger) {
              callback();
            }
          });
          this.observer.observe(target, { childList: true, subtree: true });
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
          const scrollContainer = this.findScrollContainer();
          if (!scrollContainer) {
            console.warn("Keimenon: Could not find scroll container for ChatGPT.");
            this.isScanning = false;
            return;
          }
          let noChangeCount = 0;
          let lastScrollHeight = scrollContainer.scrollHeight;
          try {
            while (!options.shouldStop() && noChangeCount < 5) {
              scrollContainer.scrollTop -= 500;
              await new Promise((r) => setTimeout(r, 800));
              const newScrollHeight = scrollContainer.scrollHeight;
              if (Math.abs(newScrollHeight - lastScrollHeight) < 10) {
                noChangeCount++;
              } else {
                noChangeCount = 0;
                lastScrollHeight = newScrollHeight;
              }
              if (scrollContainer.scrollTop === 0) {
                await new Promise((r) => setTimeout(r, 1e3));
                if (scrollContainer.scrollTop === 0 && scrollContainer.scrollHeight === lastScrollHeight) {
                  break;
                }
              }
            }
          } finally {
            this.isScanning = false;
          }
        }
        findScrollContainer() {
          const candidates = document.querySelectorAll('div[class*="react-scroll-to-bottom"]');
          for (const c of candidates) {
            if (c.scrollHeight > c.clientHeight) return c;
          }
          const generic = document.querySelectorAll(".overflow-y-auto");
          for (const g of generic) {
            if (g.scrollHeight > g.clientHeight && g.innerText.length > 500) {
              return g;
            }
          }
          return document.querySelector("main") || document.documentElement;
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
      init_normalize();
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
          const userMessageNodes = Array.from(document.querySelectorAll(".font-user-message"));
          for (const [index, node] of userMessageNodes.entries()) {
            const rawText = node.innerText || node.textContent;
            const text = normalizeText(rawText);
            if (!text) continue;
            const hash = await generateMessageHash(text);
            const id = generateOccurrenceKey(hash, index);
            messages.push({
              id,
              platform: "claude",
              conversationId,
              index,
              text,
              charCount: text.length,
              capturedAt: Date.now(),
              author: "user"
            });
          }
          return messages;
        }
        observe(callback) {
          if (this.observer) return;
          const target = document.querySelector('[class*="ChatMessageList"], [class*="scroller"]') || document.body;
          this.observer = new MutationObserver((mutations) => {
            callback();
          });
          this.observer.observe(target, { childList: true, subtree: true });
        }
        async scanFullChat(options) {
          if (this.isScanning) return;
          this.isScanning = true;
          const scrollContainer = this.findScrollContainer();
          if (!scrollContainer) {
            console.warn("Keimenon: Could not find scroll container for Claude.");
            this.isScanning = false;
            return;
          }
          let noChangeCount = 0;
          let lastScrollHeight = scrollContainer.scrollHeight;
          try {
            while (!options.shouldStop() && noChangeCount < 5) {
              scrollContainer.scrollTop -= 500;
              await new Promise((r) => setTimeout(r, 800));
              const newScrollHeight = scrollContainer.scrollHeight;
              if (Math.abs(newScrollHeight - lastScrollHeight) < 10) {
                noChangeCount++;
              } else {
                noChangeCount = 0;
                lastScrollHeight = newScrollHeight;
              }
              if (scrollContainer.scrollTop === 0) {
                await new Promise((r) => setTimeout(r, 1e3));
                if (scrollContainer.scrollTop === 0 && scrollContainer.scrollHeight === lastScrollHeight) {
                  break;
                }
              }
            }
          } finally {
            this.isScanning = false;
          }
        }
        findScrollContainer() {
          return document.querySelector('.overflow-y-auto[class*="flex-1"]') || document.documentElement;
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
      AdapterFactory = class {
        static createAdapter(url) {
          if (url.includes("chatgpt.com") || url.includes("chat.openai.com")) {
            return new ChatGPTAdapter();
          }
          if (url.includes("claude.ai")) {
            return new ClaudeAdapter();
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
      var adapter = null;
      var isScanning = false;
      var scanController = null;
      async function init() {
        adapter = AdapterFactory.createAdapter(window.location.href);
        if (!adapter) {
          return;
        }
        console.log(`[Keimenon] Initialized adapter: ${adapter.name}`);
        chrome.runtime.sendMessage({
          action: "EXTENSION_READY",
          meta: {
            adapter: adapter.name,
            capabilities: {
              scan: typeof adapter.scanFullChat === "function"
            }
          }
        }).catch(() => {
        });
        await extractAndSend();
        adapter.observe(() => {
          extractAndSend();
        });
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
          if (request.action === "GET_MESSAGES") {
            extractAndSend();
            sendResponse({ status: "ok" });
          } else if (request.action === "SCAN_FULL_CHAT") {
            startScan();
            sendResponse({ status: "started" });
          } else if (request.action === "STOP_SCAN") {
            stopScan();
            sendResponse({ status: "stopped" });
          } else if (request.action === "PING") {
            sendResponse({ status: "pong", adapter: adapter?.name });
          }
        });
      }
      var extractTimeout;
      async function extractAndSend() {
        if (!adapter) return;
        if (extractTimeout) clearTimeout(extractTimeout);
        extractTimeout = setTimeout(async () => {
          const messages = await adapter.runOnce();
          chrome.runtime.sendMessage({
            action: "MESSAGES_UPDATED",
            payload: { messages },
            meta: {
              count: messages.length,
              adapter: adapter.name,
              capabilities: {
                scan: typeof adapter.scanFullChat === "function"
              }
            }
          }).catch(() => {
          });
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
          chrome.runtime.sendMessage({ action: "SCAN_COMPLETE" }).catch(() => {
          });
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

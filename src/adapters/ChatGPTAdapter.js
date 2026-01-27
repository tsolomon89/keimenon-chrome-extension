import { BaseAdapter } from './BaseAdapter.js';
import { normalizeText, findScrollContainer } from '../shared/dom.js';
import { extractMessageContent } from '../shared/extraction.js';

/**
 * @implements {import('../shared/types').PlatformAdapter}
 */
export class ChatGPTAdapter extends BaseAdapter {
  constructor(context = document) {
    super('chatgpt', context);
  }

  isSupportedLocation(url) {
    // Only support actual chat pages, not the home page
    // Matches:
    // - https://chatgpt.com/c/... (Conversation)
    // - https://chatgpt.com/g/... (GPTs - often behave like chats)
    // - https://chatgpt.com/share/... (Shared links - read only but scannable)
    // - https://chat.openai.com/... (Legacy)
    if (!url.includes('chatgpt.com') && !url.includes('chat.openai.com')) {
        return false;
    }
    
    // Explicitly exclude home page root or simple non-chat paths
    try {
        const urlObj = new URL(url);
        if (urlObj.pathname === '/' || urlObj.pathname === '') {
            return false;
        }
        return (
            urlObj.pathname.startsWith('/c/') || 
            urlObj.pathname.startsWith('/g/') || 
            urlObj.pathname.startsWith('/share/') ||
            urlObj.pathname.startsWith('/chat') 
        );
    } catch (e) {
        return false;
    }
  }

  getConversationId(url) {
    const match = url.match(/\/c\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  async runOnce() {
    const messages = [];
    const conversationId = this.context.location ? this.getConversationId(this.context.location.href) : 'mock-conversation';
    
    // Primary selector
    let nodes = Array.from(this.context.querySelectorAll('[data-message-author-role]'));
    
    // Fallback
    if (nodes.length === 0) {
        nodes = Array.from(this.context.querySelectorAll('.text-message, .message-content, [class*="conversation-turn"]'));
        if (nodes.length > 0) {
            console.log('[Keimenon] Found nodes via fallback selectors:', nodes.length);
        }
    }
    
    const occurrenceMap = new Map();
    
    for (const [index, node] of nodes.entries()) {
        const rawText = extractMessageContent(node);
        const text = normalizeText(rawText);
        if (!text) continue;

        const hash = await this.getMessageHash(node, text);
        const role = node.getAttribute('data-message-author-role');
        let author = 'assistant';
        
        if (role === 'user') {
            author = 'user';
        } else if (!role) {
             // Heuristic for fallback selectors
             if (node.querySelector('.font-user-message') || node.matches('.font-user-message')) {
                 author = 'user';
             }
        }
        
        const id = this.getUniqueId(occurrenceMap, hash);
        
        messages.push({
            id,
            platform: 'chatgpt',
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
}

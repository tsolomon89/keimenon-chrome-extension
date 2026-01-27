
/**
 * Extracts text from a DOM node with special handling for:
 * 1. KaTeX Math (extracts the original TeX source from MathML annotation)
 * 2. MathJax (extracts source)
 * 3. Markdown structure reconstruction (Headers, Lists, Code Blocks, Emphasis)
 * 4. Block elements (ensuring proper newlines)
 * 5. Skipping UI artifacts
 * 
 * @param {Node} root - The root node to extract from.
 * @param {Object} options
 * @param {Set<string>} [options.excludeSelectors] - CSS selectors for elements to skip (e.g. '.font-ui')
 * @returns {string} The extracted text.
 */
export function extractMessageContent(root, options = {}) {
    if (!root) return '';
    
    // Config
    const excludeSelectors = options.excludeSelectors || new Set();
    
    let buffer = '';
    
    // Helper to append text
    function append(str) {
        buffer += str;
    }

    // Helper to insure we are on a new line (used before headers, lists, etc)
    function ensureNewline(count = 1) {
        let currentNewlines = 0;
        for (let i = buffer.length - 1; i >= 0; i--) {
            if (buffer[i] === '\n') currentNewlines++;
            else break;
        }
        
        const needed = count - currentNewlines;
        if (needed > 0) {
            buffer += '\n'.repeat(needed);
        }
    }

    function walk(node, context = {}) {
        if (!node) return;

        // TEXT NODE
        if (node.nodeType === Node.TEXT_NODE) {
            let val = node.nodeValue;
            
            // If inside a pre/code block, preserve exact whitespace
            if (context.isPre) {
                append(val);
                return;
            }

            // Normal text
            // Collapse whitespace but respect leading/trailing only if significant?
            // Actually, for markdown, we generally want single spaces.
            val = val.replace(/[\r\n]+/g, ' ');
            
            // If we just emitted a list marker, we don't want to accidentally trim leading space if it matters,
            // but we DO want to ensure we don't double space.
            // Simplified: just append. 
            append(val);
            return;
        }

        // ELEMENT NODE
        if (node.nodeType === Node.ELEMENT_NODE) {
            // 1. Check exclusions
            for (const selector of excludeSelectors) {
                if (node.matches && node.matches(selector)) return;
            }

            const tagName = node.tagName.toLowerCase();

            // 2. Special Leaf Handlers
            
            // KaTeX
            if (node.classList.contains('katex')) {
                const annotation = node.querySelector('annotation[encoding="application/x-tex"]');
                if (annotation) {
                    const isDisplay = node.classList.contains('katex-display') || 
                                      (node.parentNode && node.parentNode.classList.contains('katex-display'));
                    const tex = annotation.textContent;
                    if (isDisplay) {
                        ensureNewline(2);
                        append('$$' + tex + '$$');
                        ensureNewline(2);
                    } else {
                        append('$' + tex + '$');
                    }
                    return; 
                }
            }

            // MathJax
            if (tagName === 'script' && node.type && node.type.includes('math/tex')) {
                const tex = node.textContent;
                const isDisplay = node.type.includes('mode=display');
                if (isDisplay) {
                    ensureNewline(2);
                    append('$$' + tex + '$$');
                    ensureNewline(2);
                } else {
                    append('$' + tex + '$');
                }
                return;
            }
            
            // BR
            if (tagName === 'br') {
                append('\n');
                return;
            }

            // 3. MarkDown Structure Handlers

            // Headers
            if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                ensureNewline(2);
                const level = parseInt(tagName.substring(1));
                append('#'.repeat(level) + ' ');
            }
            
            // Paragraphs / Divs (Structural)
            if (tagName === 'p' || tagName === 'div') {
                 // Special case: If we are inside an LI and we are the FIRST element, 
                 // we should NOT force a newline, or else we break the bullet line.
                 // Example: <li><p>Text</p></li> -> * Text (Good) vs * \n Text (Bad)
                 const isFirstInLi = context.inLi && !context.hasContentInLi;
                 
                 if (!isFirstInLi && buffer.length > 0) {
                     ensureNewline(1);
                 }
            }

            // Lists
            if (tagName === 'ul' || tagName === 'ol') {
                ensureNewline(2);
            }
            
            if (tagName === 'li') {
                ensureNewline(1);
                // Determine indent based on depth
                const depth = (context.listDepth || 0);
                const indent = '  '.repeat(depth);
                
                // Determine marker
                let marker = '*';
                if (node.parentNode && node.parentNode.tagName.toLowerCase() === 'ol') {
                     // Calculate index among list items
                     let index = 1;
                     let sibling = node.previousElementSibling;
                     while (sibling) {
                         if (sibling.tagName.toLowerCase() === 'li') {
                             index++;
                         }
                         sibling = sibling.previousElementSibling;
                     }
                     
                     // Check for 'start' attribute on OL
                     const startAttr = node.parentNode.getAttribute('start');
                     if (startAttr) {
                         const startVal = parseInt(startAttr, 10);
                         if (!isNaN(startVal)) {
                             // Adjust index based on start value
                             // index is 1-based count of previous LIs + 1. 
                             // if start is 5, first item (index 1) should be 5.
                             // so add (start - 1)
                             index += (startVal - 1);
                         }
                     }
                     
                     marker = `${index}.`; 
                }
                
                append(`${indent}${marker} `);
            }

            // Code Blocks
            if (tagName === 'pre') {
                ensureNewline(2);
                let lang = '';
                const codeChild = node.querySelector('code');
                if (codeChild) {
                    for (const cls of codeChild.classList) {
                        if (cls.startsWith('language-') || cls.startsWith('lang-')) {
                            lang = cls.replace(/^(language-|lang-)/, '');
                            break;
                        }
                    }
                }
                append('```' + lang);
                ensureNewline(1);
            }

            // Inline Code
            const isInlineCode = tagName === 'code' && !context.isPre && node.parentNode.tagName.toLowerCase() !== 'pre';
            if (isInlineCode) {
                append('`');
            }

            // Emphasis
            const isBold = tagName === 'b' || tagName === 'strong';
            const isItalic = tagName === 'i' || tagName === 'em';
            
            if (isBold) append('**');
            if (isItalic) append('*');

            // Blockquote
            if (tagName === 'blockquote') {
                 ensureNewline(2);
                 append('> ');
            }
            
            // Link
            if (tagName === 'a') {
                append('[');
            }

            // --- RECURSE ---
            
            const newContext = { ...context };
            if (tagName === 'ul' || tagName === 'ol') {
                newContext.listDepth = (newContext.listDepth || 0) + 1;
            }
            if (tagName === 'pre') {
                newContext.isPre = true;
            }
            if (tagName === 'li') {
                newContext.inLi = true;
                newContext.hasContentInLi = false;
            }
            if (tagName === 'p' || tagName === 'div') {
                 // If we were inside an LI, we are now "deeper", so we don't want 
                 // subsequent siblings in the LI to think they are first.
                 // But actually, we need to update hasContentInLi for the PARENT context. 
                 // Context is copied, so we can't update parent.
                 // We can use a shared object or just check previous siblings?
                 // Checking previous siblings is expensive. 
                 // Let's rely on the fact that if we hit a p/div, we process it.
            }

            let child = node.firstChild;
            while (child) {
                walk(child, newContext);
                
                // If we processed a child, we likely added content.
                if (context.inLi) {
                     // We can't update context boolean easily for siblings in this recursion style 
                     // without a mutable object.
                     // Hack: check if buffer length changed?
                     context.hasContentInLi = true; 
                }
                
                child = child.nextSibling;
            }
            
            // --- AFTER ---

            if (tagName === 'a') {
                const href = node.getAttribute('href') || '';
                append(`](${href})`);
            }

            if (isBold) append('**');
            if (isItalic) append('*');
            if (isInlineCode) append('`');
            
            if (tagName === 'pre') {
                ensureNewline(1);
                append('```');
                ensureNewline(2);
            }
        }
    }

    walk(root);
    return buffer.trim();
}


export function filterMessages(messages, query, minLen) {
    const q = (query || '').toLowerCase();
    const len = parseInt(minLen) || 0;
    
    return messages.filter(m => {
        if (m.text.length < len) return false;
        if (q && !m.text.toLowerCase().includes(q)) return false;
        return true;
    });
}

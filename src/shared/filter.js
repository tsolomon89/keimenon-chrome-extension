
export function filterMessages(messages, query, minLen, maxLen) {
    const q = (query || '').toLowerCase();
    const min = parseInt(minLen) || 0;
    const max = parseInt(maxLen) || 0;
    
    return messages.filter(m => {
        if (m.text.length < min) return false;
        if (max > 0 && m.text.length > max) return false;
        if (q && !m.text.toLowerCase().includes(q)) return false;
        return true;
    });
}

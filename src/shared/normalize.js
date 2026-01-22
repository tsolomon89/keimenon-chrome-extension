
export function normalizeText(rawText) {
    if (!rawText) return '';
    let normalized = rawText.replace(/\u00A0/g, ' ');
    normalized = normalized.replace(/\r\n/g, '\n');
    normalized = normalized.trim();
    return normalized;
}

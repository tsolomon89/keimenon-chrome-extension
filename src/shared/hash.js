
export async function generateMessageHash(normalizedText) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalizedText);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 16);
}

export function generateOccurrenceKey(hash, index) {
    return `${hash}_${index}`;
}

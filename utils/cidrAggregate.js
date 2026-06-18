import { mergeCidr } from 'cidr-tools';
import { isValidCidr4, isValidCidr6 } from '../utils.js';

export function aggregateCidr4(items) {
    return mergeCidr(items.filter(isValidCidr4));
}

export function aggregateCidr6(items) {
    return mergeCidr(items.filter(isValidCidr6));
}

/** Extract first valid CIDR from an output line (strips comments). */
export function extractCidrFromLine(line) {
    const trimmed = line.split('#')[0].trim();
    if (!trimmed) return null;
    if (isValidCidr4(trimmed) || isValidCidr6(trimmed)) return trimmed;
    const token = trimmed.split(/\s+/)[0];
    if (isValidCidr4(token) || isValidCidr6(token)) return token;
    return null;
}

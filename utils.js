import { RecordType } from "./types.js";

export function isValidDomain(domain, logTag = null) {
    const tagPrefix = logTag ? `[${logTag}] ` : "";
    if (typeof domain !== "string") {
        console.error(`${tagPrefix}Not valid domain: ${domain}`);
        return false;
    }

    domain = domain.trim().toLowerCase();

    // базовая длина домена
    if (domain.length === 0 || domain.length > 253) {
        console.error(`${tagPrefix}Not valid domain: ${domain}`);
        return false;
    }

    // запрещённые символы (regex, wildcard, пробелы и т.п.)
    if (/[\*\+\?\(\)\[\]\{\}\|\^\$\\\/\s]/.test(domain)) {
        console.error(`${tagPrefix}Not valid domain: ${domain}`);
        return false;
    }

    // проверка структуры домена (поддержка Punycode xn--)
    const domainRegex =
        /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z0-9-]{2,63}$/;

    if (!domainRegex.test(domain)){
        console.error(`${tagPrefix}Not valid domain: ${domain}`);
        return false;
    }

    return true;
}

export function isValidIpv4(value) {
    if (typeof value !== "string") return false;
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(value.trim());
}

export function isValidIpv6(value) {
    if (typeof value !== "string") return false;
    // Basic IPv6 regex
    const ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    return ipv6Regex.test(value.trim());
}

export function isValidCidr4(value) {
    if (typeof value !== "string") return false;
    const parts = value.trim().split('/');
    if (parts.length !== 2) return false;
    const [ip, prefix] = parts;
    if (!/^\d+$/.test(prefix)) return false;
    const prefixNum = Number(prefix);
    return isValidIpv4(ip) && !isNaN(prefixNum) && prefixNum >= 0 && prefixNum <= 32;
}

export function isValidCidr6(value) {
    if (typeof value !== "string") return false;
    const parts = value.trim().split('/');
    if (parts.length !== 2) return false;
    const [ip, prefix] = parts;
    if (!/^\d+$/.test(prefix)) return false;
    const prefixNum = Number(prefix);
    return isValidIpv6(ip) && !isNaN(prefixNum) && prefixNum >= 0 && prefixNum <= 128;
}

/** @returns {string|null} Normalized ASN (e.g. AS15169) or null */
export function parseAsn(value) {
    if (typeof value !== "string") return null;

    const match = /^AS(\d+)$/i.exec(value.trim());
    if (!match) return null;

    const num = Number(match[1]);
    if (!Number.isInteger(num) || num < 1 || num > 4294967295) return null;

    return `AS${match[1]}`;
}

export function isValidAsn(value, logTag = null) {
    const valid = parseAsn(value) !== null;
    if (!valid) {
        const tagPrefix = logTag ? `[${logTag}] ` : "";
        console.error(`${tagPrefix}Not valid ASN: ${value}`);
    }
    return valid;
}

export function filterRecords(type, items, logTag = null) {
    if (!Array.isArray(items)) return [];
    
    switch (type) {
        case RecordType.DOMAIN:
            return items.filter(item => item && item.split('.').length > 1 && isValidDomain(item, logTag));
        case RecordType.IPV4:
            return items.filter(item => isValidIpv4(item));
        case RecordType.IPV6:
            return items.filter(item => isValidIpv6(item));
        case RecordType.CIDR4:
            return items.filter(item => isValidCidr4(item));
        case RecordType.CIDR6:
            return items.filter(item => isValidCidr6(item));
        default:
            return [];
    }
}

export function filterDomains(domains, logTag = null) {
    return filterRecords(RecordType.DOMAIN, domains, logTag);
}

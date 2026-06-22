import { RecordType } from '../../../types.js';

export function mihomoBehaviorForType(recordType) {
    switch (recordType) {
        case RecordType.DOMAIN:
            return 'domain';
        case RecordType.CIDR4:
        case RecordType.CIDR6:
        case RecordType.IPV4:
        case RecordType.IPV6:
            return 'ipcidr';
        default:
            return null;
    }
}

export function flattenBlocks(blocks) {
    const records = [];
    for (const block of blocks) {
        records.push(...block.records);
    }
    return records;
}

export function toMihomoIpcidrRecord(record, recordType) {
    if (recordType === RecordType.IPV4) {
        return `${record}/32`;
    }
    if (recordType === RecordType.IPV6) {
        return `${record}/128`;
    }
    return record;
}

export function buildSingBoxRule(records, recordType, options) {
    const includeSubdomains = options.domainIncludeSubdomains !== false;

    if (recordType === RecordType.DOMAIN) {
        const rule = {};
        const domains = [];
        const suffixes = [];

        for (const record of records) {
            domains.push(record);
            if (includeSubdomains) {
                suffixes.push(`.${record}`);
            }
        }

        if (domains.length > 0) {
            rule.domain = domains;
        }
        if (suffixes.length > 0) {
            rule.domain_suffix = suffixes;
        }

        return rule;
    }

    const ipCidr = records.map((record) => toMihomoIpcidrRecord(record, recordType));
    return { ip_cidr: ipCidr };
}

export function buildSingBoxRuleSet(records, recordType, options) {
    const version = options.rulesetVersion ?? 3;
    const rule = buildSingBoxRule(records, recordType, options);

    return {
        version,
        rules: [rule]
    };
}

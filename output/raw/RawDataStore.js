import fs from 'fs';
import path from 'path';
import { RecordType } from '../../types.js';
import { aggregateCidr4, aggregateCidr6 } from '../../utils/cidrAggregate.js';

const MANIFEST_FILE = '.raw_manifest';

export class RawDataStore {
    constructor(options = {}) {
        this.sectionDir = path.resolve(options.sectionDir);
        this.collapseCidr4 = options.collapseCidr4 === true;
        this.collapseCidr6 = options.collapseCidr6 === true;

        this.buffers = new Map();
        this.serviceOrder = [];
        this.serviceGroups = new Map();
        this.manifest = [];

        fs.mkdirSync(this.sectionDir, { recursive: true });
    }

    _key(service, type) {
        return `${service}:${type}`;
    }

    _trackService(service) {
        if (!this.serviceOrder.includes(service)) {
            this.serviceOrder.push(service);
        }
    }

    setServiceGroup(service, group) {
        if (group) {
            this.serviceGroups.set(service, group);
        }
    }

    append(service, record, type) {
        this._trackService(service);

        const key = this._key(service, type);
        if (!this.buffers.has(key)) {
            this.buffers.set(key, new Set());
        }
        this.buffers.get(key).add(record);
    }

    _normalizeRecords(service, type, records) {
        let normalized = [...records].sort();

        if (type === RecordType.CIDR4 && this.collapseCidr4) {
            const before = normalized.length;
            normalized = aggregateCidr4(normalized);
            if (before !== normalized.length) {
                console.log(`[raw] Collapsed ${service}/${type}: ${before} → ${normalized.length} prefixes`);
            }
        } else if (type === RecordType.CIDR6 && this.collapseCidr6) {
            const before = normalized.length;
            normalized = aggregateCidr6(normalized);
            if (before !== normalized.length) {
                console.log(`[raw] Collapsed ${service}/${type}: ${before} → ${normalized.length} prefixes`);
            }
        }

        return normalized;
    }

    _flush(service, type) {
        const key = this._key(service, type);
        const buffer = this.buffers.get(key);
        if (!buffer || buffer.size === 0) {
            return;
        }

        const records = this._normalizeRecords(service, type, buffer);
        const relativePath = path.join(type, `${service}.raw`).replace(/\\/g, '/');
        const fullPath = path.join(this.sectionDir, relativePath);

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, records.length ? records.join('\n') + '\n' : '');

        const entry = {
            recordType: type,
            service,
            path: relativePath,
            count: records.length
        };
        const group = this.serviceGroups.get(service);
        if (group) {
            entry.group = group;
        }
        this.manifest.push(entry);

        this.buffers.delete(key);
    }

    finalize() {
        for (const key of [...this.buffers.keys()]) {
            const sep = key.lastIndexOf(':');
            const service = key.slice(0, sep);
            const type = key.slice(sep + 1);
            this._flush(service, type);
        }

        const manifestPath = path.join(this.sectionDir, MANIFEST_FILE);
        fs.writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2) + '\n');
    }

    static readManifest(sectionDir) {
        const manifestPath = path.join(sectionDir, MANIFEST_FILE);
        if (!fs.existsSync(manifestPath)) {
            return [];
        }
        return JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
    }

    static isSectionCacheReady(sectionDir) {
        const manifest = RawDataStore.readManifest(sectionDir);
        if (manifest.length === 0) {
            return false;
        }

        for (const entry of manifest) {
            if (entry.count <= 0) {
                continue;
            }
            const filePath = path.join(sectionDir, entry.path);
            if (!fs.existsSync(filePath)) {
                return false;
            }
        }

        return true;
    }

    static serviceOrderFromManifest(sectionDir) {
        const order = [];
        for (const entry of RawDataStore.readManifest(sectionDir)) {
            if (!order.includes(entry.service)) {
                order.push(entry.service);
            }
        }
        return order;
    }
}

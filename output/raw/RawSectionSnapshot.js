import fs from 'fs';
import path from 'path';
import { RawDataStore } from './RawDataStore.js';

export class RawSectionSnapshot {
    constructor(sectionDir, serviceOrder, recordTypes) {
        this.sectionDir = path.resolve(sectionDir);
        this.serviceOrder = [...serviceOrder];
        this.recordTypes = [...recordTypes];
        this._manifest = null;
        this._cache = new Map();
        this._serviceGroups = null;
        this._groupOrder = null;
    }

    getManifest() {
        if (!this._manifest) {
            this._manifest = RawDataStore.readManifest(this.sectionDir);
        }
        return this._manifest;
    }

    _buildGroupIndex() {
        if (this._serviceGroups) {
            return;
        }

        this._serviceGroups = new Map();
        this._groupOrder = [];

        for (const service of this.serviceOrder) {
            const entry = this.getManifest().find((item) => item.service === service);
            const group = entry?.group;
            if (!group) {
                continue;
            }
            this._serviceGroups.set(service, group);
            if (!this._groupOrder.includes(group)) {
                this._groupOrder.push(group);
            }
        }
    }

    getServiceGroup(service) {
        this._buildGroupIndex();
        return this._serviceGroups.get(service) ?? null;
    }

    getGroupOrder() {
        this._buildGroupIndex();
        return [...this._groupOrder];
    }

    getServicesInGroup(group) {
        this._buildGroupIndex();
        return this.serviceOrder.filter((service) => this._serviceGroups.get(service) === group);
    }

    getUngroupedServices() {
        this._buildGroupIndex();
        return this.serviceOrder.filter((service) => !this._serviceGroups.has(service));
    }

    readRecords(service, type) {
        const cacheKey = `${service}:${type}`;
        if (this._cache.has(cacheKey)) {
            return this._cache.get(cacheKey);
        }

        const entry = this.getManifest().find(
            (item) => item.service === service && item.recordType === type
        );
        if (!entry || entry.count === 0) {
            this._cache.set(cacheKey, []);
            return [];
        }

        const fullPath = path.join(this.sectionDir, entry.path);
        const content = fs.readFileSync(fullPath, 'utf-8');
        const records = content.split('\n').filter((line) => line.length > 0);
        this._cache.set(cacheKey, records);
        return records;
    }
}

import fs from 'fs';
import path from 'path';
import { fetchUrlStringWithRetry } from './urls.js';
import { filterRecords } from './utils.js';
import { RecordType } from './types.js';

function toArray(value) {
    if (value == null) {
        return [];
    }
    return Array.isArray(value) ? value : [value];
}

export function normalizeAdditionalList(list) {
    if (Array.isArray(list)) {
        return { type: RecordType.DOMAIN, urls: list, files: [], entries: [] };
    }

    return {
        type: list.type || RecordType.DOMAIN,
        urls: list.urls || [],
        files: toArray(list.files ?? list.file),
        entries: toArray(list.entries ?? list.items ?? list.addresses)
    };
}

function parseListText(text) {
    return text
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'));
}

function resolveFilePath(filePath, configDir) {
    return path.isAbsolute(filePath) ? filePath : path.resolve(configDir, filePath);
}

export async function collectAdditionalLists(additionalLists, rawStore, { configDir }) {
    for (const serviceKey in additionalLists) {
        const { type, urls, files, entries } = normalizeAdditionalList(additionalLists[serviceKey]);
        const serviceName = `_${serviceKey}`;

        for (const url of urls) {
            try {
                const text = await fetchUrlStringWithRetry(url);
                const items = filterRecords(type, parseListText(text));

                for (const item of items) {
                    rawStore.append(serviceName, item, type);
                }
            } catch (err) {
                console.error(`Failed to fetch additional list from ${url}: ${err.message}`);
            }
        }

        for (const filePath of files) {
            const resolved = resolveFilePath(filePath, configDir);

            try {
                const text = fs.readFileSync(resolved, 'utf-8');
                const items = filterRecords(type, parseListText(text));

                for (const item of items) {
                    rawStore.append(serviceName, item, type);
                }
            } catch (err) {
                console.error(`Failed to read additional list from ${filePath}: ${err.message}`);
            }
        }

        if (entries.length > 0) {
            const items = filterRecords(
                type,
                entries.map((entry) => String(entry).trim()).filter(Boolean)
            );

            for (const item of items) {
                rawStore.append(serviceName, item, type);
            }
        }
    }
}

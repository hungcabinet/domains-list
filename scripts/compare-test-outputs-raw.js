import fs from 'fs';
import path from 'path';
import { RawDataStore } from '../output/raw/RawDataStore.js';

const RAW_DIR = path.resolve('.cache/raw');

function readRecordsFromFile(filePath) {
    if (!fs.existsSync(filePath)) {
        return [];
    }
    return fs
        .readFileSync(filePath, 'utf-8')
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
}

function collectLstRecords(dir) {
    const set = new Set();
    function walk(current) {
        if (!fs.existsSync(current)) return;
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) continue;
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                walk(full);
                continue;
            }
            if (!entry.name.endsWith('.lst')) continue;
            for (const line of readRecordsFromFile(full)) {
                if (!line.startsWith('#')) set.add(line);
            }
        }
    }
    walk(dir);
    return set;
}

function recordsFromRawSection(sectionDir, recordTypes) {
    const manifest = RawDataStore.readManifest(sectionDir);
    const byType = new Map(recordTypes.map((t) => [t, new Set()]));
    for (const entry of manifest) {
        if (!byType.has(entry.recordType)) continue;
        const fullPath = path.join(sectionDir, entry.path);
        for (const record of readRecordsFromFile(fullPath)) {
            byType.get(entry.recordType).add(record);
        }
    }
    return byType;
}

function diff(a, b) {
    return {
        onlyA: [...a].filter((x) => !b.has(x)),
        onlyB: [...b].filter((x) => !a.has(x))
    };
}

const cases = [
    {
        name: 'proxy (domain)',
        rawSection: '0-proxy',
        recordTypes: ['domain'],
        modes: {
            combined: 'data/test/combined/proxy',
            groups: 'data/test/groups/proxy',
            services: 'data/test/services/proxy'
        }
    },
    {
        name: 'russia (domain)',
        rawSection: '1-russia',
        recordTypes: ['domain'],
        modes: {
            combined: 'data/test/combined/russia',
            groups: 'data/test/groups/russia',
            services: 'data/test/services/russia'
        }
    },
    {
        name: 'social-ips + blocked-asn (cidr)',
        rawSections: ['2-social-ips', '3-blocked-asn'],
        recordTypes: ['cidr4', 'cidr6'],
        modes: {
            combined: 'data/test/combined/cidrs',
            groups: 'data/test/groups/cidrs',
            services: 'data/test/services/cidrs'
        }
    }
];

let allOk = true;

for (const testCase of cases) {
    console.log(`\n=== ${testCase.name} ===`);

    const rawByType = new Map(testCase.recordTypes.map((t) => [t, new Set()]));
    const sectionDirs = testCase.rawSections
        ? testCase.rawSections.map((s) => path.join(RAW_DIR, s))
        : [path.join(RAW_DIR, testCase.rawSection)];

    for (const sectionDir of sectionDirs) {
        const sectionRaw = recordsFromRawSection(sectionDir, testCase.recordTypes);
        for (const type of testCase.recordTypes) {
            for (const record of sectionRaw.get(type)) {
                rawByType.get(type).add(record);
            }
        }
    }

    const modeSets = {};
    for (const [mode, dirOrDirs] of Object.entries(testCase.modes)) {
        const dirs = Array.isArray(dirOrDirs) ? dirOrDirs : [dirOrDirs];
        const set = new Set();
        for (const dir of dirs) {
            for (const record of collectLstRecords(path.resolve(dir))) {
                set.add(record);
            }
        }
        modeSets[mode] = set;
    }

    for (const type of testCase.recordTypes) {
        const rawSet = rawByType.get(type);
        console.log(`\n  ${type}: raw unique=${rawSet.size}`);

        for (const [mode, set] of Object.entries(modeSets)) {
            const typePrefix = type === 'domain' ? null : type === 'cidr4' ? 'v4' : 'v6';
            // For cidr layout, all records in v4/v6 folders - mode set is combined layout
            // Filter by checking if record looks like v4 or v6
            const filtered = new Set(
                [...set].filter((r) => {
                    if (!typePrefix) return true;
                    const isV6 = r.includes(':');
                    return typePrefix === 'v6' ? isV6 : !isV6;
                })
            );
            const d = diff(rawSet, filtered);
            const ok = d.onlyA.length === 0 && d.onlyB.length === 0;
            if (!ok) allOk = false;
            console.log(
                `    ${mode}: ${filtered.size} ${ok ? 'OK' : 'MISMATCH'}`
                + (d.onlyA.length ? ` missing=${d.onlyA.length}` : '')
                + (d.onlyB.length ? ` extra=${d.onlyB.length}` : '')
            );
        }

        const gs = diff(
            new Set([...modeSets.groups].filter((r) => type !== 'domain' ? (type === 'cidr6' ? r.includes(':') : !r.includes(':')) : true)),
            new Set([...modeSets.services].filter((r) => type !== 'domain' ? (type === 'cidr6' ? r.includes(':') : !r.includes(':')) : true))
        );
        const modesOk = gs.onlyA.length === 0 && gs.onlyB.length === 0;
        if (!modesOk) allOk = false;
        console.log(`    groups vs services: ${modesOk ? 'OK' : 'MISMATCH'}`);
    }
}

console.log(allOk ? '\n✓ Raw ↔ output parity OK (groups = services).' : '\n✗ Mismatch found.');
process.exit(allOk ? 0 : 1);

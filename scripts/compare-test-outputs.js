import fs from 'fs';
import path from 'path';

const ROOT = path.resolve('data/test');

function collectRecords(dir) {
    const records = new Map();

    function walk(currentDir, relPrefix = '') {
        if (!fs.existsSync(currentDir)) {
            return;
        }
        for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
            if (entry.name.startsWith('.')) {
                continue;
            }
            const fullPath = path.join(currentDir, entry.name);
            const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                walk(fullPath, relPath);
                continue;
            }
            if (!entry.name.endsWith('.lst')) {
                continue;
            }
            const key = relPath.replace(/\\/g, '/');
            const lines = fs
                .readFileSync(fullPath, 'utf-8')
                .split('\n')
                .map((line) => line.trim())
                .filter((line) => line && !line.startsWith('#'));
            records.set(key, new Set(lines));
        }
    }

    walk(dir);
    return records;
}

function unionByLayout(files) {
    const byLayout = new Map();
    for (const [filePath, set] of files) {
        const layoutKey = filePath.includes('/')
            ? filePath.split('/').slice(0, -1).join('/')
            : '.';
        if (!byLayout.has(layoutKey)) {
            byLayout.set(layoutKey, new Set());
        }
        for (const record of set) {
            byLayout.get(layoutKey).add(record);
        }
    }
    return byLayout;
}

function diffSets(a, b) {
    const onlyA = [...a].filter((x) => !b.has(x));
    const onlyB = [...b].filter((x) => !a.has(x));
    return { onlyA, onlyB };
}

function compareMode(section, layoutKey, combined, groups, services) {
    const c = combined.get(layoutKey) ?? new Set();
    const g = groups.get(layoutKey) ?? new Set();
    const s = services.get(layoutKey) ?? new Set();

    const cg = diffSets(c, g);
    const cs = diffSets(c, s);
    const gs = diffSets(g, s);

    const ok = cg.onlyA.length === 0 && cg.onlyB.length === 0
        && cs.onlyA.length === 0 && cs.onlyB.length === 0
        && gs.onlyA.length === 0 && gs.onlyB.length === 0;

    return { section, layoutKey, combined: c.size, groups: g.size, services: s.size, ok, cg, cs, gs };
}

const sections = [
    { name: 'proxy', sub: 'proxy', layout: '.' },
    { name: 'russia', sub: 'russia', layout: '.' },
    { name: 'social-ips + blocked-asn', sub: 'cidrs', layouts: ['v4', 'v6'] }
];

let allOk = true;

for (const section of sections) {
    const combinedDir = path.join(ROOT, 'combined', section.sub);
    const groupsDir = path.join(ROOT, 'groups', section.sub);
    const servicesDir = path.join(ROOT, 'services', section.sub);

    const combinedFiles = collectRecords(combinedDir);
    const groupsFiles = collectRecords(groupsDir);
    const servicesFiles = collectRecords(servicesDir);

    const combinedUnion = unionByLayout(combinedFiles);
    const groupsUnion = unionByLayout(groupsFiles);
    const servicesUnion = unionByLayout(servicesFiles);

    const layouts = section.layouts ?? [section.layout];

    console.log(`\n=== ${section.name} ===`);

    for (const layoutKey of layouts) {
        const result = compareMode(section.name, layoutKey, combinedUnion, groupsUnion, servicesUnion);
        const status = result.ok ? 'OK' : 'MISMATCH';
        console.log(
            `[${status}] ${layoutKey}: combined=${result.combined}, groups=${result.groups}, services=${result.services}`
        );

        if (!result.ok) {
            allOk = false;
            for (const [label, diff] of [
                ['combined vs groups', result.cg],
                ['combined vs services', result.cs],
                ['groups vs services', result.gs]
            ]) {
                if (diff.onlyA.length || diff.onlyB.length) {
                    console.log(`  ${label}:`);
                    if (diff.onlyA.length) {
                        console.log(`    only in first (${diff.onlyA.length}): ${diff.onlyA.slice(0, 5).join(', ')}${diff.onlyA.length > 5 ? '…' : ''}`);
                    }
                    if (diff.onlyB.length) {
                        console.log(`    only in second (${diff.onlyB.length}): ${diff.onlyB.slice(0, 5).join(', ')}${diff.onlyB.length > 5 ? '…' : ''}`);
                    }
                }
            }
        }
    }

    console.log(`  files: combined=${combinedFiles.size}, groups=${groupsFiles.size}, services=${servicesFiles.size}`);
}

console.log(allOk ? '\n✓ All modes contain the same unique records per layout.' : '\n✗ Record mismatch detected.');
process.exit(allOk ? 0 : 1);

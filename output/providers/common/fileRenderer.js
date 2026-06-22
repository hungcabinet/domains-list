import path from 'path';
import { buildTemplates, PartitionWriter, writeBlocksWithWriter } from './partitionWriter.js';

const COMBINED_SERVICE = '_all_in_one';

function resolveLayout(options, type, layoutKey) {
    const layout = options[layoutKey] || options.outputLayout || { domain: '.' };
    return layout[type] || '.';
}

function resolveOutputDir(options) {
    return path.resolve(options.outputDir || './lists');
}

function collectGroupBlocks(raw, group, type) {
    const services = raw.getServicesInGroup(group);
    const seen = new Set();
    const blocks = [];

    for (const service of services) {
        const records = raw.readRecords(service, type);
        const uniqueRecords = [];

        for (const record of records) {
            if (seen.has(record)) {
                continue;
            }
            seen.add(record);
            uniqueRecords.push(record);
        }

        if (uniqueRecords.length === 0) {
            continue;
        }

        blocks.push({ service, records: uniqueRecords });
    }

    return blocks;
}

function collectCombinedBlocks(raw, type) {
    const seen = new Set();
    const blocks = [];

    for (const service of raw.serviceOrder) {
        const records = raw.readRecords(service, type);
        const uniqueRecords = [];

        for (const record of records) {
            if (seen.has(record)) {
                continue;
            }
            seen.add(record);
            uniqueRecords.push(record);
        }

        if (uniqueRecords.length === 0) {
            continue;
        }

        blocks.push({ service, records: uniqueRecords });
    }

    return blocks;
}

/**
 * @yields {{ fileName: string, type: string, blocks: { service: string, records: string[] }[] }}
 */
export function* iterOutputJobs(raw, options, context) {
    const recordTypes = context.recordTypes;
    const generateIndividual = options.generateIndividualFiles !== false;
    const generateCombined = options.generateCombinedFiles === true;
    const generateGroup = options.generateGroupFiles === true;

    for (const type of recordTypes) {
        if (generateIndividual) {
            for (const service of raw.serviceOrder) {
                const records = raw.readRecords(service, type);
                if (records.length === 0) {
                    continue;
                }
                yield { fileName: service, type, blocks: [{ service, records }] };
            }
        }

        if (generateGroup) {
            for (const group of raw.getGroupOrder()) {
                const blocks = collectGroupBlocks(raw, group, type);
                if (blocks.length === 0) {
                    continue;
                }
                yield { fileName: group, type, blocks };
            }

            if (!generateIndividual) {
                for (const service of raw.getUngroupedServices()) {
                    const records = raw.readRecords(service, type);
                    if (records.length === 0) {
                        continue;
                    }
                    yield { fileName: service, type, blocks: [{ service, records }] };
                }
            }
        }

        if (generateCombined) {
            const blocks = collectCombinedBlocks(raw, type);
            if (blocks.length === 0) {
                continue;
            }
            yield { fileName: COMBINED_SERVICE, type, blocks };
        }
    }
}

export function partitionBlocks(blocks, maxFileEntries) {
    if (maxFileEntries <= 0) {
        return [blocks];
    }

    const partitions = [];
    let current = [];
    let count = 0;

    for (const block of blocks) {
        let remaining = block.records;

        while (remaining.length > 0) {
            const space = maxFileEntries - count;
            if (space <= 0) {
                partitions.push(current);
                current = [];
                count = 0;
                continue;
            }

            const take = remaining.slice(0, space);
            remaining = remaining.slice(space);
            current.push({ service: block.service, records: take });
            count += take.length;

            if (count >= maxFileEntries) {
                partitions.push(current);
                current = [];
                count = 0;
            }
        }
    }

    if (current.length > 0) {
        partitions.push(current);
    }

    return partitions.length > 0 ? partitions : [];
}

/**
 * Writes line-based source files (text provider and mihomo intermediate).
 * @returns {{ fullPath: string, relativeName: string, type: string, baseName: string, partition: number }[]}
 */
export function writeLineSourceFiles(raw, options, context) {
    const outputDir = resolveOutputDir(options);
    const sourceLayoutKey = options.sourceLayout ? 'sourceLayout' : 'outputLayout';
    const fileExtension = options.sourceExtension ?? options.fileExtension ?? 'lst';
    const templates = buildTemplates(options);
    const writtenFiles = [];

    for (const job of iterOutputJobs(raw, options, context)) {
        const layout = resolveLayout(options, job.type, sourceLayoutKey);
        const writer = new PartitionWriter(
            outputDir,
            layout,
            fileExtension,
            job.fileName,
            job.type,
            templates,
            writtenFiles,
            options.maxFileEntries ?? -1
        );
        writeBlocksWithWriter(writer, job.blocks);
    }

    return writtenFiles;
}

/**
 * Text output provider render helper.
 */
export function renderTextFiles(raw, options, context) {
    const writtenFiles = writeLineSourceFiles(raw, options, context);
    return {
        outputDir: resolveOutputDir(options),
        generatedFiles: writtenFiles.map((file) => file.relativeName)
    };
}

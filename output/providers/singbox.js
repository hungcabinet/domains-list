import fs from 'fs';
import path from 'path';
import { iterOutputJobs, partitionBlocks } from './common/fileRenderer.js';
import { getFilePath } from './common/partitionWriter.js';
import { buildSingBoxRuleSet, flattenBlocks } from './common/rulesetFormats.js';
import { compileSrs, ensureCompiler, targetPathForSource, writeUtf8NoBom } from './common/compiler.js';

function resolveLayout(options, type) {
    const layoutKey = options.sourceLayout ? 'sourceLayout' : 'outputLayout';
    const layout = options[layoutKey] || options.outputLayout || { domain: '.' };
    return layout[type] || '.';
}

export async function init(options) {
    ensureCompiler('singbox', options);
}

/**
 * sing-box output provider — intermediate JSON source compiled to .srs via `sing-box rule-set compile`.
 */
export async function render(raw, options, context) {
    const renderOptions = {
        ...options,
        sourceExtension: options.sourceExtension ?? 'json',
        fileExtension: options.fileExtension ?? 'srs',
        rulesetVersion: options.rulesetVersion ?? 3
    };

    ensureCompiler('singbox', renderOptions);

    const outputDir = path.resolve(renderOptions.outputDir || './lists');
    const maxFileEntries = renderOptions.maxFileEntries ?? -1;
    const keepSourceFiles = renderOptions.keepSourceFiles === true;
    const sourceExtension = renderOptions.sourceExtension;
    const generatedFiles = [];

    for (const job of iterOutputJobs(raw, renderOptions, context)) {
        const layout = resolveLayout(renderOptions, job.type);
        const blockPartitions = partitionBlocks(job.blocks, maxFileEntries);

        for (let partitionIndex = 0; partitionIndex < blockPartitions.length; partitionIndex++) {
            const blocks = blockPartitions[partitionIndex];
            const records = flattenBlocks(blocks);
            if (records.length === 0) {
                continue;
            }

            const partition = blockPartitions.length > 1 ? partitionIndex : -1;
            const { fullPath, relativeName } = getFilePath(
                outputDir,
                layout,
                sourceExtension,
                job.fileName,
                partition
            );

            const ruleSet = buildSingBoxRuleSet(records, job.type, renderOptions);
            writeUtf8NoBom(fullPath, `${JSON.stringify(ruleSet, null, 2)}\n`);

            const sourceFile = {
                fullPath,
                relativeName,
                type: job.type,
                baseName: job.fileName,
                partition
            };

            const target = targetPathForSource(sourceFile, renderOptions);
            compileSrs(sourceFile.fullPath, target.fullPath, renderOptions);

            if (keepSourceFiles) {
                generatedFiles.push(sourceFile.relativeName);
            } else if (fs.existsSync(sourceFile.fullPath)) {
                fs.unlinkSync(sourceFile.fullPath);
            }

            generatedFiles.push(target.relativeName);
        }
    }

    return {
        outputDir,
        generatedFiles
    };
}

export default { id: 'singbox', init, render };

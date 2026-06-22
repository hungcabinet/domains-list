import fs from 'fs';
import path from 'path';
import { writeLineSourceFiles } from './common/fileRenderer.js';
import { compileMrs, ensureCompiler, targetPathForSource } from './common/compiler.js';
import { mihomoBehaviorForType } from './common/rulesetFormats.js';

export async function init(options) {
    ensureCompiler('mihomo', options);
}

/**
 * Mihomo output provider — intermediate text source compiled to .mrs via `mihomo convert-ruleset`.
 */
export async function render(raw, options, context) {
    const renderOptions = {
        ...options,
        sourceExtension: options.sourceExtension ?? 'txt',
        domainTemplate: options.domainTemplate ?? '+.{{record}}\n',
        cidr4Template: options.cidr4Template ?? '{{record}}\n',
        cidr6Template: options.cidr6Template ?? '{{record}}\n',
        ipv4Template: options.ipv4Template ?? '{{record}}/32\n',
        ipv6Template: options.ipv6Template ?? '{{record}}/128\n'
    };

    ensureCompiler('mihomo', renderOptions);

    const sourceFiles = writeLineSourceFiles(raw, renderOptions, context);
    const keepSourceFiles = renderOptions.keepSourceFiles === true;
    const generatedFiles = [];

    for (const sourceFile of sourceFiles) {
        const behavior = mihomoBehaviorForType(sourceFile.type);
        if (!behavior) {
            console.warn(`[mihomo] Skipping unsupported record type: ${sourceFile.type}`);
            if (fs.existsSync(sourceFile.fullPath)) {
                fs.unlinkSync(sourceFile.fullPath);
            }
            continue;
        }

        const target = targetPathForSource(sourceFile, renderOptions);
        compileMrs(behavior, sourceFile.fullPath, target.fullPath, renderOptions);

        if (keepSourceFiles) {
            generatedFiles.push(sourceFile.relativeName);
        } else if (fs.existsSync(sourceFile.fullPath)) {
            fs.unlinkSync(sourceFile.fullPath);
        }

        generatedFiles.push(target.relativeName);
    }

    return {
        outputDir: path.resolve(renderOptions.outputDir || './lists'),
        generatedFiles
    };
}

export default { id: 'mihomo', init, render };

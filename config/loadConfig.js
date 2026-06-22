import fs from 'fs';
import path from 'path';
import { RecordType } from '../types.js';

const TEXT_OUTPUT_DEFAULTS = {
    id: 'text',
    outputDir: './lists',
    outputLayout: { [RecordType.DOMAIN]: '.' },
    maxFileEntries: -1,
    generateIndividualFiles: true,
    generateGroupFiles: false,
    generateCombinedFiles: false,
    fileExtension: 'lst',
    domainTemplate: '{{record}}\n',
    ipv4Template: '{{record}}\n',
    ipv6Template: '{{record}}\n',
    cidr4Template: '{{record}}\n',
    cidr6Template: '{{record}}\n',
    perServiceTemplate: '',
    perServiceFooterTemplate: ''
};

/**
 * @param {string} configPath
 * @returns {{ rawTempDir: string, keepRaw: boolean, sections: Object[] }}
 */
export function loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const content = fs.readFileSync(path.resolve(configPath), 'utf-8').replace(/^\uFEFF/, '');
    const rawConfig = JSON.parse(content);

    if (!Array.isArray(rawConfig.sections) || rawConfig.sections.length === 0) {
        throw new Error('Config must define a non-empty "sections" array');
    }

    return {
        rawTempDir: rawConfig.rawTempDir || '.cache/raw',
        keepRaw: rawConfig.keepRaw === true,
        useRawCache: rawConfig.useRawCache === true,
        sections: rawConfig.sections.map(normalizeSection)
    };
}

function normalizeSection(section) {
    const name = section.name || 'unnamed';

    if (!Array.isArray(section.dataProviders) || section.dataProviders.length === 0) {
        throw new Error(`Section "${name}" must define a non-empty "dataProviders" array`);
    }

    if (!Array.isArray(section.outputProviders) || section.outputProviders.length === 0) {
        throw new Error(`Section "${name}" must define a non-empty "outputProviders" array`);
    }

    const collapseAll = section.collapseCidrs === true;

    return {
        name,
        recordTypes: section.recordTypes || [RecordType.DOMAIN],
        dataProviders: section.dataProviders,
        groups: section.groups || [],
        services: section.services || [],
        additionalLists: section.additionalLists || {},
        collapseCidrs: collapseAll,
        collapseCidr4: collapseAll || section.collapseCidr4 === true,
        collapseCidr6: collapseAll || section.collapseCidr6 === true,
        keepRaw: section.keepRaw === true,
        outputProviders: section.outputProviders.map((provider, index) =>
            normalizeOutputProvider(provider, name, index)
        )
    };
}

function normalizeOutputProvider(provider, sectionName, index) {
    if (!provider.id) {
        throw new Error(`Section "${sectionName}" outputProviders[${index}] must define "id"`);
    }

    return {
        ...TEXT_OUTPUT_DEFAULTS,
        ...provider
    };
}

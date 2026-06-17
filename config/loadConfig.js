import fs from 'fs';
import path from 'path';
import { RecordType } from '../types.js';

const DEFAULT_SECTION_NAME = "default";

/**
 * Loads and normalizes the configuration.
 * If the config has no 'sections' field, it wraps the top-level config into a single section.
 * 
 * @param {string} configPath 
 * @returns {Object} Normalized config with 'sections' array
 */
export function loadConfig(configPath) {
    if (!fs.existsSync(configPath)) {
        throw new Error(`Config file not found: ${configPath}`);
    }

    const content = fs.readFileSync(path.resolve(configPath), 'utf-8');
    const rawConfig = JSON.parse(content);

    if (rawConfig.sections && Array.isArray(rawConfig.sections)) {
        return normalizeSections(rawConfig);
    }

    // Wrap legacy config into a default section
    const defaultSection = {
        name: DEFAULT_SECTION_NAME,
        outputDir: rawConfig.outputDir || "./lists",
        recordTypes: rawConfig.recordTypes || [RecordType.DOMAIN],
        outputLayout: rawConfig.outputLayout || { [RecordType.DOMAIN]: "." },
        providers: rawConfig.providers || ["opencck-main", "metacube", "v2fly"],
        groups: rawConfig.groups || [],
        services: rawConfig.services || [],
        additionalLists: rawConfig.additionalLists || {},
        maxFileEntries: rawConfig.maxFileEntries !== undefined ? rawConfig.maxFileEntries : -1,
        generateIndividualFiles: rawConfig.generateIndividualFiles !== undefined ? rawConfig.generateIndividualFiles : false,
        generateCombinedFiles: rawConfig.generateCombinedFiles !== undefined ? rawConfig.generateCombinedFiles : true,
        domainTemplate: rawConfig.domainTemplate || "{{record}} #{{service}}\n",
        perServiceTemplate: rawConfig.perServiceTemplate || "",
        fileExtension: rawConfig.fileExtension || "lst"
    };

    return {
        sections: [defaultSection]
    };
}

function normalizeSections(config) {
    return {
        ...config,
        sections: config.sections.map(section => ({
            name: section.name || "unnamed",
            outputDir: section.outputDir || "./lists",
            recordTypes: section.recordTypes || [RecordType.DOMAIN],
            outputLayout: section.outputLayout || { [RecordType.DOMAIN]: "." },
            providers: section.providers || ["opencck-main", "metacube", "v2fly"],
            groups: section.groups || [],
            services: section.services || [],
            additionalLists: section.additionalLists || {},
            maxFileEntries: section.maxFileEntries !== undefined ? section.maxFileEntries : -1,
            generateIndividualFiles: section.generateIndividualFiles !== undefined ? section.generateIndividualFiles : true,
            generateCombinedFiles: section.generateCombinedFiles !== undefined ? section.generateCombinedFiles : false,
            domainTemplate: section.domainTemplate || "{{record}}\n",
            perServiceTemplate: section.perServiceTemplate || "",
            fileExtension: section.fileExtension || "lst",
            ...section
        }))
    };
}

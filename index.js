import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fetchUrlStringWithRetry } from './urls.js';
import { filterRecords } from './utils.js';
import { RecordType } from './types.js';
import { loadConfig } from './config/loadConfig.js';
import { resolveProviders } from './providers/registry.js';
import { RawDataStore } from './output/raw/RawDataStore.js';
import { RawSectionSnapshot } from './output/raw/RawSectionSnapshot.js';
import { renderOutputProviders } from './output/providers/registry.js';
import { finalizeOutputDir } from './output/cleanup.js';

async function collectRawData(section, rawStore) {
    const providers = resolveProviders(section.dataProviders);
    for (const provider of providers) {
        await provider.init();
    }

    const serviceGroups = new Map();
    const targetServices = [...section.services];
    const targetGroups = [...section.groups];

    for (const group of targetGroups) {
        for (const provider of providers) {
            if (provider.getServicesForGroup) {
                const before = targetServices.length;
                await provider.getServicesForGroup(group, targetServices);
                for (let i = before; i < targetServices.length; i++) {
                    const service = targetServices[i];
                    if (!serviceGroups.has(service)) {
                        serviceGroups.set(service, group);
                    }
                }
            }
        }
    }

    for (const service of targetServices) {
        if (serviceGroups.has(service)) {
            continue;
        }
        for (const provider of providers) {
            if (provider.getGroupForService) {
                const group = provider.getGroupForService(service);
                if (group) {
                    serviceGroups.set(service, group);
                    break;
                }
            }
        }
    }

    for (const service of targetServices) {
        const group = serviceGroups.get(service);
        if (group) {
            rawStore.setServiceGroup(service, group);
        }

        for (const provider of providers) {
            const records = await provider.getRecordsForService(service, section.recordTypes);

            for (const type of section.recordTypes) {
                for (const item of records[type] || []) {
                    rawStore.append(service, item, type);
                }
            }
        }
    }

    if (section.additionalLists) {
        for (const serviceKey in section.additionalLists) {
            const list = section.additionalLists[serviceKey];
            const urls = Array.isArray(list) ? list : list.urls || [];
            const type = list.type || RecordType.DOMAIN;
            const serviceName = `_${serviceKey}`;

            for (const url of urls) {
                try {
                    const text = await fetchUrlStringWithRetry(url);
                    let items = text
                        .split('\n')
                        .map((line) => line.trim())
                        .filter((line) => line && !line.startsWith('#'));

                    items = filterRecords(type, items);

                    for (const item of items) {
                        rawStore.append(serviceName, item, type);
                    }
                } catch (err) {
                    console.error(`Failed to fetch additional list from ${url}: ${err.message}`);
                }
            }
        }
    }
}

async function processSection(section, rawTempDir, sectionIndex, useRawCache) {
    console.log(`Processing section: ${section.name}`);

    const sectionDir = path.join(rawTempDir, `${sectionIndex}-${section.name}`);

    let snapshot;
    if (useRawCache && RawDataStore.isSectionCacheReady(sectionDir)) {
        console.log(`[cache] Using raw cache for section: ${section.name}`);
        const serviceOrder = RawDataStore.serviceOrderFromManifest(sectionDir);
        snapshot = new RawSectionSnapshot(sectionDir, serviceOrder, section.recordTypes);
    } else {
        const collapseAll = section.collapseCidrs === true;

        const rawStore = new RawDataStore({
            sectionDir,
            collapseCidr4: collapseAll || section.collapseCidr4 === true,
            collapseCidr6: collapseAll || section.collapseCidr6 === true
        });

        await collectRawData(section, rawStore);
        rawStore.finalize();

        snapshot = new RawSectionSnapshot(sectionDir, rawStore.serviceOrder, section.recordTypes);
    }

    const outputResults = await renderOutputProviders(snapshot, section.outputProviders, {
        sectionName: section.name,
        recordTypes: section.recordTypes
    });

    console.log(`Finished section: ${section.name}`);
    return outputResults;
}

async function run() {
    dotenv.config();

    const configPath = process.env.CONFIG_PATH;
    if (!configPath) {
        throw new Error('CONFIG_PATH not defined');
    }

    const config = loadConfig(configPath);
    const useRawCache =
        config.useRawCache === true ||
        process.env.USE_RAW_CACHE === '1' ||
        process.env.USE_RAW_CACHE === 'true';
    const rawTempDir = path.resolve(config.rawTempDir);

    if (!useRawCache && fs.existsSync(rawTempDir)) {
        fs.rmSync(rawTempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(rawTempDir, { recursive: true });

    if (useRawCache) {
        console.log(`[cache] useRawCache enabled — existing raw data in ${rawTempDir} will be reused`);
    }

    const dirGroups = new Map();

    for (const [sectionIndex, section] of config.sections.entries()) {
        const results = await processSection(section, rawTempDir, sectionIndex, useRawCache);

        for (const result of results) {
            if (!dirGroups.has(result.outputDir)) {
                dirGroups.set(result.outputDir, new Set());
            }
            for (const file of result.generatedFiles) {
                dirGroups.get(result.outputDir).add(file);
            }
        }
    }

    for (const [outputDir, allFiles] of dirGroups) {
        finalizeOutputDir(outputDir, allFiles);
    }

    if (config.keepRaw || useRawCache) {
        console.log(`[raw] Kept intermediate data in ${rawTempDir}`);
        return;
    }

    for (const [sectionIndex, section] of config.sections.entries()) {
        if (section.keepRaw) {
            continue;
        }
        const sectionDir = path.join(rawTempDir, `${sectionIndex}-${section.name}`);
        if (fs.existsSync(sectionDir)) {
            fs.rmSync(sectionDir, { recursive: true, force: true });
        }
    }

    if (fs.existsSync(rawTempDir) && fs.readdirSync(rawTempDir).length === 0) {
        fs.rmSync(rawTempDir, { recursive: true, force: true });
    } else if (fs.existsSync(rawTempDir)) {
        console.log(`[raw] Kept intermediate data in ${rawTempDir}`);
    }
}

run().catch(console.error);

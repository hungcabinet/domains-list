import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import {fetchUrlStringWithRetry} from "./urls.js";
import {filterRecords} from "./utils.js";
import {RecordType} from "./types.js";
import {OutputManager} from "./output/OutputManager.js";
import {loadConfig} from "./config/loadConfig.js";
import {resolveProviders} from "./providers/registry.js";

async function processSection(section) {
    console.log(`Processing section: ${section.name}`);

    const outputManager = new OutputManager({
        outputDir: section.outputDir,
        maxFileEntries: section.maxFileEntries,
        fileExtension: section.fileExtension,
        domainTemplate: section.domainTemplate,
        ipv4Template: section.ipv4Template,
        ipv6Template: section.ipv6Template,
        cidr4Template: section.cidr4Template,
        cidr6Template: section.cidr6Template,
        perServiceTemplate: section.perServiceTemplate,
        outputLayout: section.outputLayout
    });

    const providers = resolveProviders(section.providers);
    for (const provider of providers) {
        await provider.init();
    }

    let targetServices = [...section.services];
    let targetGroups = [...section.groups];

    // Collect services from groups
    for (const group of targetGroups) {
        for (const provider of providers) {
            if (provider.getServicesForGroup) {
                await provider.getServicesForGroup(group, targetServices);
            }
        }
    }

    // Process each service
    for (const service of targetServices) {
        for (const provider of providers) {
            const records = await provider.getRecordsForService(service, section.recordTypes);
            
            for (const type of section.recordTypes) {
                const items = records[type] || [];
                for (const item of items) {
                    if (section.generateCombinedFiles) {
                        outputManager.pushRecord("_all_in_one", item, type);
                    }
                    if (section.generateIndividualFiles) {
                        outputManager.pushRecord(service, item, type);
                    }
                }
            }
        }
    }

    // Process additional lists
    if (section.additionalLists) {
        for (const serviceKey in section.additionalLists) {
            let list = section.additionalLists[serviceKey];
            const urls = Array.isArray(list) ? list : (list.urls || []);
            const type = (list.type || RecordType.DOMAIN);

            for (let url of urls) {
                try {
                    let text = await fetchUrlStringWithRetry(url);
                    let items = text.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith('#'));
                    
                    items = filterRecords(type, items);

                    for (let item of items) {
                        const serviceName = `_${serviceKey}`;
                        if (section.generateCombinedFiles) {
                            outputManager.pushRecord("_all_in_one", item, type);
                        }
                        if (section.generateIndividualFiles) {
                            outputManager.pushRecord(serviceName, item, type);
                        }
                    }
                } catch (err) {
                    console.error(`Failed to fetch additional list from ${url}: ${err.message}`);
                }
            }
        }
    }

    console.log(`Finished section: ${section.name}`);
    return outputManager;
}

async function run(){
    dotenv.config();
    
    const configPath = process.env["CONFIG_PATH"];
    if (!configPath) throw new Error('CONFIG_PATH not defined');

    const config = loadConfig(configPath);

    const managers = [];
    for (const section of config.sections) {
        const manager = await processSection(section);
        managers.push(manager);
    }

    // Group by outputDir and finalize
    const dirGroups = new Map(); // outputDir -> Set of generated files
    const dirManagers = new Map(); // outputDir -> first manager found for this dir

    for (const m of managers) {
        if (!dirGroups.has(m.outputDir)) {
            dirGroups.set(m.outputDir, new Set());
            dirManagers.set(m.outputDir, m);
        }
        const fileSet = dirGroups.get(m.outputDir);
        for (const file of m.generatedFiles) {
            fileSet.add(file);
        }
    }

    for (const [outputDir, allFiles] of dirGroups) {
        const manager = dirManagers.get(outputDir);
        manager.finalize(allFiles);
    }
}

run().catch(console.error);

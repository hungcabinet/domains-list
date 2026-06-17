import {fetchUrlStringWithRetry} from "../urls.js";
import {filterDomains} from "../utils.js";
import {RecordType} from "../types.js";

const logTag = "v2fly";
let downloadUrl = "https://raw.githubusercontent.com/v2fly/domain-list-community/refs/heads/master/data/{{service}}"

const provider = {
    async init() {},

    async getServicesForGroup(groupName, resultList = []) {
        return resultList;
    },

    async getDomainsForService(service, resultList = []) {
        // Use a local Set for recursion tracking within this call
        const resolved = new Set();
        const domains = await this._fetchRecursive(service, resolved);
        
        let pushed = 0;
        for (const domain of domains) {
            if (!resultList.includes(domain)) {
                resultList.push(domain);
                pushed++;
            }
        }
        if (pushed > 0) {
            console.log(`[${logTag}] Added ${pushed} domains for ${service}`);
        }
        return resultList;
    },

    async getRecordsForService(service, recordTypes = [RecordType.DOMAIN]) {
        const result = {};
        for (const type of recordTypes) result[type] = [];

        if (!recordTypes.includes(RecordType.DOMAIN)) return result;

        const resolved = new Set();
        result[RecordType.DOMAIN] = await this._fetchRecursive(service, resolved);
        
        const totalPushed = result[RecordType.DOMAIN].length;
        if (totalPushed > 0) {
            console.log(`[${logTag}] Added ${totalPushed} records for ${service}`);
        }

        return result;
    },

    async _fetchRecursive(service, resolved) {
        if (resolved.has(service)) return [];
        resolved.add(service);

        try {
            let url = downloadUrl.replace("{{service}}", service);
            let text = await fetchUrlStringWithRetry(url, {
                noRetryStatusCodes: [400, 401, 403, 404]
            });
            
            if (!text || text === "{}") return [];

            let lines = text.split("\n");
            let domains = [];
            let includes = [];

            for (let line of lines) {
                line = line.trim();
                if (!line || line.startsWith('#')) continue;

                // Remove comments and attributes like @ads, @cn
                let entry = line.split('#')[0].split('@')[0].trim();
                if (!entry) continue;

                if (entry.startsWith("include:")) {
                    includes.push(entry.substring("include:".length).trim());
                } else if (entry.startsWith("full:")) {
                    domains.push(entry.substring("full:".length).trim());
                } else if (entry.startsWith("domain:")) {
                    domains.push(entry.substring("domain:".length).trim());
                } else if (entry.startsWith("regexp:") || entry.startsWith("keyword:")) {
                    // Skip regex and keywords as they are not plain domains
                    continue;
                } else {
                    domains.push(entry);
                }
            }

            let result = filterDomains(domains, logTag);
            for (const include of includes) {
                const includedDomains = await this._fetchRecursive(include, resolved);
                result.push(...includedDomains);
            }

            return [...new Set(result)];
        } catch (err) {
            return [];
        }
    }
};

export default provider;

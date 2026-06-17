import {fetchUrlsJsonWithRetry} from "../urls.js";
import {filterDomains, filterRecords} from "../utils.js";
import {RecordType} from "../types.js";

export function createOpenCkkProvider(options = {}) {
    const {
        id = "opencck",
        baseUrl = "https://iplist.opencck.org",
        serviceMap: customServiceMap = {}
    } = options;

    const logTag = id;
    const groupDataUrl = `${baseUrl}/?format=json&data=group`;
    const siteDataUrlTemplate = `${baseUrl}/?format=json&data={{dataType}}&wildcard=1&site={{site}}`;

    const services2sites = new Map();
    const groups2services = new Map();

    const serviceMap = new Map();
    serviceMap.set("jetbrains-ai", "jetbrains@grazie");
    serviceMap.set("kinopub", "kino");
    serviceMap.set("itchio", "itch");
    
    // Add custom mappings
    for (const [key, value] of Object.entries(customServiceMap)) {
        serviceMap.set(key, value);
    }

    function getSitesByService(service) {
        if (!services2sites.has(service)) {
            if (serviceMap.has(service)) {
                return getSitesByService(serviceMap.get(service));
            }
            services2sites.set(service, []);
        }
        return services2sites.get(service);
    }

    function getServicesByGroup(group) {
        if (!groups2services.has(group)) {
            groups2services.set(group, []);
        }
        return groups2services.get(group);
    }

    return {
        async init() {
            console.log(`[${logTag}] Init`);
            try {
                let data = await fetchUrlsJsonWithRetry(groupDataUrl);
                let siteCount = 0;

                for (const site in data) {
                    let service = site.replace(/\.[a-zA-Z]+$/, '');
                    let sites = getSitesByService(service);
                    if (!sites.includes(site)) {
                        sites.push(site);
                    }

                    let group = data[site];
                    let groupServices = getServicesByGroup(group);
                    if (!groupServices.includes(service)) {
                        groupServices.push(service);
                    }
                    siteCount++;
                }
                console.log(`[${logTag}] Init process done. Site count: ${siteCount}`);
            } catch (err) {
                console.error(`[${logTag}] Init failed with error: ${err}`);
            }
        },

        async getServicesForGroup(groupName, resultList = []) {
            console.log(`[${logTag}] Getting services for group ${groupName}`);
            let services = getServicesByGroup(groupName);
            let pushed = 0;
            for (const service of services) {
                if (!resultList.includes(service)) {
                    resultList.push(service);
                    pushed++;
                }
            }
            console.log(`[${logTag}] Pushed ${pushed} services for group ${groupName}`);
            return resultList;
        },

        async getDomainsForService(service, resultList = []) {
            const records = await this.getRecordsForService(service, [RecordType.DOMAIN]);
            const domains = records[RecordType.DOMAIN] || [];
            
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
            for (const type of recordTypes) {
                result[type] = [];
            }

            try {
                let sites = getSitesByService(service);
                for (let site of sites) {
                    for (const type of recordTypes) {
                        let dataType = "domains";
                        if (type === RecordType.IPV4) dataType = "ip4";
                        if (type === RecordType.IPV6) dataType = "ip6";
                        if (type === RecordType.CIDR4) dataType = "cidr4";
                        if (type === RecordType.CIDR6) dataType = "cidr6";

                        const url = siteDataUrlTemplate
                            .replace("{{dataType}}", dataType)
                            .replace("{{site}}", site);
                        
                        const data = await fetchUrlsJsonWithRetry(url);
                        if (data && data[site]) {
                            const filtered = filterRecords(type, data[site], logTag);
                            result[type].push(...filtered);
                        }
                    }
                }
                
                // Deduplicate within the service
                let totalPushed = 0;
                for (const type in result) {
                    result[type] = [...new Set(result[type])];
                    totalPushed += result[type].length;
                }

                if (totalPushed > 0) {
                    console.log(`[${logTag}] Added ${totalPushed} records for ${service}`);
                }
            } catch (err) {
                // console.error(`[${logTag}] Error getting records for ${service}: ${err.message}`);
            }

            return result;
        }
    };
}

// Default instance for backward compatibility
export default createOpenCkkProvider({ id: "opencck-main", baseUrl: "https://iplist.opencck.org" });

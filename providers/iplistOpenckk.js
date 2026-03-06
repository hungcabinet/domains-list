import {fetchUrlsJsonWithRetry} from "../urls.js";
import {filterDomains} from "../utils.js";

const logTag = "opencck";

const baseUrl = "https://iplist.opencck.org";
const groupDataUrl = `${baseUrl}/?format=json&data=group`;
const siteDataUrl = `${baseUrl}/?format=json&data=domains&wildcard=1&site={{site}}`;

const services2sites = new Map();
const groups2services = new Map();

const serviceMap = new Map();
serviceMap.set("jetbrains-ai", "jetbrains@grazie");
serviceMap.set("kinopub", "kino");
serviceMap.set("itchio", "itch");

const reverseServiceMap = new Map();
reverseServiceMap.set("jetbrains@grazie", "jetbrains-ai");

function getSitesByService(service){
    if (!services2sites.has(service)) {
        if (serviceMap.has(service)) {
            return getSitesByService(serviceMap.get(service));
        }

        services2sites.set(service, []);
    }

    return services2sites.get(service);
}

function getServicesByGroup(group){
    if (!groups2services.has(group)) {
        groups2services.set(group, []);
    }

    return groups2services.get(group);
}

async function init() {
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
    }
    catch(err){
        console.error(`[${logTag}] Init failed with error: ${err}`);
    }
}

async function getServicesForGroup(groupName, resultList = []){

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
}

async function getDomainsForService(service, resultList = []){
    try {
        let sites = await getSitesByService(service);

        let pushed = 0;

        for (let site of sites) {
            let url = siteDataUrl.replace("{{site}}", site);
            let data = await fetchUrlsJsonWithRetry(url);

            let domains = filterDomains(data[site]);

            for (let domain of domains) {
                if (!resultList.includes(domain)) {
                    resultList.push(domain);
                    pushed++;
                }
            }
        }

        if (pushed > 0) {
            console.log(`[${logTag}] Added ${pushed} domains for ${service}`);
        }
    }
    catch(err){
    }

    return resultList;
}

const provider = {};
provider.init = init;
provider.getServicesForGroup = getServicesForGroup;
provider.getDomainsForService = getDomainsForService;

export default provider;
import {fetchUrlsJsonWithRetry} from "../urls.js";
import {filterDomains} from "../utils.js";

const logTag = "metacube";

const downloadUrl = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/{{service}}.json"

async function init() {

}

async function getServicesForGroup(groupName, resultList = []){
    //not supports
    return resultList;
}

function processDomainField(value, array){
    if (typeof value === "string"){
        array.push(value);
    }
    if (Array.isArray(value)){
        for (const element of value) {
            array.push(element);
        }
    }
}

async function getDomainsForService(service, resultList = []){
    try {
        let url = downloadUrl.replace("{{service}}", service);
        let data = await fetchUrlsJsonWithRetry(url, {
            noRetryStatusCodes: [400, 401, 403, 404]
        });

        if (data.rules === undefined){
            return resultList;
        }

        let domains = [];

        for (const rule of data.rules) {
            processDomainField(rule.domain, domains);
            processDomainField(rule.domain_suffix , domains);
        }

        domains = filterDomains(domains);

        let pushed = 0;

        for (const domain of domains) {
            if (!resultList.includes(domain)){
                resultList.push(domain);

                pushed++;
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
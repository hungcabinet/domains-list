import {fetchUrlsJsonWithRetry, fetchUrlStringWithRetry} from "../urls.js";
import {filterDomains} from "../utils.js";

const logTag = "v2fly";

let downloadUrl = "https://raw.githubusercontent.com/v2fly/domain-list-community/refs/heads/master/data/{{service}}"

async function init() {

}

let resolvedServices = []

async function getServicesForGroup(groupName, resultList = []){
    //not supports
    return resultList;
}

async function getDomainsForService(service, resultList = []){
    if (resolvedServices.includes(service)){
        return resultList;
    }

    resolvedServices.push(service);

    try {
        let url = downloadUrl.replace("{{service}}", service);
        let data = (await fetchUrlStringWithRetry(url, {
            noRetryStatusCodes: [400, 401, 403, 404]
        })).split("\n");

        for (let i = 0; i < data.length; i++){
            let line = data[i];

            line = line.trim();
            if (line.startsWith("include:")){
                let include = line.substring("include:".length);

                await getDomainsForService(include, resultList);
            }

            data[i] = line.replace("@cn", "").trim();
        }

        let domains = filterDomains(data);

        let pushed = 0;

        for (let domain of domains) {
            if (!resultList.includes(domain)) {
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
import {fetchUrlsJsonWithRetry} from "../urls.js";
import {filterDomains} from "../utils.js";

const logTag = "metacube";

const downloadUrl = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/{{service}}.json"

const excludedTlds = "cv|dj|dm|im|kg|ki|li|ml|ms|mv|ne|nr|sm|ad|as|bf|bj|bt|cd|cf|ci|ao|bw|ck|ls|mz|vi|zm|bn|bz|cy|et|fj|gi|kh|mm|na|np|pg|sb|sl|vc|mg|ac|af|ag|ai|bi|bs|cg|cm|cu|dz|ga|gd|gl|gm|gs|gy|ht|je|lc|mp|mu|mw|nu|pn|re|rw|sc|sr|st|sx|sy|tf|tj|tl|tt|vg|vu|wf|yt|do|ec|eg|gh|hn|jm|kw|lb|mt|om|py|tr|ae|al|am|at|bg|ch|id|ve|uk|za|zw|ar|au|bd|br|il|ke|nz|th|tz|de|es|fr|gr|hr|hu|ie|is|it|ng|pl|ro|rs|sa|ua|jo|uz|tm|az|ba|bh|bo|by|ca|qa|vn|uy|ug|tn|sv|sk|si|sg|ee|sn|cl|pt|pr|pk|ph|pe|pa|no|ni|my|mx|mn|mk|md|ma|ly|lv|lu|lt|lk|la|kz|kr|iq|in|hk|gt|ge|fi|cr|cz|dk";
const excludedRegex = new RegExp(`\\.(${excludedTlds})$`, 'i');

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

        domains = filterDomains(domains).filter(domain => !excludedRegex.test(domain));

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
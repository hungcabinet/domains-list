import {fetchUrlsJsonWithRetry} from "../urls.js";
import {filterDomains, filterRecords} from "../utils.js";
import {RecordType} from "../types.js";

const logTag = "metacube";
const geositeUrl = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geosite/{{service}}.json";
const geoipUrl = "https://raw.githubusercontent.com/MetaCubeX/meta-rules-dat/sing/geo/geoip/{{service}}.json";
const excludedTlds = "cv|dj|dm|im|kg|ki|li|ml|ms|mv|ne|nr|sm|ad|as|bf|bj|bt|cd|cf|ci|ao|bw|ck|ls|mz|vi|zm|bn|bz|cy|et|fj|gi|kh|mm|na|np|pg|sb|sl|vc|mg|ac|af|ag|ai|bi|bs|cg|cm|cu|dz|ga|gd|gl|gm|gs|gy|ht|je|lc|mp|mu|mw|nu|pn|re|rw|sc|sr|st|sx|sy|tf|tj|tl|tt|vg|vu|wf|yt|do|ec|eg|gh|hn|jm|kw|lb|mt|om|py|tr|ae|al|am|at|bg|ch|id|ve|uk|za|zw|ar|au|bd|br|il|ke|nz|th|tz|de|es|fr|gr|hr|hu|ie|is|it|ng|pl|ro|rs|sa|ua|jo|uz|tm|az|ba|bh|bo|by|ca|qa|vn|uy|ug|tn|sv|sk|si|sg|ee|sn|cl|pt|pr|pk|ph|pe|pa|no|ni|my|mx|mn|mk|md|ma|ly|lv|lu|lt|lk|la|kz|kr|iq|in|hk|gt|ge|fi|cr|cz|dk";
const excludedRegex = new RegExp(`\\.(${excludedTlds})$`, 'i');

function collectField(value, array) {
    if (typeof value === "string") {
        array.push(value);
    }
    if (Array.isArray(value)) {
        for (const element of value) {
            array.push(element);
        }
    }
}

async function fetchRules(service, urlTemplate) {
    const url = urlTemplate.replace("{{service}}", service);
    const data = await fetchUrlsJsonWithRetry(url, {
        noRetryStatusCodes: [400, 401, 403, 404]
    });
    return data.rules || [];
}

const provider = {
    async init() {},

    async getServicesForGroup(groupName, resultList = []) {
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
        for (const type of recordTypes) result[type] = [];

        const wantsDomain = recordTypes.includes(RecordType.DOMAIN);
        const wantsCidr4 = recordTypes.includes(RecordType.CIDR4);
        const wantsCidr6 = recordTypes.includes(RecordType.CIDR6);

        try {
            if (wantsDomain) {
                const rules = await fetchRules(service, geositeUrl);
                const domains = [];
                for (const rule of rules) {
                    collectField(rule.domain, domains);
                    collectField(rule.domain_suffix, domains);
                }
                result[RecordType.DOMAIN] = filterDomains(domains, logTag)
                    .filter(domain => !excludedRegex.test(domain));
            }

            if (wantsCidr4 || wantsCidr6) {
                const rules = await fetchRules(service, geoipUrl);
                const cidrs = [];
                for (const rule of rules) {
                    collectField(rule.ip_cidr, cidrs);
                }
                if (wantsCidr4) {
                    result[RecordType.CIDR4] = filterRecords(RecordType.CIDR4, cidrs, logTag);
                }
                if (wantsCidr6) {
                    result[RecordType.CIDR6] = filterRecords(RecordType.CIDR6, cidrs, logTag);
                }
            }

            const totalPushed = recordTypes.reduce((acc, type) => acc + result[type].length, 0);
            if (totalPushed > 0) {
                console.log(`[${logTag}] Added ${totalPushed} records for ${service}`);
            }
        } catch (err) {
            // console.error(`[${logTag}] Error: ${err.message}`);
        }

        return result;
    }
};

export default provider;

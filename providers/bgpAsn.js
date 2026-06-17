import {fetchUrlsJsonWithRetry} from "../urls.js";
import {filterRecords, parseAsn} from "../utils.js";
import {RecordType} from "../types.js";

const logTag = "bgpAsn";
const downloadUrl = "https://stat.ripe.net/data/announced-prefixes/data.json?resource={{asn}}";

const provider = {
    async init() {},

    async getServicesForGroup(groupName, resultList = []) {
        return resultList;
    },

    async getRecordsForService(service, recordTypes = [RecordType.CIDR4, RecordType.CIDR6]) {
        const result = {};
        for (const type of recordTypes) result[type] = [];

        const asn = parseAsn(service);
        if (!asn) {
            if (/^AS(\d+)?$/i.test(service.trim())) {
                console.error(`[${logTag}] Not valid ASN: ${service}`);
            }
            return result;
        }

        try {
            const url = downloadUrl.replace("{{asn}}", asn);
            const data = await fetchUrlsJsonWithRetry(url, {
                noRetryStatusCodes: [400, 401, 403, 404]
            });

            if (!data || !data.data || !data.data.prefixes) {
                return result;
            }

            const prefixes = data.data.prefixes.map(p => p.prefix);

            for (const type of recordTypes) {
                if (type === RecordType.CIDR4 || type === RecordType.CIDR6) {
                    result[type] = filterRecords(type, prefixes, logTag);
                }
            }

            const totalPushed = recordTypes.reduce((acc, type) => acc + result[type].length, 0);
            if (totalPushed > 0) {
                console.log(`[${logTag}] Added ${totalPushed} records for ${service}`);
            }
        } catch (err) {
            // console.error(`[${logTag}] Error fetching ASN ${asn}: ${err.message}`);
        }

        return result;
    }
};

export default provider;

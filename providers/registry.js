import { createOpenCkkProvider } from './iplistOpenckk.js';
import metaCubeProvider from './metaCubeGeosite.js';
import v2flyProvider from './v2fly.js';
import bgpAsnProvider from './bgpAsn.js';

const providerFactories = {
    'opencck-main': () => createOpenCkkProvider({ 
        id: 'opencck-main', 
        baseUrl: 'https://iplist.opencck.org' 
    }),
    'opencck-beta': () => createOpenCkkProvider({ 
        id: 'opencck-beta', 
        baseUrl: 'https://beta.iplist.opencck.org' 
    }),
    'opencck-russia': () => createOpenCkkProvider({ 
        id: 'opencck-russia', 
        baseUrl: 'https://russia.iplist.opencck.org' 
    }),
    'metacube': () => metaCubeProvider,
    'v2fly': () => v2flyProvider,
    'bgpAsn': () => bgpAsnProvider
};

/**
 * Resolves provider IDs into provider instances.
 * 
 * @param {string[]} providerIds 
 * @param {Object} options 
 * @returns {Object[]} Array of provider instances
 */
export function resolveProviders(providerIds, options = {}) {
    const instances = [];
    
    for (const id of providerIds) {
        const factory = providerFactories[id];
        if (factory) {
            instances.push(factory());
        } else {
            console.warn(`Unknown provider ID: ${id}`);
        }
    }
    
    return instances;
}

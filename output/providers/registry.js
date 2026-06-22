import textProvider from './text.js';
import mihomoProvider from './mihomo.js';
import singboxProvider from './singbox.js';

const outputProviderFactories = {
    text: () => textProvider,
    mihomo: () => mihomoProvider,
    singbox: () => singboxProvider
};

/**
 * Resolves an output provider by id.
 *
 * @param {string} id
 * @returns {{ id: string, render: Function } | null}
 */
export function resolveOutputProvider(id) {
    const factory = outputProviderFactories[id];
    if (!factory) {
        console.warn(`Unknown output provider ID: ${id}`);
        return null;
    }
    return factory();
}

/**
 * Renders section raw data through configured output providers.
 *
 * @param {import('../raw/RawSectionSnapshot.js').RawSectionSnapshot} raw
 * @param {Object[]} outputProviderConfigs
 * @param {Object} context
 * @returns {Promise<{ outputDir: string, generatedFiles: string[] }[]>}
 */
export async function renderOutputProviders(raw, outputProviderConfigs, context) {
    const results = [];

    for (const config of outputProviderConfigs) {
        const provider = resolveOutputProvider(config.id);
        if (!provider) {
            continue;
        }

        if (provider.init) {
            await provider.init(config);
        }

        const result = await provider.render(raw, config, context);
        results.push(result);
    }

    return results;
}

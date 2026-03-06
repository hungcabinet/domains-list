function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchUrlStringWithRetry(url, options = {}) {
    const {
        retries = 3,
        timeout = 10000,
        retryDelay = 1000,
        noRetryStatusCodes = []
    } = options;

    for (let attempt = 1; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(url, {
                signal: controller.signal
            });

            clearTimeout(id);

            if (!response.ok) {
                if (noRetryStatusCodes.includes(response.status)) {
                    return "{}";
                }
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.text();

            return data;
        } catch (err) {
            clearTimeout(id);

            if (attempt === retries) {
                throw err;
            }

            console.log(`Attempt ${attempt} for url ${url} failed. Retrying after sleep...`);
            await sleep(retryDelay);
        }
    }
}

export async function fetchUrlsJsonWithRetry(url, options = {}) {
    let data = await fetchUrlStringWithRetry(url, options);

    return JSON.parse(data);
}
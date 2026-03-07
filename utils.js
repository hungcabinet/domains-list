export function isValidDomain(domain) {
    if (typeof domain !== "string") {
        console.error(`Not valid domain: ${domain}`);
        return false;
    }

    domain = domain.trim().toLowerCase();

    // базовая длина домена
    if (domain.length === 0 || domain.length > 253) {
        console.error(`Not valid domain: ${domain}`);
        return false;
    }

    // запрещённые символы (regex, wildcard, пробелы и т.п.)
    if (/[\*\+\?\(\)\[\]\{\}\|\^\$\\\/\s]/.test(domain)) {
        console.error(`Not valid domain: ${domain}`);
        return false;
    }

    // проверка структуры домена
    const domainRegex =
        /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/;

    if (!domainRegex.test(domain)){
        console.error(`Not valid domain: ${domain}`);
        return false;
    }

    return true;
}

export function filterDomains(domains){
    return domains.filter(domain => domain.split('.').length > 1).filter(domain => isValidDomain(domain));
}
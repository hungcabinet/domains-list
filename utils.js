const excludedTlds = "cv|dj|dm|im|kg|ki|li|ml|ms|mv|ne|nr|sm|ad|as|bf|bj|bt|cd|cf|ci|ao|bw|ck|ls|mz|vi|zm|bn|bz|cy|et|fj|gi|kh|mm|na|np|pg|sb|sl|vc|mg|ac|af|ag|ai|bi|bs|cg|cm|cu|dz|ga|gd|gl|gm|gs|gy|ht|je|lc|mp|mu|mw|nu|pn|re|rw|sc|sr|st|sx|sy|tf|tj|tl|tt|vg|vu|wf|yt|do|ec|eg|gh|hn|jm|kw|lb|mt|om|py|tr|ae|al|am|at|bg|ch|id|ve|uk|za|zw|ar|au|bd|br|il|ke|nz|th|tz|de|es|fr|gr|hr|hu|ie|is|it|ng|pl|ro|rs|sa|ua|jo|uz|tm|az|ba|bh|bo|by|ca|qa|vn|uy|ug|tn|sv|sk|si|sg|ee|sn|cl|pt|pr|pk|ph|pe|pa|no|ni|my|mx|mn|mk|md|ma|ly|lv|lu|lt|lk|la|kz|kr|iq|in|hk|gt|ge|fi|cr|cz|dk";
const excludedRegex = new RegExp(`\\.(${excludedTlds})$`, 'i');

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
    return domains.filter(domain => !excludedRegex.test(domain)).filter(domain => domain.split('.').length > 1).filter(domain => isValidDomain(domain));
}
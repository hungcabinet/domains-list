/**
 * Applies a template string by replacing placeholders with values.
 * Supported placeholders: {{record}}, {{domain}}, {{service}}, {{type}}
 * 
 * @param {string} template 
 * @param {Object} data 
 * @param {string} data.record
 * @param {string} data.service
 * @param {string} data.type
 * @returns {string}
 */
export function applyTemplate(template, { record, service, type }) {
    if (!template) return "";
    
    return template
        .replace(/{{record}}/g, record)
        .replace(/{{domain}}/g, record) // alias for domain
        .replace(/{{service}}/g, service)
        .replace(/{{type}}/g, type);
}

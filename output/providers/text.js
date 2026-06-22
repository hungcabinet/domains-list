import fs from 'fs';
import path from 'path';
import { applyTemplate } from '../templates.js';

const COMBINED_SERVICE = '_all_in_one';

function buildTemplates(options) {
    return {
        domain: options.domainTemplate || '{{record}}\n',
        ipv4: options.ipv4Template || '{{record}}\n',
        ipv6: options.ipv6Template || '{{record}}\n',
        cidr4: options.cidr4Template || '{{record}}\n',
        cidr6: options.cidr6Template || '{{record}}\n',
        perService: options.perServiceTemplate || '',
        perServiceFooter: options.perServiceFooterTemplate || ''
    };
}

function getFilePath(outputDir, outputLayout, fileExtension, service, type, partition = -1) {
    const layoutDir = outputLayout[type] || '.';
    const dirPath = path.join(outputDir, layoutDir);
    fs.mkdirSync(dirPath, { recursive: true });

    let fileName = service;
    if (partition >= 0) {
        fileName += `_${partition}`;
    }
    if (fileExtension) {
        fileName += `.${fileExtension}`;
    }

    return {
        fullPath: path.join(dirPath, fileName),
        relativeName: path.join(layoutDir, fileName).replace(/\\/g, '/')
    };
}

class PartitionWriter {
    constructor(outputDir, outputLayout, fileExtension, service, type, templates, generatedFiles, maxFileEntries) {
        this.outputDir = outputDir;
        this.outputLayout = outputLayout;
        this.fileExtension = fileExtension;
        this.service = service;
        this.type = type;
        this.templates = templates;
        this.generatedFiles = generatedFiles;
        this.maxFileEntries = maxFileEntries;

        this.partition = 0;
        this.entries = 0;
        this.currentPath = null;
        this.activeService = null;
    }

    _openPartition() {
        const partition = this.maxFileEntries > 0 ? this.partition : -1;
        const { fullPath, relativeName } = getFilePath(
            this.outputDir,
            this.outputLayout,
            this.fileExtension,
            this.service,
            this.type,
            partition
        );

        this.generatedFiles.add(relativeName);
        this.currentPath = fullPath;
        fs.writeFileSync(fullPath, '');
    }

    _ensurePartition() {
        if (!this.currentPath) {
            this._openPartition();
        }
    }

    _appendTemplate(template, service) {
        if (!template) {
            return;
        }
        this._ensurePartition();
        fs.appendFileSync(
            this.currentPath,
            applyTemplate(template, { record: '', service, type: this.type })
        );
    }

    beginServiceBlock(service) {
        this._appendTemplate(this.templates.perService, service);
        this.activeService = service;
    }

    endServiceBlock(service) {
        if (this.activeService !== service) {
            return;
        }
        this._appendTemplate(this.templates.perServiceFooter, service);
        this.activeService = null;
    }

    _rotatePartition() {
        if (this.activeService !== null) {
            this.endServiceBlock(this.activeService);
        }
        this.partition++;
        this.entries = 0;
        this.currentPath = null;
    }

    writeRecord(record, recordService) {
        const service = recordService ?? this.service;

        if (this.activeService !== service) {
            if (this.activeService !== null) {
                this.endServiceBlock(this.activeService);
            }
            this.beginServiceBlock(service);
        }

        this._ensurePartition();
        const template = this.templates[this.type] || '{{record}}\n';
        fs.appendFileSync(
            this.currentPath,
            applyTemplate(template, { record, service, type: this.type })
        );

        if (this.maxFileEntries <= 0) {
            return;
        }

        this.entries++;
        if (this.entries >= this.maxFileEntries) {
            this._rotatePartition();
        }
    }

    close() {
        if (this.activeService !== null) {
            this.endServiceBlock(this.activeService);
        }
    }
}

function writeServiceRecords(writer, service, records) {
    if (records.length === 0) {
        return;
    }

    for (const record of records) {
        writer.writeRecord(record, service);
    }
}

function writeServiceFile(raw, options, context, service, type, generatedFiles) {
    const records = raw.readRecords(service, type);
    if (records.length === 0) {
        return;
    }

    const templates = buildTemplates(options);
    const writer = new PartitionWriter(
        path.resolve(options.outputDir || './lists'),
        options.outputLayout || { domain: '.' },
        options.fileExtension || 'lst',
        service,
        type,
        templates,
        generatedFiles,
        options.maxFileEntries ?? -1
    );

    writeServiceRecords(writer, service, records);
    writer.close();
}

function writeCombinedFile(raw, options, context, type, generatedFiles) {
    const templates = buildTemplates(options);
    const writer = new PartitionWriter(
        path.resolve(options.outputDir || './lists'),
        options.outputLayout || { domain: '.' },
        options.fileExtension || 'lst',
        COMBINED_SERVICE,
        type,
        templates,
        generatedFiles,
        options.maxFileEntries ?? -1
    );

    const seen = new Set();
    let wroteAny = false;

    for (const service of raw.serviceOrder) {
        const records = raw.readRecords(service, type);
        const uniqueRecords = [];

        for (const record of records) {
            if (seen.has(record)) {
                continue;
            }
            seen.add(record);
            uniqueRecords.push(record);
        }

        if (uniqueRecords.length === 0) {
            continue;
        }

        wroteAny = true;
        writeServiceRecords(writer, service, uniqueRecords);
    }

    if (wroteAny) {
        writer.close();
    }
}

function writeGroupFile(raw, options, context, group, type, generatedFiles) {
    const services = raw.getServicesInGroup(group);
    if (services.length === 0) {
        return;
    }

    const templates = buildTemplates(options);
    const writer = new PartitionWriter(
        path.resolve(options.outputDir || './lists'),
        options.outputLayout || { domain: '.' },
        options.fileExtension || 'lst',
        group,
        type,
        templates,
        generatedFiles,
        options.maxFileEntries ?? -1
    );

    const seen = new Set();
    let wroteAny = false;

    for (const service of services) {
        const records = raw.readRecords(service, type);
        const uniqueRecords = [];

        for (const record of records) {
            if (seen.has(record)) {
                continue;
            }
            seen.add(record);
            uniqueRecords.push(record);
        }

        if (uniqueRecords.length === 0) {
            continue;
        }

        wroteAny = true;
        writeServiceRecords(writer, service, uniqueRecords);
    }

    if (wroteAny) {
        writer.close();
    }
}

/**
 * Text output provider — plain .lst files with templates and layout.
 */
export async function render(raw, options, context) {
    const recordTypes = context.recordTypes;
    const generateIndividual = options.generateIndividualFiles !== false;
    const generateCombined = options.generateCombinedFiles === true;
    const generateGroup = options.generateGroupFiles === true;
    const generatedFiles = new Set();

    for (const type of recordTypes) {
        if (generateIndividual) {
            for (const service of raw.serviceOrder) {
                writeServiceFile(raw, options, context, service, type, generatedFiles);
            }
        }

        if (generateGroup) {
            for (const group of raw.getGroupOrder()) {
                writeGroupFile(raw, options, context, group, type, generatedFiles);
            }

            if (!generateIndividual) {
                for (const service of raw.getUngroupedServices()) {
                    writeServiceFile(raw, options, context, service, type, generatedFiles);
                }
            }
        }

        if (generateCombined) {
            writeCombinedFile(raw, options, context, type, generatedFiles);
        }
    }

    return {
        outputDir: path.resolve(options.outputDir || './lists'),
        generatedFiles: [...generatedFiles]
    };
}

export default { id: 'text', render };

import fs from 'fs';
import path from 'path';
import { applyTemplate } from '../../templates.js';

export function buildTemplates(options) {
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

export function getFilePath(outputDir, layout, fileExtension, baseName, partition = -1) {
    const layoutDir = layout || '.';
    const dirPath = path.join(outputDir, layoutDir);
    fs.mkdirSync(dirPath, { recursive: true });

    let fileName = baseName;
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

export class PartitionWriter {
    constructor(outputDir, layout, fileExtension, baseName, type, templates, writtenFiles, maxFileEntries) {
        this.outputDir = outputDir;
        this.layout = layout;
        this.fileExtension = fileExtension;
        this.baseName = baseName;
        this.type = type;
        this.templates = templates;
        this.writtenFiles = writtenFiles;
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
            this.layout,
            this.fileExtension,
            this.baseName,
            partition
        );

        this.writtenFiles.push({ fullPath, relativeName, type: this.type, baseName: this.baseName, partition });
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
        const service = recordService ?? this.baseName;

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

export function writeBlocksWithWriter(writer, blocks) {
    for (const block of blocks) {
        for (const record of block.records) {
            writer.writeRecord(record, block.service);
        }
    }
    writer.close();
}

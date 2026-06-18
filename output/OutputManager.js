import fs from 'fs';
import path from 'path';
import { applyTemplate } from './templates.js';
import { aggregateCidr4, aggregateCidr6, extractCidrFromLine } from '../utils/cidrAggregate.js';
import { RecordType } from '../types.js';

export class OutputManager {
    constructor(options = {}) {
        this.outputDir = path.resolve(options.outputDir || './lists');
        this.maxFileEntries = options.maxFileEntries || -1;
        this.fileExtension = options.fileExtension || 'lst';
        this.templates = {
            domain: options.domainTemplate || "{{record}}\n",
            ipv4: options.ipv4Template || "{{record}}\n",
            ipv6: options.ipv6Template || "{{record}}\n",
            cidr4: options.cidr4Template || "{{record}}\n",
            cidr6: options.cidr6Template || "{{record}}\n",
            perService: options.perServiceTemplate || ""
        };
        this.outputLayout = options.outputLayout || { domain: "." };

        const collapseAll = options.collapseCidrs === true;
        this.collapseCidr4 = collapseAll || options.collapseCidr4 === true;
        this.collapseCidr6 = collapseAll || options.collapseCidr6 === true;

        this.layoutTypeByDir = new Map();
        for (const [type, dir] of Object.entries(this.outputLayout)) {
            this.layoutTypeByDir.set((dir || '.').replace(/\\/g, '/'), type);
        }
        
        this.generatedFiles = new Set();
        this.fileDataMap = new Map(); // key: {service}:{type}
        
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    _getFileKey(service, type) {
        return `${service}:${type}`;
    }

    _getFilePath(service, type, partition = -1) {
        const layoutDir = this.outputLayout[type] || ".";
        const dirPath = path.join(this.outputDir, layoutDir);
        
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        let fileName = service;
        if (partition >= 0) {
            fileName += `_${partition}`;
        }
        if (this.fileExtension) {
            fileName += `.${this.fileExtension}`;
        }

        return {
            fullPath: path.join(dirPath, fileName),
            relativeName: path.join(layoutDir, fileName).replace(/\\/g, '/')
        };
    }

    _getFileData(service, type) {
        const key = this._getFileKey(service, type);
        if (!this.fileDataMap.has(key)) {
            this.fileDataMap.set(key, {
                includedRecords: new Set(),
                partition: 0,
                entries: 0,
                isNewPartition: true
            });
        }
        return this.fileDataMap.get(key);
    }

    _detectFileType(relativeName) {
        const dir = path.dirname(relativeName).replace(/\\/g, '/');
        return this.layoutTypeByDir.get(dir === '.' ? '.' : dir);
    }

    _shouldCollapse(type) {
        if (type === RecordType.CIDR4) return this.collapseCidr4;
        if (type === RecordType.CIDR6) return this.collapseCidr6;
        return false;
    }

    _collapseCidrFiles(files) {
        if (!this.collapseCidr4 && !this.collapseCidr6) return;

        for (const relativeName of files) {
            const type = this._detectFileType(relativeName);
            if (!this._shouldCollapse(type)) continue;

            const fullPath = path.join(this.outputDir, relativeName);
            if (!fs.existsSync(fullPath)) continue;

            const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
            const cidrs = [];
            let header = '';

            for (const line of lines) {
                const cidr = extractCidrFromLine(line);
                if (cidr) {
                    cidrs.push(cidr);
                } else if (line.trim() && !header && this.templates.perService) {
                    header = line.endsWith('\n') ? line : line + '\n';
                }
            }

            if (cidrs.length === 0) continue;

            const aggregated = type === RecordType.CIDR4
                ? aggregateCidr4(cidrs)
                : aggregateCidr6(cidrs);

            const baseName = path.basename(relativeName, `.${this.fileExtension}`);
            const partitionMatch = baseName.match(/^(.+)_(\d+)$/);
            const service = partitionMatch ? partitionMatch[1] : baseName;
            const template = this.templates[type] || "{{record}}\n";

            let output = header;
            for (const record of aggregated) {
                output += applyTemplate(template, { record, service, type });
            }
            fs.writeFileSync(fullPath, output);

            if (cidrs.length !== aggregated.length) {
                console.log(`[output] Collapsed ${relativeName}: ${cidrs.length} → ${aggregated.length} prefixes`);
            }
        }
    }

    pushRecord(service, record, type) {
        const fileData = this._getFileData(service, type);
        
        if (fileData.includedRecords.has(record)) {
            return;
        }

        if (fileData.isNewPartition) {
            const partition = this.maxFileEntries > 0 ? fileData.partition : -1;
            const { fullPath, relativeName } = this._getFilePath(service, type, partition);
            
            this.generatedFiles.add(relativeName);
            fs.writeFileSync(fullPath, "");

            if (this.templates.perService) {
                const header = applyTemplate(this.templates.perService, { record: "", service, type });
                fs.appendFileSync(fullPath, header);
            }
            
            fileData.isNewPartition = false;
        }

        const partition = this.maxFileEntries > 0 ? fileData.partition : -1;
        const { fullPath } = this._getFilePath(service, type, partition);
        
        const template = this.templates[type] || "{{record}}\n";
        const content = applyTemplate(template, { record, service, type });
        fs.appendFileSync(fullPath, content);

        fileData.includedRecords.add(record);
        
        if (this.maxFileEntries > 0) {
            fileData.entries++;
            if (fileData.entries >= this.maxFileEntries) {
                fileData.partition++;
                fileData.entries = 0;
                fileData.isNewPartition = true;
            }
        }
    }

    finalize(allGeneratedFiles = null) {
        const filesToKeep = allGeneratedFiles || this.generatedFiles;
        const sortedFiles = Array.from(filesToKeep).sort();

        this._collapseCidrFiles(sortedFiles);

        const generatedFilesPath = path.join(this.outputDir, '.generated_files');
        
        fs.writeFileSync(generatedFilesPath, sortedFiles.join('\n') + '\n');

        // Cleanup: remove files in outputDir that are not in generatedFiles
        this._cleanup(this.outputDir, sortedFiles);
    }

    _cleanup(dir, allowedFiles) {
        const items = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            const relativePath = path.relative(this.outputDir, fullPath).replace(/\\/g, '/');
            
            if (item.isDirectory()) {
                // Don't delete directories like 'custom' if they are not part of our layout
                // But we should clean up our own subdirectories
                this._cleanup(fullPath, allowedFiles);
                
                // If directory is empty after cleanup, remove it (optional)
                if (fs.readdirSync(fullPath).length === 0) {
                    // fs.rmdirSync(fullPath);
                }
            } else {
                if (item.name !== '.generated_files' && !allowedFiles.includes(relativePath)) {
                    // Only delete if it's within our managed subdirectories or at root of outputDir
                    // To be safe, we only delete if it's a file we might have generated (e.g. .lst)
                    // or if it's in a directory defined in outputLayout
                    fs.unlinkSync(fullPath);
                }
            }
        }
    }
}

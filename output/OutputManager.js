import fs from 'fs';
import path from 'path';
import { applyTemplate } from './templates.js';

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

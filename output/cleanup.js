import fs from 'fs';
import path from 'path';

export function cleanupOutputDir(outputDir, allowedFiles, rootDir = outputDir) {
    if (!fs.existsSync(outputDir)) {
        return;
    }

    const items = fs.readdirSync(outputDir, { withFileTypes: true });

    for (const item of items) {
        const fullPath = path.join(outputDir, item.name);
        const relativePath = path.relative(rootDir, fullPath).replace(/\\/g, '/');

        if (item.isDirectory()) {
            cleanupOutputDir(fullPath, allowedFiles, rootDir);

            if (fs.readdirSync(fullPath).length === 0) {
                fs.rmdirSync(fullPath);
            }
        } else if (item.name !== '.generated_files' && !allowedFiles.includes(relativePath)) {
            fs.unlinkSync(fullPath);
        }
    }
}

export function finalizeOutputDir(outputDir, generatedFiles) {
    const sortedFiles = [...generatedFiles].sort();
    const resolvedDir = path.resolve(outputDir);

    fs.mkdirSync(resolvedDir, { recursive: true });
    fs.writeFileSync(
        path.join(resolvedDir, '.generated_files'),
        sortedFiles.join('\n') + '\n'
    );
    cleanupOutputDir(resolvedDir, sortedFiles, resolvedDir);
}

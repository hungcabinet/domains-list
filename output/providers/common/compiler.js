import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const compilerCache = new Map();

export function writeUtf8NoBom(filePath, content) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
}

function runCommand(command, args, label) {
    const result = spawnSync(command, args, {
        encoding: 'utf8',
        shell: process.platform === 'win32'
    });

    if (result.error) {
        throw new Error(`${label}: failed to run "${command}": ${result.error.message}`);
    }

    if (result.status !== 0) {
        const stderr = (result.stderr || '').trim();
        const stdout = (result.stdout || '').trim();
        const detail = stderr || stdout || `exit code ${result.status}`;
        throw new Error(`${label}: ${detail}`);
    }

    return (result.stdout || '').trim();
}

export function ensureCompiler(kind, options) {
    const requireCompiler = options.requireCompiler !== false;
    const cacheKey = `${kind}:${kind === 'mihomo' ? options.mihomoPath : options.singboxPath}`;

    if (compilerCache.has(cacheKey)) {
        const cached = compilerCache.get(cacheKey);
        if (!cached.ok && requireCompiler) {
            throw new Error(cached.error);
        }
        return cached;
    }

    const command = kind === 'mihomo'
        ? (options.mihomoPath || 'mihomo')
        : (options.singboxPath || 'sing-box');
    const args = kind === 'mihomo' ? ['-v'] : ['version'];
    const label = kind === 'mihomo' ? 'mihomo' : 'sing-box';

    try {
        const versionOutput = runCommand(command, args, label);
        const cached = { ok: true, command, version: versionOutput };
        compilerCache.set(cacheKey, cached);
        console.log(`[${label}] ${versionOutput.split('\n')[0]}`);
        return cached;
    } catch (err) {
        const cached = { ok: false, error: err.message };
        compilerCache.set(cacheKey, cached);
        if (requireCompiler) {
            throw err;
        }
        console.warn(`[${label}] ${err.message}`);
        return cached;
    }
}

export function compileMrs(behavior, sourcePath, targetPath, options) {
    const compiler = ensureCompiler('mihomo', options);
    if (!compiler.ok) {
        return false;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    runCommand(
        compiler.command,
        ['convert-ruleset', behavior, 'text', sourcePath, targetPath],
        'mihomo convert-ruleset'
    );
    return true;
}

export function compileSrs(sourcePath, targetPath, options) {
    const compiler = ensureCompiler('singbox', options);
    if (!compiler.ok) {
        return false;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    runCommand(
        compiler.command,
        ['rule-set', 'compile', '-o', targetPath, sourcePath],
        'sing-box rule-set compile'
    );
    return true;
}

export function swapExtension(relativePath, newExtension) {
    const dot = relativePath.lastIndexOf('.');
    if (dot === -1) {
        return `${relativePath}.${newExtension}`;
    }
    return `${relativePath.slice(0, dot + 1)}${newExtension}`;
}

export function targetPathForSource(sourceFile, options) {
    const outputDir = path.resolve(options.outputDir || './lists');
    const targetExtension = options.fileExtension || 'mrs';
    const sourceExtension = options.sourceExtension ?? 'txt';
    let relativeName = sourceFile.relativeName;

    if (options.sourceLayout) {
        const sourceDir = options.sourceLayout[sourceFile.type] || '.';
        const targetDir = options.outputLayout?.[sourceFile.type] || '.';

        if (sourceDir !== '.' && relativeName.startsWith(`${sourceDir}/`)) {
            const filePart = relativeName.slice(sourceDir.length + 1);
            relativeName = targetDir === '.'
                ? filePart
                : path.join(targetDir, filePart).replace(/\\/g, '/');
        } else if (sourceDir === '.' && targetDir !== '.') {
            relativeName = path.join(targetDir, relativeName).replace(/\\/g, '/');
        }
    }

    if (relativeName.endsWith(`.${sourceExtension}`)) {
        relativeName = `${relativeName.slice(0, -(sourceExtension.length + 1))}.${targetExtension}`;
    } else {
        relativeName = swapExtension(relativeName, targetExtension);
    }

    return {
        fullPath: path.join(outputDir, relativeName),
        relativeName
    };
}

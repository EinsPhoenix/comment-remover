import * as path from 'path';
function patternToRegex(pattern: string): RegExp {
    let regexPattern = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '{{GLOBSTAR}}')
        .replace(/\*/g, '[^/\\\\]*')
        .replace(/\?/g, '[^/\\\\]')
        .replace(/{{GLOBSTAR}}/g, '.*');
    return new RegExp(`^${regexPattern}$`, 'i');
}
function isDirectoryPattern(pattern: string): boolean {
    return pattern.endsWith('/') || pattern.endsWith('\\');
}
export function shouldIgnoreFile(filePath: string, ignorePatterns: string[]): boolean {
    if (!ignorePatterns || ignorePatterns.length === 0) {
        return false;
    }
    const fileName = path.basename(filePath);
    const normalizedPath = filePath.replace(/\\/g, '/');
    for (const pattern of ignorePatterns) {
        if (!pattern || pattern.trim() === '') {
            continue;
        }
        const trimmedPattern = pattern.trim();
        if (isDirectoryPattern(trimmedPattern)) {
            continue;
        }
        if (!trimmedPattern.includes('/') && !trimmedPattern.includes('\\')) {
            const regex = patternToRegex(trimmedPattern);
            if (regex.test(fileName)) {
                return true;
            }
        }
        const pathRegex = patternToRegex(trimmedPattern);
        if (pathRegex.test(normalizedPath)) {
            return true;
        }
        if (normalizedPath.endsWith('/' + trimmedPattern) || normalizedPath.endsWith(trimmedPattern)) {
            return true;
        }
    }
    return false;
}
export function shouldIgnoreDirectory(dirPath: string, dirName: string, ignorePatterns: string[], ignoredDirectories: string[]): boolean {
    if (ignoredDirectories.includes(dirName)) {
        return true;
    }
    if (!ignorePatterns || ignorePatterns.length === 0) {
        return false;
    }
    const normalizedPath = dirPath.replace(/\\/g, '/');
    for (const pattern of ignorePatterns) {
        if (!pattern || pattern.trim() === '') {
            continue;
        }
        let trimmedPattern = pattern.trim();
        if (isDirectoryPattern(trimmedPattern)) {
            trimmedPattern = trimmedPattern.slice(0, -1);
        }
        if (!trimmedPattern.includes('/') && !trimmedPattern.includes('\\')) {
            const regex = patternToRegex(trimmedPattern);
            if (regex.test(dirName)) {
                return true;
            }
        }
        const pathRegex = patternToRegex(trimmedPattern);
        if (pathRegex.test(normalizedPath)) {
            return true;
        }
        if (normalizedPath.endsWith('/' + trimmedPattern) || normalizedPath.endsWith(trimmedPattern)) {
            return true;
        }
        if (normalizedPath.includes('/' + trimmedPattern + '/')) {
            return true;
        }
    }
    return false;
}
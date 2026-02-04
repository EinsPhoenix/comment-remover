import { isInsideString } from '../utils/stringUtils';
import { getConfig } from './config';
function shouldPreserveComment(line: string, commentIndex: number, commentMarker: string): boolean {
    const config = getConfig();
    const prefixes = config.preserveCommentPrefixes;
    if (prefixes.length === 0) {
        return false;
    }
    const afterMarker = line.substring(commentIndex + commentMarker.length);
    for (const prefix of prefixes) {
        if (afterMarker.startsWith(prefix)) {
            return true;
        }
    }
    return false;
}
function findLineCommentIndex(line: string): number {
    const config = getConfig();
    if (!config.removeLineComments) {
        return -1;
    }
    let index = line.indexOf(' //');
    while (index !== -1) {
        if (!isInsideString(line, index) && !shouldPreserveComment(line, index + 1, '//')) {
            return index;
        }
        index = line.indexOf(' //', index + 1);
    }
    index = line.indexOf('\t//');
    while (index !== -1) {
        if (!isInsideString(line, index) && !shouldPreserveComment(line, index + 1, '//')) {
            return index;
        }
        index = line.indexOf('\t//', index + 1);
    }
    const trimmedLine = line.trimStart();
    if (trimmedLine.startsWith('//')) {
        const startIndex = line.length - trimmedLine.length;
        if (!shouldPreserveComment(line, startIndex, '//')) {
            return startIndex;
        }
    }
    index = line.indexOf(' #');
    while (index !== -1) {
        if (!isInsideString(line, index) && !shouldPreserveComment(line, index + 1, '#')) {
            return index;
        }
        index = line.indexOf(' #', index + 1);
    }
    index = line.indexOf('\t#');
    while (index !== -1) {
        if (!isInsideString(line, index) && !shouldPreserveComment(line, index + 1, '#')) {
            return index;
        }
        index = line.indexOf('\t#', index + 1);
    }
    if (trimmedLine.startsWith('#')) {
        const startIndex = line.length - trimmedLine.length;
        if (!shouldPreserveComment(line, startIndex, '#')) {
            return startIndex;
        }
    }
    index = line.indexOf('{//');
    while (index !== -1) {
        if (!isInsideString(line, index) && !shouldPreserveComment(line, index + 1, '//')) {
            return index + 1;
        }
        index = line.indexOf('{//', index + 1);
    }
    index = line.indexOf('{#');
    while (index !== -1) {
        if (!isInsideString(line, index) && !shouldPreserveComment(line, index + 1, '#')) {
            return index + 1;
        }
        index = line.indexOf('{#', index + 1);
    }
    return -1;
}
function findBlockCommentEndIndex(line: string): number {
    const config = getConfig();
    if (!config.removeBlockComments) {
        return -1;
    }
    let index = line.indexOf(' */');
    while (index !== -1) {
        if (!isInsideString(line, index)) {
            return index;
        }
        index = line.indexOf(' */', index + 1);
    }
    index = line.indexOf('\t*/');
    while (index !== -1) {
        if (!isInsideString(line, index)) {
            return index;
        }
        index = line.indexOf('\t*/', index + 1);
    }
    return -1;
}
function removeBlockComments(text: string): string {
    const config = getConfig();
    if (!config.removeBlockComments) {
        return text;
    }
    let result = '';
    let i = 0;
    while (i < text.length) {
        const char = text[i];
        const nextChar = text[i + 1] || '';
        const prevChar = i > 0 ? text[i - 1] : '';
        if (char === '"' || char === "'" || char === '`') {
            const quote = char;
            result += char;
            i++;
            while (i < text.length) {
                const c = text[i];
                result += c;
                if (c === '\\' && i + 1 < text.length) {
                    i++;
                    result += text[i];
                    i++;
                    continue;
                }
                if (c === quote) {
                    i++;
                    break;
                }
                if (quote === '`' && c === '$' && text[i + 1] === '{') {
                    result += text[i + 1];
                    i += 2;
                    let braceCount = 1;
                    while (i < text.length && braceCount > 0) {
                        const ec = text[i];
                        result += ec;
                        if (ec === '{') braceCount++;
                        if (ec === '}') braceCount--;
                        i++;
                    }
                    continue;
                }
                i++;
            }
            continue;
        }
        if (char === '/' && nextChar !== '/' && nextChar !== '*') {
            const beforeSlash = result.trimEnd();
            const lastChar = beforeSlash[beforeSlash.length - 1] || '';
            const regexPreceders = ['(', ',', '=', ':', '[', '!', '&', '|', ';', '{', '}', '\n', ''];
            const isRegexStart = regexPreceders.includes(lastChar) ||
                beforeSlash.endsWith('return') ||
                beforeSlash.endsWith('throw') ||
                beforeSlash.endsWith('case') ||
                beforeSlash.endsWith('typeof') ||
                beforeSlash.endsWith('instanceof') ||
                result.length === 0;
            if (isRegexStart) {
                result += char;
                i++;
                while (i < text.length) {
                    const c = text[i];
                    result += c;
                    if (c === '\\' && i + 1 < text.length) {
                        i++;
                        result += text[i];
                        i++;
                        continue;
                    }
                    if (c === '[') {
                        i++;
                        while (i < text.length && text[i] !== ']') {
                            result += text[i];
                            if (text[i] === '\\' && i + 1 < text.length) {
                                i++;
                                result += text[i];
                            }
                            i++;
                        }
                        if (i < text.length) {
                            result += text[i];
                            i++;
                        }
                        continue;
                    }
                    if (c === '/') {
                        i++;
                        while (i < text.length && /[gimsuy]/.test(text[i])) {
                            result += text[i];
                            i++;
                        }
                        break;
                    }
                    if (c === '\n') {
                        i++;
                        break;
                    }
                    i++;
                }
                continue;
            }
        }
        if (char === '/' && nextChar === '*') {
            const isJSDoc = text[i + 2] === '*' && text[i + 3] !== '/';
            if (config.preserveJSDocComments && isJSDoc) {
                result += char;
                i++;
                continue;
            }
            const trimmedResult = result.trimEnd();
            const isJSXComment = trimmedResult.endsWith('{');
            let endIndex = text.indexOf('*/', i + 2);
            if (endIndex === -1) {
                result += text.substring(i);
                break;
            }
            i = endIndex + 2;
            if (isJSXComment && text[i] === '}') {
                result = trimmedResult.substring(0, trimmedResult.length - 1) +
                    result.substring(trimmedResult.length);
                i++;
            }
            continue;
        }
        result += char;
        i++;
    }
    return result;
}
function processLine(line: string): string {
    let processedLine = line;
    const lineCommentIndex = findLineCommentIndex(line);
    if (lineCommentIndex !== -1) {
        processedLine = processedLine.substring(0, lineCommentIndex);
    }
    const blockCommentEndIndex = findBlockCommentEndIndex(processedLine);
    if (blockCommentEndIndex !== -1) {
        processedLine = processedLine.substring(0, blockCommentEndIndex);
    }
    return processedLine;
}
export function removeComments(text: string): string {
    const config = getConfig();
    const processedText = removeBlockComments(text);
    const lines = processedText.split('\n');
    const processedLines = lines.map(processLine);
    if (config.removeEmptyLines) {
        const nonEmptyLines = processedLines.filter(line => line.trim().length > 0);
        return nonEmptyLines.join('\n');
    }
    return processedLines.join('\n');
}

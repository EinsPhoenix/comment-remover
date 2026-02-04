export function isInsideString(line: string, position: number): boolean {
    let inDoubleQuote = false;
    let inSingleQuote = false;
    let inBacktick = false;
    for (let i = 0; i < position; i++) {
        const char = line[i];
        const prevChar = i > 0 ? line[i - 1] : '';
        if (prevChar === '\\') {
            continue;
        }
        if (char === '"' && !inSingleQuote && !inBacktick) {
            inDoubleQuote = !inDoubleQuote;
        } else if (char === "'" && !inDoubleQuote && !inBacktick) {
            inSingleQuote = !inSingleQuote;
        } else if (char === '`' && !inDoubleQuote && !inSingleQuote) {
            inBacktick = !inBacktick;
        }
    }
    return inDoubleQuote || inSingleQuote || inBacktick;
}
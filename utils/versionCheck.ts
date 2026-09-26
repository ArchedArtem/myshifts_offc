/**
 * Сравнивает две семантические версии (например, "1.2.5" и "1.3.0").
 * Возвращает:
 *   -1, если v1 < v2 (требуется обновление)
 *    0, если v1 === v2
 *    1, если v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
    if (!v1 || !v2) return 0;

    const parts1 = v1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = v2.split('.').map(n => parseInt(n, 10) || 0);

    const maxLength = Math.max(parts1.length, parts2.length);

    for (let i = 0; i < maxLength; i++) {
        const num1 = parts1[i] || 0;
        const num2 = parts2[i] || 0;

        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }

    return 0;
}
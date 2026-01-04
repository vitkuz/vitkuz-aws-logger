import crypto from 'crypto';

export type RedactionStrategy = 'mask' | 'remove' | 'hash' | string | ((value: any) => any);

export interface RedactionConfig {
    /**
     * Array of keys to redact.
     * Case-insensitive matching is recommended/implemented.
     */
    keys: string[];
    /**
     * Map of specific key to strategy.
     * If a key is in 'keys' but not here, it uses the default strategy ('mask').
     */
    strategies?: Record<string, RedactionStrategy>;
    /**
     * Default strategy for keys found in the list but not in the strategy map.
     * Default: 'mask'
     */
    defaultStrategy?: RedactionStrategy;
}

export const COMMON_REDACTION_KEYS = [
    'password',
    'passwd',
    'secret',
    'token',
    'access_token',
    'access-token',
    'auth',
    'auth-token',
    'authorization',
    'apikey',
    'api_key',
    'api-key',
    'card',
    'cvv',
    'ssn',
    'pin',
];

/**
 * Applies the redaction strategy to a single value.
 */
const applyStrategy = (value: any, strategy: RedactionStrategy): any => {
    if (typeof strategy === 'function') {
        return strategy(value);
    }

    if (typeof strategy === 'string' && strategy.startsWith('mask-last-')) {
        const parts = strategy.split('-');
        const lastN = parseInt(parts[2], 10);

        if (typeof value === 'string' && !isNaN(lastN)) {
            if (value.length <= lastN) {
                return value; // Or mask entirely? Usually if shorter, we show it or mask all. Let's return as is or mask all?
                // Security wise: showing short secrets fully is bad. Masking all is safer.
                // BUT, if user asked for last 4 and length is 3, showing 3 is effectively "last 4".
                // Let's mask all if length <= lastN to be safe? Or just return.
                // Actually, standard is usually: if len <= N, show all (it IS the last N).
                // But for API keys, usually we want to see SOMETHING masked.
                // Let's preserve standard behavior: visible suffix.
                return value;
            }
            const maskLen = value.length - lastN;
            return '*'.repeat(maskLen) + value.slice(-lastN);
        }
        return '*****'; // Fallback for non-strings
    }

    switch (strategy) {
        case 'remove':
            return undefined;
        case 'hash':
            if (typeof value === 'string' || typeof value === 'number') {
                return crypto.createHash('sha256').update(String(value)).digest('hex');
            }
            return '[HASH_FAILED_TYPE]';
        case 'mask':
        default:
            return '*****';
    }
};

/**
 * Recursively walks the object and redacts fields matching the config.
 */
export const recursiveRedact = (
    target: any,
    config: RedactionConfig,
    cache = new Set<any>(),
): any => {
    if (target === null || typeof target !== 'object') {
        return target;
    }

    // Handle circular references
    if (cache.has(target)) {
        return '[Circular]';
    }
    cache.add(target);

    // Handle Arrays
    if (Array.isArray(target)) {
        return target.map((item) => recursiveRedact(item, config, cache));
    }

    // Handle Objects
    const redactedObj: Record<string, any> = {};
    const keysToRedact = new Set(config.keys.map((k) => k.toLowerCase()));

    for (const [key, value] of Object.entries(target)) {
        const lowerKey = key.toLowerCase();

        if (keysToRedact.has(lowerKey)) {
            // Determine strategy
            let strategy = config.defaultStrategy || 'mask';
            if (config.strategies && config.strategies[key]) {
                // Try exact match first
                strategy = config.strategies[key];
            } else if (config.strategies) {
                // Try case-insensitive lookup in strategies if needed,
                // but for simplicity let's rely on specific keys matching or default.
                // Actually, user might put 'Password': 'hash' and we matched 'password'.
                // Let's iterate strategies keys to find case-insensitive match if strictly needed.
                // For performance/simplicity, strict case matching in strategies map is safer,
                // but generic 'keys' list is case-insensitive.

                // Let's look for a key in strategies that matches lowerKey
                const strategyKey = Object.keys(config.strategies).find(
                    (k) => k.toLowerCase() === lowerKey,
                );
                if (strategyKey) {
                    strategy = config.strategies[strategyKey];
                }
            }

            const result = applyStrategy(value, strategy);
            if (result !== undefined) {
                redactedObj[key] = result;
            }
            // If undefined (remove strategy), we just don't add the key.
        } else {
            // Recurse
            redactedObj[key] = recursiveRedact(value, config, cache);
        }
    }

    return redactedObj;
};

export const createRedactor = (config: RedactionConfig) => {
    return (info: any) => {
        return recursiveRedact(info, config);
    };
};

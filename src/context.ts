import { AsyncLocalStorage } from 'async_hooks';
import { Logger } from './types';

// We store a reference to the logger so we can update it in-place for the current context
interface LoggerStore {
    logger: Logger;
    requestId?: string;
}

const asyncLocalStorage = new AsyncLocalStorage<LoggerStore>();

/**
 * Runs a callback within a logger context.
 * The logger provided becomes the "current" logger for the duration of the callback.
 */
export const runWithLogger = <T>(logger: Logger, callback: () => T, requestId?: string): T => {
    return asyncLocalStorage.run({ logger, requestId }, callback);
};

/**
 * Gets the current logger from the async context.
 */
export const getLogger = (): Logger | undefined => {
    const store = asyncLocalStorage.getStore();
    return store?.logger;
};

/**
 * Gets the current request ID from the async context.
 */
export const getRequestId = (): string | undefined => {
    const store = asyncLocalStorage.getStore();
    return store?.requestId;
};

/**
 * Updates the current context's logger.
 * This effectively "extends" the logger for the remainder of the current async execution
 * and any further downstream calls sharing this context.
 */
export const updateLoggerContext = (newLogger: Logger): void => {
    const store = asyncLocalStorage.getStore();
    if (store) {
        store.logger = newLogger;
    } else {
        // If we are not in a context, we can't update it.
        // We could throw, or warn. For now, let's warn.
        console.warn(
            'AntigravityLogger: updateLoggerContext called outside of an active context. Logic ignored.',
        );
    }
};

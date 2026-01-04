import { AsyncLocalStorage } from 'async_hooks';
import { Logger } from './types';

// We store a reference to the logger so we can update it in-place for the current context
interface LoggerStore {
    logger: Logger;
}

const asyncLocalStorage = new AsyncLocalStorage<LoggerStore>();

/**
 * Runs a callback within a logger context.
 * The logger provided becomes the "current" logger for the duration of the callback.
 */
export const runWithLogger = <T>(logger: Logger, callback: () => T): T => {
    return asyncLocalStorage.run({ logger }, callback);
};

/**
 * Gets the current logger from the async context.
 * Throws an error if called outside of a runWithLogger context,
 * unless a fallback is provided (though usually we want to enforce context).
 *
 * To make it easier to use, we can return undefined or a default logger if needed,
 * but for this specific feature request "access by all down the stream", strictness is good.
 */
export const getLogger = (): Logger | undefined => {
    const store = asyncLocalStorage.getStore();
    return store?.logger;
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

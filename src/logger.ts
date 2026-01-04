import winston from 'winston';
import { Logger } from './types';
import { DEFAULT_LOG_LEVEL } from './constants';
import { RedactionConfig, createRedactor } from './redactor';

export interface CreateLoggerOptions {
    /**
     * Default context to include in all logs
     */
    defaultContext?: Record<string, any>;
    /**
     * Log level (default: process.env.LOG_LEVEL || 'info')
     */
    level?: string;
    /**
     * Configuration for data redaction
     */
    redaction?: RedactionConfig;
}

const formatContext = (context?: Record<string, any>): Record<string, any> => {
    return context || {};
};

const createLoggerWrapper = (winstonLogger: winston.Logger): Logger => {
    return {
        debug: (message: string, context?: Record<string, any>): void => {
            winstonLogger.debug(message, formatContext(context));
        },

        info: (message: string, context?: Record<string, any>): void => {
            winstonLogger.info(message, formatContext(context));
        },

        warn: (message: string, context?: Record<string, any>): void => {
            winstonLogger.warn(message, formatContext(context));
        },

        error: (message: string, error?: Error | string, context?: Record<string, any>): void => {
            const meta = formatContext(context);
            if (error instanceof Error) {
                // Winston handles error objects well if passed as meta or splat
                // But for explicit structure, let's attach it
                // Spread error first to capture custom props, then overwrite standard ones to ensure presence
                const { message, name, stack, ...rest } = error;
                meta.error = {
                    ...rest,
                    message,
                    name,
                    stack,
                };
            } else if (error) {
                meta.error = error;
            }
            winstonLogger.error(message, meta);
        },

        child: (context: Record<string, any>): Logger => {
            // Winston's child() returns a new logger instance with the metadata bound
            return createLoggerWrapper(winstonLogger.child(context));
        },
    };
};

export const createLogger = (options: CreateLoggerOptions = {}): Logger => {
    const level = options.level || process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL;

    // Create redactor if config is present
    const redactor = options.redaction ? createRedactor(options.redaction) : null;

    // Custom format that applies redaction
    const redactionFormat = winston.format((info) => {
        if (redactor) {
            return redactor(info);
        }
        return info;
    });

    const format = winston.format.combine(
        winston.format.timestamp(),
        redactionFormat(), // Apply redaction before JSON
        winston.format.json(),
    );

    const winstonLogger = winston.createLogger({
        level,
        format,
        defaultMeta: options.defaultContext,
        transports: [new winston.transports.Console()],
    });

    return createLoggerWrapper(winstonLogger);
};

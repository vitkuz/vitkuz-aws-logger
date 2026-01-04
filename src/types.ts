export interface Logger {
    debug(message: string, context?: Record<string, any>): void;
    info(message: string, context?: Record<string, any>): void;
    warn(message: string, context?: Record<string, any>): void;
    error(message: string, error?: Error | string, context?: Record<string, any>): void;

    /**
     * Creates a child logger with bound context.
     * Any logs emitted by the child will include the parent's context plus the new context.
     */
    child(context: Record<string, any>): Logger;
}

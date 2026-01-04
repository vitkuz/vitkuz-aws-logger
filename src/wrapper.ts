import { CreateLoggerOptions, createLogger } from './logger';
import { runWithLogger } from './context';

// Generic Handler type compatible with AWS Lambda
// We use 'any' to avoid strict dependency on @types/aws-lambda for this generic wrapper
// but in practice it wraps (event, context, callback?) => Promise<any> | any
type Handler<TEvent = any, TResult = any> = (
    event: TEvent,
    context: any,
    callback?: any,
) => Promise<TResult> | void;

/**
 * Higher-order function to wrap a Lambda handler with logger context.
 * Automatically extracts 'awsRequestId' and 'functionName' from the Lambda context
 * and initializes a logger for the request scope.
 *
 * @param handler The original Lambda handler
 * @param options Logger options (level, redaction, etc.)
 */
export const withLogger = <TEvent = any, TResult = any>(
    handler: Handler<TEvent, TResult>,
    options: CreateLoggerOptions = {},
): Handler<TEvent, TResult> => {
    return async (event: TEvent, context: any, callback?: any) => {
        // 1. Initialize Logger
        // Create a root logger if custom options are provided, or use default behavior.
        // We create a FRESH logger instance for each request to ensure context isolation if needed?
        // Actually, creating a logger instance is cheap?
        // Winston createLogger is relatively heavy.
        // Optimization: We could reuse a global logger and just child() it.
        // But options might change? Usually options are static.
        // Let's assume options are static per lambda wrapper usage.

        // HOWEVER, to support dynamic options per request might be overkill.
        // Let's create one global logger instance for this wrapper instantiation if possible?
        // But wait, the standard `createLogger` we implemented creates a NEW winston instance every time.
        // We should probably cache it?
        // For now, let's keep it simple: createLogger per request.
        // If performance becomes an issue, we can refactor `createLogger` to reuse the winston instance if options match.

        const rootLogger = createLogger(options);

        // 2. Extract Context
        const requestContext: Record<string, any> = {};
        if (context) {
            if (context.awsRequestId) requestContext.requestId = context.awsRequestId;
            if (context.functionName) requestContext.functionName = context.functionName;
        }

        // 3. Create Child Logger with Request Context
        const scopedLogger = rootLogger.child(requestContext);

        // 3a. Log Event and Context
        scopedLogger.debug('Lambda Event', { event });
        scopedLogger.debug('Lambda Context', { context });

        // 4. Run Handler in Context
        return runWithLogger(scopedLogger, async () => {
            // We use 'await' to ensure the context stays active during the handler execution
            // If the handler accepts a callback, we might need special handling?
            // Most modern lambdas use async/await.
            // If legacy callback style is used, AsyncLocalStorage context *should* still propagate
            // if the callback is invoked asynchronously.
            // But we wrap the result in Promise usually.

            // Supporting both async and callback style:
            try {
                // If it returns a promise, await it
                const result = await handler(event, context, callback);
                return result as TResult;
            } catch (error) {
                // We could log unhandled errors here too?
                // Standard lambda practice is to let the error propagate so Lambda runtime sees it (and retries etc)
                // BUT we should log it first because once it leaves here, we might lose the logger context behavior.
                scopedLogger.error('Unhandled Lambda Exception', error as Error);
                throw error;
            }
        });
    };
};

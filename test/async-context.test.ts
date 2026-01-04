import { createLogger, runWithLogger, getLogger, updateLoggerContext } from '../src/index';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// A "deep" function that doesn't take logger as argument
const processingStep = async (stepName: string) => {
    const logger = getLogger();
    if (!logger) {
        throw new Error('Logger not found in context!');
    }
    logger.info(`Processing step: ${stepName}`);
    await sleep(10);
};

const downstreamTask = async () => {
    // Should see the updated context here
    const logger = getLogger();
    logger?.info('Downstream task running');
};

const run = async () => {
    console.log('--- Async Context Test ---');

    const rootLogger = createLogger({ level: 'info' });

    console.log('\n--> Starting Request 1');
    await runWithLogger(rootLogger.child({ requestId: 'req-1' }), async () => {
        await processingStep('init');

        // Extend context
        console.log('--> Updating Context with userId');
        const current = getLogger();
        if (current) {
            updateLoggerContext(current.child({ userId: 'u-123' }));
        }

        await processingStep('mid-process');
        await downstreamTask();
    });

    console.log('\n--> Starting Request 2 (Parallel check)');
    // Just to ensure contexts don't bleed
    await runWithLogger(rootLogger.child({ requestId: 'req-2' }), async () => {
        const log = getLogger();
        log?.info('Request 2 start');
        await processingStep('req-2-step');
    });
};

run().catch(console.error);

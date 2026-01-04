import { withLogger, getLogger } from '../src/index';

const run = async () => {
    console.log('--- Lambda Wrapper Test ---');

    const businessLogic = async () => {
        const logger = getLogger();
        if (!logger) throw new Error('Context lost!');
        logger.info('Business logic running');
        return 'success';
    };

    const rawHandler = async (event: any, context: any) => {
        const logger = getLogger();
        logger?.info('Handler started', { event });
        return await businessLogic();
    };

    const wrappedHandler = withLogger(rawHandler, { level: 'debug' });

    const mockEvent = { foo: 'bar' };
    const mockContext = { awsRequestId: 'req-wrapper-123', functionName: 'wrapped-fn' };

    console.log('\n--> invoking wrapped handler');
    const result = await wrappedHandler(mockEvent, mockContext);
    console.log('Result:', result);

    // Test Error Handling
    console.log('\n--> invoking wrapped handler with error');
    const failingHandler = async () => {
        throw new Error('Boom');
    };
    const wrappedFailing = withLogger(failingHandler);
    try {
        await wrappedFailing({}, mockContext);
    } catch (e: any) {
        console.log('Caught expected error:', e.message);
    }
};

run().catch(console.error);

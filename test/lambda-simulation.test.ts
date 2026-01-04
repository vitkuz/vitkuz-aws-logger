import { createLogger } from '../src/index';

// 1. Simulate a Lambda Event Handler
const lambdaHandler = async (event: any, context: any) => {
    // A. Initialize Logger with Request ID (Context)
    // In a real Lambda, request ID comes from context.awsRequestId
    const logger = createLogger().child({
        requestId: context.awsRequestId,
        functionName: context.functionName,
    });

    logger.info('Lambda started execution', { event });

    try {
        await processEvent(event, logger);
    } catch (error: any) {
        // C. Error Handling Example
        logger.error('Lambda failed', error);
        // Rethrow or return failure response
        return { statusCode: 500, body: 'Internal Server Error' };
    }

    logger.info('Lambda completed successfully');
    return { statusCode: 200, body: 'OK' };
};

// 2. Business Logic with Circular Reference Simulation
const processEvent = async (event: any, logger: ReturnType<typeof createLogger>) => {
    logger.debug('Processing event', { step: 'init' });

    if (event.trigger === 'error') {
        const circularObj: any = { name: 'Circular' };
        circularObj.self = circularObj; // Circle!

        // We create an Error and attach the circular object to it
        const err = new Error('Something triggered an error');
        (err as any).metadata = circularObj; // attach metadata with circle

        throw err;
    }
};

// 3. Execution
const runMockLambda = async () => {
    console.log('--- Lambda Simulation (Circular Ref & Errors) ---');

    const mockContext = {
        awsRequestId: 'req-abc-123',
        functionName: 'my-test-lambda',
    };

    console.log('\n--> Triggering Lambda with Error Event...');
    // Trigger error
    await lambdaHandler({ trigger: 'error', someData: 123 }, mockContext);
};

runMockLambda().catch(console.error);

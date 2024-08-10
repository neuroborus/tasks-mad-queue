import { setTimeout } from "node:timers/promises";

import { TasksQueueService, ITasksQueueLogger } from '../src';

let errorsThrow = 0;
let errorsCatch = 0;

class WrappedLogger implements ITasksQueueLogger {
    log(message: string): void { console.log(message) };
    fatal(message: string): void { console.error(message) };
    error(message: string): void { errorsCatch +=1 };
    warn(message: string): void { console.warn(message) };
    trace(message: string): void { console.debug(message) };
}
const wrappedLogger = new WrappedLogger();

async function shortFunc(n: number): Promise<number> {
    await setTimeout(5, () => {
        return;
    });
    // console.log(`!${n}!`);

    return n * n;
}

async function longFunc(n: number): Promise<number> {
    await setTimeout(100, () => {
        return;
    });
    // console.log(`!${n}!`);

    return n * n;
}

function errorFunc(n: number, taskId: string): Promise<number> {
    // console.debug(`[${taskId}]Error on its way!`);
    errorsThrow += 1;
    throw new Error("WOW!");
}

async function stableFunc(n: number, taskId: string): Promise<number> {
    if (Date.now() % 2) {
        return shortFunc(n);
    } else {
        return longFunc(n);
    }
}

function unstableFunc(n: number, taskId: string): Promise<number> {
    if (Date.now() % 2) {
        return errorFunc(n, taskId);
    }
    return stableFunc(n, taskId);
}

const Queue = new TasksQueueService({
    capacity: 1500,
    delayMS: 0,
    nonWaitRetriesPerTask: 40,
    nonWaitAutoProcess: true,
    logger: wrappedLogger,
});
const awaited: number[] = [];

const selectionSize = 10;
test('Step 1', async () => {
    for (let i = 0; i < selectionSize; ++i) {
        let result;
        try {
            result = await Queue.enqueueAndWait<number>(
                async () => await unstableFunc(i, i.toString()),
            );
            awaited.push(result);
        } catch (e) {
            wrappedLogger.error('-3');
            awaited.push(-3);
        }
    }
    await Queue.wait();
}, selectionSize * 1000);

test('Step 2', async () => {
    for (let i = -selectionSize; i < 0; ++i) {
        Queue.enqueue(async () => await errorFunc(i, i.toString()));
    }
}, selectionSize * 1000);

test('Step 3', async () => {
    for (let i = 0; i < selectionSize; ++i) {
        if (i % 3) {
            let result;
            try {
                result = await Queue.enqueueAndWait<number>(async () => await unstableFunc(i, i.toString()));
                awaited.push(result);
            } catch (e) {
                wrappedLogger.error('-3');
                awaited.push(-3);
            }
        } else {
            Queue.enqueue(async () => await unstableFunc(i, i.toString()));
        }
    }
}, selectionSize * 1000);

test('Step 4', () => {
    for (let i = 0; i < selectionSize; ++i) {
        Queue.enqueue(async () => await unstableFunc(i, i.toString()));
    }
    Queue.start();
}, selectionSize * 1000);

test('Finally', async () => {
    await Queue.wait();
    console.log(awaited);
    expect(errorsCatch).toBe(errorsThrow);
}, selectionSize * 1000);

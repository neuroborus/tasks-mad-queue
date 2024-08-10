import {ITasksQueueConfig} from '../entities';

export const TasksQueueDefaultConfig: ITasksQueueConfig = {
    delayMS: 0,
    capacity: 50,
    label: 'TasksQuery',
    nonWaitRetriesPerTask: 0,
    nonWaitAutoProcess: true,
};

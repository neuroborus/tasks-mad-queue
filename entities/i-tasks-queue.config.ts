import { ITasksQueueLogger } from './i-tasks-queue-logger';

export interface ITasksQueueConfig {
  delayMS: number;
  capacity: number;
  label: string;
  // Works only with influx (non-wait) tasks
  nonWaitRetriesPerTask: number;
  nonWaitAutoProcess: boolean;
  logger?: ITasksQueueLogger;
}


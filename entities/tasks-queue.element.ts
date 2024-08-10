import { UUID } from 'crypto';
import { TasksQueueFuncType } from './tasks-queue.func-type';

export type TasksQueueElement<T = unknown> = {
  func: TasksQueueFuncType<T>;
  id: UUID;
};

import { UUID } from 'crypto';
import { TasksQueueFuncType } from '../entities';

export type TasksQueueElement<T = unknown> = {
  func: TasksQueueFuncType<T>;
  id: UUID;
};

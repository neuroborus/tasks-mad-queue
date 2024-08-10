export interface ITasksQueueLogger {
  log(message: string): void;
  fatal?(message: string): void;
  error?(message: string): void;
  warn?(message: string): void;
  trace?(message: string): void;
}

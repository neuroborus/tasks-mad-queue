# Tasks Mad Queue

[![npm version](https://badge.fury.io/js/tasks-mad-queue.svg)](https://badge.fury.io/js/tasks-mad-queue)

## This project is just experiment. Please, use [Bee-queue](https://github.com/bee-queue/bee-queue?tab=readme-ov-file) instead.

```typescript
  // API

public start(): void {
    this.influxProcess();
}

public enqueue(func: TasksQueueFuncType): void {
    this.validations();
    this.enqueueInnerInflux(func);
}

public enqueueAndWait<T>(func: TasksQueueFuncType<T>): Promise<T> {
    this.validations();
    return this.enqueueInnerAndWait<T>(func);
}

public getConfig(): ITasksQueueConfig {
    return this.config;
}

public async wait(): Promise<void> {
    await this.currentProcess;
    return;
}

public isRunning(): boolean {
    return this.isActive;
}
```

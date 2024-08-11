import { randomUUID, UUID } from 'crypto';
import {
  TasksQueueErrorCodes,
  TasksQueueFuncType,
  ITasksQueueConfig,
} from '../entities';
import { TasksQueueElement } from './tasks-queue.element';
import { EMPTY_FUNC } from './tasks-queue.empty-func-constant';
import { TasksQueueDefaultConfig } from './tasks-queue.default-config';

export class TasksQueueService {
  private readonly config: ITasksQueueConfig;
  private tasks: TasksQueueElement[] = [];
  private isQueueRunning = false;

  private currentProcess: Promise<unknown> = EMPTY_FUNC();
  private awaitedTasks: Set<string> = new Set();
  private attemptCounter: Map<string, number> = new Map();

  constructor(config: Partial<ITasksQueueConfig> = {}) {
    this.config = {
      ...TasksQueueDefaultConfig,
      ...config,
    };
  }

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
    return this.isQueueRunning;
  }

  // Service

  private taskDestructor(taskId: string): void {
    this.attemptCounter.delete(taskId);
    this.awaitedTasks.delete(taskId);
  }

  private async sleepWithDelay(): Promise<void> {
    await new Promise((resolve) => {
      setTimeout(resolve, this.config.delayMS);
    });
  }

  private capacityValidation(): void {
    if (this.tasks.length >= this.config.capacity) {
      this.config.logger?.error?.(
        `${this.config.label} | ${this.tasks.length} capacity validation failed`,
      );
      throw new Error(TasksQueueErrorCodes.FULL_CAPACITY);
    }
  }

  private validations(): void {
    this.capacityValidation();
  }

  // Processors

  private enqueueInnerInflux(
    func: TasksQueueFuncType,
    taskId: UUID = randomUUID(),
  ): void {
    this.tasks.push({ func, id: taskId });
    if (this.config.nonWaitAutoProcess) this.influxProcess();
  }

  private async enqueueInnerAndWait<T>(
    func: TasksQueueFuncType<T>,
    taskId = randomUUID(),
  ): Promise<T> {
    this.tasks.push({ func, id: taskId });
    this.awaitedTasks.add(taskId);
    const result = (await this.waitForTurn<T>(taskId)) as T;
    if (this.config.nonWaitAutoProcess) this.influxProcess();
    return result;
  }

  private async waitForTurn<T>(taskId: UUID): Promise<T | null> {
    // Create new
    const process = async () => {
      // Wait for process
      await this.currentProcess;
      return await this.processTasks<T>(taskId);
    };

    // Set new process as current
    const waitedProcess = process();
    this.currentProcess = waitedProcess;
    return waitedProcess;
  }

  private influxProcess() {
    if (!this.isQueueRunning) this.currentProcess = this.processTasks();
  }

  // noinspection t
  private async processTasks<T>(waitFor?: UUID): Promise<T | null> {
    if (this.isQueueRunning) {
      if (waitFor) {
        this.config.logger?.fatal?.(
          `${this.config.label} | ${TasksQueueErrorCodes.BAD_ENTRANCE}`,
        );
        throw new Error(TasksQueueErrorCodes.BAD_ENTRANCE);
      }
      return null;
    }

    this.isQueueRunning = true;

    this.config.logger?.trace?.(
      `${this.config.label} | Process tasks started. Tasks in queue -> ${this.tasks.length}`,
    );

    const isWaitFor = (taskId: UUID) => waitFor === taskId;

    while (this.tasks.length > 0) {
      if (
        this.awaitedTasks.has(this.tasks[0].id) &&
        !isWaitFor(this.tasks[0].id)
      ) {
        if (!waitFor) {
          // Give control of waited task to waitFor function
          this.isQueueRunning = false;
          return null;
        } else {
          this.config.logger?.fatal?.(
            `${this.config.label} | ${TasksQueueErrorCodes.LOST_WAITED_TASK} Lost ${waitFor} task!`,
          );
          throw new Error(TasksQueueErrorCodes.LOST_WAITED_TASK);
        }
      }

      const task = this.tasks.shift();
      if (!task) {
        this.config.logger?.fatal?.(
          `${this.config.label} | ${TasksQueueErrorCodes.LOST_TASK}`,
        );
        throw new Error(TasksQueueErrorCodes.LOST_TASK);
      }

      this.config.logger?.trace?.(
        `${this.config.label} | Process task ${task.id} | Tasks in queue -> ${
          this.tasks.length
        }${waitFor ? ` | Waited for -> ${waitFor}` : ''}`,
      );

      let result = {} as T;
      let err: unknown;

      await this.sleepWithDelay();
      try {
        result = (await task.func()) as T;
        this.taskDestructor(task.id);
      } catch (e: unknown) {
        err = e;
        if (!isWaitFor(task.id)) {
          this.config.logger?.error?.(
            `${this.config.label} | Task ${task.id} -> ${e}`,
          );
          // Retries only for non-waited tasks
          const retriesCounter = this.attemptCounter.get(task.id) || 0;
          if (retriesCounter < this.config.nonWaitRetriesPerTask) {
            this.config.logger?.trace?.(
              `${this.config.label} | Retry task -> ${task.id}`,
            );
            this.attemptCounter.set(task.id, retriesCounter + 1);
            this.enqueueInnerInflux(task.func, task.id);
          } else {
            this.taskDestructor(task.id);
          }
        }
      } finally {
        this.config.logger?.trace?.(
          `${this.config.label} | Processed ${task.id}${
            waitFor ? ` | Waited for -> ${waitFor}` : ''
          }`,
        );
      }
      if (isWaitFor(task.id)) {
        this.currentProcess = EMPTY_FUNC(); // Q: What if waiting query would grow? A: an instant assignment in influxProcess()
        this.taskDestructor(task.id);
        this.isQueueRunning = false;
        if (err) {
          throw err;
        } else {
          return result;
        }
      }
    }

    this.currentProcess = EMPTY_FUNC();
    this.isQueueRunning = false;
    return null;
  }
}

import {
    ILogger
} from "./logger";

import PromiseConstructor = require("promise-polyfill");
if (typeof Promise === "undefined" && typeof window !== "undefined") {
    (window as any).Promise = PromiseConstructor;
}

export interface Runnable<ResultType> {

    /**
     * Performs the actual business logics.
     * Should resolve the promise when finished.
     */
    run(): Promise<ResultType>;

    /**
     * Whether two runnable conflict with each other.
     * Must work fast as its called often.
     * @param other
     */
    conflicts(other: Runnable<any>): boolean;

    /**
     * Cancels the runnable. run() method should do nothing if launched later,
     * if cancel is called during the run() method execution, run() should stop as soon as it can.
     */
    cancel(): void;

    /**
     * Whether cancel() method was called at least once.
     */
    isCanceled(): boolean;
}

export class Reconciler {

    private waitingList: Runnable<any>[] = [];
    private runningList: Runnable<any>[] = [];

    constructor(private logger: ILogger, private timeout: number) {
    }

    public schedule<ResultType>(runnable: Runnable<ResultType>): Promise<ResultType> {
        this.addToWaitingList(runnable);

        return new Promise((resolve: (value?: ResultType) => void, reject: (error?: any) => void) => {

            setTimeout(() => {

                this.logger.debugDetail("Time came to execute " + runnable.toString(),
                    "Reconciler", "schedule");

                if (runnable.isCanceled()) {
                    this.logger.debugDetail("Runnable " + runnable.toString() + " is cancelled, doing nothing",
                        "Reconciler", "schedule");

                    this.removeFromWaitingList(runnable);
                    return;
                }

                const currentlyRunning = this.findConflictingInRunningList(runnable);
                if (currentlyRunning) {
                    // TODO add an additional short timeout parameter to launch the reschedule
                    // at the finish of the currently running task for a short time after it.

                    this.logger.debugDetail("Conflicting to " + runnable.toString()
                        + " is found in the running list: " + currentlyRunning.toString()
                        + " rescheduling current one.",
                        "Reconciler", "schedule");

                    this.schedule(runnable);
                    return;
                }

                this.removeFromWaitingList(runnable);
                this.addToRunningList(runnable);

                this.logger.debugDetail("Executing " + runnable.toString(),
                    "Reconciler", "schedule");

                this.run(runnable).then(
                    (result) => { resolve(result); },
                    (error) => { reject(error); }
                );

            }, this.timeout);

        });
    }

    private run<ResultType>(runnable: Runnable<ResultType>): Promise<ResultType> {

        return runnable.run().then(

            (result): ResultType => {
                this.removeFromRunningList(runnable);
                return result;
            },
            (error): ResultType => {
                this.removeFromRunningList(runnable);
                throw error;
            }

        );
    }

    /**
     * Adds item to waiting list and removes anything currently in the list,
     * which conflicts with the new item.
     * @param runnable
     */
    private addToWaitingList<ResultType>(runnable: Runnable<ResultType>) {
        this.logger.debugDetail("Adding runnable " + runnable.toString() + " to waiting list",
            "Reconciler", "addToWaitingList");

        this.waitingList = this.waitingList.filter((current) => {

            this.logger.debugDetail("Comparing existing runnable " + current.toString() +
                " to the new " + runnable.toString(),
                "Reconciler", "addToWaitingList");

            const conflicts = runnable.conflicts(current);
            if (conflicts) {
                this.logger.debugDetail("Runnables are conflicting, canceling existing one",
                    "Reconciler", "addToWaitingList");

                current.cancel();
            }

            return !conflicts;
        });

        this.waitingList.push(runnable);
    }

    /**
     * Removes runnable from the list of running ones.
     * @param runnable
     */
    private removeFromWaitingList<ResultType>(runnable: Runnable<ResultType>) {
        this.logger.debugDetail("Removing " + runnable.toString()
            + " from waiting list",
            "Reconciler", "removeFromWaitingList");

        const index = this.waitingList.indexOf(runnable);
        if (index !== -1) {
            this.waitingList.splice(index, 1);
        }
    }

    /**
     * Adds runnable to the list of running ones.
     * @param runnable
     */
    private addToRunningList<ResultType>(runnable: Runnable<ResultType>) {
        this.logger.debugDetail("Adding " + runnable.toString()
            + " to running list",
            "Reconciler", "removeFromWaitingList");

        this.runningList.push(runnable);
    }

    /**
     * Removes runnable from the list of running ones.
     * @param runnable
     */
    private removeFromRunningList<ResultType>(runnable: Runnable<ResultType>) {
        this.logger.debugDetail("Removing " + runnable.toString()
            + " from running list",
            "Reconciler", "removeFromWaitingList");

        const index = this.runningList.indexOf(runnable);
        if (index !== -1) {
            this.runningList.splice(index, 1);
        }
    }

    /**
     * Finds the first conflicting runnable in the current list.
     * @param runnable
     * @returns {any}
     */
    private findConflictingInRunningList<ResultType>(runnable: Runnable<ResultType>): Runnable<ResultType> {
        for (const current of this.runningList) {
            if (runnable.conflicts(current)) {
                return current;
            }
        }

        return null;
    }
}

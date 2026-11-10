// Runs the randomness sanity check off the main thread so the UI never blocks.

import { runSanityCheck, type SanityReport } from "./stats";

export type SanityWorkerRequest = { rolls: number; isRecheck: boolean };
export type SanityWorkerResponse =
  | { type: "progress"; completed: number; total: number }
  | { type: "done"; report: SanityReport }
  | { type: "error"; message: string };

const scope = self as unknown as {
  onmessage: ((event: MessageEvent<SanityWorkerRequest>) => void) | null;
  postMessage(message: SanityWorkerResponse): void;
};

scope.onmessage = (event) => {
  try {
    const { rolls, isRecheck } = event.data;
    const report = runSanityCheck({
      rolls,
      isRecheck,
      onProgress: (completed, total) => scope.postMessage({ type: "progress", completed, total }),
    });
    scope.postMessage({ type: "done", report });
  } catch (error) {
    scope.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "Sanity check failed",
    });
  }
};

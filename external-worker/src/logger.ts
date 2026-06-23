/**
 * Minimal logger for the external worker.
 * Uses console with structured prefix — replace with Pino/Winston later
 * if you need log aggregation.
 */

const PREFIX = '[palmkit-worker]';

function ts(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (...args: unknown[]) => console.log(`${ts()} ${PREFIX} INFO`, ...args),
  warn: (...args: unknown[]) => console.warn(`${ts()} ${PREFIX} WARN`, ...args),
  error: (...args: unknown[]) => console.error(`${ts()} ${PREFIX} ERROR`, ...args),
  debug: (...args: unknown[]) => {
    if (process.env.WORKER_DEBUG === '1') {
      console.debug(`${ts()} ${PREFIX} DEBUG`, ...args);
    }
  },
};

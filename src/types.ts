export type BackoffStrategy = 'fixed' | 'exponential' | 'jitter' | 'fibonacci' | 'custom'
export type RetryState = 'idle' | 'running' | 'succeeded' | 'failed'

export type CustomBackoffFn = (attempt: number, error: unknown) => number

export interface RetryOptions {
  maxAttempts?: number
  delay?: number
  strategy?: BackoffStrategy
  retryIf?: (error: unknown) => boolean | Promise<boolean>
  timeout?: number
  onRetry?: (attempt: number, error: unknown, delay: number) => void
  signal?: AbortSignal
  customBackoff?: CustomBackoffFn
}

export class RetryError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RetryError'
  }
}

export class RetryTimeoutError extends RetryError {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? 'Retry attempt timed out', options)
    this.name = 'RetryTimeoutError'
  }
}

export class MaxAttemptsError extends RetryError {
  constructor(message?: string, options?: ErrorOptions) {
    super(message ?? 'Max retry attempts exceeded', options)
    this.name = 'MaxAttemptsError'
  }
}

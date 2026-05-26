import { retry } from './retry.ts'
import type { RetryOptions, RetryState } from './types.ts'

export class RetryPolicy {
  private readonly opts: RetryOptions
  private _state: RetryState = 'idle'
  private _attempts = 0

  constructor(options?: RetryOptions) {
    this.opts = { ...options }
  }

  get attempts(): number {
    return this._attempts
  }

  get state(): RetryState {
    return this._state
  }

  reset(): void {
    this._state = 'idle'
    this._attempts = 0
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    this._state = 'running'
    this._attempts = 0

    const wrappedFn = async () => {
      this._attempts++
      return await fn()
    }

    try {
      const result = await retry(wrappedFn, {
        ...this.opts,
        onRetry: (attempt, error, delay) => {
          this.opts.onRetry?.(attempt, error, delay)
        },
      })
      this._state = 'succeeded'
      return result
    } catch (error) {
      this._state = 'failed'
      throw error
    }
  }
}

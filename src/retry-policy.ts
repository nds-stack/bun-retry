import { retry } from './retry.js'
import type { RetryOptions, RetryState } from './types.js'
import { RetryError } from './types.js'

export class RetryPolicy {
  private readonly opts: RetryOptions
  private _state: RetryState = 'idle'
  private _attempts = 0
  private _running = false

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
    if (this._running) {
      throw new RetryError('RetryPolicy already running')
    }

    this._running = true
    this._state = 'running'
    this._attempts = 0

    const wrappedFn = async () => {
      this._attempts++
      return await fn()
    }

    try {
      const result = await retry(wrappedFn, this.opts)
      this._state = 'succeeded'
      return result
    } catch (error) {
      this._state = 'failed'
      throw error
    } finally {
      this._running = false
    }
  }
}

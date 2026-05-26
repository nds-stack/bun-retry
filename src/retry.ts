import { calculateDelay } from './strategies.js'
import type { RetryOptions } from './types.js'
import { MaxAttemptsError, RetryError, RetryTimeoutError } from './types.js'

const DEFAULTS = {
  maxAttempts: 3,
  delay: 1000,
  strategy: 'exponential' as const,
}

async function withTimeout<T>(
  fn: () => Promise<T>,
  timeout: number,
  signal?: AbortSignal,
  attemptNumber?: number,
): Promise<T> {
  if (signal?.aborted) {
    throw new RetryError('Retry cancelled', { cause: signal.reason })
  }

  if (timeout <= 0 && !signal) {
    return await fn()
  }

  const race: Promise<T>[] = [fn()]
  let abortCleanup: (() => void) | undefined

  if (timeout > 0) {
    const timeoutPromise = (async () => {
      await Bun.sleep(timeout)
      throw new RetryTimeoutError(
        `Attempt ${attemptNumber} timed out after ${timeout}ms`,
      )
    })()
    timeoutPromise.catch(() => {}) // supress orphan rejection after Promise.race settles
    race.push(timeoutPromise)
  }

  if (signal) {
    const signalPromise = new Promise<never>((_, reject) => {
      if (signal.aborted) {
        reject(new RetryError('Retry cancelled', { cause: signal.reason }))
        return
      }
      const handler = () => {
        reject(new RetryError('Retry cancelled', { cause: signal.reason }))
      }
      signal.addEventListener('abort', handler, { once: true })
      abortCleanup = () => signal.removeEventListener('abort', handler)
    })
    signalPromise.catch(() => {}) // supress orphan rejection after Promise.race settles
    race.push(signalPromise)
  }

  try {
    return await Promise.race(race)
  } finally {
    abortCleanup?.()
  }
}

export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions,
): Promise<T> {
  const maxAttempts = options?.maxAttempts ?? DEFAULTS.maxAttempts
  const baseDelay = options?.delay ?? DEFAULTS.delay
  const strategy = options?.strategy ?? DEFAULTS.strategy
  const retryIf = options?.retryIf
  const timeout = options?.timeout ?? 0
  const onRetry = options?.onRetry
  const signal = options?.signal
  const customBackoff = options?.customBackoff

  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new TypeError('maxAttempts must be a positive integer >= 1')
  }

  if (!Number.isFinite(baseDelay) || baseDelay < 0) {
    throw new TypeError('delay must be a non-negative finite number')
  }

  if (customBackoff && strategy !== 'custom') {
    throw new TypeError('customBackoff requires strategy: "custom"')
  }

  const useTimeout = timeout > 0 || !!signal
  const delayFn = strategy === 'fixed' && !customBackoff
    ? () => baseDelay
    : (attempt: number, error: unknown) => calculateDelay(strategy, baseDelay, attempt, error, customBackoff)

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new RetryError('Retry cancelled', { cause: signal.reason })
    }

    try {
      if (useTimeout) {
        return await withTimeout(fn, timeout, signal, attempt + 1)
      }
      return await fn()
    } catch (error) {
      const isLastAttempt = attempt === maxAttempts - 1

      if (error instanceof RetryError && !(error instanceof RetryTimeoutError)) {
        throw error
      }

      if (retryIf) {
        const shouldRetry = await retryIf(error)
        if (typeof shouldRetry !== 'boolean') {
          throw new TypeError('retryIf must return a boolean')
        }
        if (!shouldRetry) throw error
      }

      if (isLastAttempt) {
        throw new MaxAttemptsError(
          `Failed after ${maxAttempts} attempts`,
          { cause: error },
        )
      }

      const delay = delayFn(attempt, error)
      onRetry?.(attempt + 1, error, delay)
      if (delay > 0 && Number.isFinite(delay)) await Bun.sleep(delay)
    }
  }

  throw new MaxAttemptsError(
    `Failed after ${maxAttempts} attempts`,
  )
}

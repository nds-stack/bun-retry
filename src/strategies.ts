import type { BackoffStrategy, CustomBackoffFn } from './types.ts'

function fib(n: number): number {
  if (n <= 1) return 1
  let a = 1, b = 1
  for (let i = 2; i <= n; i++) {
    const t = a + b
    a = b
    b = t
  }
  return b
}

export function calculateDelay(
  strategy: BackoffStrategy,
  baseDelay: number,
  attempt: number,
  error: unknown,
  customBackoff?: CustomBackoffFn,
): number {
  switch (strategy) {
    case 'fixed':
      return baseDelay
    case 'exponential':
      return baseDelay * Math.pow(2, attempt)
    case 'jitter': {
      const exp = baseDelay * Math.pow(2, attempt)
      return exp * (0.5 + Math.random() * 0.5)
    }
    case 'fibonacci':
      return baseDelay * fib(attempt)
    case 'custom':
      if (!customBackoff) {
        throw new TypeError('Custom strategy requires a customBackoff function')
      }
      return customBackoff(attempt, error)
    default:
      return baseDelay * Math.pow(2, attempt)
  }
}

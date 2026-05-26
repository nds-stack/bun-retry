import { describe, test, expect } from 'bun:test'
import { retry, RetryPolicy, RetryTimeoutError, MaxAttemptsError, RetryError } from '../src/index.ts'

describe('retry()', () => {
  test('succeeds on first try', async () => {
    const result = await retry(() => Promise.resolve('ok'), { maxAttempts: 3 })
    expect(result).toBe('ok')
  })

  test('succeeds after N failures', async () => {
    let c = 0
    const result = await retry(async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    }, { maxAttempts: 5, delay: 1 })
    expect(result).toBe('ok')
    expect(c).toBe(3)
  })

  test('throws MaxAttemptsError after exhausting attempts', async () => {
    const fn = async () => { throw new Error('always fail') }
    expect(
      retry(fn, { maxAttempts: 2, delay: 1 }),
    ).rejects.toThrow(MaxAttemptsError)
  })

  test('uses fixed backoff', async () => {
    const delays: number[] = []
    let c = 0
    await retry(async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    }, {
      maxAttempts: 3,
      strategy: 'fixed',
      delay: 5,
      onRetry: (_, __, d) => { delays.push(d) },
    })
    expect(delays.length).toBe(2)
    expect(delays[0]).toBe(5)
    expect(delays[1]).toBe(5)
  })

  test('uses exponential backoff', async () => {
    const delays: number[] = []
    let c = 0
    await retry(async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    }, {
      maxAttempts: 3,
      strategy: 'exponential',
      delay: 10,
      onRetry: (_, __, d) => { delays.push(d) },
    })
    expect(delays[0]).toBe(10 * Math.pow(2, 0)) // 10
    expect(delays[1]).toBe(10 * Math.pow(2, 1)) // 20
  })

  test('uses jitter backoff (reasonable range)', async () => {
    const delays: number[] = []
    let c = 0
    await retry(async () => {
      c++
      if (c < 5) throw new Error('fail')
      return 'ok'
    }, {
      maxAttempts: 5,
      strategy: 'jitter',
      delay: 100,
      onRetry: (_, __, d) => { delays.push(d) },
    })
    expect(delays.length).toBe(4)
    for (const d of delays) {
      const base = 100 * Math.pow(2, delays.indexOf(d))
      expect(d).toBeGreaterThanOrEqual(base * 0.5)
      expect(d).toBeLessThanOrEqual(base * 1.0)
    }
  })

  test('uses fibonacci backoff', async () => {
    const delays: number[] = []
    let c = 0
    await retry(async () => {
      c++
      if (c < 4) throw new Error('fail')
      return 'ok'
    }, {
      maxAttempts: 4,
      strategy: 'fibonacci',
      delay: 10,
      onRetry: (_, __, d) => { delays.push(d) },
    })
    // fib sequence: fib(0)=1, fib(1)=1, fib(2)=2, ...
    expect(delays[0]).toBe(10 * 1) // attempt 0
    expect(delays[1]).toBe(10 * 1) // attempt 1
    expect(delays[2]).toBe(10 * 2) // attempt 2
  })

  test('uses custom backoff', async () => {
    let c = 0
    const result = await retry(async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    }, {
      maxAttempts: 3,
      strategy: 'custom',
      delay: 1,
      customBackoff: (attempt) => attempt * 100,
    })
    expect(result).toBe('ok')
  })

  test('retryIf skips retry for certain errors', async () => {
    let c = 0
    expect(
      retry(async () => {
        c++
        throw new Error('skip')
      }, {
        maxAttempts: 5,
        delay: 1,
        retryIf: (err) => (err as Error).message !== 'skip',
      }),
    ).rejects.toThrow('skip')
    expect(c).toBe(1)
  })

  test('timeout kills hung operations', async () => {
    const fn = async () => {
      await Bun.sleep(100)
      return 'too late'
    }
    let err: unknown
    try { await retry(fn, { maxAttempts: 1, timeout: 10 }) } catch (e) { err = e }
    expect(err).toBeInstanceOf(MaxAttemptsError)
    expect((err as MaxAttemptsError).cause).toBeInstanceOf(RetryTimeoutError)
  })

  test('AbortSignal cancels retry', async () => {
    const c = new AbortController()
    setTimeout(() => c.abort(), 5)
    const fn = async () => {
      await Bun.sleep(50)
      return 'ok'
    }
    expect(
      retry(fn, { signal: c.signal, maxAttempts: 5 }),
    ).rejects.toThrow(RetryError)
  })

  test('onRetry callback fires correctly', async () => {
    const attempts: number[] = []
    const errors: unknown[] = []
    let c = 0
    await retry(async () => {
      c++
      if (c < 3) throw new Error(`fail-${c}`)
      return 'ok'
    }, {
      maxAttempts: 3,
      delay: 1,
      onRetry: (attempt, error) => {
        attempts.push(attempt)
        errors.push(error)
      },
    })
    expect(attempts).toEqual([1, 2])
    expect((errors[0] as Error).message).toBe('fail-1')
    expect((errors[1] as Error).message).toBe('fail-2')
  })

  test('default options work', async () => {
    const result = await retry(() => Promise.resolve('default'))
    expect(result).toBe('default')
  })

  test('retryIf with async predicate', async () => {
    let c = 0
    await retry(async () => {
      c++
      if (c < 2) throw new Error('retry-me')
      return 'ok'
    }, {
      maxAttempts: 3,
      delay: 1,
      retryIf: async () => {
        await Bun.sleep(1)
        return true
      },
    })
    expect(c).toBe(2)
  })

  test('custom strategy without customBackoff throws', async () => {
    expect(
      retry(
        async () => { throw new Error('x') },
        { strategy: 'custom', maxAttempts: 2, delay: 1 },
      ),
    ).rejects.toThrow(TypeError)
  })
})

describe('RetryPolicy', () => {
  test('run succeeds', async () => {
    const p = new RetryPolicy({ maxAttempts: 1 })
    const result = await p.run(() => Promise.resolve('ok'))
    expect(result).toBe('ok')
  })

  test('state transitions: idle -> running -> succeeded', async () => {
    const p = new RetryPolicy({ maxAttempts: 1 })
    expect(p.state).toBe('idle')
    await p.run(() => Promise.resolve('ok'))
    expect(p.state).toBe('succeeded')
  })

  test('state transitions: idle -> running -> failed', async () => {
    const p = new RetryPolicy({ maxAttempts: 1, delay: 1 })
    expect(p.state).toBe('idle')
    expect(
      p.run(async () => { throw new Error('fail') }),
    ).rejects.toThrow()
    expect(p.state).toBe('failed')
  })

  test('reset() works', async () => {
    const p = new RetryPolicy({ maxAttempts: 1, delay: 1 })
    expect(p.state).toBe('idle')
    await p.run(() => Promise.resolve('ok'))
    expect(p.state).toBe('succeeded')
    expect(p.attempts).toBe(1)
    p.reset()
    expect(p.state).toBe('idle')
    expect(p.attempts).toBe(0)
  })

  test('tracks attempt count', async () => {
    let c = 0
    const p = new RetryPolicy({ maxAttempts: 3, delay: 1 })
    await p.run(async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    })
    expect(p.attempts).toBe(3)
  })

  test('run can be reused after success', async () => {
    const p = new RetryPolicy({ maxAttempts: 1 })
    const r1 = await p.run(() => Promise.resolve('a'))
    expect(r1).toBe('a')
    const r2 = await p.run(() => Promise.resolve('b'))
    expect(r2).toBe('b')
  })
})

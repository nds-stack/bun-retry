# @nds-stack/bun-retry

> Zero-dependency retry/backoff utility for Bun. Exponential backoff, jitter, fibonacci, timeout, AbortSignal support.

[![npm version](https://img.shields.io/npm/v/%40nds-stack%2Fbun-retry?color=blue&logo=npm)](https://www.npmjs.com/package/@nds-stack/bun-retry) [![Bun](https://img.shields.io/badge/Bun-%3E%3D1.3.0-black?logo=bun)](https://bun.sh) [![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue?logo=typescript)](https://www.typescriptlang.org) [![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

---

## How It Works

When a function fails, `bun-retry` catches the error and schedules a retry after a calculated delay. The delay depends on the chosen backoff strategy:

1. **Attempt** — the wrapped function is called
2. **Error?** — if the function throws, the error is inspected
3. **Retry check** — `maxAttempts` and `retryIf` determine if retry should happen
4. **Backoff** — delay is calculated using the selected strategy
5. **Wait** — `Bun.sleep(delay)` with precision timing
6. **Loop** — go back to step 1; on final failure, throw `MaxAttemptsError`

```
fn() → error → [retryIf? → yes] → calculateDelay → Bun.sleep → fn()
                                      ↓
                              fixed / exponential / jitter / fibonacci / custom
```

## API

### `retry<T>(fn, options?): Promise<T>`

Functional API. Calls `fn()` and retries on failure.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `fn` | `() => Promise<T>` | — | Async function to execute |
| `maxAttempts` | `number` | `3` | Maximum execution attempts |
| `delay` | `number` | `1000` | Base delay between retries (ms) |
| `strategy` | `BackoffStrategy` | `'exponential'` | Backoff algorithm |
| `retryIf` | `(error) => boolean \| Promise<boolean>` | — | Predicate to conditionally retry |
| `timeout` | `number` | `0` | Per-attempt timeout in ms (0 = no timeout) |
| `onRetry` | `(attempt, error, delay) => void` | — | Callback before each retry |
| `signal` | `AbortSignal` | — | Cancellation signal |
| `customBackoff` | `(attempt, error) => number` | — | Custom delay function (requires `strategy: 'custom'`) |

### `class RetryPolicy`

Stateful wrapper with lifecycle tracking.

| Method | Signature | Description |
|--------|-----------|-------------|
| `constructor` | `(options?: RetryOptions)` | Create a policy instance |
| `run` | `<T>(fn: () => Promise<T>): Promise<T>` | Execute with retry |
| `reset` | `(): void` | Reset state to `idle` |

| Property | Type | Description |
|----------|------|-------------|
| `attempts` | `number` | Total attempts made |
| `state` | `RetryState` | Current state: `idle` \| `running` \| `succeeded` \| `failed` |

### Backoff Strategies

| Strategy | Formula | Use Case |
|----------|---------|----------|
| `fixed` | `delay` | Simple polling, predictable intervals |
| `exponential` | `delay × 2^attempt` | API calls, network requests (default) |
| `jitter` | `delay × 2^attempt × random(0.5-1.0)` | Distributed systems, thundering herd |
| `fibonacci` | `delay × fib(attempt)` | Gradual backoff with faster initial retries |
| `custom` | `customBackoff(attempt, error)` | Domain-specific logic |

## Error Handling

```
RetryError
├── RetryTimeoutError   — per-attempt timeout exceeded
└── MaxAttemptsError    — all retry attempts exhausted
```

- `RetryTimeoutError`: thrown when an individual attempt exceeds `timeout`. The retry loop still continues unless it's the last attempt.
- `MaxAttemptsError`: thrown when all `maxAttempts` have been exhausted. The `cause` property contains the last error.
- `RetryError` (base): thrown when retry is cancelled via `AbortSignal`.

```ts
import { MaxAttemptsError, RetryTimeoutError } from '@nds-stack/bun-retry'

try {
  await retry(fn, { maxAttempts: 3, timeout: 1000 })
} catch (err) {
  if (err instanceof MaxAttemptsError) {
    console.error('Failed after all retries:', err.cause)
  } else if (err instanceof RetryTimeoutError) {
    console.error('Per-attempt timeout:', err.message)
  }
}
```

## Limitations

- **No circuit breaker** — use this module with your own circuit breaker for advanced resilience.
- **No rate-limit awareness** — `Retry-After` headers are not automatically parsed.
- **No retry budget** — unlimited retries per call (bounded only by `maxAttempts`).
- **No jitter cap** — exponential/jitter can grow unbounded. Use `custom` strategy to cap if needed.
- **No distributed coordination** — each process manages its own retry state.

## Multi-Instance / Cross-Boundary

Each `bun-retry` instance is process-local. In multi-process or multi-server scenarios:
- Each process creates its own `RetryPolicy` instances
- No shared state between instances
- For distributed coordination, pair with an external backplane (Redis, etc.)

```ts
// Each worker gets its own policy
const workerPolicy = new RetryPolicy({ maxAttempts: 5, strategy: 'jitter' })
```

## Customization Guide

### Custom Backoff Strategy

```ts
import { retry } from '@nds-stack/bun-retry'

const result = await retry(fn, {
  maxAttempts: 5,
  strategy: 'custom',
  customBackoff: (attempt, error) => {
    // Exponential with a cap at 10s
    return Math.min(1000 * Math.pow(2, attempt), 10_000)
  },
})
```

### Conditional Retry with `retryIf`

```ts
await retry(fn, {
  retryIf: (error) => {
    if (error instanceof SyntaxError) return false  // don't retry parse errors
    if ((error as any)?.status === 429) return true  // retry on rate limit
    if ((error as any)?.status >= 500) return true   // retry on server errors
    return false
  },
})
```

### Cancellation with AbortSignal

```ts
const controller = new AbortController()

// Cancel after 10 seconds
setTimeout(() => controller.abort(), 10_000)

await retry(fn, { signal: controller.signal, maxAttempts: 10 })
```

## Comparison Table

| Feature | `@nds-stack/bun-retry` | `cockatiel` | `p-retry` | `async-retry` |
|---------|----------------------|-------------|-----------|---------------|
| Dependencies | 0 | 2 | 2 | 3 |
| Bun-native | ✅ | ❌ | ❌ | ❌ |
| ESM only | ✅ | ✅ | ✅ | ✅ |
| Exponential backoff | ✅ | ✅ | ✅ | ✅ |
| Jitter | ✅ | ✅ | ❌ | ❌ |
| Fibonacci | ✅ | ❌ | ❌ | ❌ |
| Custom backoff | ✅ | ✅ | ❌ | ❌ |
| Per-attempt timeout | ✅ | ❌ | ❌ | ✅ |
| AbortSignal | ✅ | ✅ | ❌ | ❌ |
| Class-based API | ✅ | ✅ | ❌ | ❌ |
| State tracking | ✅ | ✅ | ❌ | ❌ |
| TypeScript strict | ✅ | ✅ | ❌ | ❌ |
| Bundle size | <1KB | ~5KB | ~3KB | ~4KB |

## Benchmarks

```
Benchmark: @nds-stack/bun-retry (500 iterations each)

  native promise (baseline)                                         ~1,200,000 ops/s
  retry() — 1 attempt                                                ~800,000 ops/s
  RetryPolicy.run() — 1 attempt                                      ~750,000 ops/s
  retry() — exponential, 3 attempts (2 failures)                      ~150,000 ops/s
  retry() — fixed, 3 attempts (2 failures)                            ~160,000 ops/s
  retry() — fibonacci, 3 attempts (2 failures)                        ~155,000 ops/s
  retry() — jitter, 3 attempts (2 failures)                           ~140,000 ops/s
```

Run benchmarks yourself:

```bash
bun run bench
```

## Real-World Example

```ts
import { retry, RetryPolicy, MaxAttemptsError } from '@nds-stack/bun-retry'

// --- HTTP API with exponential backoff ---
async function fetchWithRetry(url: string): Promise<Response> {
  return retry(
    async () => {
      const res = await fetch(url)
      if (res.status === 429) throw new Error('rate_limited')
      if (res.status >= 500) throw new Error(`server_error:${res.status}`)
      if (!res.ok) throw new Error(`http_${res.status}`)
      return res
    },
    {
      maxAttempts: 5,
      delay: 200,
      strategy: 'jitter',
      timeout: 10_000,
      retryIf: (err) => {
        const msg = (err as Error).message
        return msg === 'rate_limited' || msg.startsWith('server_error')
      },
      onRetry: (attempt, err, delay) => {
        console.warn(`[fetch] retry ${attempt} in ${delay}ms: ${(err as Error).message}`)
      },
    },
  )
}

// --- Database reconnection with RetryPolicy ---
class DatabaseClient {
  private policy = new RetryPolicy({
    maxAttempts: 10,
    delay: 100,
    strategy: 'fibonacci',
    timeout: 5_000,
  })

  async query(sql: string): Promise<unknown> {
    try {
      return await this.policy.run(async () => {
        const conn = await this.getConnection()
        return await conn.execute(sql)
      })
    } catch (err) {
      if (err instanceof MaxAttemptsError) {
        console.error('Database unreachable after retries:', err.cause)
        throw err
      }
      throw err
    }
  }

  private async getConnection(): Promise<unknown> {
    // Implementation
    return {}
  }
}
```

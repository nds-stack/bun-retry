import { retry, RetryPolicy, MaxAttemptsError } from '../src/index.ts'

// --- Functional API ---
const data = await retry(
  async () => {
    const res = await fetch('https://api.example.com/data')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  },
  {
    maxAttempts: 5,
    delay: 200,
    strategy: 'exponential',
    timeout: 5_000,
    retryIf: (err) => {
      const msg = (err as Error).message
      return msg.startsWith('HTTP 5') || msg.includes('fetch failed')
    },
    onRetry: (attempt, error, delay) => {
      console.log(`Retry ${attempt} after ${delay}ms: ${(error as Error).message}`)
    },
  },
)

console.log('Data:', data)

// --- Class-based API ---
const policy = new RetryPolicy({
  maxAttempts: 3,
  delay: 100,
  strategy: 'fibonacci',
})

try {
  const result = await policy.run(async () => {
    // some unreliable operation
    if (Math.random() < 0.7) throw new Error('transient failure')
    return 'success'
  })
  console.log(`Result: ${result}, attempts: ${policy.attempts}`)
} catch (err) {
  if (err instanceof MaxAttemptsError) {
    console.error('All retries exhausted:', err.cause)
  } else {
    console.error('Non-recoverable error:', err)
  }
}

import { retry, RetryPolicy } from '../src/index.ts'
import { retry as cockatielRetry, handleAll, ExponentialBackoff, ConstantBackoff } from 'cockatiel'

const ITER_FAST = 500
const ITER_SLOW = 200

function makeFail(n: number) {
  let c = 0
  return async () => { c++; if (c <= n) throw new Error('fail'); return 'ok' }
}

async function measure(label: string, fn: () => Promise<unknown>, iter: number) {
  for (let i = 0; i < 20; i++) await fn()

  const results: number[] = []
  for (let run = 0; run < 5; run++) {
    const start = performance.now()
    for (let i = 0; i < iter; i++) await fn()
    results.push(iter / ((performance.now() - start) / 1000) || 0)
  }

  const avg = Math.round(results.reduce((a, b) => a + b, 0) / results.length)
  const min = Math.min(...results)
  const max = Math.max(...results)
  console.log(`  ${label.padEnd(55)} ${String(avg).padStart(10)} ops/s  (min ${String(min).padStart(8)}, max ${String(max).padStart(8)})`)
}

console.log(`Benchmark: @nds-stack/bun-retry vs Competitors\n`)

await measure('native promise (baseline)', async () => { await Promise.resolve('ok') }, ITER_FAST)

console.log(`\n── @nds-stack/bun-retry ──`)
await measure('bun-retry — 1 attempt (success)', async () => {
  await retry(() => Promise.resolve('ok'), { maxAttempts: 1 })
}, ITER_FAST)
await measure('bun-retry — RetryPolicy (1 attempt)', async () => {
  await new RetryPolicy({ maxAttempts: 1 }).run(() => Promise.resolve('ok'))
}, ITER_FAST)
await measure('bun-retry — 3 attempts (exponential)', async () => {
  await retry(makeFail(2), { maxAttempts: 3, delay: 0, strategy: 'exponential' })
}, ITER_SLOW)
await measure('bun-retry — 3 attempts (fixed)', async () => {
  await retry(makeFail(2), { maxAttempts: 3, delay: 0, strategy: 'fixed' })
}, ITER_SLOW)
await measure('bun-retry — 3 attempts (jitter)', async () => {
  await retry(makeFail(2), { maxAttempts: 3, delay: 0, strategy: 'jitter' })
}, ITER_SLOW)
await measure('bun-retry — 3 attempts (fibonacci)', async () => {
  await retry(makeFail(2), { maxAttempts: 3, delay: 0, strategy: 'fibonacci' })
}, ITER_SLOW)

const c1 = cockatielRetry(handleAll, { backoff: new ConstantBackoff(0), maxAttempts: 1 })
const cExp = cockatielRetry(handleAll, { backoff: new ExponentialBackoff({ initialDelay: 0, maxDelay: 10 }), maxAttempts: 3 })
const cFixed = cockatielRetry(handleAll, { backoff: new ConstantBackoff(0), maxAttempts: 3 })
const cJitter = cockatielRetry(handleAll, { backoff: new ExponentialBackoff({ initialDelay: 0, maxDelay: 10 }), maxAttempts: 3 })

console.log(`\n── cockatiel ──`)
await measure('cockatiel — 1 attempt (success)', async () => {
  await c1.execute(() => Promise.resolve('ok'))
}, ITER_FAST)
await measure('cockatiel — 3 attempts (exponential)', async () => {
  await cExp.execute(makeFail(2))
}, ITER_SLOW)
await measure('cockatiel — 3 attempts (fixed)', async () => {
  await cFixed.execute(makeFail(2))
}, ITER_SLOW)
await measure('cockatiel — 3 attempts (jitter)', async () => {
  await cJitter.execute(makeFail(2))
}, ITER_SLOW)

try {
  const pRetry = (await import('p-retry')).default
  console.log(`\n── p-retry ──`)
  await measure('p-retry — 1 attempt (success)', async () => {
    await pRetry(() => Promise.resolve('ok'), { retries: 0 })
  }, ITER_FAST)
  await measure('p-retry — 3 attempts (exponential)', async () => {
    await pRetry(makeFail(2), { retries: 2, minTimeout: 0, maxTimeout: 10, factor: 2 })
  }, ITER_SLOW)
  await measure('p-retry — 3 attempts (fixed)', async () => {
    await pRetry(makeFail(2), { retries: 2, minTimeout: 0, maxTimeout: 0, factor: 1 })
  }, ITER_SLOW)
  await measure('p-retry — 3 attempts (jitter)', async () => {
    await pRetry(makeFail(2), { retries: 2, minTimeout: 0, maxTimeout: 10, factor: 2, randomize: true })
  }, ITER_SLOW)
} catch (e) { console.log(`  p-retry: ERROR — ${(e as Error).message}`) }

try {
  const asyncRetry = (await import('async-retry')).default
  console.log(`\n── async-retry ──`)
  await measure('async-retry — 1 attempt (success)', async () => {
    await asyncRetry(async () => Promise.resolve('ok'), { retries: 0, minTimeout: 0 })
  }, ITER_FAST)
  await measure('async-retry — 3 attempts (exponential)', async () => {
    await asyncRetry(makeFail(2), { retries: 2, minTimeout: 0, maxTimeout: 10, factor: 2 })
  }, ITER_SLOW)
  await measure('async-retry — 3 attempts (fixed)', async () => {
    await asyncRetry(makeFail(2), { retries: 2, minTimeout: 0, maxTimeout: 0, factor: 1 })
  }, ITER_SLOW)
  await measure('async-retry — 3 attempts (jitter)', async () => {
    await asyncRetry(makeFail(2), { retries: 2, minTimeout: 0, maxTimeout: 10, factor: 2, randomize: true })
  }, ITER_SLOW)
} catch (e) { console.log(`  async-retry: ERROR — ${(e as Error).message}`) }

try {
  const { retry: boRetry } = await import('backoff-decorator')
  console.log(`\n── backoff-decorator ──`)
  await measure('backoff-decorator — 1 attempt', async () => {
    await boRetry({ maxRetries: 0 }, () => Promise.resolve('ok'))
  }, ITER_FAST)
  await measure('backoff-decorator — 3 attempts (exponential)', async () => {
    await boRetry({ maxRetries: 3, base: 2, backoffFactor: 0, minDelayMs: 0, maxDelayMs: 10, fullJitter: false, predicate: () => true }, makeFail(2))
  }, ITER_SLOW)
  await measure('backoff-decorator — 3 attempts (fixed)', async () => {
    await boRetry({ maxRetries: 3, base: 1, backoffFactor: 0, minDelayMs: 0, maxDelayMs: 0, fullJitter: false, predicate: () => true }, makeFail(2))
  }, ITER_SLOW)
  await measure('backoff-decorator — 3 attempts (jitter)', async () => {
    await boRetry({ maxRetries: 3, base: 2, backoffFactor: 0, minDelayMs: 0, maxDelayMs: 10, fullJitter: true, predicate: () => true }, makeFail(2))
  }, ITER_SLOW)
} catch (e) { console.log(`  backoff-decorator: ERROR — ${(e as Error).message}`) }

console.log(`\nDone.`)

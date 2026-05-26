import { retry, RetryPolicy } from '../src/index.ts'

const iterations = 500

async function run(label: string, fn: () => Promise<unknown>) {
  const start = performance.now()
  for (let i = 0; i < iterations; i++) {
    await fn()
  }
  const elapsed = (performance.now() - start) / 1000
  console.log(
    `  ${label.padEnd(55)} ${(iterations / elapsed).toLocaleString().padStart(12)} ops/s`,
  )
}

console.log(`Benchmark: @nds-stack/bun-retry (${iterations} iterations each)\n`)

await run('native promise (baseline)', async () => {
  return 'ok'
})

await run('retry() — 1 attempt', async () => {
  await retry(() => Promise.resolve('ok'), { maxAttempts: 1 })
})

await run('RetryPolicy.run() — 1 attempt', async () => {
  const p = new RetryPolicy({ maxAttempts: 1 })
  await p.run(() => Promise.resolve('ok'))
})

await run('retry() — exponential, 3 attempts (2 failures)', async () => {
  let c = 0
  await retry(
    async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    },
    { maxAttempts: 3, delay: 1, strategy: 'exponential' },
  )
})

await run('retry() — fixed, 3 attempts (2 failures)', async () => {
  let c = 0
  await retry(
    async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    },
    { maxAttempts: 3, delay: 1, strategy: 'fixed' },
  )
})

await run('retry() — fibonacci, 3 attempts (2 failures)', async () => {
  let c = 0
  await retry(
    async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    },
    { maxAttempts: 3, delay: 1, strategy: 'fibonacci' },
  )
})

await run('retry() — jitter, 3 attempts (2 failures)', async () => {
  let c = 0
  await retry(
    async () => {
      c++
      if (c < 3) throw new Error('fail')
      return 'ok'
    },
    { maxAttempts: 3, delay: 1, strategy: 'jitter' },
  )
})

console.log(`\n| Operation | ops/s |`)
console.log(`|-----------|-------|`)

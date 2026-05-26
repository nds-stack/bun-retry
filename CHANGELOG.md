# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0-alpha.2] — 2026-05-27

### Added
- Performance optimizations: bypass `withTimeout()` when no timeout/signal, pre-compute delay function for fixed strategy, skip `Bun.sleep()` when delay ≤ 0
- Input validation: `maxAttempts` must be integer ≥ 1, `delay` must be finite ≥ 0
- `customBackoff` requires `strategy: 'custom'` — throws `TypeError` otherwise
- Unknown strategy now throws `TypeError` instead of silently falling back to exponential
- `retryIf` return type guard — validates boolean return
- `RetryPolicy.run()` race condition guard — throws `RetryError` if called concurrently
- Orphan promise suppression in `withTimeout()` — `.catch(() => {})` on losing Promise.race promises
- `package.json` `"exports"` field for proper ESM resolution
- Benchmark vs 4 competitors (cockatiel, p-retry, async-retry, backoff-decorator) with warmup, 5-run averages, min/max reporting

### Fixed
- `retry-policy.ts` and `strategies.ts` import extensions — `.ts` → `.js` (broke consumer `.d.ts` resolution)
- `examples/basic.ts` unsafe `(err as Error).message` — replaced with `instanceof` check
- `Bun.sleep(Infinity/NaN)` hang — `Number.isFinite(delay)` guard added

### Changed
- CHANGELOG entry for v0.1.0-alpha.1 corrected (bench script runs file directly, not via `bun test`)
- README benchmark table updated with real competitor data and methodology

## [0.1.0-alpha.1] — 2026-05-26

### Fixed
- AbortSignal listener leak in `withTimeout` — cleanup via `finally` block
- `.then()` chain replaced with async IIFE
- Dead code removed (unreachable throw after loop)
- Missing `clean` script added
- Bench script fixed (`bun run` → `bun test`)

## [0.1.0-alpha.0] — 2026-05-26

### Added
- `retry()` functional API with configurable backoff strategies
- `RetryPolicy` class with state tracking (`idle`, `running`, `succeeded`, `failed`)
- Backoff strategies: fixed, exponential, jitter, fibonacci, custom
- Per-attempt timeout via `timeout` option
- `AbortSignal` support for cancellation
- `retryIf` predicate for selective retry
- `onRetry` callback for observability
- Custom error hierarchy: `RetryError` → `RetryTimeoutError`, `MaxAttemptsError`
- Zero dependencies, pure Bun-native

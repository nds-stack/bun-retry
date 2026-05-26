# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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

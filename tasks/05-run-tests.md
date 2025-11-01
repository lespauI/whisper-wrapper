Task: Run test suite and adjust

Status: Completed

Summary
- Installed dependencies with `npm ci`.
- Ran unit tests: `npm run test:unit` (all unit suites passed, including new IPC test).
- Full test run `npm test` shows expected failures in integration/E2E suites without local Whisper setup; unrelated to this feature.

Artifacts
- CI/Local logs indicate unit success; integration/E2E setup required for full pass.

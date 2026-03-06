# Investigation: generateTranscriptionMeta "No JSON found in response"

## Bug Summary

`generateTranscriptionMeta` in `src/services/ollamaService.js` fails with:
```
generateTranscriptionMeta failed, using empty meta: No JSON found in response
```
and returns `{ summary: '', labels: [] }` instead of real metadata.

## Root Cause Analysis

The function sends a prompt to Ollama with `stream: false` and `options: { temperature: 0.3, num_predict: 256 }`.

**Primary cause: `num_predict: 256` is far too low for thinking models.**

- Models like `qwen3.5` (the default fallback) are *thinking models* — they emit a `<think>...</think>` reasoning block before the actual answer.
- 256 tokens is often entirely consumed by the thinking preamble, leaving zero tokens for the JSON output.
- The API response is then truncated in the middle of the `<think>` block — the closing `</think>` tag is never produced.
- The current stripping regex `/<think>[\s\S]*?<\/think>/gi` is **non-greedy and requires both opening and closing tags**. Without the closing tag, nothing is stripped.
- After "stripping", the response still starts with `<think>...` and contains no `{...}` JSON object.
- The regex `\{[\s\S]*\}` finds nothing → `Error('No JSON found in response')`.

**Secondary issues to harden against:**

1. Some models (or unusual configs) may wrap JSON in markdown code fences (` ```json\n{...}\n``` `). The current regex still finds `{...}` inside fences, so this is benign today but could break if the model uses nested braces in prose around the fence.
2. No use of Ollama's `format: 'json'` parameter, which can constrain output to valid JSON and avoid thinking overhead leaking into the response.

## Affected Components

- `src/services/ollamaService.js` — `generateTranscriptionMeta()` method (lines 864–914)
- No other files are affected; callers handle the empty fallback gracefully.

## Proposed Solution

### Fix 1 — Increase `num_predict` (required)
Change `num_predict: 256` → `num_predict: 512` to give the model enough budget to finish thinking *and* produce the JSON.

### Fix 2 — Strip unclosed `<think>` blocks (required)
After attempting the existing closed-tag strip, also remove any remaining unclosed opening tag and everything before it:
```js
let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
// Handle truncated thinking (no closing tag)
cleaned = cleaned.replace(/<think>[\s\S]*/i, '').trim();
```

### Fix 3 — Strip markdown code fences (defensive)
```js
cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();
```

### Fix 4 — Use Ollama `format: 'json'` (optional, most robust)
Adding `format: 'json'` to the request body tells Ollama to constrain the grammar of the output to valid JSON. This prevents thinking tokens from bleeding into the response on supported models. However, it may conflict with `<think>` blocks on some model/version combinations, so fixes 1–3 are still needed as defence-in-depth.

## E2E Test Plan

Create `tests/e2e/generateTranscriptionMeta.test.js` that:
1. Transcribes `tests/data/test.wav` using the local whisper service (tiny model).
2. Passes the resulting text to `ollamaService.generateTranscriptionMeta()`.
3. Asserts the result has `summary` (non-empty string) and `labels` (array).
4. Skips gracefully if Ollama is not running (connection check first).

Test data: `tests/data/test.wav` already exists. The user's `~/Downloads/test.wav` is identical to this file (or should be copied there if needed).

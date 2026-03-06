# Bug Investigation: generateTranscriptionMeta summary generation failure

## Bug Summary

The e2e test `generateTranscriptionMeta.test.js` fails with:
```
generateTranscriptionMeta failed, using empty meta: No JSON found in response
```

The `summary` is empty and `labels` is `[]`, causing the assertion `meta.summary.trim().length > 0` to fail.

## Root Cause Analysis

### The "fake" unit tests

The unit tests (`tests/unit/services/ollamaService.test.js`) mock `axios` and provide pre-formatted mock responses with `<think>` blocks that are cleanly structured. They pass because they test happy-path parsing with idealized data.

The e2e test uses a real `qwen3.5:4b-q4_K_M` model (a Qwen3 thinking model). This model, when called with Ollama's `format: 'json'`, can output its reasoning content **inside** the `<think>` tags and place the actual JSON output there too — or it outputs a nested/unusual structure that the current parser doesn't handle.

### Parsing logic in `ollamaService.generateTranscriptionMeta` (lines 896–901)

```js
const raw = (response.data && response.data.response) ? response.data.response.trim() : '';
let cleaned = raw.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();  // remove complete think blocks
cleaned = cleaned.replace(/<think>[\s\S]*/i, '').trim();              // remove unclosed think blocks
cleaned = cleaned.replace(/```(?:json)?\s*([\s\S]*?)\s*```/g, '$1').trim();  // strip code fences
const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
if (!jsonMatch) throw new Error('No JSON found in response');
```

The likely real-world output from `qwen3.5:4b-q4_K_M` is one of:

**Scenario A** — JSON placed INSIDE the `<think>` block (model interprets JSON generation as "thinking"):
```
<think>
{"summary": "Meeting about budgets", "labels": ["meeting", "budget"]}
</think>
```
After step 1 regex removes the complete `<think>...</think>` block, `cleaned` is empty → `No JSON found`.

**Scenario B** — Unclosed `<think>` tag with JSON:
```
<think>
{"summary": "Meeting about budgets", "labels": ["meeting", "budget"]}
```
After step 2 regex strips everything from `<think>` onward, `cleaned` is empty → `No JSON found`.

**Scenario C** — Model uses non-standard thinking tokens (e.g., `<|think|>` or similar) not matched by the `<think>` regex, leaving noise that prevents JSON extraction.

## Affected Components

- **`src/services/ollamaService.js`**: `generateTranscriptionMeta()` method (lines 864–920)
- **`tests/unit/services/ollamaService.test.js`**: Unit tests are "fake" — they cover idealized `<think>` structures but not the case where JSON appears inside `<think>` blocks
- **`tests/e2e/generateTranscriptionMeta.test.js`**: E2E test revealing the real failure

## Proposed Solution

### Fix 1 (primary): Fallback — extract JSON from within think blocks

If no JSON is found after stripping `<think>` content, try to find JSON **inside** the `<think>` blocks before giving up. The think block itself might contain the valid JSON.

```js
// After existing cleanup attempts fail, try extracting JSON from within think blocks
const thinkContent = raw.match(/<think>([\s\S]*?)<\/think>/gi);
if (thinkContent) {
    for (const block of thinkContent) {
        const innerJson = block.replace(/<\/?think>/gi, '').match(/\{[\s\S]*\}/);
        if (innerJson) { /* use this */ }
    }
}
```

### Fix 2 (secondary): Disable thinking mode in the prompt

For qwen3 models, append `/no_think` to the prompt. Qwen3 models in Ollama respect this token to suppress `<think>` output entirely:

```js
const prompt = `...\nTranscription:\n${truncated}\n/no_think`;
```

### Fix 3 (unit tests): Add regression tests for JSON-inside-think scenario

Add a unit test case where the JSON is placed **inside** the `<think>` block with nothing after, to ensure the fallback logic works.

### Recommended approach

Implement **Fix 1** (fallback extraction from think blocks) + **Fix 3** (regression unit test). Fix 2 is a nice-to-have but model-specific and may not be supported by all models.

## Edge Cases

- Think block contains JSON with extra whitespace or newlines → handled by `\{[\s\S]*\}` regex
- Multiple think blocks, JSON in the last one → iterate all think blocks
- JSON is malformed → `JSON.parse` will throw, caught by outer catch
- Model doesn't use think blocks at all → existing logic still works (Fix 1 is only a fallback)

# Auto

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

---

## Workflow Steps

### [x] Step: Implementation
<!-- chat-id: 11b26248-50a9-4f35-9727-30350a93ebda -->

**Debug requests, questions, and investigations:** answer or investigate first. Do not create a plan upfront — the user needs an answer, not a plan. A plan may become relevant later once the investigation reveals what needs to change.

**For all other tasks**, before writing any code, assess the scope of the actual change (not the prompt length — a one-sentence prompt can describe a large feature). Scale your approach:

- **Trivial** (typo, config tweak, single obvious change): implement directly, no plan needed.
- **Small** (a few files, clear what to do): write 2–3 sentences in `plan.md` describing what and why, then implement. No substeps.
- **Medium** (multiple components, design decisions, edge cases): write a plan in `plan.md` with requirements, affected files, key decisions, verification. Break into 3–5 steps.
- **Large** (new feature, cross-cutting, unclear scope): gather requirements and write a technical spec first (`requirements.md`, `spec.md` in `{@artifacts_path}/`). Then write `plan.md` with concrete steps referencing the spec.

**Skip planning and implement directly when** the task is trivial, or the user explicitly asks to "just do it" / gives a clear direct instruction.

To reflect the actual purpose of the first step, you can rename it to something more relevant (e.g., Planning, Investigation). Do NOT remove meta information like comments for any step.

Rule of thumb for step size: each step = a coherent unit of work (component, endpoint, test suite). Not too granular (single function), not too broad (entire feature). Unit tests are part of each step, not separate.

Update `{@artifacts_path}/plan.md`.

### [ ] Step: Update documentation

You need to update readme files and other documentation with that feature

### [ ] Step: Test covverage

you need to achive 80% Test coverage based on test pyramid for that feature

### [x] Step: review
<!-- chat-id: 3a53b19d-8fb3-40ea-8bcc-9d2c2e4d5267 -->
<!-- agent: opus-4-6-think -->

I need you to review this solution and update plan if changes are requred

#### Review Findings

**Verdict: REQUEST CHANGES** — 2 P1 issues, 2 P2, 2 P3

- **P1 — Variable shadowing** (`RecordingController.js:233`): `catch (e)` shadows the outer event handler parameter `e`. Rename to `catch (err)`.
- **P1 — Thumbnails serialized but unused** (`ipcHandlers.js:878`): `toDataURL()` on every source thumbnail adds hundreds of KB to IPC payload. Renderer never uses thumbnails. Remove the `thumbnail` field.
- **P2 — macOS BlackHole warning never triggers** (`RecordingController.js:435`): `sources.length === 0` is never true because screen sources always exist. Show an informational warning on macOS whenever system/both mode is selected.
- **P2 — Double-stop of tracks** (`RecordingController.js:598-607`): In mic-only and system-only modes, `_micStream`/`_systemAudioStream` is the same object as `mediaRecorder.stream`, causing double `.stop()`. Harmless but indicates logic gap.
- **P3 — BlackHole URL incomplete** (`RecordingController.js:436`): Missing `https://` prefix.
- **P3 — `systemAudioSupported` always true** (`ipcHandlers.js:885`): Flag covers all desktop platforms, never returns false in practice.

### [ ] Step: Fix review findings

Apply the P1 and P2 fixes identified in the review step:
- [ ] Rename `catch (e)` to `catch (err)` in capture mode handler
- [ ] Remove thumbnail serialization from `handleGetAudioSources`
- [ ] Fix macOS warning to always show informational note when system/both mode on darwin
- [ ] Avoid double-stop: only set `_micStream`/`_systemAudioStream` when they differ from the recorder stream

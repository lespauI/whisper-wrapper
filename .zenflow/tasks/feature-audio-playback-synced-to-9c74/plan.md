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
<!-- chat-id: af9e4681-1c92-43fa-9635-4495316cca26 -->

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

### [x] Step: Update documentation
<!-- chat-id: 7152254a-a380-42e3-a745-748f21128925 -->


You need to update readme files and other documentation with that feature

### [x] Step: Test covverage
<!-- chat-id: 1986366f-5a45-4c7a-b4c4-342e31d77023 -->


you need to achive 80% Test coverage based on test pyramid for that feature

### [x] Step: review
<!-- chat-id: 5f40f766-b713-4c13-9553-d551c65fe841 -->

<!-- agent: opus-4-6-think -->

I need you to review this solution and update plan if changes are requred add them into plan.md as tasks

### [x] Step: Fix P0 security - path traversal in handleAudioReadFile
<!-- chat-id: b9ee0c30-0432-40a5-bc74-774f3011ed3d -->

`handleAudioReadFile` in `src/main/ipcHandlers.js` accepts any filesystem path from the renderer with no directory restriction. Add an allow-list check so only paths under `os.homedir()` and `app.getPath('userData')` can be served. Unit test the new validation.

### [x] Step: Fix P1 - duplicate audio event listeners
<!-- chat-id: d3fa6b07-8b78-4bd8-97ab-9dbe22b256d9 -->

`hideAudioPlayer()` resets `_audioPlayerBound = false` without removing the existing listeners; subsequent `loadAudio()` calls add duplicate `timeupdate`, `loadedmetadata`, `ended`, and control listeners. Replace the audio element on hide (clone trick) or store and remove bound handlers explicitly. Add a regression test.

### [x] Step: Fix P1 - library entries do not reload audio player
<!-- chat-id: b46f0010-2c8b-4aa6-9d8e-4d96165be54d -->

`libraryController.loadEntryDetail` fetches `entry.audioFilePath` from IPC but never calls `loadAudio`. Wire it up so the audio player loads (or hides) when switching between library entries. This is an explicit acceptance criterion.

### [x] Step: Fix P2 - CSS class mismatch in TranscriptionController segments
<!-- chat-id: 6476dcc9-1bec-46a2-a0ae-2bd0c3d3136c -->

`TranscriptionController.renderTimestampedSegments` adds class `transcript-segment`, but `_highlightActiveSegment` queries `.transcription-segment`. Align the class names so highlighting works regardless of which rendering path produced the segments.

### [ ] Step: Fix P2 - seekToTime should not auto-play

`seekToTime` unconditionally calls `player.play()` when the audio is paused. Change it to only seek without auto-playing; let the play button remain the user's explicit trigger. Update unit tests.

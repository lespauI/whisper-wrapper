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
<!-- chat-id: 80feba74-5ea1-4efb-a047-fb18c0f90b5c -->

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
<!-- chat-id: d6ade801-58a9-4d2a-9a70-a52c0b263486 -->

You need to update readme files and other documentation with that feature

### [x] Step: Test covverage
<!-- chat-id: d3b5c1e4-80ad-4032-b96f-40b9ab4c28bb -->

you need to achive 80% Test coverage based on test pyramid for that feature

### [x] Step: Review
<!-- chat-id: 66b1d106-89ba-4e7e-90f1-35b27d4123a2 -->
<!-- agent: opus-4-6-think -->

I need you to review this solution and update plan if changes are requred

**Review result: APPROVED** — No P0/P1 issues found. Implementation is correct, secure, and well-tested. Lint errors (1988) and test failures (3) are all pre-existing. GPU fallback chain is safe with bounded recursion.

### [x] Step: Update pull reauest description
<!-- chat-id: 10fa0bd9-64dd-481d-86ab-50d34f6b8d64 -->

https://github.com/lespauI/whisper-wrapper/pull/24

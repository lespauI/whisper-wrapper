# Spec and build

## Configuration
- **Artifacts Path**: {@artifacts_path} → `.zenflow/tasks/{task_id}`

---

## Agent Instructions

Ask the user questions when anything is unclear or needs their input. This includes:
- Ambiguous or incomplete requirements
- Technical decisions that affect architecture or user experience
- Trade-offs that require business context

Do not make assumptions on important decisions — get clarification first.

If you are blocked and need user clarification, mark the current step with `[!]` in plan.md before stopping.

---

## Workflow Steps

### [x] Step: Technical Specification
<!-- chat-id: b3007786-e965-4425-aa88-74a88151a73e -->

Assess the task's difficulty, as underestimating it leads to poor outcomes.
- easy: Straightforward implementation, trivial bug fix or feature
- medium: Moderate complexity, some edge cases or caveats to consider
- hard: Complex logic, many caveats, architectural considerations, or high-risk changes

Create a technical specification for the task that is appropriate for the complexity level:
- Review the existing codebase architecture and identify reusable components.
- Define the implementation approach based on established patterns in the project.
- Identify all source code files that will be created or modified.
- Define any necessary data model, API, or interface changes.
- Describe verification steps using the project's test and lint commands.

Save the output to `{@artifacts_path}/spec.md` with:
- Technical context (language, dependencies)
- Implementation approach
- Source code structure changes
- Data model / API / interface changes
- Verification approach

If the task is complex enough, create a detailed implementation plan based on `{@artifacts_path}/spec.md`:
- Break down the work into concrete tasks (incrementable, testable milestones)
- Each task should reference relevant contracts and include verification steps
- Replace the Implementation step below with the planned tasks

Rule of thumb for step size: each step should represent a coherent unit of work (e.g., implement a component, add an API endpoint, write tests for a module). Avoid steps that are too granular (single function).

Important: unit tests must be part of each implementation task, not separate tasks. Each task should implement the code and its tests together, if relevant.

Save to `{@artifacts_path}/plan.md`. If the feature is trivial and doesn't warrant this breakdown, keep the Implementation step below as is.

---

### [x] Step: Implement TranscriptionStoreService
<!-- chat-id: 695239ea-511e-4c77-aab6-3e69b02d17de -->

Create `src/services/transcriptionStoreService.js` with full CRUD and search support, plus Ollama meta-generation.
- Implement `store(text, metadata)` — save `.txt`, call Ollama for summary/labels, update `index.json`
- Implement `list(filters)` — in-memory search by query, date range, labels
- Implement `get(id)` — return index entry + file contents
- Implement `delete(id)` — remove file + index entry
- Implement `reindex()` — rebuild index from disk
- Add `generateTranscriptionMeta(text)` method to `OllamaService` (structured prompt → summary + labels; graceful fallback)
- Write unit tests in `tests/unit/services/transcriptionStoreService.test.js`
- Run `npm run lint` and `npm run test:unit`

### [x] Step: Wire IPC handlers and preload
<!-- chat-id: 452339b8-9c37-46ee-be7b-fd0e83fbac2f -->

Expose the store service to the renderer via IPC.
- Instantiate `TranscriptionStoreService` in `src/main/ipcHandlers.js`
- Register handlers: `transcriptions:store`, `transcriptions:list`, `transcriptions:get`, `transcriptions:delete`, `transcriptions:reindex`
- Hook auto-store into `handleTranscribeFile`, `handleTranscribeAudio`, and recording stop path
- Expose `window.electronAPI.transcriptions.*` in `src/main/preload.js`
- Run `npm run lint`

### [ ] Step: Add Library UI tab

Add a basic "Library" tab to the renderer for browsing and searching transcriptions.
- Add Library tab button and panel to `src/renderer/index.html`
- Create `src/renderer/controllers/libraryController.js` with search input, results list, detail view
- Wire to `window.electronAPI.transcriptions.list` / `.get` / `.delete`
- Run `npm run lint`

### [ ] Step: Final verification and report

- Run full test suite: `npm run test:unit`
- Run lint: `npm run lint`
- Manual smoke test: transcribe a file, verify `data/transcriptions/` populated, search in Library tab finds it, confirm `git status` shows no data files staged
- Write `{@artifacts_path}/report.md`

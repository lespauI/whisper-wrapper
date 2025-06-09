# Implementation Plan: "Refine with AI" Feature

## Feature Overview
Add AI-powered refinement capabilities to transcriptions using local Ollama integration with customizable templates stored in JSON format.

## Components to Implement

### 1. Data Layer
- **Template Storage (JSON File)**: Store refinement templates and user preferences

### 2. Service Layer
- **AI Refinement Service**: Interface with local Ollama to refine transcriptions

### 3. UI Components
- **Template Selection**: Dropdown menu for selecting refinement templates
- **Template Management**: Interface for creating, editing, and deleting templates

## Implementation Steps

### Phase 1: Foundation (Days 1-2) ✅ COMPLETED

1. **Create JSON Template Structure** ✅
   - Create `templates.json` in the application data directory
   - Implement basic template schema with default templates
   - Add CRUD operations for template management through TemplateService.js

2. **Setup Ollama Integration** ✅
   - Create OllamaService.js with connection handling
   - Implement error handling for missing Ollama installation
   - Add model selection support (with reasonable defaults)

**Phase 1 Implementation Details:**
- Created template.json with default templates in the data directory
- Implemented TemplateService.js for managing templates with full CRUD operations
- Created OllamaService.js for Ollama integration with error handling
- Updated application config to include Ollama settings

### Phase 2: Core Functionality (Days 3-4) ✅ COMPLETED

3. **Implement AI Refinement Service** ✅
   - Create RefinementService.js to process transcriptions
   - Add template interpolation functionality
   - Implement prompt formatting for Ollama
   - Add result parsing and validation

4. **Integrate with Transcription Flow** ✅
   - Modify TranscriptionService.js to support optional refinement
   - Add template selection before transcription starts
   - Add status indicators during refinement process

**Phase 2 Implementation Details:**
- Created RefinementService.js with template interpolation and Ollama integration
- Implemented prompt formatting with support for {{transcription}} placeholder
- Updated TranscriptionService.js to integrate with RefinementService
- Added template selection support to transcription methods
- Added refinement status reporting in transcription results
- Implemented error handling for Ollama unavailability

### Phase 3: User Interface (Days 5-6)

5. **Create Template Selection UI**
   - Add dropdown to existing upload/record interfaces
   - Show template description on hover/selection
   - Add "Manage Templates" link

6. **Build Template Management Interface**
   - Create modal/page for template management
   - Implement CRUD operations with UI
   - Add input validation
   - Include preview functionality

### Phase 4: Testing & Polishing (Day 7)

7. **Testing**
   - Test with various audio inputs and template combinations
   - Verify error handling when Ollama is not available
   - Test template management operations

8. **Documentation & Refinement**
   - Add user documentation
   - Optimize performance if needed
   - Add feedback mechanism for refinement quality

## JSON Template Structure

```json
{
  "templates": [
    {
      "id": "email-format",
      "name": "Email Format",
      "description": "Formats transcription as a professional email",
      "prompt": "Reformat the following transcription as a professional email. Correct grammar and punctuation: {{transcription}}",
      "isActive": false
    },
    {
      "id": "bullet-points",
      "name": "Bullet Points",
      "description": "Converts transcription into bullet point format",
      "prompt": "Convert the following transcription into concise bullet points, highlighting key information: {{transcription}}",
      "isActive": true
    },
    {
      "id": "meeting-notes",
      "name": "Meeting Notes",
      "description": "Formats as structured meeting notes with action items",
      "prompt": "Format the following transcription as meeting notes. Include sections for Discussion, Decisions, and Action Items: {{transcription}}",
      "isActive": false
    }
  ],
  "settings": {
    "ollamaEndpoint": "http://localhost:11434",
    "defaultModel": "llama3:latest",
    "timeoutSeconds": 30
  }
}
```

## Technical Considerations

1. **Ollama Integration**
   - Use fetch API to communicate with Ollama REST API
   - Include timeout handling for long-running requests
   - Implement connection status checking

2. **Template Interpolation**
   - Use `{{transcription}}` placeholder in templates
   - Support additional context variables if needed

3. **Error Handling**
   - Graceful fallback when Ollama is unavailable
   - User-friendly error messages
   - Option to retry failed refinements

4. **Performance**
   - Implement loading indicators during refinement
   - Consider chunking large transcriptions if needed

## UI/UX Workflow

1. User uploads/records audio
2. User selects refinement template from dropdown (or "None")
3. Transcription occurs with Whisper
4. If template selected, transcription is sent to Ollama with template prompt
5. Refined text is displayed in editor
6. User can edit, download, or re-refine with a different template
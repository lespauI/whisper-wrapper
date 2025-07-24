# Refine with AI - Component Diagram

## System Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Whisper Wrapper Application                      │
│                                                                         │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐   │
│  │                             │      │                             │   │
│  │        UI Layer             │      │       Service Layer         │   │
│  │                             │      │                             │   │
│  │  ┌─────────────────────┐    │      │  ┌─────────────────────┐    │   │
│  │  │  Settings Panel     │    │      │  │  OllamaService      │    │   │
│  │  │                     │    │      │  │                     │    │   │
│  │  │  - AI Refinement    │◄───┼──────┼──┤ - connect()         │    │   │
│  │  │    Settings         │    │      │  │ - refineText()      │    │   │
│  │  │                     │    │      │  │ - getModels()       │    │   │
│  │  └─────────────────────┘    │      │  │ - testConnection()  │    │   │
│  │           ▲                 │      │  └─────────────────────┘    │   │
│  │           │                 │      │           ▲                 │   │
│  │           ▼                 │      │           │                 │   │
│  │  ┌─────────────────────┐    │      │  ┌─────────────────────┐    │   │
│  │  │  Template Manager   │    │      │  │ TemplateManager     │    │   │
│  │  │  Modal              │◄───┼──────┼──┤                     │    │   │
│  │  │                     │    │      │  │ - loadTemplates()   │    │   │
│  │  │ - Create Template   │    │      │  │ - saveTemplate()    │    │   │
│  │  │ - Edit Template     │    │      │  │ - deleteTemplate()  │    │   │
│  │  │ - Delete Template   │    │      │  │ - getTemplateById() │    │   │
│  │  └─────────────────────┘    │      │  └─────────────────────┘    │   │
│  │           ▲                 │      │           ▲                 │   │
│  │           │                 │      │           │                 │   │
│  │           ▼                 │      │           │                 │   │
│  │  ┌─────────────────────┐    │      │           │                 │   │
│  │  │  Transcription Tab  │    │      │           │                 │   │
│  │  │                     │    │      │           │                 │   │
│  │  │ - Template Selector │◄───┼──────┼───────────┘                 │   │
│  │  │ - Refine Button     │    │      │                             │   │
│  │  │ - Loading Indicator │    │      │                             │   │
│  │  └─────────────────────┘    │      │                             │   │
│  │           ▲                 │      │                             │   │
│  └───────────┼─────────────────┘      └─────────────────────────────┘   │
│              │                                       ▲                   │
│              │                                       │                   │
│              ▼                                       │                   │
│  ┌─────────────────────────────┐      ┌─────────────────────────────┐   │
│  │                             │      │                             │   │
│  │     Controller Layer        │      │       Data Layer            │   │
│  │                             │      │                             │   │
│  │  ┌─────────────────────┐    │      │  ┌─────────────────────┐    │   │
│  │  │ RefinementController│    │      │  │  Configuration      │    │   │
│  │  │                     │◄───┼──────┼──┤                     │    │   │
│  │  │ - initRefinement()  │    │      │  │ - config.json       │    │   │
│  │  │ - executeRefinement()    │      │  │ - templates.json    │    │   │
│  │  │ - handleTemplateOps()    │      │  │                     │    │   │
│  │  └─────────────────────┘    │      │  └─────────────────────┘    │   │
│  │           ▲                 │      │                             │   │
│  └───────────┼─────────────────┘      └─────────────────────────────┘   │
│              │                                                           │
│              ▼                                                           │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                                                                 │    │
│  │                      External Ollama API                        │    │
│  │                                                                 │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Interactions

### 1. UI to Controller Interactions

- **Settings Panel → RefinementController**
  - Configure AI refinement settings
  - Access template management

- **Template Manager Modal → RefinementController**
  - Create, edit, delete templates
  - Set default template

- **Transcription Tab → RefinementController**
  - Select template for refinement
  - Initiate refinement process
  - Display refinement status

### 2. Controller to Service Interactions

- **RefinementController → OllamaService**
  - Send transcription text with template for refinement
  - Handle refinement results and errors

- **RefinementController → TemplateManager**
  - Load available templates
  - Save template changes
  - Get template details

### 3. Service to Data Interactions

- **TemplateManager → Configuration**
  - Read/write template data to templates.json
  - Validate template structure

- **OllamaService → Configuration**
  - Read Ollama connection settings from config.json

### 4. External Interactions

- **OllamaService → External Ollama API**
  - Send refinement requests to local Ollama instance
  - Receive refined text responses

## Data Flow

1. **Configuration Flow**
   - User configures AI refinement settings in Settings Panel
   - RefinementController updates configuration via config.js
   - Configuration is persisted to config.json

2. **Template Management Flow**
   - User creates/edits templates in Template Manager Modal
   - RefinementController passes template data to TemplateManager
   - TemplateManager validates and saves templates to templates.json

3. **Refinement Flow**
   - User selects template and clicks Refine button in Transcription Tab
   - RefinementController retrieves template from TemplateManager
   - RefinementController sends transcription and template to OllamaService
   - OllamaService communicates with Ollama API
   - Refined text is returned through the chain to update the UI
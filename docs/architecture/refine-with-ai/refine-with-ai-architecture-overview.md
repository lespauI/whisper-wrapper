# Refine with AI - Architecture Overview

## 1. Feature Overview

The "Refine with AI" feature enhances the Whisper Wrapper application by allowing users to improve transcription results using AI-powered text refinement. This feature leverages local Ollama models to reformat, correct grammar, or apply custom instructions to transcriptions based on user-defined templates.

## 2. Key Requirements

### Functional Requirements

- **AI Refinement Configuration**: Allow users to enable/disable AI refinement and configure Ollama endpoint and model
- **Template Management**: Create, edit, delete, and select custom refinement templates
- **Template Storage**: Store templates as JSON files in the application's data directory
- **Refinement Execution**: Process transcription text through selected Ollama model with chosen template
- **UI Integration**: Add refinement controls to the transcription screen
- **Settings Integration**: Extend existing settings panel to include AI refinement options

### Non-Functional Requirements

- **Local Processing**: All AI refinement must happen locally using Ollama models
- **User Experience**: Provide a simple, intuitive interface for template management
- **Performance**: Minimize latency during refinement operations
- **Reliability**: Handle connection issues and model errors gracefully
- **Extensibility**: Design for potential future integration with other AI services

## 3. Architecture Approach

The implementation will follow the existing client-side MVC architecture of the Whisper Wrapper application:

- **Model**: Configuration and template storage in JSON files
- **View**: UI components for template management and refinement controls
- **Controller**: Logic for template operations and AI refinement process

## 4. System Context

The "Refine with AI" feature will interact with:

1. **Existing Transcription System**: To access and modify transcription results
2. **Configuration System**: To store and retrieve AI refinement settings
3. **Local Ollama Instance**: To perform AI-powered text refinement
4. **File System**: To store and manage template files

## 5. Key Components

### 5.1 OllamaService

A new service responsible for:
- Connecting to the local Ollama instance
- Sending prompts with transcription text
- Receiving and processing refined text
- Handling errors and timeouts

### 5.2 TemplateManager

A new component responsible for:
- Loading, saving, and managing refinement templates
- Validating template structure
- Providing template selection functionality

### 5.3 RefinementController

A new controller responsible for:
- Coordinating between UI, TemplateManager, and OllamaService
- Managing the refinement workflow
- Handling user interactions with refinement features

### 5.4 UI Components

New UI elements including:
- Template selection dropdown in the transcription tab
- "Refine with AI" button in the transcription actions
- Template management modal for creating/editing templates
- AI refinement settings in the settings panel

## 6. Data Structures

### 6.1 Refinement Template

```json
{
  "id": "string",           // Unique identifier
  "name": "string",         // Display name
  "description": "string",  // Optional description
  "prompt": "string",       // The actual prompt template
  "isDefault": boolean,     // Whether this is the default template
  "createdAt": "string",    // ISO date string
  "updatedAt": "string"     // ISO date string
}
```

### 6.2 AI Refinement Configuration

```json
{
  "enabled": boolean,           // Whether refinement is enabled
  "endpoint": "string",         // Ollama endpoint URL
  "model": "string",            // Ollama model name
  "timeoutSeconds": number,     // Request timeout
  "defaultTemplateId": "string" // ID of default template
}
```

## 7. Key Workflows

### 7.1 Refining a Transcription

1. User selects a template from the dropdown
2. User clicks "Refine with AI" button
3. System retrieves the selected template
4. System sends transcription text with template prompt to Ollama
5. System displays a loading indicator during processing
6. System updates the transcription with refined text when complete
7. System handles any errors and displays appropriate messages

### 7.2 Managing Templates

1. User accesses template management from settings
2. System displays list of existing templates
3. User can create new, edit existing, or delete templates
4. System validates and saves template changes
5. System updates the template selection dropdown

## 8. Technical Constraints

- Must work with local Ollama models only
- Must maintain compatibility with existing transcription workflow
- Must handle large transcription texts efficiently
- Must provide appropriate error handling for network and model issues

## 9. Security Considerations

- Ensure all communication with Ollama is secure
- Validate all user inputs to prevent injection attacks
- Ensure template storage is properly secured

## 10. Performance Considerations

- Implement request timeouts to prevent hanging on large transcriptions
- Consider chunking large transcriptions for better performance
- Implement proper loading states to maintain UI responsiveness

## 11. Future Extensions

- Support for additional AI services beyond Ollama
- Advanced template features (variables, conditional formatting)
- Batch processing of multiple transcriptions
- Real-time refinement during transcription
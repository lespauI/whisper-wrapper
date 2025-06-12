/**
 * Ollama Service
 * Handles communication with Ollama API for AI text refinement
 */

const axios = require('axios');
const config = require('../config');
const { exec } = require('child_process');

class OllamaService {
  constructor() {
    // Get settings from the unified Ollama config
    this.settings = config.getAIRefinementSettings();
    console.log('OllamaService initialized with settings:', this.settings);
    
    // Store active requests for abortion capability
    this.activeRequests = new Map();
  }
  
  /**
   * Gracefully shut down the Ollama service using the Ollama API
   * This method sends a cancellation signal to any running models
   * and then attempts to gracefully terminate the service
   * @returns {Promise<boolean>} True if shutdown was attempted
   */
  async shutdownOllamaService() {
    console.log('Gracefully shutting down Ollama service...');
    
    try {
      // Make sure settings are up to date
      this.updateSettings();
      
      // Get the endpoint
      const endpoint = this.settings.endpoint || 'http://localhost:11434';
      
      // First, cancel all ongoing generations to stop any work
      console.log('Cancelling any active generations...');
      await this.abortRequest(); // Abort all active requests
      
      // For local Ollama instances, try to gracefully stop the service with CLI
      // This is a more graceful approach than kill -9
      const execPromise = (cmd) => new Promise((resolve) => {
        exec(cmd, (error, stdout, stderr) => {
          if (error) {
            console.log(`Command failed: ${cmd}`, error);
            resolve(false);
          } else {
            console.log(`Command success: ${cmd}`, stdout);
            resolve(true);
          }
        });
      });
      
      // Try multiple approaches to gracefully stop Ollama
      // 1. Try official commands if available
      // Note: Different versions of Ollama have different commands
      
      // First try: 'ollama stop' (newer versions)
      const officialStopResult1 = await execPromise('ollama stop');
      
      if (officialStopResult1) {
        console.log('Successfully stopped Ollama service with "ollama stop" command');
        return true;
      }
      
      // Second try: 'ollama serve stop' (might work in some versions)
      const officialStopResult2 = await execPromise('ollama serve stop');
      
      if (officialStopResult2) {
        console.log('Successfully stopped Ollama service with "ollama serve stop" command');
        return true;
      }
      
      // Third try: Just 'ollama' with no args to see available commands (for debugging)
      await execPromise('ollama --help');
      
      
      // 2. Send SIGTERM to Ollama processes (more graceful than SIGKILL)
      console.log('Trying to gracefully terminate Ollama processes with SIGTERM...');
      const findProcesses = await execPromise('ps -ef | grep ollama | grep -v grep | grep -v test-kill-ollama.js');
      
      if (!findProcesses) {
        console.log('No Ollama processes found or error finding processes');
        return false;
      }
      
      // Get process IDs and send SIGTERM - using a more structured approach
      const processOutput = await new Promise((resolve) => {
        exec('ps -ef | grep ollama | grep -v grep | grep -v test-kill-ollama.js', (error, stdout) => {
          resolve(error ? '' : stdout);
        });
      });
      
      if (!processOutput.trim()) {
        console.log('No Ollama processes found to terminate');
        return true;
      }
      
      console.log('Found Ollama processes:');
      console.log(processOutput);
      
      // Extract process IDs
      const processLines = processOutput.trim().split('\n');
      const pids = processLines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[1]; // PID is typically the second column
      }).filter(pid => pid && /^\d+$/.test(pid)); // Ensure PIDs are numeric
      
      if (pids.length === 0) {
        console.log('No valid PIDs extracted from process list');
        return true;
      }
      
      console.log(`Sending SIGTERM to ${pids.length} Ollama processes:`, pids);
      
      // Send SIGTERM to each process for graceful shutdown
      for (const pid of pids) {
        try {
          await execPromise(`kill -15 ${pid}`); // SIGTERM is more graceful than SIGKILL (-9)
          console.log(`Sent SIGTERM to Ollama process ${pid}`);
        } catch (killError) {
          console.log(`Error sending SIGTERM to process ${pid}, it may have already terminated`);
        }
      }
      
      // Wait a moment for processes to terminate
      console.log('Waiting for processes to terminate gracefully...');
      await new Promise(resolve => setTimeout(resolve, 3000)); // Longer wait time
      
      // Check if processes are still running
      const checkResult = await execPromise('ps -ef | grep ollama | grep -v grep | grep -v test-kill-ollama.js');
      
      // If processes still running, use SIGKILL as last resort, but get fresh list
      if (checkResult) {
        console.log('Some Ollama processes still running, using SIGKILL as last resort');
        
        // Get fresh list of current running processes
        const currentOutput = await new Promise((resolve) => {
          exec('ps -ef | grep ollama | grep -v grep | grep -v test-kill-ollama.js', (error, stdout) => {
            resolve(error ? '' : stdout);
          });
        });
        
        if (currentOutput.trim()) {
          const currentPids = currentOutput.trim().split('\n').map(line => {
            const parts = line.trim().split(/\s+/);
            return parts[1];
          }).filter(pid => pid && /^\d+$/.test(pid));
          
          for (const pid of currentPids) {
            try {
              await execPromise(`kill -9 ${pid}`);
              console.log(`Sent SIGKILL to Ollama process ${pid}`);
            } catch (killError) {
              console.log(`Error sending SIGKILL to process ${pid}, it may have already terminated`);
            }
          }
        }
      } else {
        console.log('All Ollama processes terminated gracefully');
      }
      
      return true;
    } catch (error) {
      console.error('Error shutting down Ollama service:', error);
      return false;
    }
  }
  
  /**
   * Update service settings
   */
  updateSettings() {
    // Get settings from the unified Ollama config
    const newSettings = config.getAIRefinementSettings();
    console.log('OllamaService updating settings from:', this.settings);
    console.log('OllamaService updating settings to:', newSettings);
    this.settings = newSettings;
  }
  
  /**
   * Test connection to Ollama
   * @returns {Promise<Object>} Connection status
   */
  async testConnection() {
    try {
      console.log('Testing Ollama connection with settings:', this.settings);
      
      // Make sure settings are up to date
      this.updateSettings();
      
      const endpoint = this.settings.endpoint || 'http://localhost:11434';
      console.log(`Making request to ${endpoint}/api/tags`);
      
      const response = await axios({
        method: 'GET',
        url: `${endpoint}/api/tags`,
        timeout: this.settings.timeoutSeconds * 1000
      });
      
      return {
        success: true,
        models: response.data.models || [],
        message: 'Successfully connected to Ollama'
      };
    } catch (error) {
      console.error('Ollama connection test failed:', error);
      return {
        success: false,
        models: [],
        message: error.message || 'Failed to connect to Ollama'
      };
    }
  }
  
  /**
   * Get available models from Ollama
   * @returns {Promise<Array>} List of available models
   */
  async getModels() {
    try {
      // Make sure settings are up to date
      this.updateSettings();
      
      const endpoint = this.settings.endpoint || 'http://localhost:11434';
      console.log(`Getting Ollama models from ${endpoint}/api/tags`);
      
      const response = await axios({
        method: 'GET',
        url: `${endpoint}/api/tags`,
        timeout: this.settings.timeoutSeconds * 1000
      });
      
      return response.data.models || [];
    } catch (error) {
      console.error('Failed to get Ollama models:', error);
      return [];
    }
  }
  
  /**
   * Refine text using Ollama
   * @param {string} text Text to refine
   * @param {string} prompt Prompt template
   * @returns {Promise<Object>} Refined text result with properties:
   *   - success: boolean indicating if refinement succeeded
   *   - refinedText: the refined text if successful
   *   - message: status message
   *   - requestId: ID of the request (can be used to abort)
   *   - stats: performance statistics if available
   */
  
  /**
   * Abort an ongoing Ollama request
   * @param {string} requestId Optional request ID to abort a specific request. If not provided, aborts all requests.
   * @returns {boolean} True if a request was aborted, false otherwise
   */
  abortRequest(requestId = null) {
    if (requestId) {
      // Abort a specific request
      const request = this.activeRequests.get(requestId);
      if (request) {
        console.log(`Aborting Ollama request ${requestId}`);
        request.controller.abort();
        request.eventEmitter.emit('progress', {
          type: 'aborted',
          message: 'Request aborted by user'
        });
        this.activeRequests.delete(requestId);
        return true;
      }
      return false;
    } else {
      // Abort all requests
      if (this.activeRequests.size === 0) {
        return false;
      }
      
      console.log(`Aborting all Ollama requests (${this.activeRequests.size} active)`);
      for (const [id, request] of this.activeRequests.entries()) {
        request.controller.abort();
        request.eventEmitter.emit('progress', {
          type: 'aborted',
          message: 'Request aborted by user'
        });
      }
      this.activeRequests.clear();
      return true;
    }
  }
  
  async refineText(text, prompt) {
    // Create a unique request ID
    const requestId = `request-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    
    // Create an AbortController for this request
    const controller = new AbortController();
    const signal = controller.signal;
    
    // Update settings in case they've changed
    this.updateSettings();
    
    // Log the raw settings
    console.log('OllamaService refineText using settings:', JSON.stringify(this.settings));
    
    // Force getting the latest settings from config
    const freshSettings = config.getAIRefinementSettings();
    console.log('Fresh settings from config:', JSON.stringify(freshSettings));
    
    // Log if AI refinement is disabled, but continue anyway
    if (!freshSettings.enabled) {
      console.log('AI refinement is disabled in settings, but continuing anyway:', freshSettings);
      // We don't return error here anymore, just log and continue
    }
    
    // Override settings with fresh ones
    this.settings = freshSettings;
    
    // Check if we actually have a prompt
    if (!prompt || typeof prompt !== 'string') {
      console.error('Invalid prompt provided:', prompt);
      return {
        success: false,
        message: 'Invalid template prompt',
        refinedText: null,
        error: {
          code: 'INVALID_PROMPT',
          message: 'The template prompt is invalid or missing'
        }
      };
    }
    
    // Check if the prompt contains the {{text}} placeholder, and if not, append the text
    let fullPrompt;
    if (prompt.includes('{{text}}')) {
      // Replace all instances of the placeholder
      fullPrompt = prompt.replace(/\{\{text\}\}/g, text);
      console.log('Found {{text}} placeholder in template, replacing with text');
    } else {
      // Template doesn't have the placeholder, so we'll append the text with instruction
      fullPrompt = `${prompt}\n\nHere is the text to process:\n\n${text}`;
      console.log('No {{text}} placeholder found in template, appending text to prompt');
    }
    
    // Get endpoint and model settings
    const endpoint = this.settings.endpoint || 'http://localhost:11434';
    const model = this.settings.model || 'gemma3:12b';
    const timeout = this.settings.timeoutSeconds || 30;
    
    console.log(`Refining text with Ollama:
    - Endpoint: ${endpoint}
    - Model: ${model}
    - Timeout: ${timeout}s
    - Prompt length: ${fullPrompt.length} chars`);
    
    try {
      // Use streaming to provide incremental updates
      const eventEmitter = new (require('events')).EventEmitter();
      let fullResponse = '';
      let responseChunks = []; // Store chunks in array to handle ordering issues
      let lastProgressUpdate = Date.now();
      let totalTokens = 0;
      let startTime = Date.now();
      
      // Store this request in the active requests map
      this.activeRequests.set(requestId, {
        controller,
        eventEmitter,
        startTime,
        text,
        model
      });
      
      // Estimate approximate text length based on input length (rough heuristic)
      // This helps provide a progress percentage even without exact token counts
      const estimatedOutputTokens = Math.max(200, Math.min(2000, Math.floor(fullPrompt.length / 3)));
      
      // Emit the initial progress update
      eventEmitter.emit('progress', {
        type: 'start',
        estimatedTokens: estimatedOutputTokens,
        elapsedMs: 0,
        progress: 0,
        text: ''
      });
      
      // Listen for abort events
      signal.addEventListener('abort', () => {
        console.log(`Request ${requestId} was aborted`);
        eventEmitter.emit('progress', {
          type: 'aborted',
          message: 'Request aborted by user'
        });
      });
      
      // Create a timeout handler
      const timeoutId = setTimeout(() => {
        console.log(`Request ${requestId} timed out after ${timeout} seconds`);
        eventEmitter.emit('progress', {
          type: 'error',
          error: 'Request timed out',
          message: `Ollama request timed out after ${timeout} seconds`
        });
        
        // Also abort the request on timeout
        if (!controller.signal.aborted) {
          controller.abort();
        }
      }, timeout * 1000);
      
      let response;
      try {
        // Setup streaming request with abort capability
        response = await axios({
          method: 'POST',
          url: `${endpoint}/api/generate`,
          timeout: timeout * 1000,
          signal: signal, // Add abort signal
          data: {
            model: model,
            prompt: fullPrompt,
            stream: true,
            options: {
              num_predict: 2048,  // Maximum tokens to generate
              temperature: 0.7    // Default creativity level
            }
          },
          responseType: 'stream',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/x-ndjson'
          }
        });
        
        // Process the stream
        response?.data?.on('data', (chunk) => {
          try {
            const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
            
            for (const line of lines) {
              // Add robust error handling for JSON parsing
              let data;
              try {
                data = JSON.parse(line);
              } catch (jsonError) {
                console.log(`Error parsing JSON response: ${jsonError.message}`);
                console.log(`Problem line: "${line.substring(0, 100)}${line.length > 100 ? '...' : ''}"`);
                continue; // Skip this problematic line and continue with the next one
              }
              
              // Track total tokens and validate response
              if (data && data.response) {
                // Store chunk in array to handle order issues
                responseChunks.push(data.response);
                
                // Rebuild the full response from the chunks
                // This fixes issues where chunks might come in wrong order
                fullResponse = responseChunks.join('');
                
                totalTokens++;
                
                // For debugging
                if (totalTokens <= 3 || totalTokens % 50 === 0) {
                  console.log(`Token ${totalTokens} received: "${data.response.substring(0, 20)}${data.response.length > 20 ? '...' : ''}" (Full length: ${fullResponse.length})`);
                }
                
                // Calculate progress percentage (capped at 99% until complete)
                const progressPct = Math.min(99, Math.round((totalTokens / estimatedOutputTokens) * 100));
                const elapsedMs = Date.now() - startTime;
                
                // Only send progress updates every 500ms to avoid flooding
                const now = Date.now();
                if (now - lastProgressUpdate > 500) {
                  eventEmitter.emit('progress', {
                    type: 'partial',
                    text: fullResponse,
                    done: false,
                    tokens: totalTokens,
                    estimatedTokens: estimatedOutputTokens,
                    progress: progressPct,
                    elapsedMs: elapsedMs
                  });
                  lastProgressUpdate = now;
                }
              }
              
              // Handle error in the stream
              if (data.error) {
                eventEmitter.emit('progress', {
                  type: 'error',
                  error: data.error,
                  message: `Ollama error: ${data.error}`
                });
              }
            }
          } catch (e) {
            console.error('Error parsing streaming response:', e);
            eventEmitter.emit('progress', {
              type: 'error',
              error: e.message,
              message: `Error parsing Ollama response: ${e.message}`
            });
          }
        });
        
        // Handle network/stream errors
        if (response?.data) {
          response.data.on('error', (err) => {
            console.error('Stream error:', err);
            eventEmitter.emit('progress', {
              type: 'error',
              error: err.message,
              message: `Stream error: ${err.message}`
            });
            
            // Emit cleanup event
            eventEmitter.emit('cleanup');
          });
        }
        
        // Clear the timeout when we start receiving data
        clearTimeout(timeoutId);
      } catch (error) {
        // Handle request setup errors (connection refused, etc.)
        console.error('Error setting up Ollama request:', error);
        eventEmitter.emit('progress', {
          type: 'error',
          error: error.message,
          message: `Failed to connect to Ollama: ${error.message}`
        });
        
        // Clear the timeout as we already have an error
        clearTimeout(timeoutId);
        
        // Remove from active requests on error
        this.activeRequests.delete(requestId);
        console.log(`Request ${requestId} failed and removed from active requests`);
      }
      
      // Handle stream completion
      return new Promise((resolve, reject) => {
        // If response is undefined (error occurred), resolve with error immediately
        if (!response || !response.data) {
          clearTimeout(timeoutId);
          
          // Emit cleanup to ensure listeners are removed
          eventEmitter.emit('cleanup');
          
          // Remove from active requests
          this.activeRequests.delete(requestId);
          
          resolve({
            success: false,
            message: 'Failed to connect to Ollama API',
            refinedText: null,
            requestId: requestId, // Include request ID
            error: {
              code: 'CONNECTION_FAILED',
              message: 'Could not establish connection to Ollama'
            }
          });
          return;
        }
        
        // Success handler
        const handleCompletion = () => {
          // Clear any pending timeout
          clearTimeout(timeoutId);
          
          // Validate response
          if (!fullResponse || fullResponse.trim().length === 0) {
            console.error('Empty response from Ollama');
            eventEmitter.emit('progress', {
              type: 'error',
              error: 'Empty response',
              message: 'Ollama returned an empty response. Please try again or check your template.'
            });
            
            // Remove from active requests on empty response
            this.activeRequests.delete(requestId);
            
            resolve({
              success: false,
              message: 'Ollama returned an empty response',
              refinedText: null,
              requestId: requestId,
              eventEmitter: eventEmitter
            });
            return;
          }
          
          // Calculate stats for logging
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);
          const tokensPerSec = (totalTokens / (elapsedSec || 1)).toFixed(2);
          
          console.log(`Ollama refinement complete:
          - Total tokens: ${totalTokens}
          - Time: ${elapsedSec}s
          - Speed: ${tokensPerSec} tokens/sec
          - Response length: ${fullResponse.length} chars`);
          
          // Emit completion event
          eventEmitter.emit('progress', {
            type: 'complete',
            text: fullResponse,
            done: true,
            tokens: totalTokens,
            elapsedMs: Date.now() - startTime,
            progress: 100
          });
          
          // Emit cleanup event to remove listeners
          eventEmitter.emit('cleanup');
          
          // Force close the response stream if it's still open
          try {
            if (response?.data) {
              // Remove all listeners to prevent memory leaks
              response.data.removeAllListeners();
              
              // If the response has a destroy method, call it
              if (typeof response.data.destroy === 'function') {
                response.data.destroy();
                console.log('Ollama response stream destroyed');
              }
              
              // If response has a socket, end it
              if (response.data.socket) {
                response.data.socket.end();
                console.log('Ollama socket connection ended');
              }
            }
          } catch (e) {
            console.warn('Error while closing Ollama connection:', e.message);
          }
          
          // Remove from active requests
          this.activeRequests.delete(requestId);
          console.log(`Request ${requestId} completed successfully and removed from active requests.`);
          
          // Resolve with success
          resolve({
            success: true,
            refinedText: fullResponse,
            message: 'Text refined successfully',
            requestId: requestId,
            stats: {
              tokens: totalTokens,
              elapsedMs: Date.now() - startTime,
              tokensPerSecond: parseFloat(tokensPerSec)
            }
          });
        };
        
        try {
          // Set up event handlers - ensure response exists
          response.data.on('end', handleCompletion);
          
          // Add a separate error handler for the stream
          response.data.on('error', (err) => {
            clearTimeout(timeoutId);
            console.error('Stream error on completion:', err);
            
            // Clean up connection resources
            try {
              // Remove listeners except the current error handler
              response.data.removeAllListeners('end');
              // Don't destroy yet - we're still in the error handler
            } catch (e) {
              console.warn('Error removing listeners in error handler:', e);
            }
            
            // Emit cleanup event for any UI listeners
            eventEmitter.emit('cleanup');
            
            // Check if we have a partial response we can use
            if (fullResponse && fullResponse.trim().length > 0) {
              console.log(`Using partial response (${fullResponse.length} chars) despite stream error`);
              eventEmitter.emit('progress', {
                type: 'warning',
                warning: err.message,
                message: 'Completed with warnings',
                text: fullResponse
              });
              
              // Force final progress update with what we have
              eventEmitter.emit('progress', {
                type: 'complete',
                text: fullResponse,
                done: true,
                tokens: totalTokens || 0,
                error: err.message,
                elapsedMs: Date.now() - startTime,
                progress: 100
              });
              
              // Now clean up the stream
              try {
                if (response?.data) {
                  // Now we can destroy the stream after our handler runs
                  setTimeout(() => {
                    try {
                      if (typeof response.data.destroy === 'function') {
                        response.data.destroy();
                      }
                      if (response.data.socket) {
                        response.data.socket.end();
                      }
                    } catch (e) {
                      console.warn('Error in delayed cleanup:', e);
                    }
                  }, 100);
                }
              } catch (cleanupErr) {
                console.warn('Error in stream cleanup:', cleanupErr);
              }
              
              // Still resolve with the partial response
              resolve({
                success: true,
                refinedText: fullResponse,
                message: 'Text partially refined (stream error occurred)',
                stats: {
                  tokens: totalTokens || 0,
                  elapsedMs: Date.now() - startTime,
                  tokensPerSecond: 0,
                  warning: err.message
                }
              });
            } else {
              // No usable response, reject
              eventEmitter.emit('progress', {
                type: 'error',
                error: err.message,
                message: `Error during refinement: ${err.message}`
              });
              
              // Clean up resources
              try {
                if (response?.data) {
                  // Destroy the stream
                  setTimeout(() => {
                    try {
                      if (typeof response.data.destroy === 'function') {
                        response.data.destroy();
                      }
                      if (response.data.socket) {
                        response.data.socket.end();
                      }
                    } catch (e) {
                      console.warn('Error in delayed cleanup:', e);
                    }
                  }, 100);
                }
              } catch (cleanupErr) {
                console.warn('Error in stream cleanup:', cleanupErr);
              }
              
              reject(err);
            }
          });
        } catch (error) {
          clearTimeout(timeoutId);
          console.error('Error setting up completion handlers:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Text refinement failed:', error);
      
      // Close any open connections
      if (typeof response?.data?.destroy === 'function') {
        try {
          console.log('Destroying Ollama response stream after global error');
          response.data.removeAllListeners();
          response.data.destroy();
          if (response.data.socket) {
            response.data.socket.end();
          }
        } catch (cleanupError) {
          console.warn('Error during global error cleanup:', cleanupError);
        }
      }
      
      // Force cleanup of any remaining memory or resources
      setTimeout(() => {
        try {
          // Try to force garbage collection of any leaked resources
          if (global.gc) {
            console.log('Forcing garbage collection after error');
            global.gc();
          }
        } catch (e) {
          // Ignore errors in cleanup
        }
      }, 1000);
      
      // Determine appropriate user-friendly error message
      let errorMessage = 'Failed to refine text';
      
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection to Ollama refused. Is Ollama running?';
      } else if (error.code === 'ETIMEDOUT' || error.code === 'ESOCKETTIMEDOUT') {
        errorMessage = `Connection to Ollama timed out after ${timeout} seconds`;
      } else if (error.response) {
        // Axios response error
        if (error.response.status === 404) {
          errorMessage = `Model "${model}" not found in Ollama`;
        } else if (error.response.status === 401 || error.response.status === 403) {
          errorMessage = 'Authentication failed with Ollama';
        } else {
          errorMessage = `Ollama error: ${error.response.status} ${error.response.statusText}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      return {
        success: false,
        refinedText: null,
        message: errorMessage,
        error: {
          code: error.code || 'UNKNOWN_ERROR',
          message: errorMessage,
          original: error.message
        }
      };
    }
  }
  
  /**
   * Get current active requests
   * @returns {Array} Array of active request IDs
   */
  getActiveRequests() {
    return Array.from(this.activeRequests.keys());
  }
  
  /**
   * Stop all ongoing Ollama requests
   * @returns {number} Number of requests aborted
   */
  stopAllRequests() {
    const count = this.activeRequests.size;
    this.abortRequest();
    return count;
  }
  
  /**
   * Check if there are any active requests
   * @returns {boolean} True if there are active requests
   */
  hasActiveRequests() {
    return this.activeRequests.size > 0;
  }
}

module.exports = new OllamaService();
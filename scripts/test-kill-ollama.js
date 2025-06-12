/**
 * Test script for gracefully shutting down the Ollama service
 */

const { exec } = require('child_process');
const axios = require('axios');

// Function to find Ollama processes
function findOllamaProcesses() {
  return new Promise((resolve) => {
    // Use grep -v to exclude both grep and this script
    exec('ps -ef | grep ollama | grep -v grep | grep -v test-kill-ollama.js', (error, stdout, stderr) => {
      if (error || !stdout.trim()) {
        console.log('No Ollama processes found');
        resolve([]);
        return;
      }
      
      console.log('Found Ollama processes:');
      console.log(stdout);
      
      // Extract process IDs
      const processLines = stdout.trim().split('\n');
      const pids = processLines.map(line => {
        const parts = line.trim().split(/\s+/);
        return parts[1]; // PID is typically the second column
      });
      
      resolve(pids);
    });
  });
}

// Helper function to execute commands as promises
function execPromise(cmd) {
  return new Promise((resolve) => {
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
}

// Function to gracefully shutdown Ollama service
async function shutdownOllamaService() {
  console.log('Gracefully shutting down Ollama service...');
  
  try {
    // First, check if Ollama API is responding
    const endpoint = 'http://localhost:11434';
    
    // Try to cancel any active generations via API
    try {
      console.log('Testing Ollama API connection...');
      const response = await axios.get(`${endpoint}/api/tags`, { timeout: 5000 });
      console.log('Ollama API is available, found models:', response.data.models.length);
    } catch (apiError) {
      console.log('Ollama API is not responding:', apiError.message);
    }
    
    // Try multiple approaches to gracefully stop Ollama
    // 1. Try official command if available
    console.log('Attempting to stop Ollama with official command...');
    const officialStopResult = await execPromise('ollama serve stop');
    
    if (officialStopResult) {
      console.log('Successfully stopped Ollama service with official command');
      return true;
    }
    
    // 2. Send SIGTERM to Ollama processes (more graceful than SIGKILL)
    console.log('Trying to gracefully terminate Ollama processes with SIGTERM...');
    
    // Get process IDs
    const pids = await findOllamaProcesses();
    
    if (pids.length === 0) {
      console.log('No Ollama processes found to terminate');
      return false;
    }
    
    console.log(`Sending SIGTERM to ${pids.length} Ollama processes:`, pids);
    
    // Send SIGTERM to each process for graceful shutdown
    for (const pid of pids) {
      await execPromise(`kill -15 ${pid}`); // SIGTERM is more graceful than SIGKILL (-9)
      console.log(`Sent SIGTERM to Ollama process ${pid}`);
    }
    
    // Wait a moment for processes to terminate
    console.log('Waiting for processes to terminate gracefully...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if processes are still running
    const remainingPids = await findOllamaProcesses();
    
    if (remainingPids.length > 0) {
      console.log('Some Ollama processes still running after SIGTERM, using SIGKILL as last resort');
      for (const pid of remainingPids) {
        await execPromise(`kill -9 ${pid}`);
        console.log(`Sent SIGKILL to Ollama process ${pid}`);
      }
    } else {
      console.log('All Ollama processes terminated gracefully with SIGTERM');
    }
    
    return true;
  } catch (error) {
    console.error('Error shutting down Ollama service:', error);
    return false;
  }
}

// Main function
async function main() {
  console.log('Testing Ollama graceful shutdown functionality');
  
  // Check if there are Ollama processes running
  const initialProcesses = await findOllamaProcesses();
  
  if (initialProcesses.length === 0) {
    console.log('No Ollama processes found to shut down. Test complete.');
    return;
  }
  
  // Gracefully shut down Ollama processes
  const result = await shutdownOllamaService();
  console.log('Shutdown Ollama service result:', result);
  
  // Verify processes are gone
  const remainingProcesses = await findOllamaProcesses();
  
  if (remainingProcesses.length === 0) {
    console.log('SUCCESS: All Ollama processes have been terminated.');
  } else {
    console.log('WARNING: Some Ollama processes are still running:', remainingProcesses);
  }
}

// Run the test
main().catch(error => {
  console.error('Error running test:', error);
});
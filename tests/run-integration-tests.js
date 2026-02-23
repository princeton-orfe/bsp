#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

/**
 * Integration Test Runner for Drupal UI Automation
 *
 * This script runs integration tests against a running Docker container
 * to validate browser behavior and API functionality.
 */

async function runIntegrationTests() {
  console.log('🚀 Starting Drupal UI Automation Integration Tests');
  console.log('================================================\n');

  try {
    // Detect if running inside container
    const isInContainer = process.env.NODE_ENV === 'test' || await checkIfInContainer();

    if (isInContainer) {
      // Running inside container - just run tests directly
      console.log('🏃 Running tests inside container...');
      const testResult = await runCommand('npm', ['run', 'test:integration:direct'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });
      console.log('\n✅ Integration tests completed successfully!');
      return true;
    } else {
      // Running on host - ensure container is running first
      console.log('📦 Checking if container is running...');
      const psResult = await runCommand('docker-compose', ['ps'], { cwd: path.join(__dirname, '..') });

      if (!psResult.includes('Up')) {
        console.log('❌ Container is not running. Starting container...');
        await runCommand('docker-compose', ['up', '--build', '-d'], { cwd: path.join(__dirname, '..') });
        console.log('⏳ Waiting for container to be ready...');
        await waitForContainer(30000); // Wait up to 30 seconds
      }

      // Run the integration tests
      console.log('🧪 Running integration tests...');
      const testResult = await runCommand('npm', ['run', 'test:integration'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit'
      });

      console.log('\n✅ Integration tests completed successfully!');
      return true;
    }

  } catch (error) {
    console.error('\n❌ Integration tests failed:', error.message);
    return false;
  }
}

async function checkIfInContainer() {
  try {
    // Check for Docker container indicators
    const cgroup = await runCommand('cat', ['/proc/1/cgroup']);
    return cgroup.includes('docker') || cgroup.includes('containerd');
  } catch (error) {
    return false;
  }
}

async function waitForContainer(timeoutMs = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const healthCheck = await runCommand('curl', ['-s', 'http://localhost:3000/health'], {
        cwd: path.join(__dirname, '..')
      });

      if (healthCheck.includes('ok')) {
        console.log('✅ Container is ready!');
        return;
      }
    } catch (error) {
      // Container not ready yet
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  throw new Error('Container failed to become ready within timeout');
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      stdio: options.stdio || 'pipe'
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Command failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (error) => {
      reject(error);
    });
  });
}

// Run the tests if this script is executed directly
if (require.main === module) {
  runIntegrationTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}

module.exports = { runIntegrationTests };
const { execSync } = require('child_process');

module.exports = async () => {
  console.log('Running global test teardown...');

  try {
    // Kill any remaining Chromium processes
    console.log('Cleaning up browser processes...');
    execSync('pkill -f chromium || true', { stdio: 'inherit' });
    execSync('pkill -f chrome || true', { stdio: 'inherit' });

    // Kill any remaining Node processes related to Playwright
    execSync('pkill -f playwright || true', { stdio: 'inherit' });

    console.log('Browser cleanup completed');
  } catch (error) {
    console.log('Cleanup completed (some processes may not have been running)');
  }

  // Give processes time to terminate
  await new Promise(resolve => setTimeout(resolve, 1000));
};
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.js',
    'server.js',
    '!**/node_modules/**'
  ],
  setupFilesAfterEnv: [],
  testTimeout: 30000, // 30 second timeout for integration tests
  verbose: true,
  forceExit: true, // Force exit to prevent hanging
  detectOpenHandles: true, // Detect open handles that prevent exit
  globalTeardown: '<rootDir>/tests/teardown.js' // Additional cleanup for Playwright processes
};
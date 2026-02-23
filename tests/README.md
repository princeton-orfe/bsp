# Drupal UI Automation Tests

This directory contains tests for the Drupal UI Automation platform, ensuring that browser behavior meets the specified requirements.

## Test Structure

```
tests/
├── integration/          # Integration tests requiring full Docker environment
│   └── browser-behavior.test.js
├── unit/                 # Unit tests for individual components
│   └── playwright-manager.test.js
└── run-integration-tests.js  # Custom test runner for integration tests
```

## Test Requirements

The tests validate that the system meets these critical requirements:

### ❌ Browser Auto-Launch Prevention
- Browser must NOT launch automatically when the server starts
- Browser should only launch when explicitly requested via API calls
- No background browser processes should be created without user interaction

### ❌ Default URL Auto-Load Prevention
- Browser must start with `about:blank`, not the configured default URL
- No automatic navigation to `DEFAULT_LOGIN_URL` should occur
- User must manually navigate to target URLs through the VNC interface

## Running Tests

All tests run in Docker containers for consistent environment and proper isolation.

### All Tests
```bash
# Run all tests in container
npm test

# Or run with explicit container command
npm run test:container
```

### Unit Tests Only
```bash
# Run only unit tests in container
npm run test:unit
```

### Integration Tests Only
```bash
# Run only integration tests in container
npm run test:integration:container
```

### Development Testing
For faster development iteration, you can run unit tests on the host:

```bash
# Run unit tests directly on host (faster for development)
npm run test:unit:host
```

## Test Validation

### Browser Auto-Launch Tests
- ✅ Server starts without browser processes
- ✅ `/playwright/ready` returns `false` initially
- ✅ Browser only launches after `/login/interactive` API call
- ✅ `/playwright/ready` returns `true` after explicit launch

### Default URL Auto-Load Tests
- ✅ Interactive context starts with `about:blank`
- ✅ Page URL remains `about:blank` (not default URL)
- ✅ No automatic navigation occurs
- ✅ Manual navigation instructions provided in API response

### Browser Control Tests
- ✅ Browser remains under Playwright control
- ✅ Screenshots can be taken (validating control)
- ✅ Page interactions work correctly
- ✅ Browser lifecycle managed properly

## Test Failure Scenarios

Tests will fail if:

1. **Browser auto-launches**: Server starts with browser processes running
2. **Automatic navigation**: Page navigates to default URL without user interaction
3. **Lost control**: Browser becomes unresponsive to Playwright commands
4. **Incorrect initial state**: Page starts with any URL other than `about:blank`

## CI/CD Integration

For automated testing in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Unit Tests
  run: npm test

- name: Run Integration Tests
  run: npm run test:integration
```

## Debugging Failed Tests

If tests fail:

1. **Check container logs**: `docker-compose logs`
2. **Verify environment variables**: Ensure `.env` is loaded correctly
3. **Check VNC access**: Ensure noVNC is accessible at `http://localhost:8080`
4. **Validate API responses**: Test endpoints manually with curl

## Test Coverage

Current test coverage includes:
- Browser lifecycle management
- API endpoint validation
- Page state verification
- Control validation
- Error handling

Future enhancements may include:
- Performance testing
- Load testing
- Cross-browser compatibility
- Security validation
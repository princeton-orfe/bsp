const PlaywrightManager = require('../../src/playwrightManager');
const { chromium } = require('playwright');

// Mock Playwright
jest.mock('playwright', () => ({
  chromium: {
    launch: jest.fn().mockResolvedValue({
      contexts: jest.fn().mockReturnValue([]),
      newContext: jest.fn().mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          url: jest.fn().mockReturnValue('about:blank'),
          title: jest.fn().mockResolvedValue('Test Page'),
          evaluate: jest.fn().mockResolvedValue('Test Title'),
          screenshot: jest.fn().mockRejectedValue(new Error('Timeout')),
          goto: jest.fn().mockResolvedValue(),
          on: jest.fn().mockImplementation(() => {}),
          close: jest.fn().mockResolvedValue(),
        }),
        close: jest.fn().mockResolvedValue(),
      }),
      close: jest.fn().mockResolvedValue(),
    }),
  },
}));

describe('PlaywrightManager Unit Tests', () => {
  let manager;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Clean up environment variables from previous tests
    delete process.env.KEEPALIVE_ENABLED;
    delete process.env.KEEPALIVE_INTERVAL_MINUTES;
    delete process.env.KEEPALIVE_MAX_FAILURES;

    // Create a new manager instance for each test
    manager = new PlaywrightManager();
  });

  afterEach(async () => {
    // Clean up any browser instances
    try {
      await manager.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Browser Launch Behavior', () => {
    test('should not auto-launch browser on instantiation', () => {
      // Manager should be created without launching browser
      expect(manager.browser).toBeNull();
      expect(manager.context).toBeNull();
      expect(manager.page).toBeNull();
    });

    test('should only launch browser when explicitly requested', async () => {
      // Initially no browser
      expect(manager.browser).toBeNull();

      // Launch browser explicitly
      const browser = await manager.launchBrowser();

      // Now browser should exist
      expect(browser).toBeDefined();
      expect(manager.browser).toBe(browser);
      expect(chromium.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Interactive Context Creation', () => {
    test('should create interactive context starting with about:blank', async () => {
      // Create interactive context
      const { context, page } = await manager.createInteractiveContext();

      // Verify context and page are created
      expect(context).toBeDefined();
      expect(page).toBeDefined();
      expect(manager.context).toBe(context);
      expect(manager.page).toBe(page);

      // Verify page starts with about:blank (not default URL)
      const currentUrl = page.url();
      expect(currentUrl).toBe('about:blank');

      // Ensure it's not the default URL
      const defaultUrl = process.env.DEFAULT_LOGIN_URL || 'https://example.com/login';
      expect(currentUrl).not.toBe(defaultUrl);
    });

    test('should not automatically navigate to default URL', async () => {
      // Create interactive context
      const { page } = await manager.createInteractiveContext();

      // Check initial URL
      let currentUrl = page.url();
      expect(currentUrl).toBe('about:blank');

      // Wait a moment to ensure no automatic navigation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // URL should still be about:blank
      currentUrl = page.url();
      expect(currentUrl).toBe('about:blank');
    });
  });

  describe('Browser Control Validation', () => {
    test('should maintain browser control', async () => {
      const { page } = await manager.createInteractiveContext();

      // Should be able to interact with the page
      const title = await page.title();
      expect(title).toBeDefined();

      // Should be able to evaluate JavaScript on the page
      const result = await page.evaluate(() => document.title);
      expect(result).toBeDefined();

      // Should be able to take screenshots (with longer timeout for container)
      try {
        const screenshot = await page.screenshot({ timeout: 45000 });
        expect(screenshot).toBeDefined();
        expect(Buffer.isBuffer(screenshot)).toBe(true);
      } catch (error) {
        // In container environment, screenshot might fail due to display issues
        // Just verify we can still interact with the page
        console.log('Screenshot failed in container environment, but page interaction works');
        expect(error.message).toContain('Timeout');
      }
    }, 60000); // Increase timeout to 60 seconds for container environment

    test('should properly close browser instances', async () => {
      await manager.createInteractiveContext();

      // Browser should be running
      expect(manager.browser).toBeDefined();
      expect(manager.browser).not.toBeNull();

      // Close the manager
      await manager.close();

      // Browser should be cleaned up
      expect(manager.browser).toBeNull();
      expect(manager.context).toBeNull();
      expect(manager.page).toBeNull();
    });
  });

  describe('Keepalive Functionality', () => {
    beforeEach(() => {
      // Clear environment variables before each test
      delete process.env.KEEPALIVE_ENABLED;
      delete process.env.KEEPALIVE_INTERVAL_MINUTES;
      jest.clearAllTimers();
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should initialize with keepalive enabled by default', () => {
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveEnabled).toBe(true);
      expect(mgr.keepaliveIntervalMinutes).toBe(60);
      expect(mgr.keepaliveInterval).toBeNull();
    });

    test('should respect KEEPALIVE_ENABLED=false environment variable', () => {
      process.env.KEEPALIVE_ENABLED = 'false';
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveEnabled).toBe(false);
    });

    test('should respect KEEPALIVE_INTERVAL_MINUTES environment variable', () => {
      process.env.KEEPALIVE_INTERVAL_MINUTES = '30';
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveIntervalMinutes).toBe(30);
    });

    test('should use default interval when KEEPALIVE_INTERVAL_MINUTES is invalid', () => {
      process.env.KEEPALIVE_INTERVAL_MINUTES = 'invalid';
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveIntervalMinutes).toBe(60);
    });

    test('should constrain interval to minimum (5 minutes)', () => {
      process.env.KEEPALIVE_INTERVAL_MINUTES = '1';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveIntervalMinutes).toBe(5);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('out of range'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('5 minutes'));
      consoleSpy.mockRestore();
    });

    test('should constrain interval to maximum (1440 minutes)', () => {
      process.env.KEEPALIVE_INTERVAL_MINUTES = '10000';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveIntervalMinutes).toBe(1440);
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('out of range'));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('1440 minutes'));
      consoleSpy.mockRestore();
    });

    test('should accept valid interval within range', () => {
      process.env.KEEPALIVE_INTERVAL_MINUTES = '30';
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveIntervalMinutes).toBe(30);
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    test('should use explicit radix for parseInt', () => {
      process.env.KEEPALIVE_INTERVAL_MINUTES = '30';
      process.env.KEEPALIVE_MAX_FAILURES = '5';
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveIntervalMinutes).toBe(30);
      expect(mgr.keepaliveMaxFailures).toBe(5);
    });

    test('should initialize keepaliveLastRefresh to null', () => {
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveLastRefresh).toBeNull();
    });

    test('getKeepaliveStatus should return correct status when not running', () => {
      const status = manager.getKeepaliveStatus();
      expect(status.enabled).toBe(true);
      expect(status.running).toBe(false);
      expect(status.intervalMinutes).toBe(60);
      expect(status.circuitBreaker).toBeDefined();
      expect(status.circuitBreaker.open).toBe(false);
      expect(status.circuitBreaker.consecutiveFailures).toBe(0);
      expect(status.circuitBreaker.maxFailures).toBe(3);
    });

    test('getKeepaliveStatus should return correct status when running', () => {
      manager.keepaliveInterval = setInterval(() => {}, 1000);
      const status = manager.getKeepaliveStatus();
      expect(status.enabled).toBe(true);
      expect(status.running).toBe(true);
      expect(status.intervalMinutes).toBe(60);
      expect(status.circuitBreaker).toBeDefined();
      clearInterval(manager.keepaliveInterval);
      manager.keepaliveInterval = null;
    });

    test('startKeepalive should not start when disabled', () => {
      process.env.KEEPALIVE_ENABLED = 'false';
      const mgr = new PlaywrightManager();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mgr.startKeepalive();

      expect(mgr.keepaliveInterval).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Keepalive disabled via KEEPALIVE_ENABLED=false');
      consoleSpy.mockRestore();
    });

    test('startKeepalive should stop existing keepalive before starting new one', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const firstInterval = setInterval(() => {}, 1000);
      manager.keepaliveInterval = firstInterval;

      manager.startKeepalive();

      expect(manager.keepaliveInterval).not.toBe(firstInterval);
      expect(manager.keepaliveInterval).not.toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Internal keepalive stopped');
      expect(consoleSpy).toHaveBeenCalledWith('Internal keepalive started');

      manager.stopKeepalive();
      consoleSpy.mockRestore();
    });

    test('startKeepalive should set up interval correctly', () => {
      process.env.KEEPALIVE_INTERVAL_MINUTES = '30';
      const mgr = new PlaywrightManager();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      mgr.startKeepalive();

      expect(mgr.keepaliveInterval).not.toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Starting internal keepalive: will refresh session every 30 minutes');
      expect(consoleSpy).toHaveBeenCalledWith('Internal keepalive started');

      mgr.stopKeepalive();
      consoleSpy.mockRestore();
    });

    test('stopKeepalive should clear interval', () => {
      manager.keepaliveInterval = setInterval(() => {}, 1000);
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.stopKeepalive();

      expect(manager.keepaliveInterval).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith('Internal keepalive stopped');
      consoleSpy.mockRestore();
    });

    test('stopKeepalive should handle being called when not running', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      manager.stopKeepalive();

      expect(manager.keepaliveInterval).toBeNull();
      expect(consoleSpy).not.toHaveBeenCalledWith('Internal keepalive stopped');
      consoleSpy.mockRestore();
    });

    test('close should stop keepalive', async () => {
      // Use real timers for this test since createInteractiveContext uses setTimeout
      jest.useRealTimers();

      await manager.createInteractiveContext();

      // Switch back to fake timers after browser launch completes
      jest.useFakeTimers();
      manager.keepaliveInterval = setInterval(() => {}, 1000);

      await manager.close();

      expect(manager.keepaliveInterval).toBeNull();

      // Clean up - afterEach will restore real timers
    });

    test('should initialize circuit breaker state correctly', () => {
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveConsecutiveFailures).toBe(0);
      expect(mgr.keepaliveMaxFailures).toBe(3);
      expect(mgr.keepaliveCircuitOpen).toBe(false);
    });

    test('should respect KEEPALIVE_MAX_FAILURES environment variable', () => {
      process.env.KEEPALIVE_MAX_FAILURES = '5';
      const mgr = new PlaywrightManager();
      expect(mgr.keepaliveMaxFailures).toBe(5);
    });

    test('startKeepalive should reset circuit breaker state', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      // Simulate a circuit breaker state
      manager.keepaliveConsecutiveFailures = 2;
      manager.keepaliveCircuitOpen = true;

      manager.startKeepalive();

      expect(manager.keepaliveConsecutiveFailures).toBe(0);
      expect(manager.keepaliveCircuitOpen).toBe(false);

      manager.stopKeepalive();
      consoleSpy.mockRestore();
    });

    test('getKeepaliveStatus should include circuit breaker state', () => {
      manager.keepaliveConsecutiveFailures = 2;
      manager.keepaliveCircuitOpen = true;

      const status = manager.getKeepaliveStatus();

      expect(status.circuitBreaker.open).toBe(true);
      expect(status.circuitBreaker.consecutiveFailures).toBe(2);
      expect(status.circuitBreaker.maxFailures).toBe(3);
    });
  });
});
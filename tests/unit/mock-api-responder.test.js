const MockApiResponder = require('../mock-api-responder');

describe('MockApiResponder', () => {
  let mockApi;

  beforeEach(() => {
    mockApi = new MockApiResponder({
      simulateDelays: false // Disable delays for faster tests
    });
  });

  afterEach(() => {
    mockApi.reset();
  });

  describe('Health Endpoint', () => {
    test('should return healthy status', async () => {
      const response = await mockApi.request('GET', '/health');

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('healthy');
      expect(response.data.service).toBe('drupal-ui-automation');
      expect(response.data.timestamp).toBeDefined();
    });
  });

  describe('Playwright Ready Endpoint', () => {
    test('should return not ready initially', async () => {
      const response = await mockApi.request('GET', '/playwright/ready');

      expect(response.status).toBe(200);
      expect(response.data.ready).toBe(false);
      expect(response.data.browser).toBe(false);
      expect(response.data.context).toBe(false);
      expect(response.data.page).toBe(false);
    });

    test('should return ready after interactive login', async () => {
      await mockApi.request('POST', '/login/interactive');
      const response = await mockApi.request('GET', '/playwright/ready');

      expect(response.status).toBe(200);
      expect(response.data.ready).toBe(true);
      expect(response.data.browser).toBe(true);
      expect(response.data.context).toBe(true);
      expect(response.data.page).toBe(true);
    });
  });

  describe('Login Endpoints', () => {
    test('should create interactive session', async () => {
      const response = await mockApi.request('POST', '/login/interactive');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.vncUrl).toBe('http://localhost:8080/vnc.html');
    });

    test('should check authentication status', async () => {
      // Initially not authenticated
      let response = await mockApi.request('GET', '/login/check');
      expect(response.data.authenticated).toBe(false);

      // After creating session but not loading
      await mockApi.request('POST', '/login/interactive');
      response = await mockApi.request('GET', '/login/check');
      expect(response.data.authenticated).toBe(false);

      // Simulate being on an admin page (authenticated)
      mockApi.currentUrl = 'https://example.com/admin/content';
      response = await mockApi.request('GET', '/login/check');
      expect(response.data.authenticated).toBe(true);
    });

    test('should navigate to login page', async () => {
      await mockApi.request('POST', '/login/interactive');
      const response = await mockApi.request('POST', '/login/navigate');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.url).toBeDefined();
    });

    test('should save and load sessions', async () => {
      await mockApi.request('POST', '/login/interactive');

      // Simulate authentication by setting URL to admin page
      mockApi.currentUrl = 'https://example.com/admin/content';
      mockApi.sessionLoaded = true;

      // Save session
      const saveResponse = await mockApi.request('POST', '/login/save', {
        body: { sessionName: 'test-session' }
      });
      expect(saveResponse.data.success).toBe(true);

      // Create a new browser session (don't reset saved sessions)
      await mockApi.request('POST', '/login/interactive');

      const loadResponse = await mockApi.request('POST', '/login/load', {
        body: { sessionName: 'test-session' }
      });
      expect(loadResponse.data.success).toBe(true);
      expect(loadResponse.data.authenticated).toBe(true);
    });
  });

  describe('Debug Endpoints', () => {
    test('should capture screenshot', async () => {
      await mockApi.request('POST', '/login/interactive');

      const response = await mockApi.request('GET', '/debug/screenshot');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.screenshot).toBeDefined();
      expect(response.data.url).toBe('about:blank');
    });

    test('should get page information', async () => {
      await mockApi.request('POST', '/login/interactive');

      const response = await mockApi.request('GET', '/debug/page');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.url).toBe('about:blank');
      expect(response.data.title).toBe('about:blank');
    });
  });

  describe('Content Endpoints', () => {
    beforeEach(async () => {
      await mockApi.request('POST', '/login/interactive');
      // Note: Content endpoints only require browser launch, not session loading
    });

    test('should return content types', async () => {
      const response = await mockApi.request('GET', '/content/types');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.types)).toBe(true);
      expect(response.data.types.length).toBeGreaterThan(0);
      expect(response.data.types[0]).toHaveProperty('name');
      expect(response.data.types[0]).toHaveProperty('label');
    });

    test('should return paginated content', async () => {
      const response = await mockApi.request('GET', '/content', {
        query: { page: 1, limit: 10 }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(Array.isArray(response.data.content)).toBe(true);
      expect(response.data.content.length).toBe(10);
      expect(response.data.pagination).toBeDefined();
      expect(response.data.pagination.currentPage).toBe(1);
      expect(response.data.pagination.totalPages).toBeGreaterThan(1);
      expect(response.data.pagination.hasNextPage).toBe(true);
    });

    test('should filter content by type', async () => {
      const response = await mockApi.request('GET', '/content', {
        query: { type: 'article', limit: 5 }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.content.length).toBe(5);
      expect(response.data.content.every(item => item.type === 'article')).toBe(true);
    });

    test('should handle pagination correctly', async () => {
      // First page
      const firstPage = await mockApi.request('GET', '/content', {
        query: { page: 1, limit: 5 }
      });

      // Second page
      const secondPage = await mockApi.request('GET', '/content', {
        query: { page: 2, limit: 5 }
      });

      expect(firstPage.data.pagination.currentPage).toBe(1);
      expect(firstPage.data.pagination.hasNextPage).toBe(true);
      expect(firstPage.data.pagination.hasPrevPage).toBe(false);

      expect(secondPage.data.pagination.currentPage).toBe(2);
      expect(secondPage.data.pagination.hasNextPage).toBe(true);
      expect(secondPage.data.pagination.hasPrevPage).toBe(true);

      // Items should be different
      const firstIds = firstPage.data.content.map(item => item.id);
      const secondIds = secondPage.data.content.map(item => item.id);
      expect(firstIds).not.toEqual(secondIds);
    });
  });

  describe('Content Detail Endpoint', () => {
    beforeEach(async () => {
      await mockApi.request('POST', '/login/interactive');
      // Note: Content detail endpoint only requires browser launch
    });

    test('should return detailed content information', async () => {
      const response = await mockApi.request('GET', '/content/detail/1001');

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.content).toBeDefined();
      expect(response.data.content.nodeId).toBe(1001);
      expect(response.data.content.data).toBeDefined();
      expect(response.data.content.data.title).toBeDefined();
      expect(response.data.content.interface).toBeDefined();
    });

    test('should handle non-existent content', async () => {
      const response = await mockApi.request('GET', '/content/detail/99999');

      expect(response.status).toBe(500);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('not found');
    });

    test('should require authentication', async () => {
      mockApi.reset(); // Remove browser session

      const response = await mockApi.request('GET', '/content/detail/1001');

      expect(response.status).toBe(500);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('Authentication required');
    });
  });

  describe('Test Cleanup', () => {
    test('should reset mock state', async () => {
      await mockApi.request('POST', '/login/interactive');
      await mockApi.request('POST', '/login/load');

      let readyResponse = await mockApi.request('GET', '/playwright/ready');
      expect(readyResponse.data.ready).toBe(true);

      await mockApi.request('POST', '/test/cleanup');

      readyResponse = await mockApi.request('GET', '/playwright/ready');
      expect(readyResponse.data.ready).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle unauthenticated content requests', async () => {
      const response = await mockApi.request('GET', '/content');

      expect(response.status).toBe(500);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('Authentication required');
    });

    test('should handle invalid endpoints', async () => {
      const response = await mockApi.request('GET', '/invalid/endpoint');

      expect(response.status).toBe(500);
      expect(response.data.success).toBe(false);
      expect(response.data.error).toContain('Endpoint not implemented');
    });
  });
});
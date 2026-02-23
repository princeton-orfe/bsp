/**
 * Mock API Responder for Drupal UI Automation Tests
 *
 * Simulates all API endpoints developed thus far for comprehensive testing.
 * Provides realistic responses with configurable behavior for different test scenarios.
 */

const fs = require('fs').promises;
const path = require('path');

class MockApiResponder {
  constructor(options = {}) {
    this.options = {
      baseUrl: 'http://localhost:3000',
      simulateDelays: false,
      defaultDelay: 100,
      ...options
    };

    // Mock state
    this.browserLaunched = false;
    this.sessionLoaded = false;
    this.currentUrl = 'about:blank';
    this.savedSessions = new Map();

    // Mock content data
    this.mockContentTypes = [
      { name: 'article', label: 'Article', description: 'Standard article content' },
      { name: 'page', label: 'Basic Page', description: 'Basic page content' },
      { name: 'event', label: 'Event', description: 'Event content type' },
      { name: 'course', label: 'Course', description: 'Course content type' }
    ];

    this.mockContentItems = this.generateMockContent(200); // Generate 200 mock items
  }

  /**
   * Generate mock content items for testing
   */
  generateMockContent(count) {
    const items = [];
    const types = ['Article', 'Event', 'Course', 'Page'];
    const authors = ['admin', 'editor', 'author', 'bino', 'ar8562'];

    for (let i = 1; i <= count; i++) {
      const type = types[(i - 1) % types.length];
      const author = authors[(i - 1) % authors.length];

      items.push({
        id: 1000 + i,
        title: `${type} Item ${i}`,
        type: type.toLowerCase(),
        author: author,
        status: i % 10 === 0 ? 'Draft' : 'Published',
        created: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)).toISOString(),
        url: `/node/${1000 + i}`
      });
    }

    return items;
  }

  /**
   * Simulate network delay if enabled
   */
  async simulateDelay(delay = this.options.defaultDelay) {
    if (this.options.simulateDelays) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  /**
   * GET /health
   */
  async getHealth() {
    await this.simulateDelay();
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'drupal-ui-automation',
      version: '1.0.0'
    };
  }

  /**
   * GET /playwright/ready
   */
  async getPlaywrightReady() {
    await this.simulateDelay();
    return {
      ready: this.browserLaunched,
      browser: this.browserLaunched,
      context: this.browserLaunched,
      page: this.browserLaunched
    };
  }

  /**
   * POST /login/interactive
   */
  async postLoginInteractive() {
    await this.simulateDelay(500); // Simulate browser launch time

    this.browserLaunched = true;
    this.currentUrl = 'about:blank';
    this.sessionLoaded = false;

    return {
      success: true,
      message: 'Interactive browser session created',
      vncUrl: 'http://localhost:8080/vnc.html',
      instructions: 'Navigate to your login page manually in the VNC interface'
    };
  }

  /**
   * GET /login/check
   */
  async getLoginCheck() {
    await this.simulateDelay();

    if (!this.browserLaunched) {
      return {
        authenticated: false,
        error: 'No browser session available'
      };
    }

    // Simulate authentication check based on URL or session state
    const isLoggedIn = this.currentUrl.includes('/admin') ||
                      this.currentUrl.includes('/user') ||
                      this.sessionLoaded;

    return {
      authenticated: isLoggedIn,
      url: this.currentUrl,
      sessionLoaded: this.sessionLoaded
    };
  }

  /**
   * POST /login/navigate
   */
  async postLoginNavigate() {
    await this.simulateDelay(300);

    if (!this.browserLaunched) {
      throw new Error('No browser session available');
    }

    const defaultUrl = process.env.DEFAULT_LOGIN_URL || 'https://example.com/login';
    this.currentUrl = defaultUrl;

    return {
      success: true,
      message: 'Navigated to login page',
      url: this.currentUrl
    };
  }

  /**
   * POST /login/save
   */
  async postLoginSave(sessionName = 'default') {
    await this.simulateDelay(200);

    if (!this.browserLaunched) {
      throw new Error('No browser session available');
    }

    this.savedSessions.set(sessionName, {
      url: this.currentUrl,
      authenticated: this.sessionLoaded,
      savedAt: new Date().toISOString()
    });

    return {
      success: true,
      message: `Session '${sessionName}' saved successfully`
    };
  }

  /**
   * POST /login/load
   */
  async postLoginLoad(sessionName = 'default') {
    await this.simulateDelay(300);

    if (!this.browserLaunched) {
      throw new Error('No browser session available');
    }

    const session = this.savedSessions.get(sessionName);
    if (!session) {
      throw new Error(`Session '${sessionName}' not found`);
    }

    this.currentUrl = session.url;
    this.sessionLoaded = session.authenticated;

    return {
      success: true,
      message: `Session '${sessionName}' loaded successfully`,
      authenticated: this.sessionLoaded
    };
  }

  /**
   * GET /debug/screenshot
   */
  async getDebugScreenshot() {
    await this.simulateDelay(500); // Simulate screenshot capture time

    if (!this.browserLaunched) {
      throw new Error('No browser session available');
    }

    return {
      success: true,
      message: 'Screenshot captured',
      screenshot: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      url: this.currentUrl,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * GET /debug/page
   */
  async getDebugPage() {
    await this.simulateDelay();

    if (!this.browserLaunched) {
      throw new Error('No browser session available');
    }

    return {
      success: true,
      url: this.currentUrl,
      title: this.currentUrl === 'about:blank' ? 'about:blank' : 'Mock Drupal Page',
      readyState: 'complete'
    };
  }

  /**
   * GET /content/types
   */
  async getContentTypes() {
    await this.simulateDelay(200);

    if (!this.browserLaunched) {
      throw new Error('Authentication required');
    }

    return {
      success: true,
      types: this.mockContentTypes,
      count: this.mockContentTypes.length
    };
  }

  /**
   * GET /content
   */
  async getContent(query = {}) {
    await this.simulateDelay(300);

    if (!this.browserLaunched) {
      throw new Error('Authentication required');
    }

    const {
      page = 1,
      limit = 50,
      type = null
    } = query;

    // Filter content by type if specified
    let filteredContent = this.mockContentItems;
    if (type) {
      filteredContent = this.mockContentItems.filter(item => item.type === type);
    }

    // Calculate pagination
    const totalItems = filteredContent.length;
    const totalPages = Math.ceil(totalItems / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const pageContent = filteredContent.slice(startIndex, endIndex);

    // Determine navigation flags
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return {
      success: true,
      content: pageContent,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalItems,
        itemsPerPage: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
        nextPage: hasNextPage ? page + 1 : null,
        prevPage: hasPrevPage ? page - 1 : null
      },
      query: {
        type: type,
        limit: limit
      }
    };
  }

  /**
   * GET /content/detail/:nodeId
   */
  async getContentDetail(nodeId) {
    await this.simulateDelay(400);

    if (!this.browserLaunched) {
      throw new Error('Authentication required');
    }

    // Find the content item in our mock data
    const contentItem = this.mockContentItems.find(item => item.id === nodeId);
    if (!contentItem) {
      throw new Error(`Content with node ID ${nodeId} not found`);
    }

    // Load schema if available
    let schema = null;
    try {
      const schemaPath = path.join(process.cwd(), 'schemas', `${contentItem.type.toLowerCase()}.json`);
      const schemaContent = await fs.readFile(schemaPath, 'utf8');
      schema = JSON.parse(schemaContent);
    } catch (error) {
      // Schema not found, use default
    }

    // Mock detailed content data
    const detailedData = {
      nodeId: contentItem.id,
      contentType: contentItem.type.toLowerCase(),
      data: {
        title: contentItem.title,
        body: `<p>This is the detailed body content for ${contentItem.title}.</p><p>It contains much more information than the summary shown in the content list.</p>`,
        status: contentItem.status === 'Published',
        author: contentItem.author,
        created: contentItem.created,
        updated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      interface: 'edit', // Mock as if we got edit access
      extractedAt: new Date().toISOString()
    };

    // Add schema-specific fields if schema exists
    if (schema) {
      if (contentItem.type.toLowerCase() === 'event') {
        detailedData.data.event_date = new Date(Date.now() + Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        detailedData.data.event_time = '14:00';
        detailedData.data.location = 'Main Conference Room';
      }
    }

    return {
      success: true,
      content: detailedData,
      schema: schema ? {
        contentType: schema.contentType,
        description: schema.description,
        fieldsUsed: Object.keys(schema.fields || {})
      } : null
    };
  }

  /**
   * POST /test/cleanup
   */
  async postTestCleanup() {
    await this.simulateDelay(100);

    this.reset();

    return {
      success: true,
      message: 'Test cleanup completed'
    };
  }

  /**
   * Simulate HTTP request to mock responder
   */
  async request(method, path, options = {}) {
    const { body, query } = options;

    try {
      let result;

      switch (`${method.toUpperCase()} ${path}`) {
        case 'GET /health':
          result = await this.getHealth();
          break;

        case 'GET /playwright/ready':
          result = await this.getPlaywrightReady();
          break;

        case 'POST /login/interactive':
          result = await this.postLoginInteractive();
          break;

        case 'GET /login/check':
          result = await this.getLoginCheck();
          break;

        case 'POST /login/navigate':
          result = await this.postLoginNavigate();
          break;

        case 'POST /login/save':
          result = await this.postLoginSave(body?.sessionName);
          break;

        case 'POST /login/load':
          result = await this.postLoginLoad(body?.sessionName);
          break;

        case 'GET /debug/screenshot':
          result = await this.getDebugScreenshot();
          break;

        case 'GET /debug/page':
          result = await this.getDebugPage();
          break;

        case 'GET /content/types':
          result = await this.getContentTypes();
          break;

        case 'GET /content':
          result = await this.getContent(query);
          break;

        case 'POST /test/cleanup':
          result = await this.postTestCleanup();
          break;

        default:
          // Handle parameterized routes
          if (method.toUpperCase() === 'GET' && path.startsWith('/content/detail/')) {
            const nodeId = parseInt(path.split('/').pop());
            if (!isNaN(nodeId)) {
              result = await this.getContentDetail(nodeId);
              break;
            }
          }

          throw new Error(`Endpoint not implemented: ${method} ${path}`);
      }

      return {
        status: 200,
        data: result
      };

    } catch (error) {
      return {
        status: 500,
        data: {
          success: false,
          error: error.message
        }
      };
    }
  }

  /**
   * Reset mock state for testing
   */
  reset() {
    this.browserLaunched = false;
    this.sessionLoaded = false;
    this.currentUrl = 'about:blank';
    this.savedSessions.clear();
  }

  /**
   * Configure mock behavior
   */
  configure(options) {
    Object.assign(this.options, options);
  }
}

module.exports = MockApiResponder;
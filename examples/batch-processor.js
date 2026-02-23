#!/usr/bin/env node

/**
 * Drupal Content Batch Processor
 *
 * Example client-side script demonstrating batch processing and aggregation
 * of Drupal content across multiple pages.
 *
 * Usage: node examples/batch-processor.js
 * Requires: Node.js 18+ (uses built-in fetch)
 */

class DrupalContentBatchProcessor {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch content with pagination support
   */
  async fetchContentPage(page = 1, limit = 50, type = null) {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString()
    });

    if (type) {
      params.append('type', type);
    }

    const url = `${this.baseUrl}/content?${params}`;
    console.log(`Fetching: ${url}`);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Response for page ${page}: success=${data.success}, content items=${data.content ? data.content.length : 'undefined'}`);
    return data;
  }

  /**
   * Get pagination information from the first page
   */
  async getPaginationInfo(type = null) {
    const firstPage = await this.fetchContentPage(1, 1, type);
    return {
      totalPages: firstPage.pagination.totalPages,
      totalItems: firstPage.pagination.totalItems,
      hasNextPage: firstPage.pagination.hasNextPage
    };
  }

  /**
   * Fetch a specific number of items, aggregating across multiple pages
   */
  async fetchItems(count, options = {}) {
    const {
      type = null,
      pageSize = 50,
      onProgress = null
    } = options;

    console.log(`Fetching ${count} items (page size: ${pageSize}, type: ${type || 'all'})`);

    // Get pagination info
    const pagination = await this.getPaginationInfo(type);
    console.log(`Site has ${pagination.totalPages} pages total`);

    // Calculate how many pages we need
    const pagesNeeded = Math.ceil(count / pageSize);
    const actualPages = Math.min(pagesNeeded, pagination.totalPages);

    console.log(`Need to fetch ${actualPages} pages to get ${count} items`);

    // Create page fetch promises
    const pagePromises = [];
    for (let page = 1; page <= actualPages; page++) {
      const promise = this.fetchContentPage(page, pageSize, type)
        .then(data => {
          if (!data.success) {
            throw new Error(`Failed to fetch page ${page}: ${data.error || 'Unknown error'}`);
          }
          if (onProgress) {
            const contentLength = data.content ? data.content.length : 0;
            onProgress(page, actualPages, contentLength);
          }
          return data;
        })
        .catch(error => {
          console.error(`Error fetching page ${page}:`, error.message);
          throw error;
        });
      pagePromises.push(promise);
    }

    // Fetch pages with controlled concurrency
    const results = [];
    for (let i = 0; i < pagePromises.length; i += 1) {
      const batch = pagePromises.slice(i, i + 1);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    // Aggregate all content
    const allContent = [];
    for (const result of results) {
      if (result && result.content && Array.isArray(result.content)) {
        allContent.push(...result.content);
      } else {
        console.warn('Skipping result with invalid content:', result);
      }
    }

    // Trim to exact count requested
    const finalContent = allContent.slice(0, count);

    return {
      content: finalContent,
      totalFetched: allContent.length,
      requested: count,
      actual: finalContent.length,
      pagesFetched: results.length,
      pagination: pagination
    };
  }

  /**
   * Example: Fetch 75 most recent items (demonstrates cross-page aggregation)
   */
  async exampleFetch75Items() {
    console.log('=== Example: Fetch 75 Most Recent Items ===');
    console.log('Site paginates by 50 items per page, so we need 2 pages\n');

    const progressCallback = (page, totalPages, itemsInPage) => {
      console.log(`Fetched page ${page}/${totalPages} (${itemsInPage} items)`);
    };

    try {
      const result = await this.fetchItems(75, {
        pageSize: 50,
        onProgress: progressCallback
      });

      console.log('\n=== Results ===');
      console.log(`Requested: ${result.requested} items`);
      console.log(`Fetched: ${result.totalFetched} items from ${result.pagesFetched} pages`);
      console.log(`Returned: ${result.actual} items (trimmed to request)`);

      // Show sample of results
      console.log('\n=== Sample Content ===');
      result.content.slice(0, 3).forEach((item, index) => {
        console.log(`${index + 1}. ${item.title} (${item.type}) - ${item.author}`);
      });

      if (result.content.length > 3) {
        console.log(`... and ${result.content.length - 3} more items`);
      }

      return result;

    } catch (error) {
      console.error('Error fetching items:', error.message);
      throw error;
    }
  }

  /**
   * Example: Fetch 75 most recent items (demonstrates cross-page aggregation)
   * NOTE: This is a demonstration that shows the logic. In a real implementation,
   * you would handle browser session management and rate limiting.
   */
  async exampleFetch75ItemsDemonstration() {
    console.log('=== Example: Fetch 75 Most Recent Items (Demonstration) ===');
    console.log('Site paginates by 50 items per page, so we need 2 pages\n');

    // Simulate getting pagination info
    console.log('Step 1: Get pagination information from first page');
    console.log('API Call: GET /content?page=1&limit=1');
    console.log('Response: 46 total pages detected\n');

    const totalPages = 46; // From our API testing
    const itemsNeeded = 75;
    const pageSize = 50;
    const pagesNeeded = Math.ceil(itemsNeeded / pageSize);

    console.log(`Step 2: Calculate requirements`);
    console.log(`- Need ${itemsNeeded} items total`);
    console.log(`- Site pages by ${pageSize} items per page`);
    console.log(`- Need to fetch ${pagesNeeded} pages (${pagesNeeded * pageSize} items)`);
    console.log(`- Will trim results to exactly ${itemsNeeded} items\n`);

    console.log('Step 3: Fetch pages sequentially');
    let totalFetched = 0;
    const allContent = [];

    for (let page = 1; page <= pagesNeeded; page++) {
      console.log(`API Call: GET /content?page=${page}&limit=${pageSize}`);
      console.log(`Response: ${pageSize} items from page ${page}`);
      totalFetched += pageSize;

      // Simulate content items
      for (let i = 1; i <= pageSize; i++) {
        const itemNumber = ((page - 1) * pageSize) + i;
        allContent.push({
          id: 10000 + itemNumber,
          title: `Content Item ${itemNumber}`,
          type: page === 1 ? 'Event' : 'Article',
          author: `Author ${itemNumber % 5 + 1}`,
          status: 'Published'
        });
      }
    }

    console.log(`\nStep 4: Aggregate and trim results`);
    console.log(`- Fetched ${totalFetched} items from ${pagesNeeded} pages`);
    console.log(`- Trimming to ${itemsNeeded} items as requested`);

    const finalContent = allContent.slice(0, itemsNeeded);

    console.log('\n=== Results ===');
    console.log(`Requested: ${itemsNeeded} items`);
    console.log(`Fetched: ${totalFetched} items from ${pagesNeeded} pages`);
    console.log(`Returned: ${finalContent.length} items (trimmed to request)`);

    // Show sample of results
    console.log('\n=== Sample Content ===');
    finalContent.slice(0, 5).forEach((item, index) => {
      console.log(`${index + 1}. ${item.title} (${item.type}) - ${item.author}`);
    });

    if (finalContent.length > 5) {
      console.log(`... and ${finalContent.length - 5} more items`);
    }

    return {
      content: finalContent,
      totalFetched,
      requested: itemsNeeded,
      actual: finalContent.length,
      pagesFetched: pagesNeeded
    };
  }

  /**
   * Example: Fetch all items of a specific type
   */
  async exampleFetchAllOfType(contentType) {
    console.log(`=== Example: Fetch All ${contentType} Items ===`);

    try {
      // First get pagination info for this type
      const pagination = await this.getPaginationInfo(contentType);
      console.log(`Found ${pagination.totalPages} pages of ${contentType} content`);

      const result = await this.fetchItems(
        pagination.totalPages * 50, // Estimate based on pages
        { type: contentType }
      );

      console.log(`Fetched ${result.actual} ${contentType} items total`);
      return result;

    } catch (error) {
      console.error(`Error fetching ${contentType} items:`, error.message);
      throw error;
    }
  }
}

// CLI interface
async function main() {
  const processor = new DrupalContentBatchProcessor();

  try {
    // Example 1: Fetch 75 items (crosses page boundary) - Demonstration
    await processor.exampleFetch75ItemsDemonstration();

    console.log('\n' + '='.repeat(50) + '\n');

    // Example 2: Show how it would work with real API
    console.log('=== Real Implementation Notes ===');
    console.log('To run with actual API calls:');
    console.log('1. Ensure Drupal session is loaded: POST /login/load');
    console.log('2. Run: await processor.exampleFetch75Items()');
    console.log('3. Handle potential browser session rate limiting');
    console.log('4. Consider adding delays between requests');

  } catch (error) {
    console.error('Batch processing demonstration failed:', error.message);
    process.exit(1);
  }
}

// Export for use as module
module.exports = DrupalContentBatchProcessor;

// Run if called directly
if (require.main === module) {
  main();
}
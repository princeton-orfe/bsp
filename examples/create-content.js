#!/usr/bin/env node

/**
 * Example: Create Drupal Content via BSP API
 *
 * This example demonstrates how to:
 * 1. Load an authenticated session
 * 2. Query available content types
 * 3. Create new content with field values
 * 4. Verify the creation was successful
 *
 * Prerequisites:
 * - Docker container running: docker-compose up -d
 * - Authenticated session saved: POST /login/save
 * - Node.js 18+ (uses built-in fetch)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const CONTENT_TYPE = process.env.CONTENT_TYPE || 'article'; // Change to desired content type

async function main() {
  console.log('=== BSP Content Creation Example ===\n');

  try {
    // Step 1: Load authenticated session
    console.log('Step 1: Loading authenticated session...');
    const loadResponse = await fetch(`${API_BASE}/login/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const loadResult = await loadResponse.json();
    if (!loadResult.success) {
      throw new Error(`Failed to load session: ${loadResult.error}`);
    }
    console.log('✓ Session loaded successfully\n');

    // Step 2: Query available content types
    console.log('Step 2: Querying available content types...');
    const typesResponse = await fetch(`${API_BASE}/content/types`);
    const typesResult = await typesResponse.json();

    if (!typesResult.success) {
      throw new Error(`Failed to query content types: ${typesResult.error}`);
    }

    console.log(`✓ Found ${typesResult.count} content types:`);
    typesResult.contentTypes.forEach(ct => {
      console.log(`  - ${ct.name} (${ct.machineName})`);
    });
    console.log();

    // Verify the requested content type exists
    const contentTypeExists = typesResult.contentTypes.some(
      ct => ct.machineName === CONTENT_TYPE
    );

    if (!contentTypeExists) {
      const available = typesResult.contentTypes.map(ct => ct.machineName).join(', ');
      throw new Error(
        `Content type "${CONTENT_TYPE}" not available. Available types: ${available}`
      );
    }

    // Step 3: Create new content
    console.log(`Step 3: Creating new ${CONTENT_TYPE}...`);

    const fields = {
      title: `Test ${CONTENT_TYPE} - ${new Date().toISOString()}`,
      body: 'This is a test content item created via the BSP API.',
      status: true // Published
    };

    // You can customize fields based on content type
    if (CONTENT_TYPE === 'page' || CONTENT_TYPE === 'ps_basic_page') {
      fields.body = 'This is a test page created via automation.';
    } else if (CONTENT_TYPE === 'event' || CONTENT_TYPE === 'ps_events') {
      fields.event_start_date = '2025-12-31';
      fields.event_start_time = '14:00';
      fields.event_end_time = '16:00';
      fields.location_name = 'Test Location';
    }

    const createResponse = await fetch(`${API_BASE}/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: CONTENT_TYPE,
        fields: fields
      })
    });

    const createResult = await createResponse.json();

    if (!createResult.success) {
      throw new Error(`Failed to create content: ${createResult.error}`);
    }

    console.log('✓ Content created successfully!');
    console.log(`  Node ID: ${createResult.nodeId}`);
    console.log(`  Content Type: ${createResult.contentType}`);
    console.log(`  URL: ${createResult.redirectUrl}`);
    console.log(`  Filled Fields: ${createResult.filledFields.length}`);

    if (createResult.filledFields.length > 0) {
      console.log('  Fields filled:');
      createResult.filledFields.forEach(field => {
        console.log(`    - ${field.field}: "${field.value}"`);
      });
    }

    if (createResult.skippedFields && createResult.skippedFields.length > 0) {
      console.log('  ⚠ Skipped fields:');
      createResult.skippedFields.forEach(field => {
        console.log(`    - ${field.field}: ${field.reason}`);
      });
    }
    console.log();

    // Step 4: Verify by fetching the created content
    if (createResult.nodeId) {
      console.log('Step 4: Verifying created content...');
      const detailResponse = await fetch(`${API_BASE}/content/detail/${createResult.nodeId}`);
      const detailResult = await detailResponse.json();

      if (detailResult.success) {
        console.log('✓ Content verified successfully');
        console.log(`  Title: ${detailResult.content.data.title || 'N/A'}`);
        console.log(`  Node ID: ${detailResult.content.nodeId}`);
      } else {
        console.log(`⚠ Could not verify content: ${detailResult.error}`);
      }
    }

    console.log('\n=== Content Creation Complete ===');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Ensure Docker container is running: docker-compose up -d');
    console.error('2. Ensure you have an authenticated session saved');
    console.error('3. Check that the content type exists in your Drupal site');
    console.error('4. Verify required fields are provided for the content type');
    process.exit(1);
  }
}

main();

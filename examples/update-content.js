#!/usr/bin/env node

/**
 * Example: Update Drupal Content via BSP API
 *
 * This example demonstrates how to:
 * 1. Load an authenticated session
 * 2. Fetch content details to see current values
 * 3. Update content fields
 * 4. Verify the update was successful
 *
 * Prerequisites:
 * - Docker container running: docker-compose up -d
 * - Authenticated session saved: POST /login/save
 * - Node.js 18+ (uses built-in fetch)
 */

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const NODE_ID = process.env.NODE_ID || '123'; // Change to a valid node ID

async function main() {
  console.log('=== BSP Content Update Example ===\n');

  try {
    // Step 1: Load authenticated session
    console.log('Step 1: Loading authenticated session...');
    const loadResponse = await fetch(`${API_BASE}/login/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const loadResult = await loadResponse.json();
    if (!loadResult.success) {
      console.error('Failed to load session:', loadResult.error);
      console.log('\nTip: Run interactive login first:');
      console.log('  curl -X POST http://localhost:3000/login/interactive');
      console.log('  open http://localhost:8080/vnc.html');
      console.log('  # Login via VNC, then:');
      console.log('  curl -X POST http://localhost:3000/login/save');
      process.exit(1);
    }
    console.log('✓ Session loaded successfully\n');

    // Step 2: Verify authentication
    console.log('Step 2: Verifying authentication...');
    const authResponse = await fetch(`${API_BASE}/login/check`);
    const authResult = await authResponse.json();

    if (!authResult.authenticated) {
      console.error('Not authenticated:', authResult.reason);
      process.exit(1);
    }
    console.log('✓ Authenticated with admin access\n');

    // Step 3: Fetch current content details
    console.log(`Step 3: Fetching current content details for node ${NODE_ID}...`);
    const detailResponse = await fetch(`${API_BASE}/content/detail/${NODE_ID}`);
    const detailResult = await detailResponse.json();

    if (!detailResult.success) {
      console.error('Failed to fetch content:', detailResult.error);
      console.log('\nTip: Verify the node ID exists and you have access to it');
      process.exit(1);
    }

    console.log('✓ Current content details:');
    console.log(`  Node ID: ${detailResult.content.nodeId}`);
    console.log(`  Title: ${detailResult.content.title}`);
    console.log(`  URL: ${detailResult.content.url}`);
    console.log(`  Interface: ${detailResult.content.interface}`);

    // Show a few fields
    const data = detailResult.content.data;
    console.log('\n  Current Fields:');
    Object.keys(data).slice(0, 5).forEach(key => {
      const value = typeof data[key] === 'string' && data[key].length > 50
        ? data[key].substring(0, 50) + '...'
        : data[key];
      console.log(`    ${key}: ${value}`);
    });
    console.log('');

    // Step 4: Prepare updates
    console.log('Step 4: Preparing content updates...');
    const updates = {
      title: `Updated: ${new Date().toISOString()}`,
      // Add more fields based on your content type
      // body: 'Updated body content',
      // status: true
    };

    console.log('  Updates to apply:');
    Object.entries(updates).forEach(([key, value]) => {
      console.log(`    ${key}: ${value}`);
    });
    console.log('');

    // Step 5: Apply updates
    console.log(`Step 5: Updating content node ${NODE_ID}...`);
    const updateResponse = await fetch(`${API_BASE}/content/${NODE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });

    const updateResult = await updateResponse.json();

    if (!updateResult.success) {
      console.error('Failed to update content:', updateResult.error);
      process.exit(1);
    }

    console.log('✓ Content updated successfully!\n');
    console.log('Update Results:');
    console.log(`  Node ID: ${updateResult.nodeId}`);
    console.log(`  Message: ${updateResult.message}`);
    console.log(`  Redirect URL: ${updateResult.redirectUrl}`);

    console.log('\n  Updated Fields:');
    updateResult.updatedFields.forEach(field => {
      const value = typeof field.value === 'string' && field.value.length > 50
        ? field.value.substring(0, 50) + '...'
        : field.value;
      console.log(`    ✓ ${field.field}: ${value}`);
    });

    if (updateResult.skippedFields.length > 0) {
      console.log('\n  Skipped Fields:');
      updateResult.skippedFields.forEach(field => {
        console.log(`    ✗ ${field.field}: ${field.reason}`);
      });
    }

    // Step 6: Verify update (optional)
    console.log('\nStep 6: Verifying update...');
    const verifyResponse = await fetch(`${API_BASE}/content/detail/${NODE_ID}`);
    const verifyResult = await verifyResponse.json();

    if (verifyResult.success) {
      console.log('✓ Verification successful');
      console.log(`  New Title: ${verifyResult.content.title}`);
    }

    console.log('\n=== Update Complete ===\n');

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = main;

/**
 * Global teardown for Playwright tests
 * Runs after all tests
 */

async function globalTeardown() {
  console.log('🧹 Running global test teardown...');
  console.log('✅ Global teardown complete');
}

export default globalTeardown;

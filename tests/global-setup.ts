/**
 * Global setup for Playwright tests
 * Runs before all tests
 */

import { chromium } from '@playwright/test';

async function globalSetup() {
  console.log('🚀 Starting global test setup...');
  
  const baseURL = 'http://localhost:3000';
  
  try {
    // Launch browser
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Wait for server to be ready
    console.log(`⏳ Waiting for server at ${baseURL}...`);
    await page.goto(baseURL, { waitUntil: 'networkidle', timeout: 60000 });
    
    console.log('✅ Server is ready');
    
    await browser.close();
  } catch (error) {
    console.error('❌ Global setup failed:', error);
    throw error;
  }
  
  console.log('✅ Global setup complete');
}

export default globalSetup;

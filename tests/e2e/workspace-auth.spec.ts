/**
 * End-to-End Playwright Test for Workspace Authentication
 * Tests the complete user flow with real authentication
 */

import { test, expect } from '@playwright/test';

test.describe('Workspace Authentication E2E Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to workspaces page
    await page.goto('http://localhost:3000/workspaces');
    
    // Wait for auth to load or redirect to login
    await page.waitForLoadState('networkidle');
  });

  test('should load workspace list without "User ID is required" error', async ({ page }) => {
    // Check if we're redirected to login
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      test.skip(true, 'User not authenticated - manual login required');
      return;
    }
    
    // Should see workspace list page
    await expect(page).toHaveURL(/\/workspaces/);
    
    // Should not see "User ID is required" error
    const errorText = await page.textContent('body');
    expect(errorText).not.toContain('User ID is required');
    expect(errorText).not.toContain('Authentication required');
    
    // Should see workspace management UI
    const hasWorkspacesHeading = await page.locator('h1').filter({ hasText: /workspace/i }).count();
    expect(hasWorkspacesHeading).toBeGreaterThan(0);
  });

  test('should create workspace without authentication errors', async ({ page }) => {
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      test.skip(true, 'User not authenticated - manual login required');
      return;
    }
    
    // Click create workspace button
    const createButton = page.locator('button').filter({ hasText: /create workspace/i }).first();
    if (await createButton.count() > 0) {
      await createButton.click();
      
      // Fill in workspace details
      const timestamp = Date.now();
      await page.fill('input[placeholder*="workspace" i], input[type="text"]', `Test Workspace ${timestamp}`);
      
      const descriptionField = page.locator('textarea').first();
      if (await descriptionField.count() > 0) {
        await descriptionField.fill('E2E test workspace for authentication testing');
      }
      
      // Submit form
      await page.locator('button[type="submit"]').click();
      
      // Wait for creation
      await page.waitForTimeout(1000);
      
      // Should not see authentication errors
      const pageText = await page.textContent('body');
      expect(pageText).not.toContain('User ID is required');
      expect(pageText).not.toContain('401');
      expect(pageText).not.toContain('Unauthorized');
    }
  });

  test('should load workspace detail page with all tabs', async ({ page }) => {
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      test.skip(true, 'User not authenticated - manual login required');
      return;
    }
    
    // Wait for workspaces to load
    await page.waitForTimeout(1000);
    
    // Find and click first workspace link
    const workspaceLinks = page.locator('a[href*="/workspaces/"]').filter({ hasNotText: /back to workspace/i });
    const firstWorkspace = workspaceLinks.first();
    
    if (await firstWorkspace.count() > 0) {
      await firstWorkspace.click();
      
      // Wait for detail page to load
      await page.waitForLoadState('networkidle');
      
      // Should see workspace detail page
      await expect(page).toHaveURL(/\/workspaces\/[^/]+$/);
      
      // Should not see authentication errors
      const pageText = await page.textContent('body');
      expect(pageText).not.toContain('User ID is required');
      expect(pageText).not.toContain('Authentication required');
      
      // Should see tab navigation
      const tabs = ['Repositories', 'Dependencies', 'Cross-Repo Links', 'Settings', 'Health'];
      for (const tab of tabs) {
        const tabButton = page.locator('button').filter({ hasText: new RegExp(tab, 'i') });
        expect(await tabButton.count()).toBeGreaterThan(0);
      }
    }
  });

  test('should load Dependencies tab without errors', async ({ page }) => {
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      test.skip(true, 'User not authenticated - manual login required');
      return;
    }
    
    await page.waitForTimeout(1000);
    
    // Navigate to first workspace
    const workspaceLinks = page.locator('a[href*="/workspaces/"]').filter({ hasNotText: /back to workspace/i });
    const firstWorkspace = workspaceLinks.first();
    
    if (await firstWorkspace.count() > 0) {
      await firstWorkspace.click();
      await page.waitForLoadState('networkidle');
      
      // Click Dependencies tab
      const dependenciesTab = page.locator('button').filter({ hasText: /dependencies/i }).first();
      if (await dependenciesTab.count() > 0) {
        await dependenciesTab.click();
        await page.waitForTimeout(500);
        
        // Should not see authentication errors
        const pageText = await page.textContent('body');
        expect(pageText).not.toContain('User ID is required');
        expect(pageText).not.toContain('401');
        
        // Should see dependencies UI
        const hasDependenciesContent = await page.locator('text=/dependency|graph|analyze/i').count();
        expect(hasDependenciesContent).toBeGreaterThan(0);
      }
    }
  });

  test('should load Cross-Repo Links tab without errors', async ({ page }) => {
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      test.skip(true, 'User not authenticated - manual login required');
      return;
    }
    
    await page.waitForTimeout(1000);
    
    // Navigate to first workspace
    const workspaceLinks = page.locator('a[href*="/workspaces/"]').filter({ hasNotText: /back to workspace/i });
    const firstWorkspace = workspaceLinks.first();
    
    if (await firstWorkspace.count() > 0) {
      await firstWorkspace.click();
      await page.waitForLoadState('networkidle');
      
      // Click Cross-Repo Links tab
      const linksTab = page.locator('button').filter({ hasText: /cross.*repo.*link/i }).first();
      if (await linksTab.count() > 0) {
        await linksTab.click();
        await page.waitForTimeout(500);
        
        // Should not see authentication errors
        const pageText = await page.textContent('body');
        expect(pageText).not.toContain('User ID is required');
        expect(pageText).not.toContain('401');
        
        // Should see cross-repo links UI
        const hasLinksContent = await page.locator('text=/link|scan|issue|pr/i').count();
        expect(hasLinksContent).toBeGreaterThan(0);
      }
    }
  });

  test('should save settings without authentication errors', async ({ page }) => {
    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('/auth')) {
      test.skip(true, 'User not authenticated - manual login required');
      return;
    }
    
    await page.waitForTimeout(1000);
    
    // Navigate to first workspace
    const workspaceLinks = page.locator('a[href*="/workspaces/"]').filter({ hasNotText: /back to workspace/i });
    const firstWorkspace = workspaceLinks.first();
    
    if (await firstWorkspace.count() > 0) {
      await firstWorkspace.click();
      await page.waitForLoadState('networkidle');
      
      // Click Settings tab
      const settingsTab = page.locator('button').filter({ hasText: /settings/i }).first();
      if (await settingsTab.count() > 0) {
        await settingsTab.click();
        await page.waitForTimeout(500);
        
        // Try to save settings
        const saveButton = page.locator('button').filter({ hasText: /save.*setting/i }).first();
        if (await saveButton.count() > 0) {
          await saveButton.click();
          await page.waitForTimeout(1000);
          
          // Should not see authentication errors
          const pageText = await page.textContent('body');
          expect(pageText).not.toContain('User ID is required');
          expect(pageText).not.toContain('401');
          expect(pageText).not.toContain('Unauthorized');
        }
      }
    }
  });
});

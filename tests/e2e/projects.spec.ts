import { test, expect } from '@playwright/test';

test.describe('Projects Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock API responses
    await page.route('/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'test-project-1',
              name: 'Test Project 1',
              status: 'active',
              lastIndexedAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
            {
              id: 'test-project-2',
              name: 'Test Project 2',
              status: 'indexing',
              lastIndexedAt: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        }),
      });
    });

    // Mock auth user endpoint
    await page.route('/api/auth/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-user-id',
            email: 'test@example.com',
            role: 'user',
            profile: {
              firstName: 'Test',
              lastName: 'User',
            },
          },
        }),
      });
    });
  });

  test('displays project list', async ({ page }) => {
    await page.goto('/projects');

    // Wait for projects to load
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();

    // Check if projects are displayed
    await expect(page.locator('text=Test Project 1')).toBeVisible();
    await expect(page.locator('text=Test Project 2')).toBeVisible();

    // Check status indicators
    await expect(page.locator('text=active')).toBeVisible();
    await expect(page.locator('text=indexing')).toBeVisible();
  });

  test('shows empty state when no projects exist', async ({ page }) => {
    // Override the API route to return empty array
    await page.route('/api/projects', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });

    await page.goto('/projects');

    // Check for empty state message
    await expect(page.locator('text=No projects found')).toBeVisible();
    await expect(page.locator('[data-testid="create-project-button"]')).toBeVisible();
  });

  test('handles API errors gracefully', async ({ page }) => {
    // Override the API route to return error
    await page.route('/api/projects', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Internal server error',
            code: 'INTERNAL_ERROR',
          },
        }),
      });
    });

    await page.goto('/projects');

    // Check for error message
    await expect(page.locator('[data-testid="error-banner"]')).toBeVisible();
    await expect(page.locator('text=Failed to load projects')).toBeVisible();
  });

  test('creates new project', async ({ page }) => {
    // Mock POST request
    await page.route('/api/projects', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 'new-project-id',
              name: 'New Test Project',
              status: 'created',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          }),
        });
      } else {
        // Handle GET request (default mock from beforeEach)
        await route.continue();
      }
    });

    await page.goto('/projects');

    // Click create project button
    await page.click('[data-testid="create-project-button"]');

    // Fill in project form
    await page.fill('[data-testid="project-name-input"]', 'New Test Project');
    await page.fill('[data-testid="github-url-input"]', 'https://github.com/test/new-project');

    // Submit form
    await page.click('[data-testid="submit-project-button"]');

    // Check for success message
    await expect(page.locator('text=Project created successfully')).toBeVisible();
  });

  test('validates project form', async ({ page }) => {
    await page.goto('/projects');

    // Click create project button
    await page.click('[data-testid="create-project-button"]');

    // Try to submit without filling required fields
    await page.click('[data-testid="submit-project-button"]');

    // Check for validation errors
    await expect(page.locator('text=Project name is required')).toBeVisible();
    await expect(page.locator('text=GitHub URL is required')).toBeVisible();
  });

  test('project search functionality', async ({ page }) => {
    await page.goto('/projects');

    // Wait for projects to load
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();

    // Search for specific project
    await page.fill('[data-testid="search-input"]', 'Test Project 1');

    // Check that only matching project is visible
    await expect(page.locator('text=Test Project 1')).toBeVisible();
    await expect(page.locator('text=Test Project 2')).not.toBeVisible();

    // Clear search
    await page.fill('[data-testid="search-input"]', '');

    // Check that all projects are visible again
    await expect(page.locator('text=Test Project 1')).toBeVisible();
    await expect(page.locator('text=Test Project 2')).toBeVisible();
  });

  test('project status filtering', async ({ page }) => {
    await page.goto('/projects');

    // Wait for projects to load
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();

    // Filter by active status
    await page.selectOption('[data-testid="status-filter"]', 'active');

    // Check that only active projects are visible
    await expect(page.locator('text=Test Project 1')).toBeVisible();
    await expect(page.locator('text=Test Project 2')).not.toBeVisible();

    // Filter by indexing status
    await page.selectOption('[data-testid="status-filter"]', 'indexing');

    // Check that only indexing projects are visible
    await expect(page.locator('text=Test Project 1')).not.toBeVisible();
    await expect(page.locator('text=Test Project 2')).toBeVisible();

    // Reset filter
    await page.selectOption('[data-testid="status-filter"]', 'all');

    // Check that all projects are visible again
    await expect(page.locator('text=Test Project 1')).toBeVisible();
    await expect(page.locator('text=Test Project 2')).toBeVisible();
  });

  test('project navigation', async ({ page }) => {
    await page.goto('/projects');

    // Wait for projects to load
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();

    // Click on a project
    await page.click('[data-testid="project-test-project-1"]');

    // Check that we navigated to project detail page
    await expect(page).toHaveURL(/\/projects\/test-project-1/);
  });

  test('responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/projects');

    // Check that mobile navigation is working
    await expect(page.locator('[data-testid="mobile-menu-button"]')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();

    // Check that layout adapts to tablet
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.reload();

    // Check that desktop layout is working
    await expect(page.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(page.locator('[data-testid="project-list"]')).toBeVisible();
  });
});

test.describe('Authentication', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    // Mock unauthenticated response
    await page.route('/api/auth/user', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: {
            message: 'Unauthorized',
            code: 'UNAUTHORIZED',
          },
        }),
      });
    });

    await page.goto('/projects');

    // Check that we're redirected to login
    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('displays user info when authenticated', async ({ page }) => {
    await page.route('/api/auth/user', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'test-user-id',
            email: 'test@example.com',
            role: 'user',
            profile: {
              firstName: 'Test',
              lastName: 'User',
            },
          },
        }),
      });
    });

    await page.goto('/projects');

    // Check that user info is displayed
    await expect(page.locator('text=Test User')).toBeVisible();
    await expect(page.locator('text=test@example.com')).toBeVisible();
  });
});
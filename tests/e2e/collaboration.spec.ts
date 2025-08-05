/**
 * End-to-end tests for real-time collaborative editing
 * Validates functional compliance and performance requirements
 */

import { test, expect } from '@playwright/test';

test.describe('Real-time Collaborative Editing', () => {
  test('multiple users can edit document simultaneously', async ({ browser }) => {
    // Create two browser contexts for different users
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    // Navigate both users to the same document
    await user1Page.goto('http://localhost:3000/documents/test-doc');
    await user2Page.goto('http://localhost:3000/documents/test-doc');

    // Wait for initial load
    await user1Page.waitForSelector('[data-testid="editor"]');
    await user2Page.waitForSelector('[data-testid="editor"]');

    // User 1 types "Hello"
    await user1Page.click('[data-testid="editor"]');
    await user1Page.keyboard.type('Hello');

    // Verify User 2 sees the change
    await expect(user2Page.locator('[data-testid="editor"]')).toContainText('Hello', { timeout: 100 });

    // User 2 types " World"
    await user2Page.click('[data-testid="editor"]');
    await user2Page.keyboard.type(' World');

    // Verify User 1 sees the change
    await expect(user1Page.locator('[data-testid="editor"]')).toContainText('Hello World', { timeout: 100 });

    await user1Context.close();
    await user2Context.close();
  });

  test('user presence shows active collaborators', async ({ browser }) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    await user1Page.goto('http://localhost:3000/documents/test-doc');
    await user2Page.goto('http://localhost:3000/documents/test-doc');

    await user1Page.waitForSelector('[data-testid="presence-list"]');
    await user2Page.waitForSelector('[data-testid="presence-list"]');

    // Check presence indicators
    const user1Presence = await user1Page.locator('[data-testid="presence-list"]');
    const user2Presence = await user2Page.locator('[data-testid="presence-list"]');

    await expect(user1Presence).toContainText('User 2');
    await expect(user2Presence).toContainText('User 1');

    await user1Context.close();
    await user2Context.close();
  });

  test('cursor positions are synchronized in real-time', async ({ browser }) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    await user1Page.goto('http://localhost:3000/documents/test-doc');
    await user2Page.goto('http://localhost:3000/documents/test-doc');

    await user1Page.waitForSelector('[data-testid="editor"]');
    await user2Page.waitForSelector('[data-testid="editor"]');

    // User 1 types and moves cursor
    await user1Page.click('[data-testid="editor"]');
    await user1Page.keyboard.type('Test content');
    
    // User 2 should see cursor position
    const cursor2 = await user2Page.locator('[data-testid="cursor-user1"]');
    await expect(cursor2).toBeVisible();

    await user1Context.close();
    await user2Context.close();
  });

  test('selection ranges are visible to other users', async ({ browser }) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    await user1Page.goto('http://localhost:3000/documents/test-doc');
    await user2Page.goto('http://localhost:3000/documents/test-doc');

    await user1Page.waitForSelector('[data-testid="editor"]');
    await user2Page.waitForSelector('[data-testid="editor"]');

    // User 1 types content and selects text
    await user1Page.click('[data-testid="editor"]');
    await user1Page.keyboard.type('This is a test document');
    
    // Select text
    await user1Page.keyboard.down('Shift');
    for (let i = 0; i < 4; i++) {
      await user1Page.keyboard.press('ArrowLeft');
    }
    await user1Page.keyboard.up('Shift');

    // User 2 should see selection
    const selection2 = await user2Page.locator('[data-testid="selection-user1"]');
    await expect(selection2).toBeVisible();

    await user1Context.close();
    await user2Context.close();
  });

  test('conflict resolution handles concurrent edits', async ({ browser }) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    await user1Page.goto('http://localhost:3000/documents/test-doc');
    await user2Page.goto('http://localhost:3000/documents/test-doc');

    await user1Page.waitForSelector('[data-testid="editor"]');
    await user2Page.waitForSelector('[data-testid="editor"]');

    // Both users type at the same position
    await user1Page.click('[data-testid="editor"]');
    await user2Page.click('[data-testid="editor"]');

    // Simulate concurrent typing
    await Promise.all([
      user1Page.keyboard.type('ABC'),
      user2Page.keyboard.type('XYZ'),
    ]);

    // Both users should see consistent final state
    const content1 = await user1Page.locator('[data-testid="editor"]').textContent();
    const content2 = await user2Page.locator('[data-testid="editor"]').textContent();

    expect(content1).toBe(content2);
    expect(content1?.length).toBe(6); // ABCXYZ or XYZABC

    await user1Context.close();
    await user2Context.close();
  });

  test('performance: edit propagation under 100ms', async ({ browser }) => {
    const user1Context = await browser.newContext();
    const user2Context = await browser.newContext();

    const user1Page = await user1Context.newPage();
    const user2Page = await user2Context.newPage();

    await user1Page.goto('http://localhost:3000/documents/test-doc');
    await user2Page.goto('http://localhost:3000/documents/test-doc');

    await user1Page.waitForSelector('[data-testid="editor"]');
    await user2Page.waitForSelector('[data-testid="editor"]');

    // Measure edit propagation time
    const startTime = Date.now();
    
    await user1Page.click('[data-testid="editor"]');
    await user1Page.keyboard.type('P');

    await user2Page.waitForFunction(
      () => (global as any).document?.querySelector('[data-testid="editor"]')?.textContent?.includes('P'),
      { timeout: 100 }
    );

    const endTime = Date.now();
    const propagationTime = endTime - startTime;

    expect(propagationTime).toBeLessThan(100);

    await user1Context.close();
    await user2Context.close();
  });

  test('document persistence across sessions', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Create document
    await page.goto('http://localhost:3000/documents/persistence-test');
    await page.waitForSelector('[data-testid="editor"]');
    
    await page.click('[data-testid="editor"]');
    await page.keyboard.type('Persistent content');

    // Wait for save
    await page.waitForTimeout(1000);

    // Close and reopen
    await context.close();
    
    const newContext = await browser.newContext();
    const newPage = await newContext.newPage();
    
    await newPage.goto('http://localhost:3000/documents/persistence-test');
    await newPage.waitForSelector('[data-testid="editor"]');

    // Content should persist
    await expect(newPage.locator('[data-testid="editor"]')).toContainText('Persistent content');

    await newContext.close();
  });

  test('authentication flow', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    // Register
    await page.goto('http://localhost:3000/register');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="register-button"]');

    // Should redirect to documents
    await page.waitForURL('http://localhost:3000/documents');

    // Login
    await page.goto('http://localhost:3000/login');
    await page.fill('[data-testid="username"]', 'testuser');
    await page.fill('[data-testid="password"]', 'password123');
    await page.click('[data-testid="login-button"]');

    // Should redirect to documents
    await page.waitForURL('http://localhost:3000/documents');

    await context.close();
  });

  test('user can create and access multiple documents', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3000/documents');

    // Create first document
    await page.click('[data-testid="create-document"]');
    await page.fill('[data-testid="document-title"]', 'First Document');
    await page.click('[data-testid="save-document"]');

    // Create second document
    await page.click('[data-testid="create-document"]');
    await page.fill('[data-testid="document-title"]', 'Second Document');
    await page.click('[data-testid="save-document"]');

    // Verify both documents exist
    const documents = await page.locator('[data-testid="document-list"] > li');
    await expect(documents).toHaveCount(2);

    await context.close();
  });

  test('stress test with 100 concurrent users', async ({ browser }) => {
    const contexts = [];
    const pages = [];

    // Create 100 concurrent users
    for (let i = 0; i < 100; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      await page.goto(`http://localhost:3000/documents/stress-test`);
      await page.waitForSelector('[data-testid="editor"]');
      
      contexts.push(context);
      pages.push(page);
    }

    // All users type simultaneously
    const typingPromises = pages.map((page, index) => 
      page.click('[data-testid="editor"]')
        .then(() => page.keyboard.type(`User${index}`))
    );

    await Promise.all(typingPromises);

    // Verify all users see consistent state
    const contentPromises = pages.map(page => 
      page.locator('[data-testid="editor"]').textContent()
    );

    const contents = await Promise.all(contentPromises);
    const firstContent = contents[0];
    
    // All contents should be the same
    contents.forEach(content => {
      expect(content).toBe(firstContent);
    });

    // Cleanup
    await Promise.all(contexts.map(c => c.close()));
  });

  test('network disconnection and reconnection handling', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3000/documents/reconnection-test');
    await page.waitForSelector('[data-testid="editor"]');

    // Type initial content
    await page.click('[data-testid="editor"]');
    await page.keyboard.type('Initial content');

    // Simulate network disconnection
    await page.context().setOffline(true);
    await page.waitForSelector('[data-testid="offline-indicator"]');

    // Type while offline
    await page.keyboard.type(' (offline)');

    // Reconnect
    await page.context().setOffline(false);
    await page.waitForSelector('[data-testid="online-indicator"]');

    // Changes should sync
    await expect(page.locator('[data-testid="editor"]')).toContainText('Initial content (offline)');

    await context.close();
  });

  test('error handling for invalid operations', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto('http://localhost:3000/documents/error-test');
    await page.waitForSelector('[data-testid="editor"]');

    // Try invalid operation via console
    await page.evaluate(() => {
      (global as any).window?.dispatchEvent(new CustomEvent('invalid-operation', {
        detail: { type: 'invalid', data: null }
      }));
    });

    // Should show error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    await context.close();
  });
});
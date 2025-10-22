# Workspace Authentication Testing Guide

## 🎯 Overview

This guide provides comprehensive testing procedures for the workspace authentication refactoring. The refactoring moved from client-side userId parameters to server-side JWT token authentication.

## ✅ Automated Tests Completed

### 1. Code Structure Tests
**Script:** `scripts/test-workspace-auth.ts`

All 8 tests **PASSED**:
- ✅ Auth Helper - getUserId exists
- ✅ Backend Route - Workspace List API
- ✅ Backend Route - Dependencies API
- ✅ Backend Route - Cross-Repo Links API
- ✅ Database Schema - Workspace model
- ✅ Frontend Component - DependenciesTab
- ✅ Frontend Component - CrossRepoLinksTab
- ✅ Frontend Component - WorkspaceDetailClient

**Run Command:**
```bash
npx tsx scripts/test-workspace-auth.ts
```

### 2. API Integration Tests
**Script:** `scripts/test-workspace-api-integration.ts`

All 2 tests **PASSED**:
- ✅ GET /api/workspaces - Returns 401 without auth
- ✅ POST /api/workspaces - Returns 401 without auth

**Run Command:**
```bash
npx tsx scripts/test-workspace-api-integration.ts
```

## 📋 Manual Testing Checklist

### Prerequisites
1. ✅ Development server running on `http://localhost:3000`
2. ✅ User authenticated in browser
3. ✅ Database accessible with test data

### Test 1: Workspace List Page

**URL:** `http://localhost:3000/workspaces`

**Expected Results:**
- [ ] Page loads without "User ID is required" error
- [ ] Page loads without 401 Unauthorized error
- [ ] Workspace list displays correctly
- [ ] "Create Workspace" button visible
- [ ] Search functionality works

**Steps:**
1. Navigate to `/workspaces`
2. Verify page loads completely
3. Check browser console for errors
4. Verify no authentication error messages

### Test 2: Create Workspace

**Location:** Workspace list page

**Expected Results:**
- [ ] Modal opens when clicking "Create Workspace"
- [ ] Form accepts workspace name and description
- [ ] Workspace creates successfully
- [ ] No "User ID is required" error
- [ ] New workspace appears in list

**Steps:**
1. Click "Create Workspace" button
2. Fill in:
   - Name: "Test Workspace {timestamp}"
   - Description: "Testing authentication refactoring"
3. Click "Create Workspace"
4. Verify success message
5. Verify workspace appears in list

### Test 3: Workspace Detail Page

**URL:** `http://localhost:3000/workspaces/[id]`

**Expected Results:**
- [ ] Page loads without authentication errors
- [ ] Workspace name and description display
- [ ] All tabs visible: Repositories, Dependencies, Cross-Repo Links, Settings, Health
- [ ] Edit and Delete buttons present

**Steps:**
1. Click on any workspace from list
2. Verify page loads completely
3. Check all tabs are clickable
4. Verify no error messages

### Test 4: Dependencies Tab

**Location:** Workspace detail → Dependencies tab

**Expected Results:**
- [ ] Tab loads without "User ID is required" error
- [ ] Dependency graph UI displays
- [ ] "Build Graph" button visible
- [ ] "Run Analysis" button visible
- [ ] No 401 errors in network tab

**Steps:**
1. Navigate to workspace detail
2. Click "Dependencies" tab
3. Verify UI renders correctly
4. Open browser DevTools → Network tab
5. Click "Build Graph" button
6. Verify API request succeeds (200 or 404 if no repos)

### Test 5: Cross-Repo Links Tab

**Location:** Workspace detail → Cross-Repo Links tab

**Expected Results:**
- [ ] Tab loads without authentication errors
- [ ] Links list displays (empty or with data)
- [ ] "Scan for Links" button visible
- [ ] "Create Link" button visible
- [ ] No 401 errors in network tab

**Steps:**
1. Navigate to workspace detail
2. Click "Cross-Repo Links" tab
3. Verify UI renders correctly
4. Open browser DevTools → Network tab
5. Click "Scan for Links" button
6. Verify API request succeeds

### Test 6: Settings Tab

**Location:** Workspace detail → Settings tab

**Expected Results:**
- [ ] Settings form displays
- [ ] Auto-sync checkbox toggles
- [ ] Sync interval input works
- [ ] "Save Settings" button visible
- [ ] Settings save successfully
- [ ] No authentication errors

**Steps:**
1. Navigate to workspace detail
2. Click "Settings" tab
3. Toggle auto-sync checkbox
4. Change sync interval value
5. Click "Save Settings"
6. Verify success message
7. Refresh page and verify settings persisted

### Test 7: Repository Management

**Location:** Workspace detail → Repositories tab

**Expected Results:**
- [ ] Repository list displays
- [ ] "Add Repository" button works
- [ ] "Bulk Add" button works
- [ ] Individual repository actions work:
  - [ ] Sync button
  - [ ] Remove button
- [ ] Search functionality works
- [ ] No authentication errors

**Steps:**
1. Navigate to workspace detail
2. Stay on "Repositories" tab
3. Click "Add Repository"
4. Add repo: "facebook/react"
5. Verify repo appears
6. Click "Sync" on the repo
7. Click "Remove" on the repo
8. Test "Bulk Add" with multiple repos

### Test 8: Edit Workspace

**Location:** Workspace detail page

**Expected Results:**
- [ ] Edit modal opens
- [ ] Form pre-filled with current data
- [ ] Changes save successfully
- [ ] No authentication errors

**Steps:**
1. Navigate to workspace detail
2. Click "Edit" button
3. Modify name or description
4. Click "Save Changes"
5. Verify changes reflected

### Test 9: Delete Workspace

**Location:** Workspace detail page

**Expected Results:**
- [ ] Confirmation dialog appears
- [ ] Workspace deletes successfully
- [ ] Redirects to workspace list
- [ ] No authentication errors

**Steps:**
1. Navigate to workspace detail
2. Click "Delete" button
3. Confirm deletion
4. Verify redirect to `/workspaces`
5. Verify workspace removed from list

## 🔍 Network Tab Verification

For each test, verify in browser DevTools → Network tab:

### Workspace List API
```
GET /api/workspaces
Status: 200 OK
Response: { workspaces: [...] }
Headers: Cookie includes session token
```

### Dependencies API
```
GET /api/workspaces/{id}/dependencies?depth=3
Status: 200 OK
Response: { dependencies: [...] }
```

### Cross-Repo Links API
```
GET /api/workspaces/{id}/cross-repo-links?state=all
Status: 200 OK
Response: { links: [...] }
```

## ❌ Error Scenarios to Test

### 1. Unauthenticated Access
**Steps:**
1. Open incognito/private window
2. Navigate to `/workspaces`

**Expected:**
- Redirect to login page
- OR 401 Unauthorized error

### 2. Invalid Workspace ID
**Steps:**
1. Navigate to `/workspaces/invalid-id`

**Expected:**
- "Workspace not found" message
- 404 error
- NOT "User ID is required"

### 3. Network Error Handling
**Steps:**
1. Open DevTools → Network tab
2. Enable "Offline" mode
3. Try any workspace operation

**Expected:**
- Graceful error message
- NOT "User ID is required"

## 🎉 Success Criteria

All tests pass if:
- ✅ **Zero** "User ID is required" errors
- ✅ **Zero** 400 Bad Request errors related to authentication
- ✅ All workspace operations work correctly
- ✅ Authentication handled server-side via JWT
- ✅ No userId in API request parameters
- ✅ Consistent error handling (401 for auth failures)

## 🐛 Known Issues

None reported after refactoring.

## 📊 Test Results Summary

**Date:** October 22, 2025
**Commit:** `d484485`

### Automated Tests
- Code Structure: 8/8 passed ✅
- API Integration: 2/2 passed ✅

### Manual Tests
- Execute checklist above and mark each item

## 🔗 Related Documentation

- [Authentication Pattern](../src/lib/auth-server.ts)
- [Workspace APIs](../src/app/api/workspaces/)
- [Frontend Components](../src/app/workspaces/)
- [Commit History](https://github.com/junaidaziz/codemind/commits/main)

## 📝 Notes

- All workspace APIs now use `getUserId(request)` pattern
- Frontend components no longer pass `userId` prop
- Authentication errors return 401 (Unauthorized) instead of 400 (Bad Request)
- Pattern consistent with existing projects, GitHub, and collaboration APIs
- Server-side auth prevents userId forgery
- Development mode supports fallback authentication

---

**Last Updated:** October 22, 2025  
**Tested By:** Automated + Manual checklist  
**Status:** ✅ All automated tests passing, manual testing required

# Phase 1 Testing Guide - Multi-Repo Workspace

## Overview
Phase 1 implements the core workspace management system with CRUD operations for workspaces and repositories.

## Components Implemented
- ✅ `types.ts` - Comprehensive type system (200+ LOC)
- ✅ `workspace-manager.ts` - Workspace manager class (440+ LOC)  
- ✅ `prisma/schema.prisma` - Workspace database model
- ✅ API endpoints (300+ LOC):
  - `GET/POST /api/workspaces` - List and create workspaces
  - `GET/PUT/DELETE /api/workspaces/[id]` - Workspace operations
  - `GET/POST/DELETE /api/workspaces/[id]/repositories` - Repository management
  - `GET /api/workspaces/[id]/stats` - Workspace statistics

## Manual Testing

### Prerequisites
1. Ensure database is running and migrated
2. Have a valid userId (from User table)

### Test Scenarios

#### 1. Create Workspace
```bash
curl -X POST http://localhost:3000/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "name": "My Workspace",
    "description": "Test workspace",
    "settings": {
      "autoSync": true,
      "syncInterval": 3600000,
      "includePrivate": true,
      "includeArchived": false,
      "defaultBranch": "main"
    }
  }'
```

Expected: 201 status, returns workspace with generated ID

#### 2. List Workspaces
```bash
curl http://localhost:3000/api/workspaces?userId=your-user-id
```

Expected: 200 status, returns array of workspaces

#### 3. Get Workspace Details
```bash
curl http://localhost:3000/api/workspaces/workspace-id?userId=your-user-id
```

Expected: 200 status, returns workspace details

####4. Update Workspace
```bash
curl -X PUT http://localhost:3000/api/workspaces/workspace-id \
  -H "Content-Type: application/json" \
  -D '{
    "userId": "your-user-id",
    "name": "Updated Workspace",
    "description": "Updated description"
  }'
```

Expected: 200 status, returns updated workspace

#### 5. Add Repositories
```bash
curl -X POST http://localhost:3000/api/workspaces/workspace-id/repositories \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "repositories": ["owner/repo1", "owner/repo2"]
  }'
```

Expected: 200 status, success message

#### 6. List Repositories
```bash
curl http://localhost:3000/api/workspaces/workspace-id/repositories?userId=your-user-id
```

Expected: 200 status, returns array of repository names

#### 7. Remove Repository
```bash
curl -X DELETE "http://localhost:3000/api/workspaces/workspace-id/repositories?userId=your-user-id&repositoryId=owner/repo1"
```

Expected: 200 status, success message

#### 8. Get Workspace Stats
```bash
curl http://localhost:3000/api/workspaces/workspace-id/stats?userId=your-user-id
```

Expected: 200 status, returns statistics

#### 9. Delete Workspace
```bash
curl -X DELETE http://localhost:3000/api/workspaces/workspace-id?userId=your-user-id
```

Expected: 200 status, success message

## Edge Cases to Test

### Error Handling
- ❌ Create workspace without userId → 400 error
- ❌ Create workspace without name → 400 error
- ❌ Get non-existent workspace → 404 error
- ❌ Update workspace from different user → 404 error (not found for that user)
- ❌ Add duplicate repository → 400 error
- ❌ Remove non-existent repository → 400 error

### Data Validation
- ✅ Custom settings are properly stored
- ✅ Default settings applied when not provided
- ✅ Repository arrays handled correctly
- ✅ Timestamps (createdAt, updatedAt) set properly

## Unit Tests Status

Unit tests have been written but require proper Prisma mocking setup:
- `workspace-manager.test.ts` - 27 test cases (DB mocking needed)
- `api-workspaces.test.ts` - API endpoint tests
- `api-workspace-detail.test.ts` - Individual workspace endpoint tests

**Note**: Tests currently fail due to Prisma client not being properly mocked. To fix:
1. Set up proper Prisma mocking with `jest-mock-extended` or similar
2. Or use a test database with `@prisma/client` test utilities
3. Or convert to integration tests with actual database

## Database Verification

### Check Workspace Model
```sql
-- Connect to your database
SELECT * FROM "Workspace";

-- Verify schema
\d "Workspace"
```

Expected columns:
- id (String, PK)
- name (String)
- description (String, nullable)
- userId (String, FK to User)
- organizationId (String, nullable)
- repositories (Json)
- settings (Json)
- createdAt (DateTime)
- updatedAt (DateTime)

## Next Steps

After manual testing confirms Phase 1 works correctly:
1. Document any bugs found
2. Fix critical issues
3. Proceed to Phase 2: Dependency Graph System

## Known Limitations

1. Sync functionality (`startSync`) is stubbed - returns "not yet implemented"
2. Repository filtering in `getWorkspaceRepositories` is not implemented
3. Workspace stats are basic - will be enhanced in Phase 2
4. No GitHub API integration yet - repositories are stored as strings

These limitations will be addressed in subsequent phases.

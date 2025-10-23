# Scaffold Command Setup & Troubleshooting

## Overview

The `/scaffold` command is a powerful AI-powered code generation tool that learns your project conventions and generates production-ready code. This document explains the setup, architecture, and troubleshooting steps.

## Architecture

### Three-Tier System

```
┌─────────────────┐
│  Chat Interface │  (Client-Side)
│  /chat page     │
└────────┬────────┘
         │ /scaffold <description>
         ▼
┌─────────────────────────────┐
│ ScaffoldCommandHandlerClient│  (Client-Side Wrapper)
│ - Validates input           │
│ - Checks project context    │
│ - Calls API                 │
└────────┬────────────────────┘
         │ POST /api/scaffold
         ▼
┌─────────────────────────────┐
│  /api/scaffold/route.ts     │  (API Endpoint)
│  - Authenticates user       │
│  - Validates project ID     │
│  - Passes to server handler │
└────────┬────────────────────┘
         │
         ▼
┌─────────────────────────────┐
│  ScaffoldCommandHandler     │  (Server-Side)
│  - Analyzes conventions     │
│  - Generates code           │
│  - Writes files (fs access) │
└─────────────────────────────┘
```

### Why This Architecture?

1. **Security**: File system access only on server
2. **Separation**: Client doesn't need Node.js APIs
3. **Flexibility**: Can add rate limiting, logging, etc. at API layer
4. **Scalability**: Can offload to background jobs if needed

## Setup Steps

### 1. Files Created

- ✅ `src/app/api/scaffold/route.ts` - API endpoint
- ✅ `src/lib/command-handlers/scaffold-handler-client.ts` - Client wrapper
- ✅ `src/lib/command-handlers/scaffold-handler.ts` - Server handler (existing)
- ✅ `SCAFFOLD_COMMAND_GUIDE.md` - User guide

### 2. Modified Files

- ✅ `src/lib/command-handlers/init.ts` - Conditional registration
- ✅ `src/app/chat/page.tsx` - Context passing with workspace path
- ✅ `src/app/api/projects/route.ts` - Added githubUrl to response
- ✅ `src/types/models.ts` - Added githubUrl to ProjectResponse

### 3. Command Registration

The command handlers are registered differently based on environment:

```typescript
// In src/lib/command-handlers/init.ts
if (typeof window === 'undefined') {
  // Server-side: Use handler with fs access
  registry.registerHandler(CommandType.SCAFFOLD, new ScaffoldCommandHandler());
} else {
  // Client-side: Use API wrapper
  registry.registerHandler(CommandType.SCAFFOLD, new ScaffoldCommandHandlerClient());
}
```

## Current Status

### ✅ Working

- Command parsing in chat interface
- API endpoint authentication
- Client-to-server communication
- Error handling and messaging

### ⚠️ Known Limitation: Workspace Path

**Issue**: The scaffold command requires a `workspacePath` to know where to write files.

**Current Behavior**:
```typescript
// Chat page derives path from project name
const workspacePath = selectedProject?.githubUrl 
  ? `/tmp/codemind-projects/${selectedProject.name.toLowerCase().replace(/\s+/g, '-')}`
  : undefined;
```

**Why This Matters**:
- The system needs to know the local file system path to write generated code
- Currently using a temporary path: `/tmp/codemind-projects/{project-name}`
- This is a **demo/development** solution

### 🚧 Workspace Path Solutions (In Priority Order)

#### Option 1: Project Settings (Recommended)
Add workspace path to project configuration:

```typescript
// Future: src/app/api/projects/[id]/workspace/route.ts
PUT /api/projects/{id}/workspace
{
  "workspacePath": "/Users/username/projects/my-app"
}
```

#### Option 2: Use Workspace Model
The database has a `Workspace` model with a `settings` JSON field:

```prisma
model Workspace {
  id             String   @id @default(cuid())
  name           String
  description    String?
  userId         String
  repositories   Json     @default("[]")
  settings       Json     @default("{}")  // ← Store workspace paths here
  // ...
}
```

Could store:
```json
{
  "workspacePath": "/Users/username/projects",
  "projectMappings": {
    "project_123": "/Users/username/projects/my-app"
  }
}
```

#### Option 3: Environment Variables
For development, use `.env.local`:

```bash
WORKSPACE_ROOT=/Users/username/projects
```

Then in code:
```typescript
const workspacePath = `${process.env.WORKSPACE_ROOT}/${projectName}`;
```

#### Option 4: VS Code Integration (Future)
Detect workspace from VS Code extension:
- Read `vscode.workspace` 
- Auto-configure on project open
- Sync with CodeMind database

## Troubleshooting Guide

### Error: "Scaffold command requires project context"

**Symptoms**:
```
Scaffold command requires project context
```

**Root Cause**: Missing `workspacePath` in command context

**Solutions**:

1. **Check Project Has GitHub URL**
   ```sql
   SELECT id, name, githubUrl FROM Project WHERE id = 'your-project-id';
   ```
   
2. **Update Project GitHub URL**
   ```typescript
   // In database or via API
   UPDATE Project 
   SET githubUrl = 'https://github.com/user/repo'
   WHERE id = 'project_id';
   ```

3. **Manually Set Workspace Path** (Temporary)
   ```typescript
   // In chat page handleCommandExecution
   const workspacePath = '/absolute/path/to/your/project';
   ```

### Error: "No handler registered for command: scaffold"

**Symptoms**: Command not recognized

**Solutions**:
1. Refresh the page (handlers initialize on mount)
2. Check browser console for initialization errors
3. Verify files exist:
   - `src/lib/command-handlers/scaffold-handler-client.ts`
   - `src/app/api/scaffold/route.ts`

### Error: "Failed to execute scaffold command"

**Symptoms**: API returns 500 error

**Solutions**:
1. Check server logs for detailed error
2. Verify user authentication (logged in)
3. Check project ID is valid
4. Ensure workspace path is writable

### Error: "Workspace path not configured"

**Symptoms**: Error message about missing workspace configuration

**Explanation**: This is the expected current behavior. The system needs workspace path configuration.

**Immediate Workaround**:
Edit `src/app/chat/page.tsx`:
```typescript
const workspacePath = '/your/actual/project/path';
```

**Proper Solution**: Implement Option 1 (Project Settings) above

## Testing the Command

### 1. Prerequisites
- ✅ Logged in user
- ✅ Project created with GitHub URL
- ✅ On `/chat` page
- ✅ Project selected from dropdown

### 2. Test Commands

```bash
# Simple test
/scaffold create Button component

# With details
/scaffold create UserCard component with avatar, name, and email

# API route
/scaffold add GET endpoint for /api/health

# Full feature
/scaffold create authentication system with login and signup
```

### 3. Expected Flow

1. Type command in chat
2. Command is parsed
3. Context gathered (projectId + workspacePath)
4. API called: `POST /api/scaffold`
5. Server analyzes conventions
6. Code generated
7. Files written to workspace
8. Success message returned

### 4. Debugging

Enable verbose logging:
```typescript
// In scaffold-handler-client.ts
console.log('Scaffold context:', {
  projectId: context.projectId,
  workspacePath: context.workspacePath,
  userId: context.userId
});
```

Check API response:
```typescript
// In chat page
console.log('Scaffold API response:', result);
```

## Next Steps

### Immediate (This Week)
1. ✅ Fix circular JSON logger error (DONE)
2. ✅ Improve error messages (DONE)
3. ⏳ Test with real project workspace path
4. ⏳ Document workspace setup process

### Short-term (This Month)
1. Add project settings page for workspace configuration
2. Implement workspace path validation
3. Add file preview before applying changes
4. Add undo/rollback functionality

### Long-term (Future)
1. VS Code extension integration
2. Auto-detect local git repositories
3. Cloud-based code generation (no local writes)
4. Multi-file diff view
5. Command Console overlay (`Ctrl/Cmd+K`)

## Configuration Examples

### Development Setup

**`.env.local`**:
```bash
# Workspace configuration
WORKSPACE_ROOT=/Users/username/projects
DEFAULT_WORKSPACE_PATH=/tmp/codemind-projects

# Feature flags
ENABLE_SCAFFOLD_COMMAND=true
SCAFFOLD_DRY_RUN=false  # Set true to preview without writing
```

### Production Considerations

1. **Security**:
   - Validate workspace paths to prevent directory traversal
   - Check file permissions before writing
   - Rate limit scaffold commands per user/project

2. **Performance**:
   - Cache convention analysis results
   - Implement background job queue for large scaffolds
   - Add progress indicators for multi-file generation

3. **Reliability**:
   - Transaction-like file operations (all or nothing)
   - Backup before overwriting files
   - Version control integration (auto-commit)

## Related Documentation

- [SCAFFOLD_COMMAND_GUIDE.md](../SCAFFOLD_COMMAND_GUIDE.md) - User guide
- [USER_GUIDE.md](../USER_GUIDE.md) - Complete feature walkthrough
- [FEATURES.md](../FEATURES.md) - Feature status overview

## Support

For issues or questions:
1. Check this troubleshooting guide first
2. Review error messages in browser console
3. Check server logs for API errors
4. Verify workspace path configuration
5. Test with simple commands first

## Changelog

### 2025-10-23
- ✅ Created API endpoint structure
- ✅ Implemented client-side wrapper
- ✅ Updated command registration logic
- ✅ Added workspace path derivation
- ✅ Improved error messaging
- ✅ Fixed circular JSON logger error
- ✅ Added githubUrl to projects API
- 📝 Documented setup and troubleshooting

### Upcoming
- ⏳ Project settings for workspace paths
- ⏳ File preview functionality
- ⏳ Undo/rollback system
- ⏳ Command Console overlay

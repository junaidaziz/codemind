# Scaffold Action Buttons - Implementation Guide

## Overview
Implemented working action buttons for scaffold commands using **server-side action execution** with action IDs instead of function serialization.

## The Problem (Previously)
Action buttons had function handlers that couldn't work across HTTP:
```typescript
// Server creates this
actions: [{
  type: 'accept',
  label: 'Apply Changes',
  handler: async () => { await applyChanges(); }  // ❌ Function lost in JSON
}]

// Client receives this after JSON.stringify
actions: [{
  type: 'accept',
  label: 'Apply Changes',
  handler: undefined  // ❌ TypeError when called
}]
```

## The Solution
Use **action IDs** to reference server-side cached handlers:

```typescript
// Server creates and caches
actions: [{
  id: 'action-proj123-1729702800000-0',  // ✅ Unique ID
  type: 'accept',
  label: 'Apply Changes',
  // No handler in client response
}]

// Handler stored server-side in cache
cache.set(actionId, {
  handler: async () => { await applyChanges(); },
  context: { userId, projectId, workspacePath },
  expiresAt: Date.now() + 5 * 60 * 1000
});
```

---

## Architecture

### Flow Diagram
```
┌─────────────┐
│    User     │
│   Clicks    │
│   Button    │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────────────────┐
│  Client (chat/page.tsx)                             │
│  - Extracts action.id                               │
│  - POST /api/scaffold/execute-action                │
│  - Shows success/error message                      │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  API (/api/scaffold/execute-action/route.ts)       │
│  1. Authenticate user                               │
│  2. Get action from cache by ID                     │
│  3. Verify permissions (userId matches)             │
│  4. Execute handler                                 │
│  5. Delete action from cache                        │
│  6. Return success                                  │
└──────────────────────┬──────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────┐
│  Handler Execution                                  │
│  - applyChanges() writes files to disk              │
│  - Uses workspacePath from context                  │
│  - Creates directories if needed                    │
└─────────────────────────────────────────────────────┘
```

---

## Implementation Details

### 1. API Route Modification (`/api/scaffold/route.ts`)

**Added Type Declarations:**
```typescript
declare global {
  var _scaffoldActionCache: Map<string, {
    handler: () => Promise<void>;
    context: CommandContext;
    changes?: CodeChange[];
    expiresAt: number;
  }> | undefined;
}
```

**Action Serialization:**
```typescript
// Convert action handlers to action IDs
const sanitizedResult = {
  ...result,
  actions: result.actions?.map((action, idx) => ({
    id: `action-${projectId}-${Date.now()}-${idx}`,
    type: action.type,
    label: action.label,
    description: action.description,
  })),
};
```

**Caching Handlers:**
```typescript
if (result.actions && result.actions.length > 0) {
  if (!global._scaffoldActionCache) {
    global._scaffoldActionCache = new Map();
  }
  sanitizedResult.actions?.forEach((sanitizedAction, idx) => {
    global._scaffoldActionCache!.set(sanitizedAction.id, {
      handler: result.actions![idx].handler,
      context,
      changes: result.changes,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes TTL
    });
  });
}
```

### 2. Action Execution Endpoint (`/api/scaffold/execute-action/route.ts`)

**Features:**
- ✅ User authentication
- ✅ Action ID validation
- ✅ Expiration checking
- ✅ Permission verification
- ✅ Handler execution
- ✅ Automatic cleanup

**Key Code:**
```typescript
export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  const { actionId } = await request.json();
  
  const cache = global._scaffoldActionCache;
  const actionData = cache.get(actionId);
  
  // Verify expiration
  if (Date.now() > actionData.expiresAt) {
    cache.delete(actionId);
    return NextResponse.json({ error: 'Action has expired' }, { status: 410 });
  }
  
  // Verify permissions
  if (actionData.context.userId !== userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  
  // Execute and cleanup
  await actionData.handler();
  cache.delete(actionId);
  
  return NextResponse.json({ success: true });
}
```

### 3. Client-Side Updates (`/chat/page.tsx`)

**Button Click Handler:**
```typescript
onClick={async () => {
  try {
    if (action.id) {
      // Server-side action execution
      const response = await fetch('/api/scaffold/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionId: action.id }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error);
      }
      
      // Show success message
      const successMsg: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ ${action.label} completed successfully!`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, successMsg]);
    }
  } catch (err) {
    // Show error message
    const errorMsg: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: `❌ Failed: ${err.message}`,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, errorMsg]);
  }
}}
```

**Enhanced Button Styling:**
```typescript
className={`px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 ${
  action.type === 'accept'
    ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-500/30'
    : action.type === 'reject'
    ? 'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/30'
    : action.type === 'modify'
    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/30'
    : 'bg-purple-600 text-white hover:bg-purple-700 shadow-lg shadow-purple-500/30'
}`}
```

### 4. Type Definitions (`types.ts`)

**Added Serialized Action Type:**
```typescript
export interface SerializedCommandAction {
  id: string;
  type: 'accept' | 'reject' | 'modify' | 'view';
  label: string;
  description?: string;
}
```

---

## What Happens When You Run the Command

### Step-by-Step Execution:

**1. User enters command:**
```
/scaffold create Card component with title, description, and image
```

**2. PromptParser extracts:**
```json
{
  "intent": "create",
  "entities": [
    { "type": "component", "name": "Card" }  // ✅ Fixed!
  ]
}
```

**3. ScaffoldHandler generates:**
```typescript
{
  success: true,
  message: "Generated 1 file(s) for Card",
  changes: [
    {
      filePath: "src/components/Card.tsx",
      newContent: "...",
      description: "Generated from template: React Component"
    }
  ],
  actions: [
    {
      type: "accept",
      label: "Apply Changes",
      handler: async () => { await applyChanges(...); }
    },
    // ... more actions
  ]
}
```

**4. API serializes actions:**
```typescript
{
  success: true,
  message: "Generated 1 file(s) for Card",
  changes: [...],
  actions: [
    {
      id: "action-proj123-1729702800000-0",
      type: "accept",
      label: "Apply Changes"
    }
  ]
}
```

**5. Client displays:**
- ✅ Modern file card with Card.tsx code
- ✅ Four action buttons (Apply, Refine, Preview, Cancel)
- ✅ Enhanced styling with shadows and hover effects

**6. User clicks "Apply Changes":**
- Client sends POST to `/api/scaffold/execute-action` with `actionId`
- Server retrieves handler from cache
- Handler calls `applyChanges()` → writes files to disk
- Server returns success
- Client shows: "✅ Apply Changes completed successfully!"

---

## Available Actions

### 1. **Apply Changes** (Accept)
- **Type:** `accept`
- **Color:** Green with shadow
- **Action:** Writes all generated files to workspace
- **Handler:** `applyChanges(generatedFiles, workspacePath)`

### 2. **Refine Request** (Modify)
- **Type:** `modify`
- **Color:** Blue with shadow
- **Action:** Logs request for refinement
- **Future:** Could prompt for adjustments

### 3. **Preview Files** (View)
- **Type:** `view`
- **Color:** Purple with shadow
- **Action:** Logs files for preview
- **Future:** Could open modal with file tree

### 4. **Cancel** (Reject)
- **Type:** `reject`
- **Color:** Red with shadow
- **Action:** Discards generated code
- **Handler:** Logs cancellation

---

## Security Features

### 1. **Authentication**
```typescript
const userId = await getUserId(request);
if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### 2. **Permission Verification**
```typescript
if (actionData.context.userId !== userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
}
```

### 3. **Expiration**
```typescript
if (Date.now() > actionData.expiresAt) {
  cache.delete(actionId);
  return NextResponse.json({ error: 'Action has expired' }, { status: 410 });
}
```

### 4. **Automatic Cleanup**
```typescript
// After execution
cache.delete(actionId);
```

---

## Cache Management

### Current Implementation (In-Memory)
```typescript
global._scaffoldActionCache = new Map();
```

**Pros:**
- ✅ Simple implementation
- ✅ Fast access
- ✅ No external dependencies

**Cons:**
- ❌ Lost on server restart
- ❌ Not shared across instances
- ❌ Limited by memory

### Production Recommendation: Redis
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Store action
await redis.setex(
  actionId,
  300, // 5 minutes TTL
  JSON.stringify({
    userId,
    projectId,
    workspacePath,
    changes,
  })
);

// Retrieve action
const data = await redis.get(actionId);
```

**Benefits:**
- ✅ Persists across restarts
- ✅ Shared across instances
- ✅ Built-in TTL
- ✅ Scalable

---

## Error Handling

### Client-Side Errors
```typescript
try {
  const response = await fetch('/api/scaffold/execute-action', {...});
  if (!response.ok) {
    throw new Error(result.error);
  }
} catch (err) {
  // Show error message in chat
  setMessages(prev => [...prev, {
    role: 'assistant',
    content: `❌ Failed: ${err.message}`
  }]);
}
```

### Server-Side Errors
```typescript
// 401 - Not authenticated
// 403 - Not authorized (wrong user)
// 404 - Action not found
// 410 - Action expired
// 500 - Execution failed
```

---

## Testing

### Manual Test Flow:
1. **Start dev server:** `pnpm dev`
2. **Go to chat:** http://localhost:3000/chat
3. **Select project** from dropdown
4. **Enter command:**
   ```
   /scaffold create Card component with title, description, and image
   ```
5. **Verify display:**
   - ✅ Component name is "Card" (not "with")
   - ✅ Modern UI with file card
   - ✅ Four action buttons visible
6. **Click "Apply Changes":**
   - ✅ Success message appears
   - ✅ Files written to workspace
7. **Check workspace:**
   ```bash
   ls -la /tmp/codemind-projects/{project-name}/src/components/
   # Should see Card.tsx
   ```

### Test Cases:

**1. Happy Path:**
```bash
✅ Generate component
✅ Click "Apply Changes"
✅ Files created successfully
✅ Success message shown
```

**2. Expired Action:**
```bash
✅ Generate component
⏰ Wait 6 minutes
❌ Click button → "Action has expired" (410)
```

**3. Wrong User:**
```bash
✅ User A generates component
🔄 Switch to User B
❌ Click button → "Unauthorized" (403)
```

**4. Missing Action:**
```bash
✅ Generate component
🔄 Server restarts (cache cleared)
❌ Click button → "Action not found" (404)
```

---

## Future Enhancements

### 1. **Persistent Storage**
Replace in-memory cache with Redis or database

### 2. **Action History**
Track all executed actions for audit trail

### 3. **Undo Support**
Store original file contents to enable rollback

### 4. **Progress Tracking**
Show progress for multi-file operations

### 5. **Batch Actions**
Execute multiple actions at once

### 6. **Preview Modal**
Show files in an interactive modal before applying

### 7. **Diff View**
Show changes for existing files

### 8. **Customizable Actions**
Allow plugins to register custom actions

---

## Files Changed

### New Files:
1. **src/app/api/scaffold/execute-action/route.ts** (85 lines)
   - Action execution endpoint

2. **docs/SCAFFOLD_ACTION_BUTTONS.md** (this file)
   - Complete documentation

### Modified Files:
1. **src/app/api/scaffold/route.ts** (+40 lines)
   - Added action serialization
   - Added caching logic
   - Added type declarations

2. **src/app/chat/page.tsx** (+35 lines)
   - Updated button click handlers
   - Added API calls
   - Added success/error messages
   - Enhanced button styling

3. **src/lib/command-handlers/types.ts** (+8 lines)
   - Added SerializedCommandAction interface

---

## Summary

✅ **Problem Solved:** Action buttons now work using server-side execution  
✅ **Security:** Authentication, authorization, and expiration checks  
✅ **UX:** Success/error messages, enhanced button styling  
✅ **Architecture:** Clean separation of concerns  
✅ **Scalability:** Ready for Redis migration  

**Before:** Buttons didn't render (functions lost in JSON)  
**After:** Buttons work perfectly with server-side handlers!

---

**Last Updated:** October 23, 2025  
**Status:** ✅ Complete and Working

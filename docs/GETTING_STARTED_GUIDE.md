# 🚀 Getting Started with CodeMind

## Overview

This guide walks you through the complete flow from the dashboard to chatting with your project using CodeMind's AI assistant.

---

## Step-by-Step User Journey

### 1. Dashboard → Projects

**Starting Point**: Dashboard at `/dashboard`

You'll see a "Recent Activity" section that shows:
- 🎬 Recent Activity (empty when starting)
- Link: "Get started by adding a project"

**Action**: Click "Get started by adding a project"

**Result**: You're redirected to `/projects` (Projects Dashboard)

---

### 2. Projects Dashboard

**What You See**:
```
📁 Projects Dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[+ Create Project]  [← Back to Home]

💡 About Project Indexing
Indexing analyzes your repository structure, extracts code context, 
and creates AI embeddings for intelligent chat responses...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 No Projects Found

You haven't added any projects yet. Create your first 
project to get started!

[+ Create Project]  [Refresh]
```

**Action**: Click "+ Create Project" button

---

### 3. Create Project Modal

**Modal Opens with Form**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
       Create New Project
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Project Name *
┌───────────────────────────────────┐
│ My Awesome Project                │
└───────────────────────────────────┘

GitHub URL *
┌───────────────────────────────────┐
│ https://github.com/user/repo     │
└───────────────────────────────────┘
Enter the GitHub repository URL to index your code

              [Cancel]  [Create Project]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Required Fields**:
1. **Project Name**: A friendly name for your project (e.g., "My Next.js App")
2. **GitHub URL**: Full GitHub repository URL (e.g., `https://github.com/username/repo`)

**Action**: Fill in both fields and click "Create Project"

**What Happens**:
- API call to `POST /api/projects` with your data
- Project is created in the database with status "idle"
- Modal closes
- Projects list refreshes automatically

---

### 4. After Creating Project

**Projects Table Appears**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project Name          | Status | Last Indexed | Actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
My Awesome Project    | idle   | Never        | [View] [Chat] [Index Now] [Delete]
project_abc123...     |        |              |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Project Status Explained**:
- 🟡 **idle**: Project created but not yet indexed
- 🟡 **indexing**: Currently analyzing and indexing your code
- 🟢 **ready**: Fully indexed and ready for AI chat
- 🔴 **error**: Indexing failed (check permissions or network)

---

### 5. Index Your Project (Critical Step!)

**Why Index?**
Before you can chat with your project, it needs to be indexed. Indexing:
- Analyzes your repository structure
- Extracts code context from files
- Creates embeddings for intelligent AI responses
- Maps relationships between files and functions

**Action**: Click "Index Now" button

**What You See**:
```
Status changes: idle → indexing
Button shows: "Reindexing..." (disabled)
```

**Behind the Scenes**:
```
API: POST /api/projects/{projectId}/index

Process:
1. Clone/fetch repository from GitHub
2. Scan file structure
3. Parse code files
4. Extract functions, classes, imports
5. Generate embeddings
6. Store in database
7. Update status to "ready"
```

**Duration**: Depends on repository size
- Small project (10-50 files): 1-2 minutes
- Medium project (100-500 files): 3-5 minutes
- Large project (1000+ files): 5-15 minutes

**Progress Tracking**:
You'll see an "Active Indexing Jobs" widget appear showing:
- Project name
- Progress percentage
- Current file being processed
- Estimated time remaining

---

### 6. Monitoring Indexing Progress

**Indexing Progress Widget**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Active Indexing Jobs

My Awesome Project
Progress: [███████░░░] 75%
Status: Analyzing src/components/...
Duration: 2m 30s

[View Details]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**What to Expect**:
- Real-time progress updates every 3 seconds
- File-by-file processing status
- Completion notification
- Automatic status change to "ready"

**If Indexing Fails**:
Common reasons and solutions:

1. **Repository Access**
   - Error: "Unable to clone repository"
   - Solution: Check GitHub URL is correct and repo is public
   - For private repos: Configure GitHub token

2. **Network Issues**
   - Error: "Network timeout"
   - Solution: Check internet connection, retry indexing

3. **Large Repository**
   - Error: "Repository too large"
   - Solution: Contact admin to increase limits

4. **Unsupported Files**
   - Error: "Failed to parse files"
   - Solution: Check for very large files or binary content

**Retry**: Click "Re-index" button to try again

---

### 7. Project is Ready!

**Status Changes to "ready"**:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Project Name          | Status  | Last Indexed      | Actions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
My Awesome Project    | ready ✅| 10/23/2025 2:45PM | [View] [Chat] [Re-index] [Delete]
project_abc123...     |         |                   |
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Codebase Insights Widget Appears**:
Shows statistics about your indexed project:
- Total files analyzed
- Lines of code
- Most changed files
- Code complexity hotspots
- Recent activity

---

### 8. Start Chatting with Your Project

**Option A: From Projects Page**

Click the **[Chat]** button next to your project

**Result**: Redirects to `/chat?project={projectId}`

---

**Option B: From Dashboard**

1. Go back to `/dashboard`
2. Click "Chat with Projects"
3. Select your project from the dropdown

---

### 9. Chat Interface

**What You See**:
```
┌─────────────────────────────────────────────────────────────┐
│  CodeMind - Chat                                      [User] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Project: [My Awesome Project ▼]  ← Your project selected  │
│                                                               │
│  No messages yet. Start a conversation!                      │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Type your message or command...           [Send] │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

---

### 10. Example Chat Interactions

#### A. Ask About Your Code

**You**:
```
What does the UserProfile component do?
```

**AI Response**:
```
The UserProfile component (src/components/UserProfile.tsx) is a React 
component that displays user information including:

- Avatar image
- User name
- Email address  
- Bio text
- Edit button for profile settings

It accepts props:
- user: { id, name, email, avatar, bio }
- onEdit: () => void

The component uses TailwindCSS for styling and includes responsive 
design for mobile and desktop views.
```

#### B. Generate Code with /scaffold

**You**:
```
/scaffold create Button component with primary and secondary variants
```

**AI Response**:
```
✅ Generated 3 files:
- src/components/Button.tsx
- src/components/Button.test.tsx
- src/components/Button.module.css

The Button component includes:
- Primary and secondary variants
- Proper TypeScript types
- Accessible ARIA attributes
- Unit tests with React Testing Library
```

#### C. Ask for Explanations

**You**:
```
How does authentication work in this project?
```

**AI Response**:
```
Based on your codebase, authentication is handled through:

1. Auth Context (src/contexts/AuthContext.tsx)
   - Manages user state
   - Provides login/logout functions

2. API Routes (src/app/api/auth/*)
   - /api/auth/login - JWT token generation
   - /api/auth/logout - Session cleanup
   - /api/auth/me - Get current user

3. Protected Routes (src/app/components/ProtectedRoute.tsx)
   - Checks authentication before rendering
   - Redirects to /login if unauthorized

Would you like me to explain any specific part in detail?
```

---

## Quick Reference: Complete Flow

```
1. Dashboard
   └─> "Get started by adding a project"
       
2. Projects Page
   └─> Click "+ Create Project"
       
3. Fill Modal
   ├─> Project Name: "My App"
   └─> GitHub URL: "https://github.com/user/repo"
       
4. Project Created
   └─> Status: "idle"
       
5. Click "Index Now"
   └─> Status: "indexing" (wait 1-15 minutes)
       
6. Indexing Complete
   └─> Status: "ready" ✅
       
7. Click "Chat"
   └─> Chat interface opens
       
8. Start Chatting!
   ├─> Ask questions about code
   ├─> Generate new code with /scaffold
   ├─> Get explanations
   └─> Request refactoring suggestions
```

---

## Available Actions on Projects

### 1. View
**Button**: [View]
**Action**: Go to `/projects/{projectId}`
**Shows**:
- Project details
- File structure
- Statistics
- Configuration options

### 2. Chat
**Button**: [Chat]
**Action**: Go to `/chat?project={projectId}`
**Shows**:
- AI chat interface
- Code context awareness
- Command support

### 3. Index Now / Re-index
**Button**: [Index Now] or [Re-index]
**Action**: Trigger indexing process
**When to Use**:
- First time: "Index Now" (required before chatting)
- After code changes: "Re-index" (updates AI knowledge)
- After errors: Retry indexing

### 4. Delete
**Button**: [Delete]
**Action**: Permanently remove project
**Warning**: 
- Deletes all project data
- Removes chat sessions
- Cannot be undone
- Shows confirmation modal

---

## Tips for Best Experience

### 1. Indexing
- ✅ **DO**: Index immediately after creating project
- ✅ **DO**: Re-index after major code changes
- ✅ **DO**: Wait for "ready" status before chatting
- ❌ **DON'T**: Try to chat with "idle" or "indexing" projects
- ❌ **DON'T**: Index multiple large projects simultaneously

### 2. GitHub Repositories
- ✅ **DO**: Use public repositories (easiest)
- ✅ **DO**: Ensure repository is accessible
- ✅ **DO**: Use full GitHub URLs
- ❌ **DON'T**: Use non-GitHub URLs
- ❌ **DON'T**: Use private repos without token configuration

### 3. Chatting
- ✅ **DO**: Ask specific questions about code
- ✅ **DO**: Use `/scaffold` for code generation
- ✅ **DO**: Reference file paths when asking questions
- ✅ **DO**: Ask for explanations of complex code
- ❌ **DON'T**: Ask questions unrelated to your codebase
- ❌ **DON'T**: Expect instant responses for very large files

### 4. Project Management
- ✅ **DO**: Give projects descriptive names
- ✅ **DO**: Monitor indexing progress
- ✅ **DO**: Check "Last Indexed" timestamp
- ✅ **DO**: Re-index when code changes significantly
- ❌ **DON'T**: Delete projects with active chat sessions

---

## Troubleshooting

### "No Projects Found"
**Cause**: First time user or all projects deleted
**Solution**: Click "+ Create Project" to add your first project

### "Indexing Failed"
**Cause**: Repository access, network, or file issues
**Solution**: 
1. Check GitHub URL is correct
2. Verify repository is public or you have access
3. Try "Re-index" button
4. Check browser console for errors

### "Cannot chat with project"
**Cause**: Project not indexed (status is "idle" or "error")
**Solution**: Click "Index Now" and wait for "ready" status

### "Chat responses are outdated"
**Cause**: Code changed but project not re-indexed
**Solution**: Go to Projects page, click "Re-index"

### "Project taking too long to index"
**Cause**: Large repository or slow network
**Solution**: 
- Wait patiently (can take 5-15 minutes)
- Check progress in Indexing Progress widget
- Refresh page to see updated status

---

## What's Next?

After you're comfortable with basic chat:

1. **Explore Advanced Commands**
   - `/scaffold` for code generation
   - See [SCAFFOLD_COMMAND_GUIDE.md](../SCAFFOLD_COMMAND_GUIDE.md)

2. **View Project Analytics**
   - Click [View] on any project
   - See code insights and statistics

3. **Manage Multiple Projects**
   - Create additional projects
   - Switch between them in chat dropdown

4. **Review Activity**
   - Check Dashboard for recent activity
   - Monitor AI interactions

5. **Configure Project Settings** (Coming Soon)
   - Workspace paths
   - Custom indexing rules
   - Advanced options

---

## Summary

**Essential Steps**:
1. ✅ Create project (name + GitHub URL)
2. ✅ Index project (click "Index Now")
3. ✅ Wait for "ready" status
4. ✅ Click "Chat" to start
5. ✅ Ask questions or use `/scaffold` commands

**That's it!** You're now ready to use CodeMind's AI-powered code assistance.

---

## Related Documentation

- [USER_GUIDE.md](../USER_GUIDE.md) - Complete feature walkthrough
- [SCAFFOLD_COMMAND_GUIDE.md](../SCAFFOLD_COMMAND_GUIDE.md) - Code generation guide
- [FEATURES.md](../FEATURES.md) - All available features
- [docs/SCAFFOLD_COMMAND_SETUP.md](SCAFFOLD_COMMAND_SETUP.md) - Technical setup details

---

**Need Help?** Check the troubleshooting section or review error messages in the browser console.

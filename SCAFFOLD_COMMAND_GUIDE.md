# 🎯 How to Use the `/scaffold` Command

## 📍 Where to Use It

### Option 1: Chat Interface (Recommended)
**Location:** `/chat` page

**Steps:**
1. Go to `http://localhost:3000/chat` (or your deployed URL)
2. Select a project from the dropdown
3. Type your command in the chat input box
4. Hit Enter

**Example:**
```
/scaffold create UserProfile component with avatar, name, and email
```

### Option 2: Command Console (Coming Soon)
The Command Console (`Ctrl/Cmd + K`) feature is referenced in the documentation but needs to be implemented as a global overlay component.

---

## 💬 Using in Chat Interface

### Step-by-Step Visual Guide

```
┌─────────────────────────────────────────────────────────────┐
│  CodeMind - Chat                                      [User] │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Project: [Select Project ▼]  ← Select your project first   │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  You                                           10:30 │    │
│  │  /scaffold create UserCard component           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Assistant                                     10:31 │    │
│  │  ✅ Generated 3 files:                              │    │
│  │  - src/components/UserCard.tsx                      │    │
│  │  - src/components/UserCard.test.tsx                 │    │
│  │  - src/components/UserCard.module.css               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  Type your message or command...                   [Send]    │
│  ↑ Type your /scaffold command here                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Examples

### 1. React Component
```
/scaffold create UserProfile component with avatar, name, email, and bio
```

**What you get:**
- `src/components/UserProfile.tsx` - Main component
- `src/components/UserProfile.module.css` - Styles
- Type definitions included

### 2. API Route (Next.js)
```
/scaffold add GET and POST endpoints for /api/users
```

**What you get:**
- `src/app/api/users/route.ts` - Both GET and POST handlers
- TypeScript interfaces
- Error handling

### 3. Prisma Model
```
/scaffold create Product model with name, price, and Category relation
```

**What you get:**
- Prisma schema update
- Migration file
- TypeScript types

### 4. Custom Hook
```
/scaffold create useAuth hook for authentication
```

**What you get:**
- `src/hooks/useAuth.ts` - Hook implementation
- `src/hooks/useAuth.test.ts` - Tests
- TypeScript types

---

## 📋 Command Format

### Basic Syntax
```
/scaffold <description>
```

### Alternative (Short Form)
```
/scaf <description>
```

### Examples with Different Complexity

**Simple:**
```
/scaffold create Button component
```

**Medium:**
```
/scaffold generate UserCard component with name, avatar, and edit button
```

**Complex:**
```
/scaffold create complete authentication system with login, signup, and forgot password
```

---

## ✨ Features

### Smart Convention Detection
The scaffolder automatically:
- ✅ Analyzes your existing code style
- ✅ Matches your naming conventions (camelCase, PascalCase, etc.)
- ✅ Follows your folder structure
- ✅ Uses your import style (relative vs absolute)
- ✅ Detects your framework (React, Next.js, etc.)
- ✅ Matches your TypeScript/JavaScript preference

### What Gets Generated
- ✅ **Main files** - Components, routes, models, hooks
- ✅ **Type definitions** - Full TypeScript support
- ✅ **Tests** - Jest/Vitest test files
- ✅ **Styles** - CSS Modules, Tailwind, etc.
- ✅ **Dependencies** - Automatic imports and relations

---

## 🎨 More Examples

### Components
```bash
# Basic component
/scaffold create Header component

# Component with props
/scaffold create Card component with title, description, and image

# Component with state
/scaffold create Counter component with increment and decrement buttons

# Dashboard component
/scaffold create DashboardStats component with charts
```

### API Routes
```bash
# Simple CRUD
/scaffold add /api/posts endpoints with CRUD operations

# With authentication
/scaffold create /api/auth/login with JWT validation

# With parameters
/scaffold generate /api/users/[id] route with GET and DELETE
```

### Database Models
```bash
# Simple model
/scaffold create User model with email and password

# With relations
/scaffold create Post model with User and Comment relations

# Complex model
/scaffold create Order model with Product, User, and Payment relations
```

### Hooks
```bash
# State management
/scaffold create useLocalStorage hook

# API calls
/scaffold create useFetch hook with TypeScript

# Form handling
/scaffold create useForm hook with validation
```

### Full Features
```bash
# Authentication
/scaffold create complete authentication system

# Blog
/scaffold generate blog feature with posts and comments

# User profile
/scaffold build user profile section with settings
```

---

## 🔧 Troubleshooting

### Command Not Recognized?
**Error:** "No handler registered for command: scaffold"

**Solution:** The handlers should initialize automatically. If you see this error:
1. Refresh the page
2. Check the browser console for initialization logs
3. Make sure you're on the `/chat` page

### Project Context Required?
**Error:** "Scaffold command requires project context"

**Solution:** The scaffold command needs workspace path information:
1. **Temporary workaround:** The system will attempt to derive a workspace path from your project name at `/tmp/codemind-projects/{project-name}`
2. **For production use:** You should configure workspace paths in project settings (coming soon)
3. **For development:** Make sure your project has a `githubUrl` configured

**Future improvement:** We're working on:
- Project settings page to configure custom workspace paths
- Automatic detection of local git repositories
- Integration with VS Code workspaces

### No Project Selected?
**Error:** "Project ID and workspace path are required"

**Solution:**
1. Select a project from the dropdown at the top
2. Make sure the project is fully indexed
3. Project status should be "Ready"
4. Verify the project has a GitHub URL configured

### API Error?
**Error:** "Failed to execute scaffold command"

**Solution:**
1. Check if the backend server is running
2. Verify your authentication (logged in)
3. Check browser console for detailed error
4. Ensure the project has proper workspace configuration

---

## 📊 Current Status

### ✅ Working Now
- `/scaffold` command parsing
- Client-side handler registration
- API endpoint (`/api/scaffold`)
- Command execution through chat

### 🚧 Coming Soon
- Command Console overlay (`Ctrl/Cmd + K`)
- Code preview before applying
- Multi-file diff view
- Undo/rollback functionality

---

## 🎯 Next Steps

1. **Go to Chat:** Navigate to `/chat`
2. **Select Project:** Choose your active project
3. **Type Command:** Enter `/scaffold create Button component`
4. **Hit Enter:** Watch the magic happen! ✨

---

**Pro Tip:** Start with simple components to see how the scaffolder learns your code style, then try more complex features!

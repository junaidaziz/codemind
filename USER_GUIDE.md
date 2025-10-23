# 📚 CodeMind - Complete User Guide

> **Last Updated:** October 23, 2025  
> **Version:** 3.0  
> **Your AI-Powered Development Assistant**

---

## 🚀 Quick Start

### 1. Sign Up & Login
1. Go to `/auth/signup` and create your account
2. Verify your email (check spam folder)
3. Login at `/auth/login`
4. You'll be redirected to `/dashboard`

### 2. Create Your First Project
1. Navigate to **Projects** from the dashboard
2. Click **"Create Project"**
3. Enter GitHub repository URL (e.g., `https://github.com/username/repo`)
4. Click **"Create & Index"**
5. Wait for indexing to complete (~2-5 minutes for average repos)

### 3. Start Using AI Features
Once indexing is complete, you can:
- Chat with your codebase
- Generate code with Smart Scaffolder
- Create automated PRs
- Analyze code quality
- Generate tests

---

## 📋 Table of Contents

1. [Smart Scaffolder - AI Code Generation](#smart-scaffolder)
2. [Developer Command Console](#command-console)
3. [Multi-Repository Workspaces](#workspaces)
4. [Testing Automation](#testing-automation)
5. [AI Chat & Assistant](#ai-chat)
6. [Autonomous PR Creation](#autonomous-pr)
7. [GitHub Integration](#github-integration)
8. [Analytics & Insights](#analytics)
9. [Project Management](#project-management)

---

## 🎨 Smart Scaffolder - AI Code Generation {#smart-scaffolder}

**Generate production-ready code that matches YOUR project's style**

### How It Works

The Smart Scaffolder:
1. **Analyzes your codebase** to learn conventions
2. **Understands natural language** prompts
3. **Generates code** that matches your style
4. **Creates multiple files** when needed
5. **Handles dependencies** automatically

### Access Smart Scaffolder

**Option 1: Chat Interface** (Recommended)
1. Go to `/chat`
2. Type `/scaffold` or `/generate` followed by your request
3. Example: `/scaffold create UserProfile component with avatar`

**Option 2: Command Console**
1. Press `Ctrl/Cmd + K` anywhere
2. Type your scaffold request
3. Press Enter

### Example Prompts

#### React Components
```
/scaffold create a UserCard component with name, email, and avatar
/scaffold generate DashboardStats component with charts
/scaffold build ProfileHeader with edit button and social links
```

#### API Routes (Next.js)
```
/scaffold add GET and POST endpoints for /api/posts
/scaffold create /api/auth/login with JWT validation
/scaffold generate /api/users/[id] route with CRUD operations
```

#### Prisma Models
```
/scaffold create User model with email and role
/scaffold generate Product table with Category relation
/scaffold add Comment model connected to Post and User
```

#### React Hooks
```
/scaffold create useAuth hook for authentication
/scaffold generate useFetch hook with TypeScript
/scaffold build useDebounce hook with 500ms delay
```

#### Full Features
```
/scaffold create complete authentication system
/scaffold generate blog feature with posts and comments
/scaffold build user profile section with settings
```

### What Gets Generated

The scaffolder creates:
- ✅ **Main files** (components, routes, models)
- ✅ **Type definitions** (TypeScript interfaces)
- ✅ **Tests** (if applicable)
- ✅ **Styles** (CSS/Tailwind)
- ✅ **Dependencies** (imports, relations)

### Smart Convention Detection

The system automatically detects and matches:
- **Naming conventions**: camelCase, PascalCase, kebab-case, snake_case
- **File structure**: Components in `/components`, API in `/api`, etc.
- **Import style**: Relative (`./Button`) or absolute (`@/components/Button`)
- **Framework patterns**: Next.js App Router, Pages Router, React, etc.
- **TypeScript usage**: Types, interfaces, generics
- **Styling approach**: CSS Modules, Tailwind, Styled Components

### Built-in Templates

**Available Now:**
- ✅ Next.js API Routes (REST, GraphQL)
- ✅ React Components (Functional, Class)
- ✅ Prisma Models (with relations)
- ✅ React Hooks (custom hooks)
- ✅ TypeScript Utilities
- ✅ Test Files (Jest, Vitest)

**Coming Soon:**
- ⏳ Express Routes
- ⏳ Vue Components
- ⏳ Python FastAPI Routes
- ⏳ Django Models

---

## 💻 Developer Command Console {#command-console}

**Quick actions without leaving your workflow**

### Access Console

**Keyboard Shortcut:** `Ctrl + K` (Windows/Linux) or `Cmd + K` (Mac)

The console appears as an overlay on any page!

### Available Commands

#### Code Generation
```
/scaffold <prompt>     - Generate code with AI
/generate <prompt>     - Alias for scaffold
/create <prompt>       - Create new files
```

#### Navigation
```
/projects              - Go to projects page
/workspaces            - Go to workspaces
/chat                  - Open AI chat
/dashboard             - Return to dashboard
/testing               - Open testing tools
```

#### Quick Actions
```
/search <query>        - Search across codebase
/analyze               - Run code analysis
/test                  - Run tests
/deploy                - Deploy project
```

#### Project Management
```
/index                 - Re-index current project
/sync                  - Sync with GitHub
/pr create             - Create pull request
/issue create          - Create GitHub issue
```

### Command Features

- ✅ **Fuzzy search** - Type partial commands
- ✅ **Auto-complete** - Suggestions as you type
- ✅ **Command history** - Press `↑` to see previous commands
- ✅ **Context-aware** - Commands based on current page
- ✅ **Keyboard navigation** - Use arrow keys

---

## 🏢 Multi-Repository Workspaces {#workspaces}

**Manage multiple repositories together**

### What Are Workspaces?

Workspaces let you:
- Group related repositories
- Analyze cross-repo dependencies
- Link issues and PRs across repos
- Monitor CI/CD across all repos
- Enforce branch policies consistently
- Track multi-repo metrics

### Create a Workspace

1. Go to `/workspaces`
2. Click **"Create Workspace"**
3. Enter workspace name and description
4. Click **"Create"**

### Add Repositories

1. Click on a workspace
2. Go to **"Repositories"** tab
3. Click **"Add Repository"**
4. Enter GitHub URL: `https://github.com/owner/repo`
5. Click **"Add"**

**Bulk Add:**
- Click **"Bulk Add"**
- Paste multiple URLs (one per line)
- Click **"Add All"**

### Workspace Features

#### 1. Dependencies Tab
**View cross-repo dependencies**

- 📦 NPM packages across repos
- 🐍 Python packages
- ☕ Maven dependencies
- 🐹 Go modules
- 🔗 Dependency graph visualization
- ⚠️ Conflict detection
- 📊 Version analysis

#### 2. Cross-Repo Links Tab
**Link issues and PRs**

- 🔗 Link issues across repositories
- 🔀 Link related pull requests
- 📋 View relationship graph
- 🏷️ Tag dependencies between features
- 📈 Track implementation across repos

**How to Link:**
1. Go to Cross-Repo Links tab
2. Click **"Create Link"**
3. Select source repository and issue/PR
4. Select target repository and issue/PR
5. Add relationship type (blocks, depends on, relates to)
6. Click **"Link"**

#### 3. GitHub Actions Tab
**Monitor CI/CD across all repos**

- ✅ View all workflow runs
- ❌ See failures across repos
- 🤖 AI error analysis for failures
- 📊 Success rate trends
- 🔔 Get notified of failures
- 📝 View detailed logs

#### 4. Branch Policy Tab
**Enforce consistent policies**

- 🛡️ Set protection rules for all repos
- ✅ Require reviews before merge
- 🧪 Require status checks
- 🚫 Restrict who can push
- 📋 Compliance reports
- ⚠️ Violation alerts

**Example Policies:**
- Require 2 code reviews
- Must pass all tests
- No force pushes
- Signed commits required
- Linear history only

#### 5. Insights Tab
**Analytics across all repositories**

- 📊 Commit activity across repos
- 👥 Top contributors
- 📈 Code quality trends
- 🐛 Bug fix rates
- ⏱️ Average PR merge time
- 📉 Technical debt tracking

---

## 🧪 Testing Automation {#testing-automation}

**AI-powered testing tools**

### Test Coverage Dashboard

**View:** `/testing/coverage`

**Features:**
- 📊 Overall coverage percentage
- 📁 File-level coverage breakdown
- 📈 Coverage trends over time
- 🔍 Search and filter files
- 🎯 Set coverage goals
- 📉 Identify uncovered code

**How to Use:**
1. Go to `/testing/coverage`
2. Select your project
3. Click **"Analyze"** to generate report
4. View metrics:
   - Statements coverage
   - Branch coverage
   - Function coverage
   - Line coverage

**Filter Options:**
- All files
- Low coverage (<60%)
- Medium coverage (60-79%)
- High coverage (≥80%)

### Test Generation (Coming Soon)

**View:** `/testing/generate`

**Features:**
- 🤖 AI generates test cases
- ✅ Supports Jest, Vitest, Mocha
- 📝 Preview before applying
- ✏️ Edit generated tests
- 🎯 Focus on untested code
- 📦 Batch generation

### Snapshot Manager (Coming Soon)

**View:** `/testing/snapshots`

**Features:**
- 📸 View all snapshots
- 🔄 Update outdated snapshots
- 🆚 Compare snapshot diffs
- 🗑️ Bulk operations
- 📅 Snapshot history

### Failure Analysis (Coming Soon)

**View:** `/testing/failures`

**Features:**
- 📉 Failure timeline
- 🤖 AI root cause analysis
- 💡 Fix suggestions
- 🔧 Track fixes
- 📊 Failure patterns

---

## 💬 AI Chat & Assistant {#ai-chat}

**Chat with your codebase**

### Access Chat

Go to `/chat` or click **"Chat"** in navigation

### What Can You Ask?

#### Code Understanding
```
"Explain how authentication works in this project"
"What does the UserService class do?"
"Show me all database queries"
"How is error handling implemented?"
```

#### Code Location
```
"Where is the login function?"
"Find all API routes"
"Show me the User model"
"List all React components"
```

#### Code Generation
```
"Generate a new API endpoint for products"
"Create a React component for user profile"
"Add a Prisma model for orders"
"Write a test for the auth service"
```

#### Code Review
```
"Review this code: [paste code]"
"Suggest improvements for my recent commit"
"Find security issues in auth.ts"
"Check for performance problems"
```

#### Debugging Help
```
"Why is this function throwing an error?"
"Debug the login flow"
"Explain this error message: [paste error]"
"Help me fix this bug: [describe bug]"
```

### Chat Features

- ✅ **Context-aware** - Knows your entire codebase
- ✅ **Code snippets** - Shows relevant code
- ✅ **File references** - Links to actual files
- ✅ **Multi-turn conversations** - Remembers context
- ✅ **Markdown support** - Formatted responses
- ✅ **Code highlighting** - Syntax highlighting
- ✅ **Copy code** - One-click copy

### Chat Commands

While in chat, use special commands:
```
/scaffold <prompt>     - Generate code
/search <query>        - Search codebase
/analyze <file>        - Analyze specific file
/explain <concept>     - Explain in detail
/clear                 - Clear chat history
```

---

## 🤖 Autonomous PR Creation {#autonomous-pr}

**AI creates pull requests for you**

### What is APR?

Autonomous PR (APR) is an AI agent that:
1. Analyzes your codebase
2. Understands the task
3. Makes necessary changes
4. Runs tests
5. Creates a pull request
6. Adds description and reviews

### Create an APR Session

**Option 1: From Projects Page**
1. Go to `/projects`
2. Select a project
3. Click **"Create APR"**
4. Enter task description
5. Click **"Start"**

**Option 2: From Chat**
```
"Create a PR to add user authentication"
"Generate PR for fixing the login bug"
"Make a PR that adds dark mode"
```

### Task Examples

```
"Add pagination to the users list"
"Fix the memory leak in the data service"
"Implement rate limiting for API routes"
"Add error boundaries to React components"
"Optimize database queries"
"Add input validation to forms"
"Implement caching for expensive operations"
"Add logging to critical functions"
```

### APR Workflow

1. **Analysis** (1-2 min)
   - Understands the task
   - Identifies affected files
   - Plans changes

2. **Code Generation** (2-5 min)
   - Makes changes across files
   - Follows your conventions
   - Adds necessary imports

3. **Validation** (1-2 min)
   - Checks syntax
   - Runs linters
   - Verifies tests

4. **PR Creation** (30 sec)
   - Commits changes
   - Pushes to branch
   - Opens pull request
   - Adds description

### Review the PR

1. APR posts GitHub PR link in chat
2. Review changes on GitHub
3. Request changes if needed
4. Merge when satisfied

### APR Best Practices

✅ **Do:**
- Be specific in task description
- Provide context if needed
- Review the PR thoroughly
- Test the changes locally

❌ **Don't:**
- Give vague instructions
- Expect it to know external APIs without context
- Merge without review
- Use for critical production hotfixes without testing

---

## 🔗 GitHub Integration {#github-integration}

**Seamless GitHub connectivity**

### Connect GitHub

1. Go to `/profile` or `/settings`
2. Click **"Connect GitHub"**
3. Authorize CodeMind
4. Grant repository access

### What Gets Synced

- ✅ Repository code and structure
- ✅ Issues and pull requests
- ✅ Commits and branches
- ✅ CI/CD workflow runs
- ✅ Code reviews
- ✅ Contributors and teams

### Automatic Webhooks

CodeMind automatically sets up webhooks for:
- Push events
- Pull request events
- Issue events
- Workflow run events
- Release events

### Manual Sync

Force sync anytime:
1. Go to project page
2. Click **"Sync with GitHub"**
3. Wait for sync to complete

---

## 📊 Analytics & Insights {#analytics}

**Understand your development patterns**

### Dashboard Analytics

**View:** `/dashboard`

See at a glance:
- Total projects
- Active indexing jobs
- Recent activity
- Quick actions

### Project Analytics

**View:** `/projects` → Select project

**Codebase Insights Widget:**
- 📁 Most changed files
- 📊 File type distribution
- 🔥 Complexity hotspots
- 📈 Code churn metrics
- ⏱️ Recent activity (7d/30d/90d)

**Metrics Shown:**
- Total files modified
- Total changes/commits
- Average changes per file
- High-complexity areas

**Time Ranges:**
- Last 30 days
- Last 90 days
- Last 6 months
- Last year

### Workspace Insights

**View:** `/workspaces/[id]` → Insights tab

**Features:**
- 📊 Commits across all repos
- 👥 Top contributors
- 📈 Activity trends
- 🏆 Most active repositories
- 📉 Code quality metrics
- ⏱️ Average PR merge time

### Activity Feed

**View:** `/activity`

See chronological feed of:
- Code changes
- PR creations and merges
- Issue updates
- Deployments
- Test runs
- AI operations

---

## 📁 Project Management {#project-management}

**Organize and manage projects**

### Create Project

1. Go to `/projects`
2. Click **"Create Project"**
3. Enter details:
   - Project name
   - GitHub repository URL
4. Click **"Create & Index"**

### Project Status

Projects can be:
- **Indexing** - Currently being analyzed
- **Ready** - Fully indexed and ready
- **Failed** - Indexing failed (retry available)
- **Outdated** - Needs re-indexing

### Re-index Project

When code changes significantly:
1. Go to project page
2. Click **"Re-index"**
3. Wait for completion

**Auto-reindex triggers:**
- Major commits detected
- Manual sync requested
- Project settings changed

### Delete Project

1. Go to project page
2. Click **"Delete"**
3. Confirm deletion
4. Project and all data removed

⚠️ **Warning:** This cannot be undone!

---

## 🎯 Tips & Best Practices

### Getting the Most from CodeMind

1. **Keep Projects Synced**
   - Enable auto-sync in workspace settings
   - Manually sync after major changes

2. **Use Descriptive Prompts**
   - Bad: "make a component"
   - Good: "create a UserProfile component with avatar, name, email, and edit button"

3. **Review AI-Generated Code**
   - Always review before committing
   - Test thoroughly
   - Customize to your needs

4. **Organize with Workspaces**
   - Group related repos
   - Set consistent policies
   - Monitor together

5. **Leverage Analytics**
   - Track code quality trends
   - Identify problem areas
   - Optimize workflow

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open command console |
| `Ctrl/Cmd + /` | Open chat |
| `Ctrl/Cmd + P` | Quick navigate |
| `Esc` | Close modals/console |
| `↑` / `↓` | Navigate command history |

---

## ❓ Troubleshooting

### Indexing Issues

**Problem:** Indexing stuck or failed

**Solutions:**
1. Check GitHub permissions
2. Verify repository is accessible
3. Try manual re-index
4. Check if repo is too large (>1GB)

### Chat Not Responding

**Problem:** AI not responding or slow

**Solutions:**
1. Check internet connection
2. Refresh the page
3. Clear browser cache
4. Try different prompt

### Scaffolder Not Working

**Problem:** Code generation fails

**Solutions:**
1. Be more specific in prompt
2. Check project is indexed
3. Verify file paths are correct
4. Try simpler generation first

### GitHub Sync Issues

**Problem:** Changes not syncing

**Solutions:**
1. Check GitHub connection
2. Re-authorize if needed
3. Manual sync
4. Check webhook status

---

## 🆘 Getting Help

### Support Channels

1. **In-App Help**
   - Click "?" icon in navigation
   - Access context-sensitive help

2. **Documentation**
   - Visit `/docs` for detailed guides
   - Check API documentation

3. **Community**
   - Join our Discord server
   - Follow on Twitter
   - GitHub discussions

4. **Email Support**
   - help@codemind.dev
   - Response within 24 hours

---

## 🔄 What's Next?

### Recently Added ✨
- ✅ Test Coverage Dashboard
- ✅ Multi-Repository Workspaces
- ✅ Codebase Insights Widget
- ✅ GitHub Actions Monitoring

### Coming Soon 🚀
- ⏳ Test Generation UI
- ⏳ Snapshot Manager
- ⏳ Failure Analysis Dashboard
- ⏳ Visual Dependency Graph
- ⏳ Team Collaboration Features
- ⏳ VS Code Extension

---

**Built with ❤️ by Junaid Aziz**  
*Last Updated: October 23, 2025*

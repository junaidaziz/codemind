# Chat Tools Guide

CodeMind's AI chat now includes powerful tools for project management and automation! The AI can interact with GitHub, manage PRs, auto-fix bugs, generate code, and run tests - all from chat.

## 🚀 Available Tools (11 Total)

### GitHub Issue Management (3 tools)

#### 1. **Create GitHub Issues**
Ask the AI to create issues directly on your GitHub repository.

**Examples:**
```
"Create an issue titled 'Fix login bug' with description 'Users unable to login with OAuth'"

"Make a bug report for the broken navigation menu"

"Create a feature request for dark mode support"
```

**What it does:**
- Creates issue on GitHub
- Stores it in CodeMind database
- Returns issue number and URL
- Optionally adds labels and assignees

---

#### 2. **Assign GitHub Issues**
Assign issues to contributors via chat.

**Examples:**
```
"Assign issue #42 to junaidaziz"

"Assign issue #15 to alice and bob"
```

**What it does:**
- Assigns the specified issue to GitHub users
- Updates the issue in database
- Confirms assignment

---

#### 3. **List GitHub Issues**
View and filter issues from your repository.

**Examples:**
```
"Show me all open issues"

"List closed issues"

"Show issues labeled 'bug'"
```

**What it does:**
- Fetches issues from database
- Filters by state and labels
- Shows issue details

---

### GitHub Pull Request Management (5 tools)

#### 4. **Create GitHub Pull Requests**
Create pull requests to merge branches directly from chat.

**Examples:**
```
"Create a PR to merge feature/dark-mode into main with title 'Add dark mode support'"

"Make a pull request from fix/login-bug to develop titled 'Fix OAuth login issue'"

"Create a draft PR from feature/new-ui to main and request review from alice"
```

**What it does:**
- Creates PR on GitHub
- Stores it in CodeMind database
- Optionally creates as draft
- Optionally requests reviewers
- Returns PR number and URL

---

#### 5. **List Pull Requests**
View and filter pull requests from your repository.

**Examples:**
```
"Show me all open pull requests"

"List merged PRs"

"Show PRs by alice"

"List all closed but not merged PRs"
```

**What it does:**
- Fetches PRs from database
- Filters by state (open, closed, merged, all)
- Filters by author
- Shows PR details (number, title, branches, merged status, etc.)

---

#### 6. **Merge Pull Requests**
Merge approved pull requests with different merge strategies.

**Examples:**
```
"Merge PR #42"

"Merge pull request #15 using squash method"

"Merge PR #8 with rebase and custom message 'Release v2.0'"
```

**What it does:**
- Checks if PR is mergeable (no conflicts)
- Supports merge methods: merge, squash, rebase
- Updates PR status in database
- Returns merge confirmation with SHA

---

#### 7. **Add Comments to PRs/Issues**
Add comments to pull requests or issues for discussion.

**Examples:**
```
"Add comment to PR #42: 'Looks good, just fix the TypeScript errors'"

"Comment on issue #15: 'This is now fixed in the latest release'"
```

**What it does:**
- Posts comment on GitHub PR or issue
- Supports Markdown formatting
- Returns comment URL

---

#### 8. **Add Labels to PRs/Issues**
Categorize PRs and issues with labels.

**Examples:**
```
"Add labels 'bug' and 'priority:high' to issue #42"

"Label PR #15 with 'ready-for-review'"
```

**What it does:**
- Adds labels to GitHub items
- Updates database
- Returns updated item with new labels

---

### AI-Powered Automation (3 tools) 🤖

#### 9. **Auto-Fix Code Issues** ⚡
Automatically analyze bugs and generate fixes using AI.

**Examples:**
```
"Fix the memory leak in the dashboard component"

"Auto-fix the email validation bug in the login form"

"There's a bug where users can't delete their accounts - please fix it"
```

**What it does:**
- Uses GPT-4 to analyze the issue
- Identifies root cause
- Generates specific code changes
- Creates a new branch
- Opens a draft PR with the fix
- Provides detailed explanation

**Why it's powerful:**
- Saves hours of debugging time
- Suggests best-practice solutions
- Creates ready-to-review PRs
- Learns from your codebase

---

#### 10. **Generate Code from Requirements** 🎨
Create new features, components, or services from natural language.

**Examples:**
```
"Generate a user profile component with avatar, name, bio, and social links"

"Create an API endpoint for user authentication with JWT"

"Build a notification service that supports email and SMS"
```

**What it does:**
- Uses GPT-4 to generate production-ready code
- Creates complete file structure
- Includes types, error handling, and documentation
- Opens draft PR with all generated files
- Provides setup instructions

**Feature Types Supported:**
- React components
- API routes
- Services and utilities
- Full pages
- Complete features

---

#### 11. **Run Automated Tests** ✅
Execute tests, linting, and type checking on PRs or branches.

**Examples:**
```
"Run tests on PR #42"

"Run linting and type checking on the feature/dark-mode branch"

"Test PR #15 before merging"
```

**What it does:**
- Runs TypeScript compilation check
- Executes ESLint for code quality
- Runs Jest unit tests
- Optionally runs E2E tests
- Posts detailed results as PR comment
- Indicates if safe to merge

**Test Types:**
- `lint` - ESLint code quality
- `typecheck` - TypeScript validation
- `unit` - Jest unit tests
- `e2e` - Playwright E2E tests
- `all` - Run everything (default)

---

### Integration Tools (2 tools - Coming Soon)

#### 12. **Fetch Jira Issues** (Pending)
Pull issues from your Jira board.

**Examples:**
```
"Fetch my Jira issues"

"Show Jira tickets from project ABC"

"Get Jira issues with JQL: status = 'In Progress'"
```

**What it does:**
- Connects to Jira API
- Fetches issues based on JQL query
- Displays status, assignee, priority

**Note:** Requires Jira credentials configured in project settings and database migration.

---

#### 13. **Fetch Trello Cards** (Pending)
Pull cards from your Trello board.

**Examples:**
```
"Fetch Trello cards from board ABC123"

"Show cards from the 'To Do' list"
```

**What it does:**
- Connects to Trello API
- Fetches cards from specified board
- Optionally filters by list name
- Shows card details (name, description, due date, labels)

**Note:** Requires Trello credentials configured in project settings and database migration.

---

## 📊 Tool Statistics

- **Total Tools**: 11 (8 active, 2 pending, 3 AI-powered)
- **GitHub Tools**: 8 (issues, PRs, comments, labels)
- **AI Automation**: 3 (auto-fix, code generation, testing)
- **Integrations**: 2 pending (Jira, Trello)
- **Lines of Code**: ~1,600 (chat-tools.ts)
- **AI Model**: GPT-4 Turbo (for automation tools)

---

## 🎯 Real-World Usage Examples

### Complete Feature Workflow

```
User: "Generate a dark mode toggle component"

AI: [Calls generate_code_from_requirements]
    ✅ Generated 3 files:
    - DarkModeToggle.tsx
    - DarkModeToggle.module.css  
    - DarkModeToggle.test.tsx
    
    PR #127 created: https://github.com/...

User: "Run tests on PR #127"

AI: [Calls run_automated_tests]
    ✅ All tests passed!
    - Typecheck: ✅
    - Lint: ✅
    - Unit tests: ✅
    
    Safe to merge!

User: "Merge PR #127 using squash"

AI: [Calls merge_github_pull_request]
    ✅ PR #127 merged successfully!
    Merge SHA: abc123def
```

### Bug Fix Workflow

```
User: "There's a memory leak in the Dashboard component"

AI: [Calls auto_fix_code_issue]
    🔍 Analyzing issue...
    
    ✅ Created fix PR #128
    🔗 https://github.com/user/repo/pull/128
    
    Root Cause: useEffect missing cleanup function
    
    Fix: Added return statement to cleanup subscriptions
    
    Please review before merging!

User: "Add comment to PR #128: 'Great catch! Approving now'"

AI: [Calls add_comment_tool]
    ✅ Comment added to PR #128

User: "Run tests on PR #128"

AI: [Calls run_automated_tests]
    ✅ 3/3 tests passed
    
User: "Merge it"

AI: [Calls merge_github_pull_request]
    ✅ Merged! 🎉
```

### Project Status Overview

```
User: "Show me all open PRs and issues"

AI: [Calls list_github_pull_requests and list_github_issues]
    
    📦 Pull Requests (3 open):
    - PR #127: Add dark mode toggle (alice) ✅ Mergeable
    - PR #126: Fix API timeout (bob) ⚠️ Conflicts
    - PR #125: Update docs (charlie) 📝 Draft
    
    📋 Issues (5 open):
    - #45: Memory leak in dashboard [bug, priority:high] → alice
    - #44: Add search feature [enhancement] → Unassigned
    - #43: Update documentation [docs] → charlie
    ...
```

---

## 🔧 Setup & Configuration

### GitHub Configuration (Required)

"Show Trello cards in 'To Do' list"

"Get all cards from Trello"
```

**What it does:**
- Connects to Trello API
- Fetches cards from specified board
- Can filter by list name
- Shows card details, labels, members

**Note:** Requires Trello credentials configured in project settings and database migration.

---

---

## ⚙️ Configuration

### GitHub (Required for issue creation/assignment)
Already configured if you have `GITHUB_TOKEN` in environment or project settings.

### Jira Integration
Add these to your **Project Settings**:
```
Jira API Token:    Your Jira API token
Jira Email:        Your Jira account email
Jira Domain:       yourcompany.atlassian.net
Jira Project Key:  PROJ (optional, for default queries)
```

**How to get Jira API Token:**
1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Click "Create API token"
3. Give it a name like "CodeMind Integration"
4. Copy the token and add to project settings

### Trello Integration
Add these to your **Project Settings**:
```
Trello API Key:    Your Trello API key
Trello Token:      Your Trello token
Trello Board ID:   The board ID to sync
```

**How to get Trello credentials:**
1. Go to https://trello.com/power-ups/admin
2. Create a new Power-Up
3. Get your API key
4. Generate a token: https://trello.com/1/authorize?key=YOUR_API_KEY&name=CodeMind&expiration=never&response_type=token&scope=read,write
5. Get Board ID from URL: trello.com/b/**BOARD_ID**/board-name

---

## 🎯 Usage Examples

### Create and Assign an Issue
```
User: "Create a bug report for the broken search feature and assign it to alice"

AI: *Creates issue #45 "Fix: Broken search feature"*
    *Assigns to alice*
    
    ✅ Created issue #45: Fix: Broken search feature
    🔗 https://github.com/user/repo/issues/45
    👤 Assigned to: alice
```

### View Project Status
```
User: "Show me all open issues and Jira tickets"

AI: *Fetches GitHub issues*
    *Fetches Jira issues*
    
    📊 GitHub Issues (Open): 12
    - #45: Fix broken search (alice)
    - #44: Add dark mode (bob)
    ...
    
    📊 Jira Issues: 8
    - ABC-123: Implement API (In Progress, alice)
    - ABC-122: Update documentation (To Do, Unassigned)
    ...
```

### Cross-Platform Overview
```
User: "What tasks do we have across GitHub, Jira, and Trello?"

AI: *Fetches from all sources*
    
    📦 Project Overview:
    
    GitHub: 12 open issues, 45 closed
    Jira: 8 issues (3 in progress, 5 to do)
    Trello: 15 cards (5 in "To Do", 7 "In Progress", 3 "Done")
```

---

## 🔧 Technical Details

### Function Calling
The chat uses OpenAI's function calling feature to decide when to use tools. The AI:
1. Analyzes your message
2. Decides if a tool is needed
3. Calls the appropriate tool
4. Returns formatted results

### Tool Execution Flow
```
User Message → AI Decision → Tool Execution → Result Formatting → Response
```

### Enabling/Disabling
Function calling is **enabled by default**. To disable:
```javascript
// In chat request
{
  message: "your message",
  projectId: "...",
  useFunctionCalling: false  // Disable tools
}
```

---

## 🎨 UI Integration

### Chat Interface
- Tool executions show as system messages
- Loading indicators during tool execution
- Success/error notifications
- Formatted results with links

### Future Enhancements
- [ ] Task dashboard showing all tasks from all sources
- [ ] Batch operations (create multiple issues)
- [ ] Advanced filtering and search
- [ ] Webhook integration for real-time updates
- [ ] Custom tool creation via UI

---

## 🐛 Troubleshooting

### "GitHub token not configured"
- Add `GITHUB_TOKEN` to environment variables
- Or configure in Project Settings

### "Jira credentials not configured"
- Go to Project Settings
- Add Jira API Token, Email, and Domain

### "Trello credentials not configured"
- Go to Project Settings
- Add Trello API Key, Token, and Board ID

### Tool execution fails
- Check API credentials are valid
- Verify permissions (repo access, Jira/Trello board access)
- Check network connectivity

---

## 📚 API Reference

See `/api/chat` endpoint documentation for programmatic access to chat tools.

**Endpoint:** `POST /api/chat`

**Request Body:**
```json
{
  "projectId": "project_id",
  "message": "Create an issue for bug X",
  "userId": "user_id",
  "sessionId": "session_id",
  "useFunctionCalling": true
}
```

**Response:** Server-Sent Events (SSE) stream
```
data: {"content": "Creating issue..."}
data: {"toolCall": {"tool": "create_github_issue", "status": "executing"}}
data: {"toolCall": {"tool": "create_github_issue", "status": "completed", "result": {...}}}
data: {"content": "Issue created successfully!"}
data: [DONE]
```

---

## 🎉 Examples

Check `/examples` folder for code samples using the chat tools API.

---

Made with ❤️ by the CodeMind team

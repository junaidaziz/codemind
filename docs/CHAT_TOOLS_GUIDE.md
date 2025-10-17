# Chat Tools Guide

CodeMind's AI chat now includes powerful tools for project management! The AI can interact with GitHub, Jira, and Trello directly from chat.

## 🚀 Available Tools

### 1. **Create GitHub Issues**
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

### 2. **Assign GitHub Issues**
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

### 3. **Create GitHub Pull Requests** 🆕
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

### 4. **List GitHub Issues**
View and filter issues from your repository.

**Examples:**
```
"Show me all open issues"

"List closed issues with bug label"

"Show the last 5 issues"
```

**What it does:**
- Fetches issues from database
- Filters by state, labels, etc.
- Shows issue details (number, title, assignees, etc.)

---

### 5. **Fetch Jira Issues**
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

### 6. **Fetch Trello Cards**
Pull cards from your Trello board.

**Examples:**
```
"Fetch Trello cards from board ABC123"

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

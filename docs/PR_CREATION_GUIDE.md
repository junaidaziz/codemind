# 🎉 New Feature: Create Pull Requests via Chat!

You can now create GitHub pull requests directly from CodeMind chat! No need to switch to GitHub or use the command line.

## 🚀 How to Use

### Basic PR Creation

Simply tell the AI in natural language what PR you want to create:

```
"Create a pull request to merge feature/dark-mode into main"
```

The AI will ask you for details or you can provide them upfront:

```
"Create a PR from feature/dark-mode to main titled 'Add dark mode support' with description 'This PR adds a dark mode toggle to the settings page'"
```

### Examples

**1. Simple PR:**
```
"Make a pull request from fix/login-bug to develop titled 'Fix OAuth login issue'"
```

**2. Draft PR:**
```
"Create a draft PR from feature/new-ui to main with title 'New UI design' and description 'Work in progress for the new UI'"
```

**3. PR with Reviewers:**
```
"Create a PR from feature/api-integration to main titled 'Add Stripe integration' and request review from alice and bob"
```

**4. Detailed PR:**
```
"Create a pull request:
- From: feature/notifications
- To: main
- Title: Add email notifications
- Description: Implements email notifications for deployment events
- Reviewers: alice, charlie"
```

## ✨ Features

- ✅ **Natural Language:** Just describe what you want in plain English
- ✅ **Full Details:** Specify title, description, source/target branches
- ✅ **Draft Mode:** Create draft PRs for work in progress
- ✅ **Request Reviewers:** Add reviewers directly when creating the PR
- ✅ **Auto-Save:** PRs are automatically saved to CodeMind database
- ✅ **Direct Link:** Get the GitHub PR URL immediately

## 📝 What You Need

**Before creating a PR, make sure:**

1. **GitHub Token Configured:** Add your GitHub token in project settings
2. **Branches Exist:** Both source and target branches must exist in the repository
3. **Changes Committed:** The source branch should have commits to merge
4. **Function Calling Enabled:** Toggle "Use Function Calling" in chat settings

## 🎯 Use Cases

### 1. Quick Bug Fix PR
```
"I just fixed the login bug. Create a PR from fix/login to main titled 'Fix login redirect issue'"
```

### 2. Feature Branch Ready
```
"My feature is ready! Create a PR to merge feature/dark-mode into develop with description 'Adds dark mode support with theme toggle in settings'"
```

### 3. Hot Fix
```
"Create an urgent PR from hotfix/security-patch to main and request review from security-team"
```

### 4. Work in Progress
```
"Create a draft PR from feature/redesign to main so the team can see my progress"
```

## 🔧 Technical Details

### What Happens Behind the Scenes:

1. **AI Parses Your Request:** The AI extracts PR details from your message
2. **Validates Branches:** Checks that source and target branches exist
3. **Creates PR on GitHub:** Uses GitHub API to create the pull request
4. **Adds Reviewers (if requested):** Assigns reviewers to the PR
5. **Saves to Database:** Stores PR info in CodeMind for tracking
6. **Returns Confirmation:** Gives you the PR number and URL

### Parameters:

- **title** (required): Title of the pull request
- **body** (required): Description/details of the PR
- **head** (required): Source branch (where your changes are)
- **base** (required): Target branch (where you want to merge)
- **draft** (optional): true/false - create as draft PR
- **reviewers** (optional): Comma-separated GitHub usernames

## 📊 After Creation

Once the PR is created, you can:

- ✅ Click the URL to view it on GitHub
- ✅ See it in your project's PRs list
- ✅ Ask the AI to list PRs: "Show me all open pull requests"
- ✅ Track PR status in CodeMind dashboard

## 🐛 Troubleshooting

### "Branch not found"
- Make sure both branches exist: `git branch -a`
- Check branch names are spelled correctly
- Push your branch if it's only local: `git push origin branch-name`

### "GitHub token not configured"
- Go to Project Settings
- Add your GitHub Personal Access Token
- Token needs `repo` scope for private repos

### "No permission to create PR"
- Your GitHub token must have write access to the repository
- Check token scopes include `public_repo` or `repo`

### "No changes to merge"
- The source branch must have commits not in the target branch
- Commit your changes first: `git commit -m "Your changes"`
- Push to GitHub: `git push origin branch-name`

## 💡 Tips

1. **Be Specific:** Include all details in one message for fastest results
2. **Use Draft Mode:** For work in progress, create draft PRs
3. **Add Reviewers Early:** Request reviewers when creating the PR
4. **Good Titles:** Use descriptive titles that explain the change
5. **Detailed Descriptions:** Add context, testing notes, screenshots

## 🎉 Try It Now!

1. Go to any project in CodeMind
2. Open the Chat tab
3. Enable "Use Function Calling"
4. Type: `"Create a test PR from test-branch to main"`

---

## 🎉 Now Available

- ✅ **List and filter pull requests** - View PRs by state, author, merged status
- ✅ **Merge PRs via chat** - Merge with different methods (merge, squash, rebase)

## 🚀 Coming Soon

- Update PR details (title, description)
- Add labels to PRs
- Comment on PRs
- Request additional reviewers
- Convert draft to ready for review

---

**Questions?** Ask in the chat: "How do I create a pull request?"

**Documentation:** See [CHAT_TOOLS_GUIDE.md](./CHAT_TOOLS_GUIDE.md) for all available tools.

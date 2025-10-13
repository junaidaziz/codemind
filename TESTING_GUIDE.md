# 🧪 Auto Fix System - Testing Guide

## Quick Test (5 minutes)

### Step 1: Check Prerequisites
Make sure you have these environment variables set in your `.env.local`:

```env
# REQUIRED - Get from https://platform.openai.com/api-keys
OPENAI_API_KEY="sk-your-openai-key-here"

# REQUIRED - Get from https://github.com/settings/tokens
GITHUB_TOKEN="ghp_your-github-token-here"  

# REQUIRED - Your database URL
DATABASE_URL="your-database-connection-string"
```

### Step 2: Start the Application
```bash
cd /Users/junaidaziz/projects/personal/junaid/codemind
npm run dev
```

### Step 3: Test the Dashboard
1. **Visit**: http://localhost:3001/auto-fix
2. **Click**: "🧪 Test Auto Fix" button
3. **Expect**: Success message with session ID
4. **Check**: Recent Sessions section for new entry

### Step 4: Test API Directly
Open a new terminal and run:

```bash
curl -X POST http://localhost:3001/api/github/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-repo",
    "logContent": "TypeError: Cannot read property \"length\" of null at line 42 in /src/utils.js",
    "triggerType": "manual"
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "sessionId": "session_abc123",
  "message": "Auto-fix process initiated successfully"
}
```

---

## Test Scenarios

### 1. **JavaScript Null Pointer Error**
```bash
curl -X POST http://localhost:3001/api/github/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-null-pointer",
    "logContent": "TypeError: Cannot read property \"map\" of null\n    at processData (/src/data.js:15:12)\n    at main (/src/app.js:8:5)",
    "triggerType": "manual"
  }'
```

### 2. **TypeScript Import Error**
```bash
curl -X POST http://localhost:3001/api/github/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-import-error", 
    "logContent": "Error: Cannot find module \"./missing-file\"\n    at require (/src/index.ts:3:15)",
    "triggerType": "manual"
  }'
```

### 3. **Syntax Error**
```bash
curl -X POST http://localhost:3001/api/github/auto-fix \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "test-syntax-error",
    "logContent": "SyntaxError: Unexpected token } in JSON at position 42\n    at JSON.parse (/src/config.js:10:23)",
    "triggerType": "manual"
  }'
```

---

## Verify Results

### Check Database Records
```bash
npx prisma studio
```
Look for new entries in:
- `AutoFixSession` table
- `AutoFixResult` table (if fix completed)

### Check API Statistics
```bash
curl http://localhost:3001/api/auto-fix/stats
```

### Check Session History
```bash
curl http://localhost:3001/api/auto-fix/sessions?limit=5
```

---

## Real Repository Test

### Setup a Test Repository

1. **Create a new repository** on GitHub
2. **Add a file with intentional errors:**

```javascript
// test-error.js
const data = null;
console.log(data.length); // This will cause TypeError

function missingBracket() {
  if (true) {
    console.log("missing closing bracket"
  // Missing }
}

const undefinedVar = someUndefinedVariable; // ReferenceError
```

3. **Configure GitHub Action** (copy from `.github/workflows/auto-fix.yml`)
4. **Push the error-containing code**
5. **Watch for:**
   - CI failure
   - Auto-fix GitHub Action triggering
   - New branch creation (e.g., `auto-fix/fix-type-error-123`)
   - Pull request creation with fixes

---

## Troubleshooting

### ❌ "OpenAI API key not found"
- **Fix**: Add `OPENAI_API_KEY` to `.env.local`
- **Check**: Key starts with `sk-`
- **Verify**: Account has credits at https://platform.openai.com/usage

### ❌ "GitHub authentication failed"
- **Fix**: Add `GITHUB_TOKEN` to `.env.local`
- **Check**: Token has `repo` permissions
- **Verify**: Test with `curl -H "Authorization: token YOUR_TOKEN" https://api.github.com/user`

### ❌ "Database connection failed"
- **Fix**: Check `DATABASE_URL` format
- **Run**: `npx prisma db push` to apply schema
- **Verify**: Database is running and accessible

### ❌ "No sessions appear in dashboard"
- **Check**: Browser console for errors
- **Verify**: API endpoints responding
- **Run**: `npm run dev` and refresh page

### ❌ "Auto-fix not generating good fixes"
- **Note**: AI may not understand complex errors
- **Try**: Simpler, well-defined error patterns
- **Check**: Error logs are complete and clear

---

## Success Criteria

✅ **Basic Test Passing:**
- Dashboard loads without errors
- "Test Auto Fix" button works
- Session appears in Recent Sessions
- Statistics update

✅ **API Integration Working:**
- POST requests return success
- Database records created
- Error analysis generates suggestions

✅ **GitHub Integration Working:**
- Authentication successful
- Can create branches and commits
- Pull requests generated (if repository configured)

---

## Next Steps After Testing

1. **Configure real repositories** for automatic fixes
2. **Set up GitHub webhooks** for CI integration  
3. **Monitor API usage** and costs
4. **Customize fix templates** for your codebase
5. **Scale to production** environment

**Happy Testing!** 🚀
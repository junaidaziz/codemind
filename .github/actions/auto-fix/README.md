# CodeMind Auto Fix GitHub Action

Automatically detect and fix build failures in your CI/CD pipeline using AI-powered analysis.

## Features

- 🤖 **AI-Powered Analysis**: Analyzes build logs and error messages to identify fixable issues
- 🔧 **Automatic Fixes**: Generates and applies code fixes for common build problems  
- 🔀 **Pull Request Creation**: Creates PRs with fixes for review and testing
- 📊 **Smart Filtering**: Only attempts fixes for issues that can be reliably automated
- ⚡ **Fast Response**: Triggers immediately when builds fail
- 🛡️ **Safe by Default**: Requires approval for PRs unless configured otherwise

## Quick Start

### 1. Add to Your Workflow

Create or update `.github/workflows/auto-fix.yml` in your repository:

```yaml
name: Auto Fix on Build Failure

on:
  workflow_run:
    workflows: ["CI", "Build", "Test"]
    types: [completed]
  
jobs:
  auto-fix:
    runs-on: ubuntu-latest
    if: ${{ github.event.workflow_run.conclusion == 'failure' }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: CodeMind Auto Fix
        uses: your-org/codemind/.github/actions/auto-fix@main
        with:
          codemind-api-key: ${{ secrets.CODEMIND_API_KEY }}
          project-id: ${{ github.repository }}
```

### 2. Set Up Secrets

Add these secrets to your repository settings:

- `CODEMIND_API_KEY`: Your CodeMind API key (get from [codemind.app](https://codemind.app))

### 3. Configure Variables (Optional)

Add these repository variables for customization:

- `CODEMIND_API_URL`: Custom API URL (default: `https://codemind.app/api`)
- `CODEMIND_PROJECT_ID`: Custom project ID (default: repository name)

## Configuration Options

### Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `codemind-api-key` | CodeMind API key for authentication | ✅ | - |
| `codemind-api-url` | CodeMind API base URL | ❌ | `https://codemind.app/api` |
| `project-id` | CodeMind project ID | ❌ | Repository name |
| `require-approval` | Whether PRs require manual approval | ❌ | `true` |
| `max-fixes-per-hour` | Maximum fixes per hour | ❌ | `3` |
| `branch-prefix` | Prefix for auto-fix branches | ❌ | `codemind/auto-fix` |
| `trigger-on` | When to trigger (`failure`, `always`, `manual`) | ❌ | `failure` |

### Outputs

| Output | Description |
|--------|-------------|
| `success` | Whether the auto-fix was successful |
| `pr-url` | URL of the created pull request |
| `pr-number` | Number of the created pull request |
| `session-id` | CodeMind session ID for tracking |

## Usage Examples

### Basic Usage

```yaml
- name: CodeMind Auto Fix
  uses: your-org/codemind/.github/actions/auto-fix@main
  with:
    codemind-api-key: ${{ secrets.CODEMIND_API_KEY }}
```

### Advanced Configuration

```yaml
- name: CodeMind Auto Fix
  uses: your-org/codemind/.github/actions/auto-fix@main
  with:
    codemind-api-key: ${{ secrets.CODEMIND_API_KEY }}
    project-id: "my-project"
    require-approval: false
    max-fixes-per-hour: 5
    branch-prefix: "bot/fix"
    trigger-on: "always"
```

### With Custom Follow-up Actions

```yaml
- name: CodeMind Auto Fix  
  id: autofix
  uses: your-org/codemind/.github/actions/auto-fix@main
  with:
    codemind-api-key: ${{ secrets.CODEMIND_API_KEY }}

- name: Notify Team
  if: steps.autofix.outputs.success == 'true'
  run: |
    echo "Auto-fix PR created: ${{ steps.autofix.outputs.pr-url }}"
    # Send Slack notification, email, etc.
```

### Manual Trigger

```yaml
name: Manual Auto Fix

on:
  workflow_dispatch:
    inputs:
      force_fix:
        description: 'Force auto-fix even if build passes'
        type: boolean
        default: false

jobs:
  manual-fix:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: CodeMind Auto Fix
        uses: your-org/codemind/.github/actions/auto-fix@main
        with:
          codemind-api-key: ${{ secrets.CODEMIND_API_KEY }}
          trigger-on: "manual"
```

## What Issues Can Be Fixed?

CodeMind Auto Fix can handle many common build and test failures:

### Build Errors
- Missing imports and dependencies
- TypeScript configuration issues
- Syntax errors and typos
- File path resolution problems

### Test Failures  
- Outdated test expectations
- Mock configuration issues
- Test setup and teardown problems
- Assertion mismatches

### Linting Issues
- Code formatting violations
- Unused variables and imports
- ESLint rule violations
- Prettier formatting issues

### Dependency Issues
- Missing package installations
- Version conflicts
- Peer dependency warnings
- Package.json inconsistencies

### Security Issues
- Vulnerability fixes in dependencies
- Basic security pattern updates
- Configuration hardening

## How It Works

1. **Failure Detection**: Monitors your CI/CD workflows for failures
2. **Log Collection**: Gathers error logs and build output
3. **AI Analysis**: Uses CodeMind AI to analyze errors and identify fixable issues
4. **Fix Generation**: Creates targeted code fixes based on the analysis
5. **PR Creation**: Opens a pull request with the proposed fixes
6. **Review & Merge**: Team reviews and merges the fixes

## Security & Privacy

- **Secure by Default**: Only sends necessary log data for analysis
- **No Code Storage**: Your code is not stored or retained
- **Audit Trail**: All actions are logged and traceable
- **Permission Control**: Respects GitHub repository permissions

## Troubleshooting

### Action Not Triggering

1. Check that the workflow name in `workflow_run` matches your actual CI workflow
2. Ensure the `CODEMIND_API_KEY` secret is set correctly
3. Verify your CodeMind project is properly configured

### Auto-Fix Not Creating PRs

1. Check the action outputs and logs for error messages
2. Ensure the issues are actually auto-fixable (see supported issues above)
3. Verify your rate limits haven't been exceeded
4. Check repository permissions for the GitHub token

### Invalid API Responses

1. Verify your API key is valid and has proper permissions
2. Check the CodeMind API URL is correct
3. Ensure your project ID exists in CodeMind

## Support

- 📖 **Documentation**: [codemind.app/docs](https://codemind.app/docs)
- 💬 **Community**: [GitHub Discussions](https://github.com/your-org/codemind/discussions)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/your-org/codemind/issues)
- 📧 **Support**: support@codemind.app

## License

This action is licensed under the MIT License. See [LICENSE](../../../LICENSE) for details.
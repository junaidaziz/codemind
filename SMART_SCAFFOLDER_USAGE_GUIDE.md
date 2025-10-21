# 🏗️ Smart Scaffolder - Usage Guide

Complete guide to using the Smart Scaffolder feature in CodeMind.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Command Syntax](#command-syntax)
3. [Supported Scaffolds](#supported-scaffolds)
4. [Examples](#examples)
5. [Best Practices](#best-practices)
6. [Advanced Features](#advanced-features)
7. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

The Smart Scaffolder generates code from natural language descriptions. Simply use the `/scaffold` command in the chat:

```bash
/scaffold "create a UserProfile component"
```

The system will:
1. 🧠 Parse your request
2. 📊 Analyze your project conventions
3. 🎯 Select appropriate templates
4. 🔧 Generate context-aware code
5. 👀 Show you a preview
6. ✅ Apply changes when you approve

---

## 📝 Command Syntax

### Basic Syntax

```bash
/scaffold "<description>"
/scaf "<description>"        # Short alias
```

### Command Format

```
/scaffold [intent] [entity] [with modifiers] [references]

Examples:
  /scaffold create UserProfile component
  /scaffold add posts API route with auth
  /scaffold generate Product model with Category relation
```

### Intent Keywords

- **create** - Create new code from scratch
- **add** - Add new feature to existing code
- **generate** - Generate boilerplate code
- **scaffold** - Scaffold complete structure
- **update** - Update existing code
- **extend** - Extend functionality

### Entity Types

- **component** - React/UI components
- **route** - API endpoints
- **model** - Database models
- **service** - Business logic services
- **hook** - Custom React hooks
- **utility** - Helper functions
- **test** - Test files
- **module** - Complete modules

### Modifiers

- **with-tests** - Include test files
- **with-types** - Add TypeScript types
- **with-docs** - Include documentation
- **with-auth** - Add authentication
- **typescript** / **javascript** - Language preference

---

## 🎨 Supported Scaffolds

### 1. React Components

**Template**: `react-component`

**Usage**:
```bash
/scaffold "create UserProfile component with avatar"
/scaffold "add Card component with state management"
```

**Generated Files**:
- `src/components/UserProfile.tsx` - Component file
- `src/components/UserProfile.module.css` - Optional styles

**Features**:
- Props interface with TypeScript
- State management (useState)
- Effect hooks (useEffect)
- Optional CSS modules
- JSDoc comments

---

### 2. Next.js API Routes

**Template**: `nextjs-api-route`

**Usage**:
```bash
/scaffold "create API route for users"
/scaffold "add posts endpoint with authentication"
```

**Generated Files**:
- `src/app/api/users/route.ts` - API route handler

**Features**:
- Multiple HTTP methods (GET, POST, PUT, DELETE)
- Request validation with Zod
- Authentication middleware
- Error handling
- TypeScript types

---

### 3. Custom React Hooks

**Template**: `react-hook`

**Usage**:
```bash
/scaffold "create useAuth hook"
/scaffold "add useFetch hook for API calls"
```

**Generated Files**:
- `src/hooks/useAuth.ts` - Custom hook

**Features**:
- State management
- Effect cleanup
- TypeScript return types
- Error handling
- Loading states

---

### 4. Prisma Models

**Template**: `prisma-model`

**Usage**:
```bash
/scaffold "generate Prisma model for Product"
/scaffold "create User model with Profile relation"
```

**Generated Files**:
- `prisma/schema.prisma` - Model definition (appends to existing)

**Features**:
- Field definitions
- Relations to other models
- Indexes and constraints
- Timestamps (createdAt, updatedAt)
- Unique constraints

---

## 💡 Examples

### Example 1: Complete Auth System

```bash
# 1. Create auth API route
/scaffold "create authentication API route with JWT"

# 2. Create auth hook
/scaffold "add useAuth hook for session management"

# 3. Create login component
/scaffold "create LoginForm component with validation"

# 4. Create user model
/scaffold "generate User model with email and password"
```

### Example 2: Blog Feature

```bash
# 1. Create Post model
/scaffold "generate Post model with User relation"

# 2. Create API endpoints
/scaffold "create posts API route with CRUD operations"

# 3. Create components
/scaffold "add PostCard component"
/scaffold "create PostList component"
/scaffold "add PostEditor component with rich text"
```

### Example 3: E-commerce Product Module

```bash
# 1. Database model
/scaffold "create Product model with Category and price"

# 2. API routes
/scaffold "add products API with filtering and pagination"

# 3. Components
/scaffold "create ProductCard component with image"
/scaffold "add ProductGrid component"
/scaffold "create ProductDetails component"
```

---

## ✨ Best Practices

### 1. Be Specific

❌ **Bad**: `/scaffold "create component"`  
✅ **Good**: `/scaffold "create UserProfile component with avatar and bio"`

The more specific you are, the better the generated code.

### 2. Mention Technologies

Include frameworks, libraries, or patterns:

```bash
/scaffold "create API route with Zod validation"
/scaffold "add component using Tailwind CSS"
/scaffold "generate Prisma model with relations"
```

### 3. Reference Existing Patterns

Mention similar existing code:

```bash
/scaffold "create Settings module similar to Profile"
/scaffold "add dashboard like the admin panel"
```

### 4. Use Modifiers

Add modifiers for extra features:

```bash
/scaffold "create component with tests"
/scaffold "add API route with auth and validation"
```

### 5. Preview Before Applying

Always review the preview before clicking "Accept":
- Check file paths are correct
- Verify generated code follows conventions
- Look for any conflicts

---

## 🔧 Advanced Features

### Convention Detection

The scaffolder automatically detects your project's conventions:

- **Naming patterns** (camelCase, PascalCase, kebab-case)
- **Folder structure** (where components/routes/utils go)
- **Import style** (single/double quotes, path aliases)
- **Framework** (Next.js, React, Express)
- **TypeScript configuration**

### Template Variables

Templates support variables that are auto-filled:

- `{{componentName}}` - Component name
- `{{routeName}}` - API route name
- `{{modelName}}` - Model name
- `{{pascalCase name}}` - Convert to PascalCase
- `{{camelCase name}}` - Convert to camelCase
- `{{kebabCase name}}` - Convert to kebab-case

### Conditionals

Templates include conditional sections:

```typescript
{{#if withAuth}}
// Authentication code here
{{/if}}

{{#if methods}}
// Multiple HTTP methods
{{/if}}
```

### Multi-File Generation

Some templates generate multiple files:

- Component + CSS module
- API route + types + tests
- Model + migration + seeder

### Dependency Graphs

The system builds dependency graphs showing:
- Which files import which
- File relationships
- Circular dependencies (warns you!)

---

## 🐛 Troubleshooting

### Issue: "Unable to understand the scaffold request"

**Cause**: Prompt is too ambiguous or uses unfamiliar terms.

**Solution**:
- Be more specific about what you want
- Use standard terminology (component, route, model, etc.)
- Try rephrasing with different keywords

### Issue: "No suitable templates found"

**Cause**: Requested entity type doesn't match available templates.

**Solution**:
- Check supported entity types (component, route, model, service, hook)
- Use `/scaffold help` to see available templates
- Request something similar to examples

### Issue: Generated code doesn't match my style

**Cause**: Convention detection may be inaccurate for inconsistent codebases.

**Solution**:
- The more consistent your existing code, the better
- First few scaffolds help the system learn
- You can modify generated code before applying

### Issue: File already exists

**Cause**: Trying to create a file that exists.

**Solution**:
- The preview will show this as a conflict
- Choose to:
  - Skip (don't create)
  - Overwrite (replace existing)
  - Modify request (different name)

### Issue: Import paths are wrong

**Cause**: Path aliases not detected correctly.

**Solution**:
- Check your `tsconfig.json` or `jsconfig.json`
- Verify path aliases are configured
- Manually fix imports after applying

---

## 📊 Success Metrics

After scaffolding:
- ✅ Files compile without errors
- ✅ Imports resolve correctly
- ✅ Code follows project conventions
- ✅ Types are correct (TypeScript)
- ✅ No circular dependencies

---

## 🎯 Command Reference

### Primary Command
```bash
/scaffold "<description>"
```

### Aliases
```bash
/scaf "<description>"
```

### Help
```bash
/scaffold help
/help scaffold
```

### Examples
```bash
/scaffold examples         # Show example prompts
```

---

## 🚀 Next Steps

1. **Start Simple**: Try scaffolding a basic component
2. **Iterate**: Refine your prompts based on results
3. **Learn Patterns**: See what works best for your project
4. **Go Complex**: Try multi-file scaffolds
5. **Share**: Document successful patterns for your team

---

## 💬 Feedback

Have issues or suggestions? The Smart Scaffolder learns from usage:
- Report ambiguous prompts that fail
- Share successful prompts
- Request new template types
- Suggest improvements

---

**Built with ❤️ by CodeMind AI**

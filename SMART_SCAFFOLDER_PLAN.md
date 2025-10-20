# Smart Scaffolder Mode - Implementation Plan 🏗️

**Feature**: AI Code Generation → Smart Scaffolder Mode  
**Priority**: ⭐⭐⭐⭐ (Tier 1, High-Impact)  
**Status**: Planning Phase  
**Start Date**: October 20, 2025

---

## 🎯 Vision

Transform the `/gen` command into an intelligent scaffolder that:
- Reads existing project conventions and patterns
- Generates multiple related files with proper dependencies
- Adapts to the project's architecture and style
- Creates complete features (components + tests + docs + migrations)

---

## 📋 Implementation Phases

### **Phase 1: Project Convention Analyzer** 🔍
**Goal**: Understand the existing codebase structure and patterns

#### 1.1 Convention Detection System
- [ ] Create `ProjectConventionAnalyzer` class
- [ ] Detect file naming conventions (kebab-case, PascalCase, etc.)
- [ ] Identify directory structure patterns
- [ ] Detect framework (Next.js, React, Node.js, etc.)
- [ ] Parse existing component patterns
- [ ] Extract styling approach (CSS Modules, Tailwind, styled-components)

#### 1.2 Pattern Recognition
- [ ] Analyze existing components for common patterns
- [ ] Detect import/export styles
- [ ] Identify prop typing patterns (TypeScript, PropTypes, etc.)
- [ ] Extract state management patterns (useState, Redux, Zustand)
- [ ] Detect API patterns (fetch, axios, tRPC)

#### 1.3 Convention Storage
- [ ] Create convention cache in database
- [ ] Store per-project conventions
- [ ] Version control for convention changes
- [ ] Convention update triggers

**Files to Create**:
- `src/lib/scaffolder/convention-analyzer.ts`
- `src/lib/scaffolder/pattern-detector.ts`
- `src/lib/scaffolder/convention-cache.ts`
- `src/lib/scaffolder/types.ts`

---

### **Phase 2: Dependency Graph Builder** 🕸️
**Goal**: Track file relationships and dependencies

#### 2.1 Dependency Parser
- [ ] Parse import/export statements
- [ ] Build dependency tree
- [ ] Identify circular dependencies
- [ ] Map component hierarchies

#### 2.2 Visualization
- [ ] Create dependency graph visualizer
- [ ] Show file relationships in UI
- [ ] Highlight impact of new files
- [ ] Interactive node exploration

#### 2.3 Dependency Validation
- [ ] Validate new file dependencies
- [ ] Prevent circular dependencies
- [ ] Suggest missing imports
- [ ] Auto-add required dependencies

**Files to Create**:
- `src/lib/scaffolder/dependency-parser.ts`
- `src/lib/scaffolder/dependency-graph.ts`
- `src/components/DependencyGraphVisualization.tsx`

---

### **Phase 3: Multi-File Generator** 📦
**Goal**: Generate complete features with multiple related files

#### 3.1 File Template System
- [ ] Create template engine
- [ ] Define file type templates:
  - Component + Test + Story
  - API Route + Handler + Types
  - Database Model + Migration + Seeder
  - Service + Interface + Mock
- [ ] Support custom templates
- [ ] Template variables and interpolation

#### 3.2 Context-Aware Generation
- [ ] Use convention analyzer results
- [ ] Apply project-specific patterns
- [ ] Match existing code style
- [ ] Maintain consistency across files

#### 3.3 Smart Suggestions
- [ ] Suggest related files to generate
- [ ] Recommend test files
- [ ] Propose documentation files
- [ ] Suggest migration scripts

**Files to Create**:
- `src/lib/scaffolder/template-engine.ts`
- `src/lib/scaffolder/multi-file-generator.ts`
- `src/lib/scaffolder/templates/` (directory with templates)
- `src/lib/scaffolder/context-applier.ts`

---

### **Phase 4: Framework Templates** 🎨
**Goal**: Pre-built templates for popular frameworks

#### 4.1 Next.js Templates
- [ ] App Router page/layout templates
- [ ] API route templates
- [ ] Server/Client component templates
- [ ] Middleware templates
- [ ] Route handlers

#### 4.2 React Templates
- [ ] Functional component templates
- [ ] Custom hook templates
- [ ] Context provider templates
- [ ] HOC templates

#### 4.3 Backend Templates
- [ ] Express route templates
- [ ] NestJS module templates
- [ ] Prisma model templates
- [ ] GraphQL resolver templates

#### 4.4 Database Templates
- [ ] Prisma migration templates
- [ ] Seed data templates
- [ ] SQL migration templates

**Files to Create**:
- `src/lib/scaffolder/templates/nextjs/`
- `src/lib/scaffolder/templates/react/`
- `src/lib/scaffolder/templates/backend/`
- `src/lib/scaffolder/templates/database/`

---

### **Phase 5: Enhanced /gen Command** 🚀
**Goal**: Upgrade the generate command with scaffolder capabilities

#### 5.1 Command Parser Updates
- [ ] Add multi-file generation flags
- [ ] Support template selection
- [ ] Add convention override options
- [ ] Support batch generation

#### 5.2 Interactive Mode
- [ ] Prompt for file selection
- [ ] Preview all files before generation
- [ ] Allow customization per file
- [ ] Provide diff preview

#### 5.3 Smart Prompts
- [ ] Natural language understanding:
  - "Create settings module similar to profile"
  - "Generate CRUD for User model"
  - "Add authentication like GitHub login"
- [ ] Context from existing files
- [ ] Similarity matching

**Files to Modify**:
- `src/lib/command-handlers/generate-handler.ts`
- `src/lib/command-parser.ts` (add new flags)

**New Files**:
- `src/lib/scaffolder/smart-prompt-parser.ts`
- `src/lib/scaffolder/similarity-matcher.ts`

---

### **Phase 6: UI Integration** 🎨
**Goal**: Beautiful interface for scaffolding workflow

#### 6.1 Scaffolder Panel
- [ ] Create scaffolder UI component
- [ ] File tree preview
- [ ] Dependency graph view
- [ ] Template selector
- [ ] Convention viewer

#### 6.2 Generation Preview
- [ ] Show all files to be generated
- [ ] Code preview for each file
- [ ] Dependency visualization
- [ ] Edit before generation option

#### 6.3 Progress Tracking
- [ ] Generation progress indicator
- [ ] File-by-file status
- [ ] Error handling and retry
- [ ] Success confirmation

**Files to Create**:
- `src/components/ScaffolderPanel.tsx`
- `src/components/GenerationPreview.tsx`
- `src/components/FileTreePreview.tsx`
- `src/components/TemplateSelector.tsx`

---

### **Phase 7: Testing & Documentation** 🧪
**Goal**: Comprehensive testing and user documentation

#### 7.1 Unit Tests
- [ ] Test convention analyzer
- [ ] Test dependency parser
- [ ] Test template engine
- [ ] Test multi-file generator

#### 7.2 Integration Tests
- [ ] Test full scaffolding flow
- [ ] Test framework templates
- [ ] Test with real projects
- [ ] Test error scenarios

#### 7.3 Documentation
- [ ] User guide for scaffolder
- [ ] Template creation guide
- [ ] Convention customization docs
- [ ] Example workflows

**Files to Create**:
- `scripts/test-scaffolder.ts`
- `SMART_SCAFFOLDER_GUIDE.md`
- `docs/TEMPLATE_CREATION.md`

---

## 🔧 Technical Architecture

### Core Components

```
┌─────────────────────────────────────────┐
│        Smart Scaffolder System          │
├─────────────────────────────────────────┤
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   ProjectConventionAnalyzer       │ │
│  │   - Detect patterns               │ │
│  │   - Extract conventions           │ │
│  │   - Cache results                 │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   DependencyGraphBuilder          │ │
│  │   - Parse imports/exports         │ │
│  │   - Build dependency tree         │ │
│  │   - Visualize relationships       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   MultiFileGenerator              │ │
│  │   - Template engine               │ │
│  │   - Context application           │ │
│  │   - File creation                 │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   SmartPromptParser               │ │
│  │   - Natural language processing   │ │
│  │   - Similarity matching           │ │
│  │   - Context extraction            │ │
│  └───────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

### Data Flow

```
User: "/gen Create settings module similar to profile"
  ↓
SmartPromptParser
  - Parse natural language
  - Find "profile" module
  - Extract patterns
  ↓
ProjectConventionAnalyzer
  - Get project conventions
  - Analyze profile module
  - Extract reusable patterns
  ↓
MultiFileGenerator
  - Apply templates
  - Generate files:
    * src/components/Settings.tsx
    * src/components/Settings.test.tsx
    * src/app/settings/page.tsx
    * src/lib/settings-service.ts
  ↓
DependencyGraphBuilder
  - Calculate dependencies
  - Validate structure
  - Show impact
  ↓
UI Preview
  - Show all files
  - Display dependencies
  - Allow edits
  ↓
User: Click "Accept"
  ↓
File Creation
  - Write all files
  - Update imports
  - Run formatters
```

---

## 📊 Success Metrics

### Performance Targets
- Convention analysis: < 5 seconds
- Template generation: < 2 seconds per file
- Dependency graph build: < 3 seconds
- UI preview render: < 500ms

### Quality Targets
- Convention detection accuracy: > 90%
- Generated code passes linting: 100%
- Proper TypeScript types: 100%
- Test coverage: > 85%

### User Experience
- Reduce scaffolding time by 70%
- One command generates complete features
- Zero manual file creation needed
- Consistent with existing codebase

---

## 🎯 Use Cases

### Use Case 1: New Feature Module
```bash
/gen Create settings module similar to profile
```
**Generates**:
- `src/components/Settings.tsx`
- `src/components/Settings.test.tsx`
- `src/app/settings/page.tsx`
- `src/lib/settings-service.ts`
- `src/types/settings.ts`

### Use Case 2: CRUD API
```bash
/gen Add CRUD endpoints for Post model
```
**Generates**:
- `src/app/api/posts/route.ts` (GET, POST)
- `src/app/api/posts/[id]/route.ts` (GET, PUT, DELETE)
- `src/lib/post-service.ts`
- `src/types/post.ts`
- `prisma/migrations/xxx_add_post.sql`

### Use Case 3: Authentication Flow
```bash
/gen Add Google OAuth similar to GitHub login
```
**Generates**:
- `src/app/api/auth/google/route.ts`
- `src/lib/auth/google-provider.ts`
- `src/components/GoogleLoginButton.tsx`
- Update `src/lib/auth-config.ts`

---

## 🚀 Implementation Timeline

### Week 1: Foundation
- Phase 1: Convention Analyzer (3 days)
- Phase 2: Dependency Graph (2 days)
- Initial testing (2 days)

### Week 2: Generation
- Phase 3: Multi-File Generator (3 days)
- Phase 4: Framework Templates (3 days)
- Template testing (1 day)

### Week 3: Command & UI
- Phase 5: Enhanced /gen (2 days)
- Phase 6: UI Integration (3 days)
- E2E testing (2 days)

### Week 4: Polish & Launch
- Phase 7: Testing & Docs (3 days)
- Bug fixes and refinements (2 days)
- Documentation and examples (2 days)

**Total**: ~4 weeks for complete implementation

---

## 🔗 Dependencies

### Existing Systems
- ✅ Command Parser (already built)
- ✅ Command Registry (already built)
- ✅ Generate Handler (foundation exists)
- ✅ Chat UI (for display)

### New Dependencies
- AST Parser (TypeScript Compiler API)
- Template Engine (Handlebars or custom)
- Graph Visualization (D3.js or Cytoscape)

### External Services
- AI for pattern matching (OpenAI)
- Code formatters (Prettier)
- Linters (ESLint)

---

## 📝 Next Immediate Steps

1. **Create directory structure** for scaffolder
2. **Implement ProjectConventionAnalyzer** (Phase 1.1)
3. **Add database schema** for convention storage
4. **Create basic template engine**
5. **Update /gen command handler**

---

**Ready to Begin Phase 1!** 🎉

Let's start with the Convention Analyzer to understand existing project patterns.

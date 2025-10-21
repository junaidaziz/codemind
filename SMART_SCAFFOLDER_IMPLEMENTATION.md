# 🏗️ Smart Scaffolder Mode - Implementation Tracker

**Feature**: #1 Smart Scaffolder Mode (Tier 1)  
**Started**: January 21, 2025  
**Target Completion**: ~3 weeks  
**Status**: 🟡 In Progress - Phase 1

---

## 📋 Overview

The Smart Scaffolder Mode enables developers to generate production-ready code modules using natural language. It analyzes existing project conventions and generates consistent, multi-file implementations.

### Key Capabilities
- 🧠 Context-aware scaffolding (reads project conventions)
- 💬 Natural language prompts
- 📦 Multi-file generation with dependencies
- 🎨 Framework-specific templates
- 🔄 Auto-generate migrations, seeders, docs
- 👁️ Preview before applying

---

## 🎯 Implementation Phases

### ✅ Phase 0: Planning & Setup (Day 0)
- [x] Create implementation tracking document
- [x] Define architecture and file structure
- [x] Set up todo list and milestones

### 🟡 Phase 1: Core Scaffolding Architecture (Days 1-4)
**Goal**: Build foundational services and type system

#### Tasks:
- [ ] Create scaffolding service directory structure
- [ ] Define core TypeScript interfaces and types
- [ ] Implement ScaffoldingService base class
- [ ] Create ConventionAnalyzer skeleton
- [ ] Build TemplateEngine foundation
- [ ] Add database schema for scaffolding templates

**Files to Create**:
```
src/lib/scaffolding/
  ├── types.ts                    # Core type definitions
  ├── ScaffoldingService.ts       # Main orchestrator
  ├── ConventionAnalyzer.ts       # Project pattern detection
  ├── TemplateEngine.ts           # Template processing
  ├── PromptParser.ts             # NLP prompt processing
  └── templates/
      ├── index.ts                # Template registry
      ├── react-component.ts      # React component templates
      ├── api-route.ts            # API route templates
      ├── prisma-model.ts         # Prisma model templates
      └── service-class.ts        # Service class templates
```

**Success Criteria**:
- ✅ All core service files created
- ✅ Type system fully defined
- ✅ Basic template loading works
- ✅ Convention analyzer can detect simple patterns

---

### ⬜ Phase 2: Convention Analysis (Days 5-7)
**Goal**: Detect and codify project conventions

#### Tasks:
- [ ] Implement naming convention detection (camelCase, PascalCase, etc.)
- [ ] Analyze folder structure patterns
- [ ] Detect import style (default vs named, absolute vs relative)
- [ ] Identify framework and libraries in use
- [ ] Extract common code patterns
- [ ] Cache analyzed conventions per project

**Key Features**:
- Detect TypeScript configuration (strict mode, paths, etc.)
- Identify component patterns (functional vs class, hooks usage)
- Analyze prop patterns and naming
- Detect state management approach
- Identify testing framework and patterns

**Success Criteria**:
- ✅ Can detect conventions from sample projects
- ✅ 90%+ accuracy on naming patterns
- ✅ Correctly identifies framework (Next.js, React, etc.)
- ✅ Caches results for performance

---

### ⬜ Phase 3: Template System (Days 8-11)
**Goal**: Build flexible, convention-aware templates

#### Tasks:
- [ ] Create template variable system
- [ ] Implement conditional rendering
- [ ] Add convention application logic
- [ ] Build 5 base templates (component, route, model, service, test)
- [ ] Add template validation
- [ ] Implement multi-file template support

**Template Features**:
- Variable interpolation: `{{componentName}}`, `{{imports}}`, etc.
- Conditionals: `{{#if useTypeScript}}...{{/if}}`
- Loops: `{{#each props}}...{{/each}}`
- Convention application: auto-apply detected patterns
- Dependency injection: auto-add imports

**Base Templates**:
1. React Component (functional + TypeScript)
2. Next.js API Route (with auth, validation)
3. Prisma Model (with relations)
4. Service Class (with error handling)
5. Jest Test Suite (with mocks)

**Success Criteria**:
- ✅ Templates render correctly with variables
- ✅ Conditionals and loops work
- ✅ Generated code follows conventions
- ✅ Multi-file templates generate properly

---

### ⬜ Phase 4: Natural Language Parsing (Days 12-14)
**Goal**: Understand and extract intent from user prompts

#### Tasks:
- [ ] Build prompt tokenizer and parser
- [ ] Implement intent classification
- [ ] Extract target entities (file names, types, etc.)
- [ ] Identify reference patterns ("similar to X")
- [ ] Map prompts to templates
- [ ] Handle ambiguous prompts gracefully

**Example Prompts to Support**:
- "Create settings module similar to profile"
- "Add user authentication API routes"
- "Generate Prisma model for Product with relations"
- "Scaffold a dashboard component with charts"
- "Create CRUD endpoints for Posts"

**Parsing Features**:
- Intent detection (create, update, add, generate, etc.)
- Entity extraction (module names, file types)
- Pattern matching ("similar to", "like", "based on")
- Framework hints (API route, component, model, etc.)
- Relationship detection (with relations, using X)

**Success Criteria**:
- ✅ 85%+ intent classification accuracy
- ✅ Correctly extracts entity names
- ✅ Identifies reference patterns
- ✅ Suggests corrections for ambiguous prompts

---

### ⬜ Phase 5: Multi-File Generation (Days 15-17)
**Goal**: Generate complete, interconnected modules

#### Tasks:
- [ ] Build dependency graph generator
- [ ] Implement file relationship tracking
- [ ] Add import path resolution
- [ ] Create preview system (before applying)
- [ ] Implement safe file writing (backup + rollback)
- [ ] Add conflict detection and resolution

**Generation Flow**:
1. Parse prompt → Extract intent + entities
2. Analyze conventions → Get project patterns
3. Select templates → Based on intent
4. Generate files → Apply conventions
5. Build dependency graph → Link files
6. Preview changes → Show to user
7. Apply changes → Write files safely

**Safety Features**:
- Backup existing files before overwriting
- Detect merge conflicts
- Preview all changes before applying
- Rollback on error
- Dry-run mode

**Success Criteria**:
- ✅ Can generate 2+ related files
- ✅ Imports resolve correctly
- ✅ Dependency graph accurate
- ✅ Preview shows all changes
- ✅ Rollback works on errors

---

### ⬜ Phase 6: Framework Templates (Days 18-19)
**Goal**: Add specialized templates for popular frameworks

#### Tasks:
- [ ] Next.js page + route templates
- [ ] Next.js Server Actions template
- [ ] Express.js route + middleware templates
- [ ] Prisma model + migration templates
- [ ] React Hook templates
- [ ] Tailwind component templates

**Framework Support**:
- **Next.js 15**: App Router, Server Components, Route Handlers
- **Prisma**: Models with relations, migrations, seeders
- **React**: Components, hooks, contexts
- **Express**: Routes, middleware, controllers
- **Testing**: Jest, React Testing Library

**Success Criteria**:
- ✅ 10+ framework-specific templates
- ✅ Templates follow framework best practices
- ✅ Generated code passes framework linting
- ✅ Auto-generates boilerplate correctly

---

### ⬜ Phase 7: Command Console Integration (Day 20)
**Goal**: Wire up to `/scaffold` command in chat

#### Tasks:
- [ ] Create `/scaffold` command handler
- [ ] Add to command registry
- [ ] Design rich preview UI in chat
- [ ] Add "Apply" and "Cancel" actions
- [ ] Implement real-time progress updates
- [ ] Add to command help documentation

**Chat UI Features**:
- Show parsed intent and entities
- Display dependency graph visually
- Preview code with syntax highlighting
- Show before/after file tree
- Apply button with confirmation
- Cancel with explanation

**Command Examples**:
```
/scaffold Create settings module similar to profile
/scaffold Add auth API routes with JWT
/scaffold Generate Product model with User relation
/scaffold Create dashboard component with charts
```

**Success Criteria**:
- ✅ `/scaffold` command works in chat
- ✅ Rich preview displays correctly
- ✅ Apply/Cancel actions work
- ✅ Progress updates in real-time
- ✅ Help documentation complete

---

### ⬜ Phase 8: Testing & Verification (Days 21-22)
**Goal**: Ensure reliability and handle edge cases

#### Tasks:
- [ ] Write unit tests for all services
- [ ] Add integration tests for full flow
- [ ] Test with various project types
- [ ] Verify convention detection accuracy
- [ ] Performance optimization
- [ ] Edge case handling

**Test Coverage**:
- ScaffoldingService: 90%+
- ConventionAnalyzer: 95%+
- TemplateEngine: 90%+
- PromptParser: 85%+
- Full integration: Happy path + 10 edge cases

**Edge Cases to Test**:
- Empty project (no conventions to detect)
- Mixed conventions (inconsistent codebase)
- Ambiguous prompts
- Invalid file names
- File already exists
- Permission errors
- Large file generation (100+ files)

**Success Criteria**:
- ✅ 90%+ test coverage
- ✅ All edge cases handled gracefully
- ✅ Performance <2s for typical generation
- ✅ No memory leaks on large generations

---

### ⬜ Phase 9: Documentation & Polish (Day 23)
**Goal**: Complete documentation and final touches

#### Tasks:
- [ ] Write API documentation
- [ ] Create usage guide with examples
- [ ] Add troubleshooting section
- [ ] Record demo video
- [ ] Prepare release notes
- [ ] Update roadmap

**Documentation Sections**:
1. **Quick Start**: Basic usage examples
2. **Prompt Guide**: How to write effective prompts
3. **Templates**: Available templates and customization
4. **Conventions**: How detection works
5. **Advanced**: Multi-file generation, custom templates
6. **API Reference**: TypeScript interfaces
7. **Troubleshooting**: Common issues

**Success Criteria**:
- ✅ Complete usage guide published
- ✅ 10+ example prompts documented
- ✅ API reference generated
- ✅ Demo video created
- ✅ Release notes ready

---

## 🏗️ Architecture Design

### Core Services

#### 1. ScaffoldingService
**Responsibility**: Main orchestrator
```typescript
class ScaffoldingService {
  async scaffold(prompt: string, projectId: string): Promise<ScaffoldResult>
  async preview(prompt: string, projectId: string): Promise<PreviewResult>
  async apply(previewId: string): Promise<ApplyResult>
  async rollback(scaffoldId: string): Promise<void>
}
```

#### 2. ConventionAnalyzer
**Responsibility**: Detect project patterns
```typescript
class ConventionAnalyzer {
  async analyzeProject(projectId: string): Promise<ProjectConventions>
  detectNamingConvention(files: FileTree): NamingStyle
  detectImportStyle(files: FileTree): ImportStyle
  detectFramework(files: FileTree): Framework
  cacheConventions(projectId: string, conventions: ProjectConventions): void
}
```

#### 3. TemplateEngine
**Responsibility**: Render templates
```typescript
class TemplateEngine {
  render(template: Template, context: TemplateContext): string
  registerTemplate(name: string, template: Template): void
  applyConventions(code: string, conventions: ProjectConventions): string
}
```

#### 4. PromptParser
**Responsibility**: Parse natural language
```typescript
class PromptParser {
  parse(prompt: string): ParsedIntent
  extractEntities(prompt: string): Entity[]
  classifyIntent(prompt: string): IntentType
  findReferences(prompt: string): Reference[]
}
```

### Data Models

```typescript
interface ScaffoldRequest {
  prompt: string;
  projectId: string;
  userId: string;
  previewOnly?: boolean;
}

interface ScaffoldResult {
  id: string;
  files: GeneratedFile[];
  dependencyGraph: DependencyGraph;
  appliedConventions: ProjectConventions;
  preview: PreviewData;
  status: 'pending' | 'applied' | 'failed';
}

interface GeneratedFile {
  path: string;
  content: string;
  imports: string[];
  exports: string[];
  dependencies: string[];
}

interface ProjectConventions {
  naming: NamingStyle;
  imports: ImportStyle;
  framework: Framework;
  typescript: boolean;
  strictMode: boolean;
  testFramework?: string;
  stateManagement?: string;
}

interface Template {
  name: string;
  description: string;
  framework?: string;
  category: 'component' | 'route' | 'model' | 'service' | 'test';
  files: TemplateFile[];
  variables: TemplateVariable[];
}
```

---

## 📊 Progress Tracking

### Lines of Code Written
- **Phase 0**: 0 lines (planning)
- **Phase 1**: Target 800 lines
- **Phase 2**: Target 600 lines
- **Phase 3**: Target 1,000 lines
- **Phase 4**: Target 700 lines
- **Phase 5**: Target 900 lines
- **Phase 6**: Target 800 lines
- **Phase 7**: Target 400 lines
- **Phase 8**: Target 1,200 lines (tests)
- **Phase 9**: Target 200 lines (docs)

**Total Target**: ~6,600 lines

### Current Progress
- **Completed**: 0 / 9 phases
- **Lines Written**: 0 / ~6,600
- **Tests Passing**: 0 / ~50 expected
- **Documentation**: 0%

---

## 🎯 Success Metrics

### Functional Metrics
- [ ] Generate valid code 95%+ of time
- [ ] Follow project conventions 90%+ accuracy
- [ ] Handle 20+ different prompt types
- [ ] Support 5+ frameworks/libraries
- [ ] Generation speed <3 seconds average

### Quality Metrics
- [ ] Generated code passes linting
- [ ] Generated code type-checks (TypeScript)
- [ ] 90%+ test coverage
- [ ] No critical bugs in production
- [ ] Performance optimized (<2s typical)

### User Metrics
- [ ] 80%+ user satisfaction
- [ ] Used 5+ times per week per developer
- [ ] 70%+ time saved vs manual scaffolding
- [ ] <5% rollback rate
- [ ] 50%+ prompts understood first try

---

## 🐛 Known Issues & Risks

### Risks
1. **Convention detection accuracy**: May struggle with inconsistent codebases
   - Mitigation: Allow manual convention configuration
2. **Prompt ambiguity**: NLP may misunderstand complex prompts
   - Mitigation: Show parsed intent for confirmation
3. **Framework diversity**: Hard to support all frameworks
   - Mitigation: Start with Next.js + React, expand later
4. **File conflicts**: Overwriting existing files is risky
   - Mitigation: Always backup, show preview, allow rollback

### Known Limitations
- Initial version: TypeScript/JavaScript only
- Framework support: Next.js, React, Prisma only at launch
- Template library: Limited to ~10 base templates initially
- Multi-language: Not supported (Python, Ruby, etc.)

---

## 📝 Development Notes

### Architecture Decisions
- **Why separate ConventionAnalyzer**: Reusable for other features
- **Why TemplateEngine over string replace**: Flexibility for complex templates
- **Why PromptParser**: Better UX than rigid command syntax
- **Why preview system**: Safety and user control

### Performance Considerations
- Cache analyzed conventions per project
- Use worker threads for large file generation
- Stream large outputs to avoid memory issues
- Debounce preview updates during editing

### Security Considerations
- Validate all file paths (prevent directory traversal)
- Sanitize template variables (prevent code injection)
- Check user permissions before writing files
- Rate limit generation requests

---

## 🚀 Next Steps

**Current Phase**: Phase 1 - Core Architecture  
**Next Action**: Create service directory structure and type definitions

### Immediate Tasks (Today)
1. Create `src/lib/scaffolding/` directory
2. Define core types in `types.ts`
3. Create skeleton for all core services
4. Set up database schema for templates

### Tomorrow
1. Implement ConventionAnalyzer basics
2. Build template loading system
3. Start on PromptParser foundation

---

## 📚 References

- [Existing /gen command](src/app/api/chat/commands/gen/route.ts)
- [Project indexing service](src/lib/project-indexing.ts)
- [Command console](src/app/api/chat/route.ts)
- [Template inspiration: Plop.js](https://plopjs.com/)
- [NLP: compromise.js](https://github.com/spencermountain/compromise)

---

**Last Updated**: January 21, 2025  
**Next Review**: January 22, 2025

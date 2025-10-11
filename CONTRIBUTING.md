# Contributing to CodeMind

We're excited that you're interested in contributing to CodeMind! This guide will help you get started with contributing to our intelligent code understanding platform.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [Getting Started](#getting-started)
3. [Development Setup](#development-setup)
4. [Project Structure](#project-structure)
5. [Contributing Guidelines](#contributing-guidelines)
6. [Pull Request Process](#pull-request-process)
7. [Testing Guidelines](#testing-guidelines)
8. [Documentation](#documentation)
9. [Community](#community)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone, regardless of background, experience level, gender identity, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Expected Behavior

- **Be respectful and inclusive** in all interactions
- **Collaborate constructively** with other contributors
- **Provide helpful and constructive feedback**
- **Focus on what's best for the community**
- **Show empathy towards other community members**

### Unacceptable Behavior

- Harassment, discrimination, or offensive comments
- Personal attacks or trolling
- Publishing others' private information without permission
- Any conduct that could be considered inappropriate in a professional setting

### Reporting Issues

If you witness or experience unacceptable behavior, please report it to the maintainers at conduct@codemind.dev. All reports will be handled confidentially.

## Getting Started

### Ways to Contribute

There are many ways to contribute to CodeMind:

- **Report bugs** and suggest features
- **Improve documentation** and write tutorials
- **Submit code changes** and new features
- **Help other users** in discussions and issues
- **Review pull requests** from other contributors
- **Create examples and templates**

### Before You Start

1. **Check existing issues** to see if your idea or bug report already exists
2. **Read our documentation** to understand the project structure and goals
3. **Join our community** channels to discuss your contribution ideas
4. **Set up the development environment** following our setup guide

## Development Setup

### Prerequisites

- **Node.js 18+** and **pnpm**
- **PostgreSQL 14+** with pgvector extension
- **Git** for version control
- **VS Code** (recommended) with suggested extensions

### Setup Instructions

1. **Fork the repository**
   ```bash
   # Go to https://github.com/codemind/codemind and click "Fork"
   ```

2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/codemind.git
   cd codemind
   ```

3. **Add upstream remote**
   ```bash
   git remote add upstream https://github.com/codemind/codemind.git
   ```

4. **Install dependencies**
   ```bash
   pnpm install
   ```

5. **Set up environment**
   ```bash
   cp env.production.template .env.local
   # Edit .env.local with your configuration
   ```

6. **Set up database**
   ```bash
   pnpm prisma generate
   pnpm prisma migrate dev
   pnpm prisma db seed
   ```

7. **Start development server**
   ```bash
   pnpm dev
   ```

### Development Commands

```bash
# Development
pnpm dev              # Start development server
pnpm dev:turbo        # Start with Turbopack (faster)
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run ESLint
pnpm lint:fix         # Fix linting issues
pnpm type-check       # Run TypeScript checks
pnpm format           # Format code with Prettier

# Database
pnpm prisma studio    # Open database GUI
pnpm prisma migrate   # Create new migration
pnpm prisma generate  # Generate Prisma client

# Testing
pnpm test             # Run unit tests
pnpm test:watch       # Run tests in watch mode
pnpm test:e2e         # Run end-to-end tests
```

## Project Structure

### Directory Overview

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   ├── auth/          # Authentication endpoints
│   │   ├── projects/      # Project management
│   │   ├── chat/          # Chat functionality
│   │   └── analytics/     # Analytics and metrics
│   ├── auth/              # Authentication pages
│   ├── chat/              # Chat interface
│   ├── projects/          # Project management UI
│   ├── analytics/         # Analytics dashboard
│   ├── components/        # App-specific components
│   └── lib/               # App utilities
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   ├── charts/           # Chart components
│   └── forms/            # Form components
├── lib/                  # Shared utilities
│   ├── auth.ts           # Authentication utilities
│   ├── db.ts             # Database connection
│   ├── embeddings.ts     # AI/ML utilities
│   └── logger.ts         # Logging system
├── types/                # TypeScript definitions
│   ├── api.ts            # API types
│   ├── auth.ts           # Authentication types
│   └── analytics.ts      # Analytics types
└── styles/               # Global styles

prisma/
├── schema.prisma         # Database schema
├── migrations/           # Database migrations
└── seed.ts              # Database seeding

docs/                     # Documentation
├── README.md             # Main documentation
├── API.md               # API documentation
├── USER_GUIDE.md        # User guide
└── DEPLOYMENT.md        # Deployment guide
```

### Key Files and Their Purpose

- **`src/app/layout.tsx`**: Root layout with providers and global styles
- **`src/lib/db.ts`**: Prisma database client and connection utilities
- **`src/lib/auth.ts`**: Supabase authentication integration
- **`src/components/ui/`**: Reusable UI components following design system
- **`prisma/schema.prisma`**: Database schema definition
- **`next.config.ts`**: Next.js configuration
- **`tailwind.config.ts`**: Tailwind CSS configuration

## Contributing Guidelines

### Coding Standards

#### TypeScript
- Use **strict TypeScript** configuration
- Define interfaces for all data structures
- Use proper type annotations for function parameters and return types
- Prefer `type` over `interface` for union types
- Use `const assertions` where appropriate

```typescript
// Good
interface User {
  id: string;
  email: string;
  createdAt: Date;
}

const createUser = async (data: CreateUserData): Promise<User> => {
  // Implementation
};

// Avoid
const createUser = async (data: any) => {
  // Implementation
};
```

#### React Components
- Use **functional components** with hooks
- Implement proper error boundaries for critical components
- Use **TypeScript interfaces** for component props
- Follow **composition over inheritance** patterns
- Implement loading and error states appropriately

```typescript
// Good
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  children, 
  onClick, 
  disabled = false 
}) => {
  return (
    <button
      className={`btn btn-${variant} btn-${size}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
};
```

#### API Routes
- Follow **RESTful conventions**
- Use appropriate **HTTP status codes**
- Implement **proper error handling**
- Use **Zod for request validation**
- Include **request timing and logging**

```typescript
// Good
export async function POST(request: NextRequest): Promise<NextResponse> {
  return withRequestTiming('POST', '/api/projects', async () => {
    try {
      const body = await request.json();
      const validatedData = CreateProjectSchema.parse(body);
      
      const project = await projectService.create(validatedData);
      
      return NextResponse.json({
        success: true,
        data: project
      }, { status: 201 });
      
    } catch (error) {
      logger.error('Project creation failed', {}, error as Error);
      
      if (error instanceof z.ZodError) {
        return NextResponse.json(
          createApiError("Validation failed", "VALIDATION_ERROR", error.errors),
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        createApiError("Internal server error", "INTERNAL_ERROR"),
        { status: 500 }
      );
    }
  });
}
```

#### Database Operations
- Use **Prisma ORM** for type-safe database operations
- Implement **proper error handling** for database operations
- Use **transactions** for multi-step operations
- Include **performance monitoring** for slow queries

```typescript
// Good
export class ProjectService {
  async createProject(data: CreateProjectData): Promise<Project> {
    const timer = createPerformanceTimer('project_creation');
    
    try {
      const project = await db.project.create({
        data: {
          ...data,
          status: 'created',
          createdAt: new Date(),
        },
        include: {
          files: true,
        },
      });
      
      // Queue indexing job
      await jobQueue.add('index_project', { projectId: project.id });
      
      return project;
    } catch (error) {
      logger.error('Project creation failed', { data }, error as Error);
      throw error;
    } finally {
      endPerformanceTimer(timer);
    }
  }
}
```

### Naming Conventions

- **Files**: Use kebab-case for files (`user-profile.tsx`)
- **Components**: Use PascalCase (`UserProfile.tsx`)
- **Functions**: Use camelCase (`getUserProfile`)
- **Constants**: Use UPPER_SNAKE_CASE (`MAX_FILE_SIZE`)
- **Types/Interfaces**: Use PascalCase (`UserProfile`, `ApiResponse`)

### Git Workflow

#### Branch Naming
- **Feature branches**: `feature/short-description`
- **Bug fixes**: `fix/short-description`
- **Documentation**: `docs/short-description`
- **Refactoring**: `refactor/short-description`

#### Commit Messages
Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
type(scope): description

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Build process or auxiliary tool changes

**Examples:**
```
feat(auth): add two-factor authentication support

fix(chat): resolve message ordering issue in real-time updates

docs(api): update project creation endpoint documentation

refactor(analytics): improve query performance with caching
```

## Pull Request Process

### Before Creating a PR

1. **Sync with upstream**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make your changes**
   - Write code following our standards
   - Add tests for new functionality
   - Update documentation if needed

4. **Test your changes**
   ```bash
   pnpm test
   pnpm lint
   pnpm type-check
   ```

5. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat(scope): your descriptive commit message"
   ```

### Creating the Pull Request

1. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create PR on GitHub**
   - Go to your fork on GitHub
   - Click "Compare & pull request"
   - Fill out the PR template

### PR Template

```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## How Has This Been Tested?
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Checklist
- [ ] My code follows the project's coding standards
- [ ] I have performed a self-review of my code
- [ ] I have commented my code in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Additional Notes
Any additional information, considerations, or questions.
```

### PR Review Process

1. **Automated Checks**
   - All tests must pass
   - Code must pass linting and type checking
   - Build must succeed

2. **Code Review**
   - At least one maintainer approval required
   - Address all review comments
   - Keep discussions constructive and respectful

3. **Merge Requirements**
   - All checks passing
   - Approved by maintainer
   - Up to date with main branch
   - No merge conflicts

## Testing Guidelines

### Test Structure

We use **Jest** for unit testing and **Playwright** for end-to-end testing.

#### Unit Tests

```typescript
// src/lib/__tests__/auth.test.ts
import { describe, it, expect, vi } from 'vitest';
import { AuthService } from '../auth';

describe('AuthService', () => {
  describe('validateToken', () => {
    it('should return user data for valid token', async () => {
      const mockUser = { id: '1', email: 'test@example.com' };
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null
      });

      const result = await AuthService.validateToken('valid-token');
      
      expect(result).toEqual(mockUser);
    });

    it('should throw error for invalid token', async () => {
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: new Error('Invalid token')
      });

      await expect(AuthService.validateToken('invalid-token'))
        .rejects.toThrow('Invalid token');
    });
  });
});
```

#### Integration Tests

```typescript
// src/app/api/__tests__/projects.test.ts
import { describe, it, expect } from 'vitest';
import { testApiHandler } from 'next-test-api-route-handler';
import handler from '../projects/route';

describe('/api/projects', () => {
  it('should create a new project', async () => {
    await testApiHandler({
      handler,
      test: async ({ fetch }) => {
        const response = await fetch({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Test Project',
            description: 'A test project',
          }),
        });

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data).toHaveProperty('id');
      },
    });
  });
});
```

#### E2E Tests

```typescript
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should allow user to sign up and log in', async ({ page }) => {
    // Sign up
    await page.goto('/auth/signup');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=signup-button]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
    
    // Log out
    await page.click('[data-testid=user-menu]');
    await page.click('[data-testid=logout-button]');
    
    // Log in
    await page.goto('/auth/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    
    // Should redirect to dashboard
    await expect(page).toHaveURL('/dashboard');
  });
});
```

### Test Guidelines

- **Write tests for all new features** and bug fixes
- **Use descriptive test names** that explain what is being tested
- **Mock external dependencies** appropriately
- **Test both success and error cases**
- **Keep tests focused and independent**
- **Use data-testid attributes** for E2E test selectors

## Documentation

### Types of Documentation

1. **Code Documentation**
   - Add JSDoc comments for complex functions
   - Include usage examples in comments
   - Document API interfaces and types

2. **API Documentation**
   - Update API.md for new endpoints
   - Include request/response examples
   - Document error codes and responses

3. **User Documentation**
   - Update user guide for new features
   - Add screenshots for UI changes
   - Include step-by-step instructions

4. **Technical Documentation**
   - Update README for setup changes
   - Document architecture decisions
   - Include deployment instructions

### Documentation Standards

```typescript
/**
 * Creates a new project and queues it for indexing
 * 
 * @param data - Project creation data
 * @param data.name - Project name (must be unique per user)
 * @param data.description - Optional project description
 * @param data.repositoryUrl - Git repository URL
 * @returns Promise resolving to created project
 * 
 * @throws {ValidationError} When input data is invalid
 * @throws {ConflictError} When project name already exists
 * 
 * @example
 * ```typescript
 * const project = await projectService.create({
 *   name: 'My Project',
 *   description: 'A sample project',
 *   repositoryUrl: 'https://github.com/user/repo.git'
 * });
 * ```
 */
async create(data: CreateProjectData): Promise<Project> {
  // Implementation
}
```

## Community

### Communication Channels

- **GitHub Discussions**: General questions and feature discussions
- **GitHub Issues**: Bug reports and feature requests
- **Discord** (coming soon): Real-time chat with the community
- **Twitter**: [@CodeMindDev](https://twitter.com/codeminddev) for announcements

### Getting Help

1. **Check the documentation** first
2. **Search existing issues** and discussions
3. **Ask in GitHub Discussions** for general questions
4. **Create an issue** for bugs or feature requests
5. **Join our Discord** for real-time help

### Recognition

We value all contributions and recognize contributors through:

- **Contributor acknowledgment** in release notes
- **GitHub contributor badges** on the repository
- **Special recognition** for significant contributions
- **Early access** to new features for active contributors

### Maintainer Responsibilities

Project maintainers are responsible for:

- **Reviewing pull requests** in a timely manner
- **Maintaining code quality** and project standards
- **Helping contributors** with questions and issues
- **Managing releases** and project roadmap
- **Fostering an inclusive** and welcoming community

---

## Thank You!

Thank you for your interest in contributing to CodeMind! Every contribution, no matter how small, helps make CodeMind better for everyone. We're excited to see what you'll build with us.

If you have any questions about contributing, don't hesitate to reach out to the maintainers or ask in our community channels.

Happy coding! 🚀

---

*This contributing guide is a living document. Please suggest improvements by creating an issue or pull request.*
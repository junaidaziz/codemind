# CodeMind Agent Core Service

A standalone microservice for AI agent processing, extracted from the main CodeMind web application for independent scaling and deployment.

## Features

- **Standalone AI Processing**: Independent agent service with LangChain integration
- **RESTful API**: HTTP endpoints for agent requests and streaming responses  
- **Docker Ready**: Full containerization with multi-stage builds
- **Production Grade**: Rate limiting, security headers, health checks, metrics
- **Scalable Architecture**: Designed for horizontal scaling and load balancing

## Quick Start

### Local Development

1. **Install Dependencies**
```bash
npm install
```

2. **Configure Environment**
```bash
cp env.template .env
# Edit .env with your configuration
```

3. **Start Development Server**
```bash
npm run dev
```

The service will be available at `http://localhost:3001`

### Docker Deployment

1. **Build and Run with Docker Compose**
```bash
docker-compose up -d
```

2. **Check Service Health**
```bash
curl http://localhost:3001/health
```

## API Endpoints

### Process Agent Request
```http
POST /api/agent/process
Content-Type: application/json

{
  "command": "chat",
  "projectId": "project-123",
  "userId": "user-456", 
  "message": "Explain this code",
  "context": {
    "filePath": "src/example.ts",
    "codeSnippet": "const hello = () => console.log('world');"
  }
}
```

### Stream Agent Response
```http
POST /api/agent/stream
Content-Type: application/json

# Same request format as /process
# Returns Server-Sent Events (SSE) stream
```

### Health Check
```http
GET /health
```

### Agent Capabilities
```http
GET /api/agent/capabilities
```

### Service Metrics
```http
GET /api/metrics
```

## Commands

The agent supports these command types:

- `chat` - General conversation and questions
- `summarize_project` - Project overview and analysis  
- `explain_function` - Function and code explanation
- `generate_tests` - Test case generation
- `analyze_code` - Code quality analysis

## Configuration

All configuration is done via environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `OPENAI_MODEL` | OpenAI model | `gpt-4o-mini` |
| `OPENAI_MAX_TOKENS` | Max tokens per request | `1000` |
| `RATE_LIMIT_MAX` | Requests per window | `100` |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window | `900000` (15min) |
| `AGENT_SERVICE_SECRET` | Service auth secret | Required |
| `ALLOWED_ORIGINS` | CORS origins | `http://localhost:3000` |

See `env.template` for complete configuration options.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web App       │───▶│  Agent Service  │───▶│   OpenAI API    │
│  (Next.js)      │    │  (Express)      │    │   (LangChain)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Database      │    │   Rate Limiter  │    │   Monitoring    │
│  (PostgreSQL)   │    │   (Memory)      │    │   (Metrics)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run start` - Start production server  
- `npm run test` - Run test suite
- `npm run lint` - Code linting

### Project Structure

```
src/
├── lib/
│   ├── agent.ts        # Core agent processing logic
│   ├── env.ts          # Environment configuration  
│   ├── logger.ts       # Structured logging
│   └── types.ts        # TypeScript definitions
└── index.ts            # Express server setup
```

## Deployment

### Production Deployment

1. **Configure Environment**
   - Set production environment variables
   - Configure database connection
   - Set up monitoring and logging

2. **Build Container**
```bash
docker build -t codemind-agent-core .
```

3. **Deploy with Docker Compose**
```bash
docker-compose -f docker-compose.yml up -d
```

4. **Scale Horizontally**
```bash
docker-compose up -d --scale agent-core=3
```

### Health Monitoring

The service includes comprehensive health checks:

- `/health` - Service health status
- `/api/metrics` - Performance metrics
- Container health checks
- Structured logging with Winston

### Security

- CORS protection with configurable origins
- Rate limiting with Express Rate Limit
- Security headers with Helmet
- Request validation with Zod
- Non-root container user

## Integration with Main App

The web application communicates with the agent service via HTTP:

```typescript
// In web app - agent service client
const response = await fetch('http://agent-service:3001/api/agent/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(agentRequest)
});
```

## Monitoring

Key metrics exposed at `/api/metrics`:

- Request count and response times
- Memory usage and CPU utilization  
- Active connections
- Error rates and types
- Agent execution statistics

## License

Part of the CodeMind project. See main repository for license information.
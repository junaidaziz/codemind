# OpenAI Cost Optimization Guide

## 🚨 Current Issues

1. **Expensive Model Usage**: Using `gpt-4o` in agent calls (most expensive model)
2. **Heavy RAG Implementation**: Multiple API calls per chat request
3. **Background Processing**: Embedding generation and job processors
4. **No Rate Limiting**: No built-in cost controls

## 💰 Cost Breakdown

| Model | Cost per 1M tokens | Usage in CodeMind |
|-------|-------------------|-------------------|
| gpt-4o | $2.50 input / $10.00 output | Agent calls (langchain-agent.ts) |
| gpt-4o-mini | $0.15 input / $0.60 output | Chat calls (langchain-rag.ts) |
| text-embedding-3-small | $0.02 per 1M tokens | All embeddings |

## 🛠️ Immediate Fixes

### 1. Switch Agent Model to gpt-4o-mini
```typescript
// In src/app/lib/langchain-agent.ts
const model = new ChatOpenAI({
  openAIApiKey: env.OPENAI_API_KEY,
  modelName: 'gpt-4o-mini', // Changed from gpt-4o
  temperature: 0.7,
  maxTokens: 1000, // Reduced from 2000
});
```

### 2. Add Usage Monitoring
```typescript
// Track token usage per request
interface TokenTracker {
  requestId: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: Date;
}
```

### 3. Implement Rate Limiting
```typescript
// Add to chat API route
const DAILY_TOKEN_LIMIT = 100000; // Adjust based on budget
const USER_HOURLY_LIMIT = 10000;
```

### 4. Optimize Embeddings
- Use smaller embedding models
- Cache embeddings to avoid regeneration
- Process in smaller batches

## 📊 Monitoring Setup

1. **Add token counting to all API calls**
2. **Create cost dashboard**
3. **Set up usage alerts**
4. **Implement daily/monthly limits**

## 🎯 Recommended Actions

1. **URGENT**: Switch gpt-4o to gpt-4o-mini in agent
2. **HIGH**: Add token usage tracking
3. **MEDIUM**: Implement rate limiting
4. **LOW**: Optimize embedding generation

## 💡 Long-term Optimization

1. **Local Models**: Consider using local models for development
2. **Caching**: Implement response caching for similar queries
3. **Batch Processing**: Combine multiple requests
4. **Smart Routing**: Use cheaper models for simple tasks
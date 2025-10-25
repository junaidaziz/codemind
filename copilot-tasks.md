# 🤖 CodeMind — Active Roadmap

> **Last Updated:** October 24, 2025  
> **Goal:** Build the best AI-powered code review and CI/CD automation platform.

---

## 🎯 ACTIVE ROADMAP (Completed items removed)

### **Current Focus: Feature #11 – Code Review Automation**
Priority: ⭐⭐⭐ CORE DIFFERENTIATOR | Effort (remaining): ~3 weeks

Delivered Foundation:
- Types, reviewer engine, risk scorer, storage layer, analyze API, GitHub PR webhook

Remaining High-Impact Tasks:
1. Persist review impact records (`CodeReviewImpact`) derived from critical/high findings
2. Implement GitHub comment posting for summary + inline critical issues
3. Add review simulation (affected components + dependency surface)
4. Integrate documentation/testing suggestions persistence & display
5. Add integration tests for analyze endpoint + webhook workflow
6. Build minimal UI: PR review list + detail view (risk + comments)
7. Add incremental re-analysis (only changed files) optimization
8. Implement caching & rate limiting for GitHub API calls

Secondary Enhancements:
- Parallel file analysis worker pool
- Configurable rule set (user overrides risk weights)
- Slack/Discord notification hook for completed reviews

### **Next Up: Feature #10 – CI/CD & DevOps Integration**
Early Scope (defer until Feature #11 core shipped):
- GitHub Actions integration: pre-merge AI check job
- Deployment event ingestion (Vercel) → summarize build & risk
- Post-deploy health scan & rollback suggestion draft

### **Future (Watchlist)**
Feature #9: VS Code Extension (trigger only after demand threshold)
Feature #15: Performance & Cost Optimization (activate post real usage metrics)

**Built with ❤️ by Junaid Aziz**

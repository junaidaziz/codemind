## Phase 2 Testing Guide: Dependency Graph System

This guide provides comprehensive testing procedures for the Dependency Graph System (Phase 2).

### Table of Contents
1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [API Endpoint Testing](#api-endpoint-testing)
4. [Package Manager Parser Testing](#package-manager-parser-testing)
5. [Graph Analysis Testing](#graph-analysis-testing)
6. [Integration Testing](#integration-testing)
7. [Known Limitations](#known-limitations)

---

### Prerequisites

Before testing, ensure:
- PostgreSQL database is running
- `GITHUB_TOKEN` environment variable is set
- At least one workspace created with repositories
- Node.js and pnpm installed

### Environment Setup

```bash
# Set GitHub token (required for API access)
export GITHUB_TOKEN="your_github_personal_access_token"

# Verify database connection
psql $DATABASE_URL -c "SELECT 1"

# Check workspace exists
psql $DATABASE_URL -c "SELECT id, name, repositories FROM \"Workspace\" LIMIT 1"
```

---

### API Endpoint Testing

#### Test 1: Build Dependency Graph (GET)

**Basic Graph Generation:**
```bash
curl -X GET "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies?userId={USER_ID}" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "nodes": [
    {
      "id": "owner/repo:package-name@1.0.0",
      "name": "package-name",
      "version": "1.0.0",
      "repository": "owner/repo",
      "packageManager": "npm",
      "dependencies": ["owner/repo:dep@1.0.0"],
      "dependents": []
    }
  ],
  "edges": [
    {
      "from": "owner/repo:root",
      "to": "owner/repo:package-name@1.0.0",
      "type": "direct",
      "versionConstraint": "1.0.0"
    }
  ],
  "metadata": {
    "workspaceId": "workspace-id",
    "generatedAt": "2025-10-21T...",
    "totalNodes": 10,
    "totalEdges": 15,
    "crossRepoLinks": 2
  }
}
```

**With Dev Dependencies:**
```bash
curl -X GET "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies?userId={USER_ID}&includeDevDeps=true" \
  -H "Content-Type: application/json"
```

**With All Options:**
```bash
curl -X GET "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies?userId={USER_ID}&includeDevDeps=true&includePeerDeps=true&includeTransitive=false&maxDepth=5" \
  -H "Content-Type: application/json"
```

#### Test 2: Cycle Detection (POST)

```bash
curl -X POST "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "analysisType": "cycles"
  }'
```

**Expected Response:**
```json
{
  "cycles": [
    {
      "nodes": ["A", "B", "C", "A"],
      "length": 3,
      "repositories": ["owner/repo1", "owner/repo2"],
      "severity": "high"
    }
  ]
}
```

**Severity Levels:**
- `high`: Cross-repository cycles (critical)
- `medium`: Long cycles (>5 nodes)
- `low`: Short same-repo cycles

#### Test 3: Cross-Repo Links (POST)

```bash
curl -X POST "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "analysisType": "cross-repo"
  }'
```

**Expected Response:**
```json
{
  "crossRepoLinks": [
    {
      "sourceRepo": "owner/repo1",
      "targetRepo": "owner/repo2",
      "dependencies": [
        {
          "from": "package-a",
          "to": "package-b",
          "version": "1.0.0"
        }
      ],
      "type": "direct"
    }
  ]
}
```

#### Test 4: Repository Metrics (POST)

```bash
curl -X POST "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "analysisType": "metrics"
  }'
```

**Expected Response:**
```json
{
  "metrics": [
    {
      "repository": "owner/repo1",
      "packageManager": "npm",
      "dependencyCount": 25,
      "dependentCount": 3,
      "crossRepoDependencies": 5,
      "cyclomaticComplexity": 12,
      "health": {
        "totalDependencies": 25,
        "directDependencies": 20,
        "devDependencies": 5,
        "outdatedCount": 0,
        "vulnerableCount": 0,
        "duplicateCount": 0,
        "averageDependencyDepth": 2.5,
        "maxDependencyDepth": 5
      }
    }
  ]
}
```

#### Test 5: Impact Analysis (POST)

```bash
curl -X POST "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "analysisType": "impact",
    "targetNodeId": "owner/repo:package@1.0.0"
  }'
```

**Expected Response:**
```json
{
  "impact": {
    "targetNode": "owner/repo:package@1.0.0",
    "directImpact": ["node1", "node2"],
    "transitiveImpact": ["node3", "node4", "node5"],
    "affectedRepositories": ["owner/repo1", "owner/repo2"],
    "impactScore": 45,
    "criticalPath": [
      ["target", "node1", "node3"],
      ["target", "node2", "node4"]
    ]
  }
}
```

#### Test 6: Duplicate Detection (POST)

```bash
curl -X POST "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "analysisType": "duplicates"
  }'
```

**Expected Response:**
```json
{
  "duplicates": [
    {
      "name": "react",
      "versions": [
        {"repository": "owner/repo1", "version": "18.0.0"},
        {"repository": "owner/repo2", "version": "17.0.0"}
      ]
    }
  ]
}
```

#### Test 7: Summary (POST)

```bash
curl -X POST "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "analysisType": "summary"
  }'
```

**Expected Response:**
```json
{
  "summary": {
    "totalRepositories": 5,
    "totalDependencies": 150,
    "crossRepoLinks": 12,
    "cycles": 2,
    "averageDependenciesPerRepo": 30,
    "mostDependedOn": [
      {"node": "react@18.0.0", "count": 15},
      {"node": "lodash@4.17.21", "count": 12}
    ],
    "mostDependent": [
      {"node": "main-app@1.0.0", "count": 25},
      {"node": "utils-lib@2.0.0", "count": 18}
    ]
  }
}
```

#### Test 8: Visualization Data (POST)

```bash
curl -X POST "http://localhost:3000/api/workspaces/{WORKSPACE_ID}/dependencies" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "USER_ID",
    "analysisType": "visualization"
  }'
```

**Expected Response:**
```json
{
  "visualization": {
    "nodes": [
      {
        "id": "node1",
        "label": "package@1.0.0",
        "group": "owner/repo1",
        "value": 5
      }
    ],
    "edges": [
      {
        "from": "node1",
        "to": "node2",
        "dashes": false
      }
    ]
  }
}
```

---

### Package Manager Parser Testing

#### Test 9: npm (package.json)

**Setup Test Repository:**
1. Create a test repository with `package.json`
2. Add to workspace
3. Run dependency graph

**Verify:**
- Dependencies parsed correctly
- DevDependencies separated
- PeerDependencies included (when enabled)
- Version constraints preserved

#### Test 10: Maven (pom.xml)

**Setup Test Repository:**
1. Create a test repository with `pom.xml`
2. Add to workspace
3. Run dependency graph

**Verify:**
- GroupId:ArtifactId format correct
- Test scope dependencies separated
- Version handling (including properties)

#### Test 11: Gradle (build.gradle)

**Setup Test Repository:**
1. Create a test repository with `build.gradle` or `build.gradle.kts`
2. Add to workspace
3. Run dependency graph

**Verify:**
- Implementation dependencies parsed
- TestImplementation separated
- Version-less dependencies get 'latest'

#### Test 12: Python (requirements.txt)

**Setup Test Repository:**
1. Create a test repository with `requirements.txt`
2. Add to workspace
3. Run dependency graph

**Verify:**
- Various version operators (==, >=, ~=)
- Comments ignored
- Packages without versions get 'latest'

---

### Graph Analysis Testing

#### Test 13: Cycle Detection Accuracy

**Create Test Scenario:**
```sql
-- Create workspace with circular dependencies
-- Package A depends on B
-- Package B depends on C
-- Package C depends on A
```

**Verify:**
- Cycle detected
- All nodes in cycle identified
- Severity correctly classified
- Cross-repo cycles marked as high severity

#### Test 14: Cross-Repo Link Detection

**Create Test Scenario:**
- Add multiple repositories to workspace
- Ensure some share dependencies
- Run cross-repo analysis

**Verify:**
- All cross-repo links found
- Dependencies grouped by repo pair
- Type (direct/transitive) correct

#### Test 15: Impact Analysis Accuracy

**Create Test Scenario:**
- Create dependency tree with known structure
- Select a node with multiple dependents
- Run impact analysis

**Verify:**
- Direct impact includes immediate dependents
- Transitive impact includes all affected nodes
- Impact score proportional to affected nodes
- Critical paths identified correctly

---

### Integration Testing

#### Test 16: End-to-End Workflow

**Scenario:**
1. Create workspace
2. Add multiple repositories (different package managers)
3. Build dependency graph
4. Run all analysis types
5. Verify data consistency

**Verification Checklist:**
- [ ] All repositories detected
- [ ] Package managers correctly identified
- [ ] Dependencies parsed for all repos
- [ ] Graph metadata correct
- [ ] Cross-repo links counted correctly
- [ ] All analysis types return valid data
- [ ] No errors in logs

#### Test 17: Large Workspace Performance

**Scenario:**
- Workspace with 10+ repositories
- Each with 20+ dependencies
- Run full analysis

**Metrics to Track:**
- Graph build time
- Analysis completion time
- Memory usage
- API response times

**Acceptable Performance:**
- Graph build: < 30 seconds
- Analysis: < 10 seconds per type
- API response: < 5 seconds

#### Test 18: Error Handling

**Test Cases:**
```bash
# Invalid workspace ID
curl -X GET "http://localhost:3000/api/workspaces/invalid/dependencies?userId=USER_ID"
# Expected: 404 Not Found

# Missing userId
curl -X GET "http://localhost:3000/api/workspaces/WORKSPACE_ID/dependencies"
# Expected: 400 Bad Request

# Invalid analysis type
curl -X POST "http://localhost:3000/api/workspaces/WORKSPACE_ID/dependencies" \
  -d '{"userId": "USER_ID", "analysisType": "invalid"}'
# Expected: 400 Bad Request

# Missing GITHUB_TOKEN
unset GITHUB_TOKEN
curl -X GET "http://localhost:3000/api/workspaces/WORKSPACE_ID/dependencies?userId=USER_ID"
# Expected: 400 Bad Request with token error
```

---

### Known Limitations

1. **Gradle Parsing**: Basic regex-based parsing may miss complex dependency declarations
2. **Transitive Dependencies**: Requires additional API calls, limited by GitHub rate limits
3. **Private Repositories**: Requires GitHub token with appropriate scopes
4. **Large Graphs**: May be slow for workspaces with 50+ repositories
5. **Package Manager Detection**: Checks root directory only, doesn't handle monorepos
6. **XML Parsing**: Maven pom.xml with complex inheritance may not parse fully
7. **Version Ranges**: Treated as strings, not resolved to actual versions

---

### SQL Verification Queries

```sql
-- Check workspace repositories
SELECT id, name, repositories::json 
FROM "Workspace" 
WHERE id = 'YOUR_WORKSPACE_ID';

-- Verify no duplicate workspaces
SELECT userId, COUNT(*) 
FROM "Workspace" 
GROUP BY userId 
HAVING COUNT(*) > 1;
```

---

### Troubleshooting

**Issue: "GitHub token not configured"**
- Solution: Set `GITHUB_TOKEN` environment variable
- Verify: `echo $GITHUB_TOKEN`

**Issue: "Workspace not found"**
- Check workspace ID is correct
- Verify userId matches workspace owner
- Check database: `SELECT * FROM "Workspace" WHERE id = 'ID'`

**Issue: Parser returns empty dependencies**
- Verify repository has dependency file in root
- Check file format is correct
- Review GitHub token permissions

**Issue: Slow graph generation**
- Reduce number of repositories
- Disable transitive dependencies
- Set lower maxDepth
- Check GitHub API rate limits

---

### Next Steps

After completing Phase 2 testing:
1. Document any issues found
2. Note performance metrics
3. Proceed to Phase 3: Cross-Repo Linking
4. Consider adding automated unit tests with proper Prisma mocking

---

**Testing Completed:** ___/___/___  
**Tester:** _______________  
**Issues Found:** _______________  
**Performance Notes:** _______________

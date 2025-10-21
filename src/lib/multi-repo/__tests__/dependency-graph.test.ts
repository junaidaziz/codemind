/**
 * Tests for Dependency Graph Manager
 * 
 * Tests dependency detection, parsing, and graph construction
 */

import { DependencyGraphManager, PackageManager } from '../dependency-graph';

// Mock Octokit
jest.mock('@octokit/rest', () => ({
  Octokit: jest.fn().mockImplementation(() => ({
    repos: {
      getContent: jest.fn(),
    },
  })),
}));

// Mock fast-xml-parser
jest.mock('fast-xml-parser', () => ({
  XMLParser: jest.fn().mockImplementation(() => ({
    parse: jest.fn(),
  })),
}));

describe('DependencyGraphManager', () => {
  let manager: DependencyGraphManager;
  let mockOctokit: any;

  beforeEach(() => {
    manager = new DependencyGraphManager('test-token');
    mockOctokit = (manager as any).octokit;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('detectPackageManager', () => {
    it('should detect npm from package.json', async () => {
      mockOctokit.repos.getContent
        .mockResolvedValueOnce({ data: { content: 'test' } });

      const result = await manager.detectPackageManager('owner', 'repo');
      
      expect(result).toBe(PackageManager.NPM);
      expect(mockOctokit.repos.getContent).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        path: 'package.json',
        ref: 'main',
      });
    });

    it('should detect Maven from pom.xml', async () => {
      mockOctokit.repos.getContent
        .mockRejectedValueOnce(new Error('Not found')) // package.json
        .mockResolvedValueOnce({ data: { content: 'test' } }); // pom.xml

      const result = await manager.detectPackageManager('owner', 'repo');
      
      expect(result).toBe(PackageManager.MAVEN);
    });

    it('should detect Gradle from build.gradle', async () => {
      mockOctokit.repos.getContent
        .mockRejectedValueOnce(new Error('Not found')) // package.json
        .mockRejectedValueOnce(new Error('Not found')) // pom.xml
        .mockResolvedValueOnce({ data: { content: 'test' } }); // build.gradle

      const result = await manager.detectPackageManager('owner', 'repo');
      
      expect(result).toBe(PackageManager.GRADLE);
    });

    it('should detect Python from requirements.txt', async () => {
      mockOctokit.repos.getContent
        .mockRejectedValueOnce(new Error('Not found')) // package.json
        .mockRejectedValueOnce(new Error('Not found')) // pom.xml
        .mockRejectedValueOnce(new Error('Not found')) // build.gradle
        .mockRejectedValueOnce(new Error('Not found')) // build.gradle.kts
        .mockResolvedValueOnce({ data: { content: 'test' } }); // requirements.txt

      const result = await manager.detectPackageManager('owner', 'repo');
      
      expect(result).toBe(PackageManager.PYTHON);
    });

    it('should return UNKNOWN when no package manager detected', async () => {
      mockOctokit.repos.getContent.mockRejectedValue(new Error('Not found'));

      const result = await manager.detectPackageManager('owner', 'repo');
      
      expect(result).toBe(PackageManager.UNKNOWN);
    });
  });

  describe('parseNpmDependencies', () => {
    it('should parse dependencies from package.json', async () => {
      const packageJson = {
        name: 'test-package',
        version: '1.0.0',
        dependencies: {
          'react': '^18.0.0',
          'lodash': '~4.17.21',
        },
        devDependencies: {
          'jest': '^29.0.0',
          'typescript': '^5.0.0',
        },
        peerDependencies: {
          'react-dom': '^18.0.0',
        },
      };

      const content = Buffer.from(JSON.stringify(packageJson)).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const result = await manager.parseNpmDependencies('owner', 'repo');

      expect(result.packageManager).toBe(PackageManager.NPM);
      expect(result.projectName).toBe('test-package');
      expect(result.projectVersion).toBe('1.0.0');
      expect(result.dependencies).toHaveLength(2);
      expect(result.devDependencies).toHaveLength(2);
      expect(result.peerDependencies).toHaveLength(1);
      
      expect(result.dependencies[0]).toMatchObject({
        name: 'react',
        version: '^18.0.0',
        type: 'direct',
        packageManager: PackageManager.NPM,
      });
    });

    it('should handle package.json without dependencies', async () => {
      const packageJson = {
        name: 'empty-package',
        version: '1.0.0',
      };

      const content = Buffer.from(JSON.stringify(packageJson)).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const result = await manager.parseNpmDependencies('owner', 'repo');

      expect(result.dependencies).toHaveLength(0);
      expect(result.devDependencies).toHaveLength(0);
    });

    it('should throw error for invalid package.json', async () => {
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content: Buffer.from('invalid json').toString('base64') },
      });

      await expect(manager.parseNpmDependencies('owner', 'repo')).rejects.toThrow();
    });
  });

  describe('parseMavenDependencies', () => {
    it('should parse dependencies from pom.xml', async () => {
      const pomXml = `
        <project>
          <artifactId>test-project</artifactId>
          <version>1.0.0</version>
          <dependencies>
            <dependency>
              <groupId>org.springframework.boot</groupId>
              <artifactId>spring-boot-starter</artifactId>
              <version>3.0.0</version>
            </dependency>
            <dependency>
              <groupId>junit</groupId>
              <artifactId>junit</artifactId>
              <version>4.13.2</version>
              <scope>test</scope>
            </dependency>
          </dependencies>
        </project>
      `;

      const content = Buffer.from(pomXml).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      // Mock XML parser
      const mockXmlParser = (manager as any).xmlParser;
      mockXmlParser.parse.mockReturnValueOnce({
        project: {
          artifactId: 'test-project',
          version: '1.0.0',
          dependencies: {
            dependency: [
              {
                groupId: 'org.springframework.boot',
                artifactId: 'spring-boot-starter',
                version: '3.0.0',
              },
              {
                groupId: 'junit',
                artifactId: 'junit',
                version: '4.13.2',
                scope: 'test',
              },
            ],
          },
        },
      });

      const result = await manager.parseMavenDependencies('owner', 'repo');

      expect(result.packageManager).toBe(PackageManager.MAVEN);
      expect(result.projectName).toBe('test-project');
      expect(result.projectVersion).toBe('1.0.0');
      expect(result.dependencies).toHaveLength(1);
      expect(result.devDependencies).toHaveLength(1);
      
      expect(result.dependencies[0].name).toBe('org.springframework.boot:spring-boot-starter');
      expect(result.devDependencies[0].scope).toBe('test');
    });

    it('should handle single dependency', async () => {
      const content = Buffer.from('<project></project>').toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const mockXmlParser = (manager as any).xmlParser;
      mockXmlParser.parse.mockReturnValueOnce({
        project: {
          dependencies: {
            dependency: {
              groupId: 'junit',
              artifactId: 'junit',
              version: '4.13.2',
            },
          },
        },
      });

      const result = await manager.parseMavenDependencies('owner', 'repo');

      expect(result.dependencies).toHaveLength(1);
    });
  });

  describe('parseGradleDependencies', () => {
    it('should parse dependencies from build.gradle', async () => {
      const buildGradle = `
        dependencies {
          implementation 'org.springframework.boot:spring-boot-starter:3.0.0'
          compile 'com.google.guava:guava:31.0-jre'
          testImplementation 'junit:junit:4.13.2'
          testCompile 'org.mockito:mockito-core:4.0.0'
        }
      `;

      const content = Buffer.from(buildGradle).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const result = await manager.parseGradleDependencies('owner', 'repo');

      expect(result.packageManager).toBe(PackageManager.GRADLE);
      expect(result.dependencies.length).toBeGreaterThan(0);
      expect(result.devDependencies.length).toBeGreaterThan(0);
    });

    it('should fallback to build.gradle.kts', async () => {
      const buildGradleKts = `
        dependencies {
          implementation("org.springframework.boot:spring-boot-starter:3.0.0")
        }
      `;

      const content = Buffer.from(buildGradleKts).toString('base64');
      mockOctokit.repos.getContent
        .mockRejectedValueOnce(new Error('Not found')) // build.gradle
        .mockResolvedValueOnce({ data: { content } }); // build.gradle.kts

      const result = await manager.parseGradleDependencies('owner', 'repo');

      expect(result.packageManager).toBe(PackageManager.GRADLE);
    });

    it('should handle dependencies without version', async () => {
      const buildGradle = `
        dependencies {
          implementation 'org.springframework.boot:spring-boot-starter'
        }
      `;

      const content = Buffer.from(buildGradle).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const result = await manager.parseGradleDependencies('owner', 'repo');

      expect(result.dependencies[0]?.version).toBe('latest');
    });
  });

  describe('parsePythonDependencies', () => {
    it('should parse dependencies from requirements.txt', async () => {
      const requirements = `
        Django==4.2.0
        requests>=2.28.0
        pytest~=7.3.0
        # This is a comment
        flask
      `;

      const content = Buffer.from(requirements).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const result = await manager.parsePythonDependencies('owner', 'repo');

      expect(result.packageManager).toBe(PackageManager.PYTHON);
      expect(result.dependencies).toHaveLength(4);
      
      expect(result.dependencies[0]).toMatchObject({
        name: 'Django',
        version: '4.2.0',
        type: 'direct',
      });
      
      expect(result.dependencies[3]).toMatchObject({
        name: 'flask',
        version: 'latest',
      });
    });

    it('should skip comments and empty lines', async () => {
      const requirements = `
        # Comment line
        
        Django==4.2.0
        
        # Another comment
      `;

      const content = Buffer.from(requirements).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const result = await manager.parsePythonDependencies('owner', 'repo');

      expect(result.dependencies).toHaveLength(1);
    });
  });

  describe('parseDependencies', () => {
    it('should route to correct parser based on detected package manager', async () => {
      // Mock detectPackageManager to return NPM
      jest.spyOn(manager, 'detectPackageManager').mockResolvedValueOnce(PackageManager.NPM);
      
      const packageJson = { name: 'test', version: '1.0.0' };
      const content = Buffer.from(JSON.stringify(packageJson)).toString('base64');
      mockOctokit.repos.getContent.mockResolvedValueOnce({
        data: { content },
      });

      const result = await manager.parseDependencies('owner', 'repo');

      expect(result.packageManager).toBe(PackageManager.NPM);
    });

    it('should return empty for unknown package manager', async () => {
      jest.spyOn(manager, 'detectPackageManager').mockResolvedValueOnce(PackageManager.UNKNOWN);

      const result = await manager.parseDependencies('owner', 'repo');

      expect(result.packageManager).toBe(PackageManager.UNKNOWN);
      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build graph for multiple repositories', async () => {
      const repositories = [
        { owner: 'test', name: 'repo1', defaultBranch: 'main' },
        { owner: 'test', name: 'repo2', defaultBranch: 'main' },
      ];

      // Mock parseDependencies for both repos
      jest.spyOn(manager, 'parseDependencies')
        .mockResolvedValueOnce({
          packageManager: PackageManager.NPM,
          projectName: 'repo1',
          projectVersion: '1.0.0',
          dependencies: [
            {
              name: 'react',
              version: '^18.0.0',
              type: 'direct',
              packageManager: PackageManager.NPM,
              repository: 'test/repo1',
            },
          ],
          devDependencies: [],
        })
        .mockResolvedValueOnce({
          packageManager: PackageManager.NPM,
          projectName: 'repo2',
          projectVersion: '1.0.0',
          dependencies: [
            {
              name: 'lodash',
              version: '^4.17.21',
              type: 'direct',
              packageManager: PackageManager.NPM,
              repository: 'test/repo2',
            },
          ],
          devDependencies: [],
        });

      const graph = await manager.buildDependencyGraph('workspace-1', repositories);

      expect(graph.nodes.size).toBeGreaterThan(0);
      expect(graph.edges.length).toBeGreaterThan(0);
      expect(graph.metadata.workspaceId).toBe('workspace-1');
      expect(graph.metadata.totalNodes).toBe(graph.nodes.size);
      expect(graph.metadata.totalEdges).toBe(graph.edges.length);
    });

    it('should handle cross-repo dependencies', async () => {
      const repositories = [
        { owner: 'test', name: 'repo1' },
        { owner: 'test', name: 'repo2' },
      ];

      jest.spyOn(manager, 'parseDependencies')
        .mockResolvedValueOnce({
          packageManager: PackageManager.NPM,
          projectName: 'repo1',
          projectVersion: '1.0.0',
          dependencies: [
            {
              name: 'shared-lib',
              version: '1.0.0',
              type: 'direct',
              packageManager: PackageManager.NPM,
              repository: 'test/repo2', // Cross-repo dependency
            },
          ],
          devDependencies: [],
        })
        .mockResolvedValueOnce({
          packageManager: PackageManager.NPM,
          projectName: 'shared-lib',
          projectVersion: '1.0.0',
          dependencies: [],
          devDependencies: [],
        });

      const graph = await manager.buildDependencyGraph('workspace-1', repositories);

      expect(graph.metadata.crossRepoLinks).toBeGreaterThan(0);
    });

    it('should respect includeDevDependencies config', async () => {
      const repositories = [{ owner: 'test', name: 'repo1' }];

      jest.spyOn(manager, 'parseDependencies').mockResolvedValueOnce({
        packageManager: PackageManager.NPM,
        projectName: 'repo1',
        projectVersion: '1.0.0',
        dependencies: [],
        devDependencies: [
          {
            name: 'jest',
            version: '^29.0.0',
            type: 'dev',
            packageManager: PackageManager.NPM,
            repository: 'test/repo1',
          },
        ],
      });

      const graphWithDev = await manager.buildDependencyGraph(
        'workspace-1',
        repositories,
        { includeDevDependencies: true }
      );

      expect(graphWithDev.edges.some(e => e.type === 'dev')).toBe(true);
    });

    it('should handle errors gracefully', async () => {
      const repositories = [
        { owner: 'test', name: 'repo1' },
        { owner: 'test', name: 'repo2' },
      ];

      jest.spyOn(manager, 'parseDependencies')
        .mockRejectedValueOnce(new Error('Parse error'))
        .mockResolvedValueOnce({
          packageManager: PackageManager.NPM,
          projectName: 'repo2',
          projectVersion: '1.0.0',
          dependencies: [],
          devDependencies: [],
        });

      // Should not throw, just continue with successful repos
      const graph = await manager.buildDependencyGraph('workspace-1', repositories);

      expect(graph.nodes.size).toBeGreaterThan(0);
    });
  });
});

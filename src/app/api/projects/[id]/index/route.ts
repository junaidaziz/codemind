import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { Octokit } from "@octokit/rest";
import { chunkCodeFile } from "@/lib/chunking";
import { embedTexts } from "@/lib/embeddings";
import { insertEmbeddingsBatch } from "@/lib/db-utils";
import { 
  createApiError,
  createApiSuccess
} from "../../../../../types";
import { z } from 'zod';

// Params validation schema
const IndexProjectParamsSchema = z.object({
  id: z.string().uuid("Invalid project ID format"),
});

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const params = await context.params;
    
    // Validate params
    const { id } = IndexProjectParamsSchema.parse(params);
    const project = await prisma.project.findUnique({ where: { id } });

    if (!project) {
      return NextResponse.json(
        createApiError("Project not found", "RESOURCE_NOT_FOUND"), 
        { status: 404 }
      );
    }

    // 🟡 Set project status to "indexing"
    await prisma.project.update({
      where: { id },
      data: { status: "indexing" }
    });

    const octokit = new Octokit();
    const repoPath = project.githubUrl.replace("https://github.com/", "");
    const [owner, repo] = repoPath.split("/");

    // ✅ Fetch repo tree (recursive)
    const { data: tree } = await octokit.git.getTree({
      owner,
      repo,
      tree_sha: project.defaultBranch,
      recursive: "true"
    });

  // Define the type for tree items
  interface TreeItem {
    path?: string;
    type?: string;
    sha?: string;
    size?: number;
  }

  // ✅ Filter only code files
  const codeFiles = tree.tree.filter(
    (f: TreeItem) =>
      f.type === "blob" &&
      f.path !== undefined &&
      /\.(ts|js|tsx|jsx|py|rb|go|java|cs|php|vue)$/.test(f.path)
  );

  const allChunks: {
    path: string;
    content: string;
    startLine: number;
    endLine: number;
  }[] = [];

  // ✅ Fetch file contents and chunk
  for (const file of codeFiles.slice(0, 10)) {
    try {
      const { data: fileData } = await octokit.repos.getContent({
        owner,
        repo,
        path: file.path!
      });

      if ("content" in fileData && fileData.content) {
        const content = Buffer.from(fileData.content, "base64").toString(
          "utf8"
        );
        const chunkingResult = chunkCodeFile(content, file.path!);
        allChunks.push(...chunkingResult.chunks);
      }
    } catch (err) {
      console.warn(`Skipping ${file.path} due to fetch error:`, err);
    }
  }

    if (!allChunks.length) {
      await prisma.project.update({
        where: { id },
        data: { status: "error" }
      });
      return NextResponse.json(
        createApiError("No valid code files found", "VALIDATION_ERROR"),
        { status: 400 }
      );
    }

    // ✅ Generate embeddings
    const embeddings = await embedTexts(allChunks.map(c => c.content));

    // ✅ Prepare and batch insert
    const preparedChunks = allChunks.map((c, i) => ({
      path: c.path,
      language: "ts",
      startLine: c.startLine,
      endLine: c.endLine,
      content: c.content,
      tokenCount: 0,
      embedding: embeddings[i]
    }));

    await insertEmbeddingsBatch(project.id, preparedChunks);

    // ✅ Update project status
    await prisma.project.update({
      where: { id },
      data: { status: "ready", lastIndexedAt: new Date() }
    });

    return NextResponse.json(createApiSuccess({
      status: "ready",
      chunks: allChunks.length
    }));
  } catch (error) {
    console.error("Error indexing project:", error);
    
    if (error instanceof z.ZodError) {
      const details = error.issues.reduce((acc, issue) => {
        const path = issue.path.join('.');
        if (!acc[path]) acc[path] = [];
        acc[path].push(issue.message);
        return acc;
      }, {} as Record<string, string[]>);
      
      return NextResponse.json(
        createApiError("Invalid request parameters", "VALIDATION_ERROR", details),
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      createApiError("Failed to index project", "INTERNAL_ERROR"),
      { status: 500 }
    );
  }
}

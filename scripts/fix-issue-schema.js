#!/usr/bin/env node

/**
 * Script to fix missing AI fields in Issue table
 * This runs the SQL migration directly against the database
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🔧 Fixing Issue table schema...');
  
  try {
    // Add AI fields to Issue table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Issue"
        ADD COLUMN IF NOT EXISTS "aiAnalyzed" BOOLEAN NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS "aiAnalyzedAt" TIMESTAMP(3),
        ADD COLUMN IF NOT EXISTS "aiSummary" TEXT,
        ADD COLUMN IF NOT EXISTS "aiFixPrUrl" TEXT;
    `);
    
    console.log('✅ Added AI fields to Issue table');
    
    // Add index for faster queries
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "Issue_aiAnalyzed_idx" ON "Issue"("aiAnalyzed");
    `);
    
    console.log('✅ Added index on aiAnalyzed column');
    
    // Verify the columns exist
    const result = await prisma.$queryRawUnsafe(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'Issue'
        AND column_name IN ('aiAnalyzed', 'aiAnalyzedAt', 'aiSummary', 'aiFixPrUrl')
      ORDER BY column_name;
    `);
    
    console.log('\n📊 Verified columns:');
    console.table(result);
    
    // Count issues
    const issueCount = await prisma.issue.count();
    console.log(`\n✅ Total issues in database: ${issueCount}`);
    
    // Test query
    const testIssues = await prisma.issue.findMany({
      select: {
        id: true,
        number: true,
        title: true,
        aiAnalyzed: true,
      },
      take: 3,
    });
    
    console.log('\n✅ Sample issues with AI fields:');
    console.table(testIssues);
    
    console.log('\n✅ Schema fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error fixing schema:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();

#!/usr/bin/env node

/**
 * Database Connection Test
 * Tests the DATABASE_URL connection to Supabase
 */

const { PrismaClient } = require('@prisma/client');

async function testDatabaseConnection() {
  const prisma = new PrismaClient({
    log: ['query', 'info', 'warn', 'error'],
  });

  try {
    console.log('🔍 Testing database connection...');
    console.log('📍 Database URL:', process.env.DATABASE_URL?.replace(/:[^:@]*@/, ':***@') || 'NOT SET');
    
    // Test basic connection
    await prisma.$connect();
    console.log('✅ Successfully connected to database');

    // Test query execution
    const result = await prisma.$queryRaw`SELECT NOW() as current_time, version() as pg_version`;
    console.log('✅ Query execution successful:', result[0]);

    // Test pgvector extension
    try {
      const extensions = await prisma.$queryRaw`SELECT * FROM pg_extension WHERE extname = 'vector'`;
      if (extensions.length > 0) {
        console.log('✅ pgvector extension is installed');
      } else {
        console.log('⚠️  pgvector extension not found');
      }
    } catch (error) {
      console.log('⚠️  Could not check pgvector extension:', error.message);
    }

    // Test table existence
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    console.log('📋 Available tables:', tables.map(t => t.table_name));

    // Test project table specifically
    try {
      const projectCount = await prisma.project.count();
      console.log(`✅ Project table accessible - ${projectCount} projects found`);
    } catch (error) {
      console.log('❌ Error accessing project table:', error.message);
    }

  } catch (error) {
    console.error('❌ Database connection failed:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    
    if (error.message.includes("Can't reach database server")) {
      console.log('\n🔧 Troubleshooting tips:');
      console.log('1. Check if Supabase project is active');
      console.log('2. Verify database credentials');
      console.log('3. Check network connectivity');
      console.log('4. Ensure database is not paused');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the test
testDatabaseConnection().catch(console.error);
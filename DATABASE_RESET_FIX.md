# Database Reset Recovery Script

## Issue
After resetting the database, the application fails because:
1. The `vector` extension is not enabled
2. The `User.role` column is missing from the schema

## Quick Fix

### Option 1: Run SQL Commands in Supabase Dashboard

Go to your Supabase project → SQL Editor and run:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add role column to User table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'role'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
    END IF;
END $$;
```

### Option 2: Manual Database Migration

1. Enable vector extension in Supabase:
   - Go to Database → Extensions
   - Search for "vector" and enable it

2. Run Prisma migration:
   ```bash
   npx prisma db push
   ```

## Application Behavior

The application now handles database schema mismatches gracefully:

- ✅ **Missing role column**: Uses default 'user' role
- ✅ **User not found**: Signs out gracefully 
- ✅ **Database errors**: Shows helpful messages
- ✅ **Invalid sessions**: Automatic cleanup

## Testing

After fixing the database:
1. Refresh the page with the stale URL
2. The application should work normally
3. If still seeing issues, sign out and sign in again

The improved error handling ensures the app won't crash even if database issues persist.
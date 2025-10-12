# 🚀 IMMEDIATE FIX - Run These SQL Commands

## ⚡ Quick Solution (2 minutes)

**Go to your Supabase Dashboard → SQL Editor and paste this:**

```sql
-- 1. Enable vector extension (required for embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add missing role column to User table
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'User' AND column_name = 'role'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';
        RAISE NOTICE 'Added role column to User table';
    ELSE 
        RAISE NOTICE 'Role column already exists';
    END IF;
END $$;

-- 3. Verify the fix worked
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'User' AND column_name = 'role';
```

## ✅ What This Does

1. **Enables vector extension** - Required for AI embeddings
2. **Adds role column** - Fixes the "column does not exist" error
3. **Sets default value** - All existing users get 'user' role
4. **Verifies success** - Shows you the column was created

## 🧪 Test It Works

After running the SQL:

1. **Refresh your browser** on `http://localhost:3000/chat?project=cmgmjqgks0003xoyk4pdoyg3n`
2. **No more 500 errors** - The API will work normally
3. **Try creating a project** - Should work without issues

## 🎯 Why This Is The Best Solution

- ✅ **Instant fix** - Takes 30 seconds to run
- ✅ **Safe operation** - Won't delete any data
- ✅ **Handles existing users** - Everyone gets default 'user' role
- ✅ **Future-proof** - App now handles schema issues gracefully

The enhanced error handling we added ensures this won't happen again even if you reset the database in the future!

---

**🔥 Run the SQL commands above and your app will be working in under 1 minute!**
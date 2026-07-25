SELECT column_name, is_nullable
FROM information_schema.columns
WHERE table_name = 'LoginTransfer'
ORDER BY ordinal_position;

SELECT migration_name, finished_at, rolled_back_at
FROM "_prisma_migrations"
WHERE migration_name LIKE '%login_transfer%'
ORDER BY started_at;

SET @migration_sql = IF(
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'jackpot' AND column_name = 'countStartedAt') = 0,
    'ALTER TABLE jackpot ADD COLUMN countStartedAt DATETIME NULL AFTER createdAt',
    'SELECT 1'
);
PREPARE migration_statement FROM @migration_sql;
EXECUTE migration_statement;
DEALLOCATE PREPARE migration_statement;

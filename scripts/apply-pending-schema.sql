-- Run in Supabase → SQL Editor when production shows "Database schema is out of date".
-- Matches Alembic revisions 002_account_credit_limit and 003_transaction_transfer_fee.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18, 2);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transfer_fee NUMERIC(18, 2) NOT NULL DEFAULT 0;

-- Sync Alembic version (create table if this is a fresh DB without alembic)
CREATE TABLE IF NOT EXISTS alembic_version (
  version_num VARCHAR(32) NOT NULL PRIMARY KEY
);

UPDATE alembic_version
SET version_num = '003_transaction_transfer_fee'
WHERE version_num IS NOT NULL;

INSERT INTO alembic_version (version_num)
SELECT '003_transaction_transfer_fee'
WHERE NOT EXISTS (SELECT 1 FROM alembic_version);

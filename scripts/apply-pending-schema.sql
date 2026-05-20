-- Run in Supabase → SQL Editor if `npm run db:migrate` cannot reach the DB.
-- Matches Alembic revisions 002_account_credit_limit and 003_transaction_transfer_fee.

ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(18, 2);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transfer_fee NUMERIC(18, 2) NOT NULL DEFAULT 0;

-- Keep Alembic in sync (single row in alembic_version)
UPDATE alembic_version
SET version_num = '003_transaction_transfer_fee'
WHERE version_num IS DISTINCT FROM '003_transaction_transfer_fee';

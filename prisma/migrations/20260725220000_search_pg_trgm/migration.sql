CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "UserCategory_title_trgm_idx"
  ON "UserCategory" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "UserCounterparty_name_trgm_idx"
  ON "UserCounterparty" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Transaction_title_trgm_idx"
  ON "Transaction" USING GIN ("title" gin_trgm_ops);

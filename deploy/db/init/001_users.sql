-- PropCount initial schema (расширяется миграциями API)
-- Выполняется один раз при первом старте тома Postgres

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('landlord', 'tenant')),
  inn           TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);
CREATE INDEX IF NOT EXISTS users_inn_idx ON users (inn) WHERE inn IS NOT NULL;

COMMENT ON TABLE users IS 'Аккаунты: арендодатель / арендатор. ИНН обязателен для tenant.';

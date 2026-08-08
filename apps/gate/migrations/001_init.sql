CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE receipt_status AS ENUM ('PENDING', 'COMMITTED', 'FAILED', 'UNKNOWN');

CREATE TABLE receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant text NOT NULL DEFAULT 'default',
  idempotency_key text NOT NULL,
  fingerprint text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  status receipt_status NOT NULL DEFAULT 'PENDING',
  upstream_status int,
  response_headers jsonb,
  response_body bytea,
  response_truncated boolean NOT NULL DEFAULT false,
  attempt_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  execution_deadline timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  resolution_note text,
  CONSTRAINT uq_key UNIQUE (tenant, idempotency_key)
);
CREATE INDEX idx_receipts_status ON receipts(status);
CREATE INDEX idx_receipts_created ON receipts(created_at DESC);

CREATE TABLE events (
  id bigserial PRIMARY KEY,
  receipt_id uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_events_created ON events(created_at DESC);

CREATE SCHEMA IF NOT EXISTS demo;
CREATE TABLE demo.charges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount integer NOT NULL,
  currency text NOT NULL,
  card_last4 text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

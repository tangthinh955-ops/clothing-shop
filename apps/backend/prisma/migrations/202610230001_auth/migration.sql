CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');
CREATE TYPE "TokenKind" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

CREATE TABLE "users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(254) NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
  "emailVerifiedAt" TIMESTAMPTZ(6),
  "disabledAt" TIMESTAMPTZ(6),
  "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "users_email_normalized" CHECK ("email" = lower(btrim("email"))),
  CONSTRAINT "users_session_version_nonnegative" CHECK ("sessionVersion" >= 0)
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "auth_tokens" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "kind" "TokenKind" NOT NULL,
  "expiresAt" TIMESTAMPTZ(6) NOT NULL,
  "usedAt" TIMESTAMPTZ(6),
  "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");
CREATE INDEX "auth_tokens_userId_kind_idx" ON "auth_tokens"("userId", "kind");
CREATE INDEX "auth_tokens_expiresAt_idx" ON "auth_tokens"("expiresAt");

CREATE TABLE "sessions" (
  "sid" VARCHAR(255) NOT NULL,
  "sess" JSONB NOT NULL,
  "expire" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "sessions_pkey" PRIMARY KEY ("sid")
);
CREATE INDEX "sessions_expire_idx" ON "sessions"("expire");

#!/bin/sh
set -e

echo "=== Pushing database schema ==="
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')"
npx prisma db push --skip-generate --accept-data-loss 2>&1 || {
  echo "WARNING: db push failed, retrying in 5s..."
  sleep 5
  npx prisma db push --skip-generate --accept-data-loss 2>&1 || echo "WARNING: db push failed again. Tables may need manual setup."
}

echo "=== Running seed ==="
echo "ADMIN_EMAIL is set: $([ -n "$ADMIN_EMAIL" ] && echo 'YES' || echo 'NO')"
node prisma/seed.mjs 2>&1 || echo "WARNING: Seed failed (admin may already exist)"

echo "=== Starting application ==="
node server.js

#!/bin/sh
set -e

echo "=== Database connection diagnostic ==="
echo "DATABASE_URL is set: $([ -n "$DATABASE_URL" ] && echo 'YES' || echo 'NO')"
# Print URL without password
echo "DATABASE_URL (masked): $(echo $DATABASE_URL | sed 's|://[^:]*:[^@]*@|://***:***@|')"

# Test raw TCP connection first
DB_HOST=$(echo $DATABASE_URL | sed 's|.*@\([^:]*\):.*|\1|')
DB_PORT=$(echo $DATABASE_URL | sed 's|.*:\([0-9]*\)/.*|\1|')
echo "Testing TCP connection to $DB_HOST:$DB_PORT..."
if nc -z -w5 $DB_HOST $DB_PORT 2>/dev/null; then
  echo "TCP connection OK"
else
  echo "TCP connection FAILED - database not reachable"
fi

# Test pg connection with node
echo "Testing PostgreSQL authentication..."
node -e "
const pg = require('pg');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => { console.log('PostgreSQL connection OK'); return client.query('SELECT current_user, current_database()'); })
  .then(r => { console.log('Connected as:', r.rows[0].current_user, 'to db:', r.rows[0].current_database); client.end(); })
  .catch(e => { console.error('PostgreSQL connection FAILED:', e.message); process.exit(0); });
" 2>&1

echo "=== Pushing database schema ==="
npx prisma db push --accept-data-loss 2>&1 || {
  echo "WARNING: db push failed, retrying in 5s..."
  sleep 5
  npx prisma db push --accept-data-loss 2>&1 || echo "WARNING: db push failed again."
}

echo "=== Running seed ==="
echo "ADMIN_EMAIL is set: $([ -n "$ADMIN_EMAIL" ] && echo 'YES' || echo 'NO')"
node prisma/seed.mjs 2>&1 || echo "WARNING: Seed failed (admin may already exist)"

echo "=== Checking Chrome for WhatsApp ==="
if [ -d "/app/.cache/puppeteer" ]; then
  echo "Puppeteer Chrome cache found at /app/.cache/puppeteer"
  find /app/.cache/puppeteer -name "chrome" -type f 2>/dev/null | head -1 | while read p; do
    echo "Chrome binary: $p"
  done
else
  echo "WARNING: Puppeteer Chrome cache not found - WhatsApp integration may not work"
fi

# Clear stale WhatsApp Web cache (prevents "ready" event from not firing)
if [ -d "/app/.wwebjs_auth" ]; then
  echo "=== Clearing WhatsApp Web cache ==="
  find /app/.wwebjs_auth -name "Default" -type d -exec rm -rf {}/Service\ Worker {}/Cache {}/Code\ Cache \; 2>/dev/null || true
fi

echo "=== Starting application ==="
node server.js

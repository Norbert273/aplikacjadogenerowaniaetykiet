#!/bin/sh
echo "Running database migrations..."
npx prisma migrate deploy 2>/dev/null || echo "Migrations skipped (may need manual setup)"

echo "Running seed..."
npx tsx prisma/seed.ts 2>/dev/null || echo "Seed skipped"

echo "Starting application..."
node server.js

FROM node:20-slim AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# Let Puppeteer download its own compatible Chrome
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
RUN npm ci --ignore-scripts
RUN npx prisma generate
# Download Puppeteer's compatible Chrome binary
RUN npx puppeteer browsers install chrome

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated ./src/generated
COPY . .
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install only the shared libraries Chrome needs (not system chromium itself)
RUN apt-get update && apt-get install -y --no-install-recommends \
    fonts-liberation \
    fonts-noto-color-emoji \
    netcat-openbsd \
    ca-certificates \
    libglib2.0-0 \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --create-home --home-dir /home/nextjs -g nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

# Copy all node_modules for prisma db push + seed
COPY --from=deps /app/node_modules ./node_modules
# Copy Puppeteer's downloaded Chrome binary
COPY --from=deps /app/.cache/puppeteer /app/.cache/puppeteer
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer

COPY prisma/seed.mjs ./prisma/seed.mjs
COPY start.sh ./start.sh

RUN chmod +x ./start.sh

# Fix permissions: nextjs user needs write access
RUN mkdir -p /app/.wwebjs_auth && \
    chown -R nextjs:nodejs /app/.wwebjs_auth /app/node_modules/@prisma /app/.cache

# Crashpad fix: point XDG dirs to writable /tmp
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Force rebuild v4 - puppeteer bundled chrome

CMD ["./start.sh"]

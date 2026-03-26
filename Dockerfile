FROM node:20-slim AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN npm ci --ignore-scripts
RUN npx prisma generate

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
ENV PUPPETEER_SKIP_DOWNLOAD=true
# Install Chromium and dependencies for whatsapp-web.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto-color-emoji \
    netcat-openbsd \
    ca-certificates \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libasound2 \
    libcups2 \
    libdrm2 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libpango-1.0-0 \
    dbus \
    && rm -rf /var/lib/apt/lists/*

# Neutralize chrome_crashpad_handler - replace with /bin/true so it exits 0
RUN for f in $(find /usr -name 'chrome_crashpad_handler' -o -name 'chrome-crashpad-handler' 2>/dev/null); do \
      mv "$f" "${f}.bak" && ln -s /bin/true "$f"; \
    done; true

# Set Chromium path - debian slim uses /usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --create-home --home-dir /home/nextjs -g nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src/generated ./src/generated
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json

# Copy all node_modules for prisma db push + seed (prisma CLI has many transitive deps)
COPY --from=deps /app/node_modules ./node_modules
COPY prisma/seed.mjs ./prisma/seed.mjs
COPY start.sh ./start.sh

RUN chmod +x ./start.sh

# Fix permissions: nextjs user needs write access
RUN mkdir -p /app/.wwebjs_auth && \
    chown -R nextjs:nodejs /app/.wwebjs_auth /app/node_modules/@prisma

# Fix chrome_crashpad_handler: point XDG dirs to writable /tmp
# This is the actual fix - crashpad needs a writable dir for its database
ENV XDG_CONFIG_HOME=/tmp/.chromium
ENV XDG_CACHE_HOME=/tmp/.chromium

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
# Force rebuild v3 - whatsapp-web.js migration

CMD ["./start.sh"]

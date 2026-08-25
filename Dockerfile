FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# postinstall copies pdf.js worker; script must exist before npm ci.
COPY scripts/copy-pdf-worker.js ./scripts/copy-pdf-worker.js
# postinstall runs `prisma generate`; schema + placeholder URL must exist.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# NEXT_PUBLIC_* must be present at build time to be inlined into the client bundle.
ARG NEXT_PUBLIC_DEFAULT_CURRENCIES=RUB,USD,EUR
ARG NEXT_PUBLIC_APP_NAME=PayTracker
ARG NEXT_PUBLIC_YANDEX_MAPS_API_KEY=
ENV NEXT_PUBLIC_DEFAULT_CURRENCIES=${NEXT_PUBLIC_DEFAULT_CURRENCIES}
ENV NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME}
ENV NEXT_PUBLIC_YANDEX_MAPS_API_KEY=${NEXT_PUBLIC_YANDEX_MAPS_API_KEY}
# Placeholder URL: prisma.config.ts requires DATABASE_URL, but `generate`
# never connects. The real URL is injected at runtime.
ENV DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder
# Worker is gitignored — regenerate into public for the image.
RUN node scripts/copy-pdf-worker.js
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN apk add --no-cache openssl
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY scripts/app-entrypoint.sh ./app-entrypoint.sh
COPY --from=builder /app/scripts/fetch-exchange-rates.ts ./scripts/fetch-exchange-rates.ts
COPY --from=builder /app/tsconfig.json ./tsconfig.json
RUN chmod +x ./app-entrypoint.sh \
  && test -x node_modules/.bin/tsx
EXPOSE 3000
ENTRYPOINT ["/bin/sh", "./app-entrypoint.sh"]

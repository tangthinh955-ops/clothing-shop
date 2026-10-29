# syntax=docker/dockerfile:1
FROM node:24.22.1-bookworm-slim AS base
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /app
ENV NODE_OPTIONS=--max-old-space-size=512

COPY package.json package-lock.json .npmrc ./
COPY apps/backend/package.json ./apps/backend/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
RUN npm ci --include=dev --no-audit --no-fund

COPY tsconfig.base.json ./
COPY apps/backend/tsconfig.json apps/backend/prisma.config.ts ./apps/backend/
COPY apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/src ./apps/backend/src
COPY apps/frontend/tsconfig.json apps/frontend/vite.config.ts apps/frontend/index.html ./apps/frontend/
COPY apps/frontend/src ./apps/frontend/src
RUN npm run db:generate && npm run build

# One-shot migration runner. The API image does not run migrations on startup.
FROM build AS migrate
WORKDIR /app/apps/backend
CMD ["node", "../../node_modules/prisma/build/index.js", "migrate", "deploy"]

FROM build AS production-dependencies
RUN npm prune --omit=dev --no-audit --no-fund

FROM base AS api
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build --chown=node:node /app/apps/backend/dist ./apps/backend/dist
USER node
WORKDIR /app/apps/backend
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM nginx:1.28-alpine AS web
COPY deploy/nginx/frontend.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 8080

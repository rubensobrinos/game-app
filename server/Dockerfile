# server/Dockerfile — bijgewerkt voor de échte server (server/index.mjs, AR5/AR6).
# Build-context is de REPO-ROOT (zie compose: build.context: .).
#
# Bijgewerkt (2026-08-02, DT6): de placeholder had geen dependencies en geen
# shared/frontend-imports. server/index.mjs importeert nu Fastify (via
# package.json/package-lock.json → npm ci) en ../shared/content/index.mjs,
# en serveert client/, shared/ en frontend/ statisch (zie
# registerStaticRoutes) — alle drie moeten dus in het image staan.

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/ ./server/
COPY client/ ./client/
COPY shared/ ./shared/
COPY frontend/ ./frontend/

EXPOSE 3000
USER node
CMD ["node", "server/index.mjs"]

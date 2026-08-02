# server/Dockerfile — fase 1. Build-context is de REPO-ROOT (zie compose:
# build.context: .), zodat package.json en straks shared/ meekomen.
# De placeholder heeft geen dependencies, dus geen npm install; zodra AR5/AR6
# echte deps introduceert (Fastify, Socket.IO, redis) komen hier een
# package-lock.json en `npm ci --omit=dev` bij.

FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

COPY package.json ./
COPY server/ ./server/
# Toekomst (AR5+): COPY shared/ ./shared/  — gedeelde contentmodule

EXPOSE 3000
USER node
CMD ["node", "server/index.mjs"]

# syntax=docker/dockerfile:1.7
FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS build
WORKDIR /app
COPY package.json package-lock.json tsconfig.base.json ./
COPY LICENSE THIRD_PARTY_NOTICES.md ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/templates/package.json packages/templates/package.json
RUN npm ci --ignore-scripts
COPY apps/api apps/api
COPY packages/core packages/core
COPY packages/templates packages/templates
RUN npm run build --workspace @reconforge/core \
 && npm run build --workspace @reconforge/templates \
 && npm run build --workspace @reconforge/api \
 && npm prune --omit=dev --ignore-scripts

FROM node:24.18.0-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8787
WORKDIR /app
RUN addgroup -S reconforge && adduser -S -G reconforge reconforge
COPY --from=build --chown=reconforge:reconforge /app/package.json /app/package-lock.json ./
COPY --from=build --chown=reconforge:reconforge /app/LICENSE /app/THIRD_PARTY_NOTICES.md ./
COPY --from=build --chown=reconforge:reconforge /app/node_modules ./node_modules
COPY --from=build --chown=reconforge:reconforge /app/apps/api/package.json ./apps/api/package.json
COPY --from=build --chown=reconforge:reconforge /app/apps/api/dist ./apps/api/dist
COPY --from=build --chown=reconforge:reconforge /app/packages/core/package.json ./packages/core/package.json
COPY --from=build --chown=reconforge:reconforge /app/packages/core/dist ./packages/core/dist
COPY --from=build --chown=reconforge:reconforge /app/packages/templates/package.json ./packages/templates/package.json
COPY --from=build --chown=reconforge:reconforge /app/packages/templates/dist ./packages/templates/dist
USER reconforge
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "apps/api/dist/server.js"]

# FitSphere API image for Google Cloud Run (D-101; runbook, "The API on Cloud Run").
# Node 24 runs the TypeScript files directly, as `npm start` does on the PC. No setting or secret is
# built in: Cloud Run passes them in when the API starts (runbook, "Configuration names").
FROM node:24-slim

ENV NODE_ENV=production
WORKDIR /app

# Only the root package files, the API and the shared package; .dockerignore keeps everything
# else out of the build, every .env file included. The manifests go first so that the install is
# reused when only the code changes.
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
# The API's packages and @fitsphere/shared (a link to packages/shared), without test tools.
RUN npm ci --omit=dev --workspace @fitsphere/api --no-audit --no-fund && npm cache clean --force

COPY packages/shared packages/shared
COPY apps/api apps/api

USER node
# In a container the API listens on every address; Cloud Run sets PORT (8080 unless told otherwise).
ENV HOST=0.0.0.0 PORT=8080
EXPOSE 8080
CMD ["node", "apps/api/src/server.ts"]

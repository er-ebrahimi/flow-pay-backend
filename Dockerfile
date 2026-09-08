############################################################
# FlowPay Backend — multi-stage Dockerfile
# Stage 1: install deps + build the NestJS app
# Stage 2: runtime image (node only, no dev tooling)
############################################################

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

RUN npm install -g npm@11.12.1

# Prisma CLI needs these to emit the contract.
RUN apk add --no-cache libc6-compat

# Install ALL deps (incl. dev) so the build can run tsc/contract:emit.
COPY package*.json ./

RUN echo "=== PACKAGE FILES ===" && \
    ls -lah /app/package* && \
    echo "=== TYPESCRIPT IN PACKAGE.JSON ===" && \
    grep -n '"typescript"' /app/package.json && \
    echo "=== TYPESCRIPT IN LOCKFILE ===" && \
    grep -n '"typescript"' /app/package-lock.json | head -20 && \
    echo "=== NPM VERSION ===" && \
    npm --version && \
    echo "=== NODE VERSION ===" && \
    node --version && \
    npm ci
# RUN npm ci

# Copy the Prisma contract + config so contract:emit can run before nest build.
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY tsconfig.json tsconfig.build.json ./

# Emit the Prisma contract (writes src/prisma/generated — committed, but
# regenerating here guarantees the image matches the installed RC).
RUN npm run contract:emit

# Copy the rest of the source and compile.
COPY src ./src
COPY migrations ./migrations
RUN npm run build

# ---- runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install only production deps. `npm install` (not `ci`) because the
# lockfile pins versions the public RC registry may not re-serve exactly;
# the build stage already resolved the canonical set.
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copy build output + the files the running app reads at runtime.
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/prisma/generated ./src/prisma/generated
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/prisma.config.ts ./
COPY --from=build /app/migrations ./migrations

# Non-root runtime.
RUN addgroup --system --gid 1001 appgroup \
    && adduser --system --uid 1001 appuser --ingroup appgroup
USER appuser

EXPOSE 3000

# start:prod is "node dist/main" (see package.json).
CMD ["node", "dist/main"]

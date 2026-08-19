# syntax=docker/dockerfile:1.7

ARG PLAYWRIGHT_VERSION=1.61.1
FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS base

ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

FROM base AS build

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/api/package.json packages/api/tsconfig.json ./packages/api/
COPY packages/agent/package.json packages/agent/tsconfig.json ./packages/agent/
COPY packages/mcp-server/package.json packages/mcp-server/tsconfig.json ./packages/mcp-server/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/api/src ./packages/api/src
COPY packages/agent/src ./packages/agent/src
COPY packages/mcp-server/src ./packages/mcp-server/src

RUN pnpm --filter @a11y-agent/mcp-server build \
    && pnpm --filter @a11y-agent/agent build \
    && pnpm --filter @a11y-agent/api build \
    && pnpm --filter @a11y-agent/api --prod deploy --legacy /app

FROM base AS runtime

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

WORKDIR /app

COPY --from=build --chown=pwuser:pwuser /app ./

USER pwuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

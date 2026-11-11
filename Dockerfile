FROM node:22-slim

WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --chown=node:node package.json package-lock.json ./
RUN chown node:node /app
USER node
RUN npm ci
COPY --chown=node:node . .
RUN mkdir -p /app/.wrangler

ENV NODE_ENV=development \
    WRANGLER_SEND_METRICS=false \
    XDG_CONFIG_HOME=/app/.wrangler/xdg
EXPOSE 8787

HEALTHCHECK --interval=20s --timeout=4s --start-period=15s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["sh", "-c", "npm run db:migrate:local && npm run dev -- --ip 0.0.0.0"]

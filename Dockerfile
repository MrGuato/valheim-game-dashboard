# Longhouse: Valheim server dashboard + collector. No npm dependencies.
FROM node:22-alpine

LABEL org.opencontainers.image.source="https://github.com/MrGuato/valheim-game-dashboard" \
      org.opencontainers.image.description="Longhouse: a clean, self-hosted dashboard for your Valheim dedicated server" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    LONGHOUSE_PORT=8080 \
    LONGHOUSE_DATA_DIR=/data

WORKDIR /app
COPY package.json ./
COPY server/ ./server/
COPY index.html docs.html ./
COPY assets/ ./assets/

RUN rm -rf ./server/test \
 && mkdir -p /data \
 && chown node:node /data

USER node
EXPOSE 8080
VOLUME /data

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${LONGHOUSE_PORT}/healthz" >/dev/null || exit 1

CMD ["node", "server/index.js"]

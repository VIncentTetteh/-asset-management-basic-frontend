# AssetIQ web image: the Next.js static export, served by nginx.
#
# next.config.ts sets output: "export", so the build emits plain HTML/JS/CSS with
# no Node server. Serving that from nginx rather than from the backend keeps the
# two tiers independently scalable and lets the asset cache headers below apply
# without teaching Spring about them. The edge proxy puts the API on the same
# origin at /api/v1, which the HttpOnly SameSite=Strict session cookie requires.

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --legacy-peer-deps

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build args become NEXT_PUBLIC_ env vars baked into the bundle.
ARG NEXT_PUBLIC_APP_MODE=standalone
ARG NEXT_PUBLIC_API_URL=/api/v1
ENV NEXT_PUBLIC_APP_MODE=$NEXT_PUBLIC_APP_MODE
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

# nginx-unprivileged, not nginx: the stock image starts its master process as
# root and only drops to the nginx user for workers, which fails outright under
# `read_only: true` / readOnlyRootFilesystem and runAsNonRoot. This variant runs
# entirely as uid 101 and writes its pid to /tmp. Port 3000 is above 1024, so
# binding it needs no capability.
FROM nginxinc/nginx-unprivileged:1.27-alpine AS runner

ARG VERSION=0.0.0-dev
ARG VCS_REF=unknown
ARG BUILD_DATE=unknown
LABEL org.opencontainers.image.title="AssetIQ Web" \
      org.opencontainers.image.description="AssetIQ web UI (Next.js static export)" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.licenses="Proprietary"

USER root
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=101:101 /app/out /usr/share/nginx/html
USER 101:101

EXPOSE 3000

# The image runs with a read-only root filesystem. Everything nginx writes lives
# under these paths, which the runtime supplies as tmpfs.
VOLUME ["/tmp", "/var/cache/nginx"]

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=5 \
  CMD wget -q --spider http://127.0.0.1:3000/ || exit 1

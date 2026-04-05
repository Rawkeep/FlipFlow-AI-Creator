# ── Build Stage ──
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ── Production Stage ──
FROM node:22-alpine
WORKDIR /app

# better-sqlite3 needs build tools at install time
RUN apk add --no-cache python3 make g++

COPY --from=build /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev && apk del python3 make g++

COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server

# Data directory for SQLite (mount as volume for persistence)
RUN mkdir -p /app/data

EXPOSE 3001
ENV NODE_ENV=production
ENV PORT=3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/health || exit 1

CMD ["node", "server/index.js"]

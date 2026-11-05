FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-bookworm-slim AS production-deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:20-bookworm-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=production-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json package-lock.json ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "const http = require('node:http'); const req = http.get({ host: '127.0.0.1', port: process.env.PORT || 3000, path: '/health', timeout: 3000 }, res => { res.resume(); process.exitCode = res.statusCode === 200 ? 0 : 1; }); req.on('timeout', () => req.destroy()); req.on('error', () => { process.exitCode = 1; });"
CMD ["npm", "start"]

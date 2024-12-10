# This Dockerfile must be run from the root of the repository (containing package-lock.json)
FROM node:18.16-alpine3.18 AS builder
WORKDIR /app

COPY package-lock.json package.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:18.16-alpine3.18 AS runner
WORKDIR /app

COPY --from=builder /app/build ./build/
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules/

CMD ["node", "build/index.js"]
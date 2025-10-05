# connector/Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy source
COPY . .

FROM node:18-alpine

# create a non-root user and its home dir
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /home/app \
    && chown -R app:app /home/app

WORKDIR /app

# Copy built app and set owner to app
COPY --from=builder --chown=app:app /app /app

# copy wait script and make executable
COPY --chown=app:app wait-for-postgres.sh /usr/local/bin/wait-for-postgres.sh
RUN chmod +x /usr/local/bin/wait-for-postgres.sh

ENV HOME=/home/app NODE_ENV=production

USER app

# Use the wait script to ensure DB readiness before starting node.
# You can override command in docker-compose for dev (e.g. nodemon).
CMD ["/usr/local/bin/wait-for-postgres.sh", "node", "index.js"]

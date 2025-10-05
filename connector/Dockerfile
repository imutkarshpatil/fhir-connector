# connector/Dockerfile
# Small, production-friendly image for the Node.js connector

FROM node:18-alpine AS builder
WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package.json package-lock.json* ./
RUN npm ci --only=production

# Copy source
COPY . .

# Use a lightweight runtime image
FROM node:18-alpine
RUN addgroup -S app && adduser -S app -G app
WORKDIR /app

# Copy node_modules from builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app ./

USER app
ENV NODE_ENV=production

CMD ["node", "index.js"]

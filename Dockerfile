# Stage 1: Build the application
FROM node:22-alpine AS builder
WORKDIR /app

# Copy package files
COPY package.json ./
RUN npm install

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Create the production image
FROM node:22-alpine
WORKDIR /app

# Copy package.json and install production dependencies
COPY package.json ./
RUN npm install --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy public dashboard files
COPY --from=builder /app/public ./public

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Install curl for health checks (required by Coolify)
RUN apk add --no-cache curl

# Create data directory with proper permissions
RUN mkdir -p data && chown -R nodejs:nodejs data && chmod -R 755 data

# Add health check for container monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

EXPOSE 3000

# Create startup script to handle permissions and debugging in production
RUN echo '#!/bin/sh' > /app/start.sh && \
    echo 'echo "🔧 Setting up data directory permissions..."' >> /app/start.sh && \
    echo 'mkdir -p /app/data 2>/dev/null || true' >> /app/start.sh && \
    echo 'chown -R nodejs:nodejs /app/data 2>/dev/null || true' >> /app/start.sh && \
    echo 'chmod -R 755 /app/data 2>/dev/null || true' >> /app/start.sh && \
    echo 'echo "📁 Data directory status:"' >> /app/start.sh && \
    echo 'ls -la /app/data/ 2>/dev/null || echo "  Data directory is empty or does not exist"' >> /app/start.sh && \
    echo 'if [ -f /app/data/.env ]; then' >> /app/start.sh && \
    echo '  echo "✅ Found data/.env file"' >> /app/start.sh && \
    echo '  echo "📄 File permissions: $(ls -la /app/data/.env)"' >> /app/start.sh && \
    echo 'else' >> /app/start.sh && \
    echo '  echo "⚠️  No data/.env file found - using environment variables"' >> /app/start.sh && \
    echo 'fi' >> /app/start.sh && \
    echo 'exec su-exec nodejs node dist/index.js' >> /app/start.sh && \
    chmod +x /app/start.sh && \
    apk add --no-cache su-exec

CMD ["/app/start.sh"]
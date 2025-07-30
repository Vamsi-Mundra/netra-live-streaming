# Use multi-stage build for production
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY Netra-Backend/package*.json ./Netra-Backend/
COPY Netra-Frontend/package*.json ./Netra-Frontend/
COPY Netra-sfu/package*.json ./Netra-sfu/

# Install dependencies
RUN npm ci --only=production --ignore-scripts
RUN cd Netra-Backend && npm ci --only=production --ignore-scripts
RUN cd Netra-Frontend && npm ci --ignore-scripts
RUN cd Netra-sfu && npm ci --only=production --ignore-scripts

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build frontend
RUN cd Netra-Frontend && npm run build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install Docker Compose
RUN apk add --no-cache docker-compose

# Copy built application
COPY --from=builder /app/Netra-Frontend/dist ./Netra-Frontend/dist
COPY --from=builder /app/Netra-Backend ./Netra-Backend
COPY --from=builder /app/Netra-sfu ./Netra-sfu
COPY --from=builder /app/docker-compose.yml ./
COPY --from=builder /app/railway.json ./

# Copy node_modules
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/Netra-Backend/node_modules ./Netra-Backend/node_modules
COPY --from=deps /app/Netra-sfu/node_modules ./Netra-sfu/node_modules

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Start the application
CMD ["docker-compose", "up", "-d"] 
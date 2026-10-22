FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install Prometheus and utility tools on Alpine Linux
RUN apk add --no-cache prometheus curl bash jq

# 1. Copy Main App
COPY package.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY client/ ./client/
COPY runbooks/ ./runbooks/

# 2. Copy and install Simulators
COPY simulator/auth-service/ ./simulator/auth-service/
RUN cd simulator/auth-service && npm install --omit=dev

COPY simulator/traffic-generator/ ./simulator/traffic-generator/
RUN cd simulator/traffic-generator && npm install --omit=dev

COPY simulator/prometheus/prometheus.yml /etc/prometheus/prometheus.yml

# 3. Add Master Startup Script
COPY start-all.sh ./
RUN chmod +x start-all.sh

EXPOSE 8080
CMD ["./start-all.sh"]
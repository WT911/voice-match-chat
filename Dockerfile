# ============================================
# Chat-App 生产部署 Dockerfile
# 多阶段构建: Build + Production
# ============================================

# ---- Build Stage ----
FROM node:22-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package.json package-lock.json ./
RUN npm ci --production=false

# 构建前端
COPY client/ ./client/
COPY vite.config.ts tsconfig.json tailwind.config.js postcss.config.js ./
RUN npm run build

# ---- Production Stage ----
FROM node:22-alpine

WORKDIR /app

# 只复制生产依赖
COPY package.json package-lock.json ./
RUN npm ci --production && npm cache clean --force

# 复制构建产物和服务端代码
COPY --from=builder /app/dist ./dist
COPY server/ ./server/
COPY tsconfig.json ./

# 非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

# 环境变量（Railway 自动注入 DATABASE_URL）
ENV NODE_ENV=production
ENV PORT=4001

EXPOSE 4001

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/voice-match/levels || exit 1

CMD ["node", "--import", "tsx/esm", "server/server.ts"]

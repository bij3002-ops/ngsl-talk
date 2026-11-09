# NGSL Talk: 백엔드 하나가 API와 빌드된 프론트엔드를 함께 제공합니다.
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci
COPY . .
RUN npm run build -w frontend && npm prune --omit=dev

FROM node:26-slim
WORKDIR /app
# 학습 기록은 DATABASE_URL(Postgres)에 저장합니다. 컨테이너 안의 파일은 재시작하면 사라집니다.
ENV NODE_ENV=production \
    PORT=8080
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/backend ./backend
COPY --from=build /app/frontend/dist ./frontend/dist
EXPOSE 8080
CMD ["node", "backend/src/index.ts"]

# SHARP / ELISY254 - Render production container
FROM node:22-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN npm run generate:brand-css
RUN npm run build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=10000

COPY --from=build /app/dist ./dist
COPY --from=build /app/server.cjs ./server.cjs
COPY --from=build /app/brand.config.json ./brand.config.json

EXPOSE 10000

CMD ["node", "server.cjs"]

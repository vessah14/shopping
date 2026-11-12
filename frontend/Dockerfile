FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_FRONTEND_URL=http://localhost:3000
ENV NEXT_PUBLIC_FRONTEND_URL=${NEXT_PUBLIC_FRONTEND_URL}
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/public/uploads /app/default-uploads
RUN mkdir -p /app/public/uploads/products

EXPOSE 3000
CMD ["sh", "-c", "cp -an /app/default-uploads/. /app/public/uploads/ && exec ./node_modules/.bin/next start --hostname 0.0.0.0 --port ${PORT:-3000}"]
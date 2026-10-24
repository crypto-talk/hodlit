FROM node:22.13-alpine AS dependencies
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22.13-alpine AS build
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=""
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN corepack enable && pnpm run build

FROM node:22.13-alpine AS runtime
WORKDIR /app
RUN corepack enable
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
COPY --from=build --chown=node:node /app ./
USER node
EXPOSE 3000
CMD ["pnpm", "run", "start"]

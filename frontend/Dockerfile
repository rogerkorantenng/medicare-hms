# The frontend image, for running the whole stack locally with one command.
#
# Production deploys to Vercel from git rather than from this image; it
# exists so that the end-to-end verification in the Testing Report runs
# against the same three processes an examiner can start themselves.
FROM node:20-alpine AS deps
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /srv
COPY --from=deps /srv/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /srv
ENV NODE_ENV=production PORT=3000
# `output: 'standalone'` in next.config.mjs traces exactly the files the
# server needs, so this stage carries no build tooling.
COPY --from=build /srv/.next/standalone ./
COPY --from=build /srv/.next/static ./.next/static
COPY --from=build /srv/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]

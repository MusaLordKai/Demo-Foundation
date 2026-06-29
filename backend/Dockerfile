# Single-stage image: builds TypeScript, then runs migrations + API at start.
FROM node:20-slim

WORKDIR /app

# OpenSSL is required by the Prisma query engine.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies (devDeps included: the Prisma CLI runs migrations at boot).
# --omit=optional skips the embedded-postgres platform binaries (tests only).
COPY package*.json ./
RUN npm install --no-audit --omit=optional

# Generate the Prisma client and compile to dist/.
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV PORT=4000
EXPOSE 4000

RUN sed -i 's/\r//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh
CMD ["./docker-entrypoint.sh"]

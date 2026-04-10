FROM node:24-slim

RUN apt-get update && \
    apt-get install -y python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

RUN npm install -g pnpm@10

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json tsconfig.json ./

COPY lib/ ./lib/
COPY artifacts/agent/ ./artifacts/agent/

RUN pnpm install --no-frozen-lockfile

RUN mkdir -p /data

ENV DB_PATH=/data/memory.db
ENV NODE_ENV=production

CMD ["pnpm", "--filter", "@workspace/agent", "run", "start"]

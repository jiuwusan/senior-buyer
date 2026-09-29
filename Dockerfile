FROM node:22-alpine

WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

RUN yarn global add pm2

RUN mkdir -p /app/logs /app/weidian/weidian-api/database /app/youzan/youzan-api/database

COPY weidian/weidian-api/package.json /app/weidian/weidian-api/package.json
COPY weidian/weidian-api/yarn.lock /app/weidian/weidian-api/yarn.lock
COPY youzan/youzan-api/package.json /app/youzan/youzan-api/package.json
COPY youzan/youzan-api/yarn.lock /app/youzan/youzan-api/yarn.lock

RUN cd /app/weidian/weidian-api && yarn install --frozen-lockfile --production=true
RUN cd /app/youzan/youzan-api && yarn install --frozen-lockfile --production=true

COPY ecosystem.config.js ./
COPY weidian/weidian-api ./weidian/weidian-api
COPY youzan/youzan-api ./youzan/youzan-api

ENV NODE_ENV=production
ENV PM2_HOME=/app/.pm2

EXPOSE 37071 37072

CMD ["pm2-runtime", "start", "ecosystem.config.js"]

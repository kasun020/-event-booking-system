FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache openssl

COPY package*.json ./
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
RUN for i in 1 2 3 4 5; do npm install --ignore-scripts --network-timeout=1000000 && exit 0; echo "npm install failed (attempt ${i}/5), retrying..."; sleep 5; done; exit 1

COPY prisma ./prisma
RUN for i in 1 2 3 4 5; do npx prisma generate && exit 0; echo "Prisma generate failed (attempt ${i}/5), retrying..."; sleep 5; done; exit 1

COPY src ./src

EXPOSE 3004

CMD ["npm", "start"]

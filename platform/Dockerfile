FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 4100 4101 4102 4103 4104 4105

CMD ["npm", "run", "start:api"]

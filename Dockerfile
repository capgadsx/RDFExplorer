FROM node:lts-alpine
WORKDIR /usr/src/app
COPY package*.json .
RUN npm ci --only=production
COPY . .
EXPOSE 4200
CMD [ "node", "server.js" ]

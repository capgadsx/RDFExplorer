FROM node:lts-alpine
ENV GRAPH_API_URL="http://127.0.0.1:8080/graph"
WORKDIR /usr/src/app
COPY package*.json .
RUN npm ci --only=production
COPY . .
EXPOSE 4200
CMD [ "sh", "/usr/src/app/start.sh" ]

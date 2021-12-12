FROM node:16 as dev

WORKDIR /app
RUN chown node: /app
USER node
COPY package*.json ./
RUN npm ci

CMD [ "npm", "run", "watch:dev" ]

EXPOSE 8080

FROM dev as app

COPY . .
CMD [ "npm", "run", "start" ]

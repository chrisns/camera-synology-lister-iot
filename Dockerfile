FROM node:16.6.0-alpine

RUN mkdir /app
WORKDIR /app
COPY package.json .
RUN npm install -s --prod
COPY . .

CMD node index

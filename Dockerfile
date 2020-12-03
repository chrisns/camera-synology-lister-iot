FROM node:alpine
LABEL org.opencontainers.image.source https://github.com/chrisns/camera-synology-lister-iot

RUN mkdir /app
WORKDIR /app
COPY package.json .
RUN npm install -s --prod
COPY . .

CMD node index
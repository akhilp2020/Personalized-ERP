FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm i --only=prod
COPY src ./src
EXPOSE 8080
CMD ["node","-r","./src/tracing.js","src/index.js"]
CMD ["node","-r","./src/tracing.js","src/index.js"]

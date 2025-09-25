FROM node:20-alpine
WORKDIR /app
COPY package.json ./
RUN npm i --only=prod || true
COPY src ./src
CMD ["node","src/worker.js"]

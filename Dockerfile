FROM node:22-alpine
WORKDIR /app

# Root package metadata, TypeScript configuration, and ws dependency are supplied by the project setup.
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc -p server/tsconfig.json

ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist-server/server/src/index.js"]

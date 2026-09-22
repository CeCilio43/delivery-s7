FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package*.json ./
EXPOSE 3003
CMD ["node", "dist/index.js"]

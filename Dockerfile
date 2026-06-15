FROM node:22-alpine

# better-sqlite3 requires native build tools
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY index.html server.js ./

EXPOSE 3000
CMD ["node", "server.js"]

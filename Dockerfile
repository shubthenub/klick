FROM node:18

WORKDIR /app

# Copy all necessary files
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY worker/messageWorker.js ./worker/messageWorker.js

# Install dependencies
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Start worker
CMD ["node", "worker/messageWorker.js"]

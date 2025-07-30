FROM node:20
WORKDIR /app
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["sh","-c","npm run migrate && node src/index.js"] 
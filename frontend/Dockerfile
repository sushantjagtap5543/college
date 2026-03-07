FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY . .
# Enforce execution permissions on node binaries to prevent 'sh: vite: Permission denied'
RUN chmod -R +x node_modules/.bin || true
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]

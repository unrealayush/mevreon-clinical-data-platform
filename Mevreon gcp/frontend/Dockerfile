# Stage 1: build
FROM node:20-alpine AS build
WORKDIR /app
ENV CI=true
COPY package*.json ./
RUN npm ci --silent
# VITE_API_BASE is injected from frontend/.env.production at deploy time (see deploy/gcp.sh).
COPY . .
RUN npm run build

# Stage 2: serve with nginx
FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .

ARG VITE_API_BASE_URL=/api
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN npm run build

# ---- Runtime stage ----
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Rendered to /etc/nginx/conf.d/default.conf at start-up; only the variables
# set below (or overridden by the platform) are substituted.
COPY nginx.conf /etc/nginx/templates/default.conf.template
ENV BACKEND_HOSTPORT=backend:8080
ENV PORT=80
EXPOSE 80

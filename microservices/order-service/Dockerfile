# Build context is the repository root (see docker-compose.yml).
# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace
COPY . .
RUN mvn -pl microservices/order-service -am -DskipTests package

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
RUN addgroup -S cloudops && adduser -S cloudops -G cloudops
COPY --from=build /workspace/microservices/order-service/target/order-service.jar app.jar
USER cloudops
EXPOSE 8082
ENTRYPOINT ["java", "-jar", "app.jar"]

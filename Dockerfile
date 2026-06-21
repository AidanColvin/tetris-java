# --- Build stage ---
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -e -B dependency:go-offline
COPY src ./src
RUN mvn -q -e -B clean package -DskipTests

# --- Run stage ---
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/tetris.jar app.jar
# Hosts (Render/Railway/Fly) inject PORT; Spring reads it via application.properties.
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

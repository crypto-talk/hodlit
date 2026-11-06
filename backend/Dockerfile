FROM eclipse-temurin:24-jdk AS build
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle ./
COPY gradle ./gradle
RUN chmod +x gradlew && ./gradlew dependencies --no-daemon
COPY src ./src
RUN ./gradlew test bootJar --no-daemon

FROM eclipse-temurin:24-jre
LABEL org.cryptalk.hodlit.service="backend"
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 cryptalk \
    && mkdir -p /app/uploads \
    && chown cryptalk /app/uploads
COPY --from=build /workspace/build/libs/*.jar app.jar
USER cryptalk
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

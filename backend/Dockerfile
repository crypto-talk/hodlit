FROM gradle:8.14.3-jdk24@sha256:2968ab57ef9379b6e67eb9c5b25602d0068a5c754098c4939d00e35e8390a297 AS build
USER root
WORKDIR /workspace
COPY gradlew settings.gradle build.gradle gradle.properties ./
COPY gradle ./gradle
# Use the bundled distribution instead of downloading it from GitHub during deployment.
# Fail if a future Wrapper upgrade is not reflected in the pinned builder image.
RUN expected_version="$(sed -n 's/.*gradle-\(.*\)-bin.zip/\1/p' gradle/wrapper/gradle-wrapper.properties)" \
    && test "$GRADLE_VERSION" = "$expected_version" \
    && gradle dependencies --no-daemon
COPY src ./src
RUN gradle test bootJar --no-daemon

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

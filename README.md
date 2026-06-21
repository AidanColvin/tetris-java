# Tetris — Java Edition

An online Tetris where **the entire game engine runs in Java**. A Spring Boot
backend holds the authoritative game state (board, SRS rotation, line clears,
scoring, gravity, 7-bag, hold, hard drop) and streams it to the browser over a
WebSocket. The browser only renders state and forwards keystrokes.

## Architecture

```
Browser (HTML5 Canvas + JS)  <->  WebSocket /ws/game  <->  Spring Boot
   renders state, sends keys         JSON state msgs        TetrisGame engine (Java)
                                 <->  REST /api/leaderboard <->  file-persisted scores
```

- **Backend** — Spring Boot 3 (Java 17). `com.tetris.game.*` is the engine;
  `com.tetris.web.*` is the WebSocket + leaderboard REST layer.
- **Frontend** — static `index.html` / `style.css` / `game.js`, served by Spring Boot.
- One authoritative game per connected browser; gravity advances on the server.

## Run locally

```bash
mvn spring-boot:run
# or build a jar:
mvn clean package
java -jar target/tetris.jar
```

Then open http://localhost:8080.

## Controls

| Key | Action |
| --- | --- |
| Left / Right | Move |
| Down | Soft drop |
| Up / X | Rotate CW |
| Z | Rotate CCW |
| Space | Hard drop |
| C | Hold |

## Deploy (public URL)

The app is a single Spring Boot process with a long-lived WebSocket, so it needs
a JVM/Docker host (Vercel's serverless model can't run it). A `Dockerfile` is
included; it works as-is on Render, Railway, or Fly.io. Hosts inject `PORT`,
which `application.properties` already honors.

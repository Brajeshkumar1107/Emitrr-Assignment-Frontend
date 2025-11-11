# 🎮 Connect 4 - Real-Time Multiplayer Game

A real-time multiplayer Connect 4 (4 in a Row) game built with **Go** backend and **React** frontend, featuring WebSocket communication, competitive AI bot, leaderboard tracking, and Kafka analytics integration.

## 📋 Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [WebSocket Protocol](#websocket-protocol)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## ✨ Features

- 🎯 **Real-Time Multiplayer**: Play against friends or AI bot via WebSocket
- 🤖 **Competitive AI Bot**: Minimax algorithm with alpha-beta pruning
- 🏅 **Leaderboard**: Track wins and statistics
- 🔄 **Reconnection Support**: 30-second window to rejoin disconnected games
- ⏱️ **Auto-Matchmaking**: 10-second bot fallback if no player joins
- 📊 **Analytics**: Kafka integration for game event tracking
- 💾 **Persistent Storage**: PostgreSQL for game history and statistics

## 🔧 Prerequisites

### Required
- **Go** 1.24.0 or higher ([Download](https://golang.org/dl/))
- **Node.js** 16.x or higher and **npm** ([Download](https://nodejs.org/))
- **PostgreSQL** 12+ (optional, for leaderboard and analytics)

### Optional
- **Kafka** 2.8+ (for analytics - optional)

## 📁 Project Structure

```
connect4/
├── backend/                 # Go backend server
│   ├── cmd/
│   │   └── server/         # Main server entry point
│   └── internal/
│       ├── analytics/      # Kafka producer/consumer
│       ├── bot/            # AI bot logic (minimax)
│       ├── database/       # PostgreSQL integration
│       ├── game/            # Game logic
│       └── ws/              # WebSocket handlers
├── src/                     # React frontend
│   ├── components/         # React components
│   ├── utils/              # Utility functions
│   └── App.tsx             # Main app component
└── README.md               # This file
```

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd connect4
```

### 2. Backend Setup

```bash
cd backend

# Install Go dependencies
go mod download

# Build the server
go build ./cmd/server
```

### 3. Frontend Setup

```bash
# From project root
npm install
```

### 4. Database Setup (Optional)

If you want to use the leaderboard and analytics features:

```bash
# Create PostgreSQL database
createdb connect4

# Run schema
psql -d connect4 -f backend/internal/database/schema.sql
```

## ⚙️ Configuration

### Environment Variables

#### Backend

Create a `.env` file in the `backend/` directory or set environment variables:

```bash
# Server Configuration
SERVER_PORT=8080                    # Default: 8080

# Database Configuration (Optional)
DB_HOST=localhost                   # PostgreSQL host
DB_PORT=5432                        # PostgreSQL port
DB_USER=postgres                    # Database user
DB_PASSWORD=postgres                # Database password
DB_NAME=connect4                    # Database name

# Kafka Configuration (Optional)
KAFKA_BROKERS=localhost:9092       # Kafka broker addresses (comma-separated)

# CORS Configuration
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### Frontend

Create a `.env` file in the project root:

```bash
REACT_APP_WS_URL=ws://localhost:8080/ws
REACT_APP_API_URL=http://localhost:8080
```

## 🎮 Running the Application

### Development Mode

#### 1. Start the Backend Server

```bash
cd backend/cmd/server

# Set environment variables (Windows PowerShell)
$env:SERVER_PORT='8080'
$env:DB_HOST='localhost'  # Optional
$env:DB_USER='postgres'  # Optional
$env:DB_PASSWORD='postgres'  # Optional
$env:DB_NAME='connect4'  # Optional

# Run the server
go run main.go
```

Or on Linux/Mac:

```bash
cd backend/cmd/server
SERVER_PORT=8080 go run main.go
```

The server will start on `http://localhost:8080`

#### 2. Start the Frontend

```bash
# From project root
npm start
```

The frontend will start on `http://localhost:3000`

### Production Mode

#### Build Frontend

```bash
npm run build
```

This creates an optimized production build in the `build/` directory.

#### Run Backend

```bash
cd backend/cmd/server
go build -o server main.go
./server
```

## 📡 API Documentation

### REST Endpoints

#### GET `/leaderboard`
Get the top players leaderboard.

**Response:**
```json
[
  {
    "username": "player1",
    "gamesPlayed": 10,
    "gamesWon": 7,
    "winPercentage": 70.0
  }
]
```

#### GET `/active-users`
Get list of currently active users.

**Response:**
```json
[
  {
    "username": "player1",
    "status": "waiting" | "in_game"
  }
]
```

### WebSocket Endpoint

#### `ws://localhost:8080/ws`

See [WebSocket Protocol](#websocket-protocol) section below.

## 🔌 WebSocket Protocol

### Client → Server Messages

#### Join Game
```json
{
  "type": "join",
  "payload": {
    "username": "player1",
    "gameMode": "friend" | "computer"
  }
}
```

#### Make Move
```json
{
  "type": "move",
  "payload": {
    "column": 3
  }
}
```

### Server → Client Messages

#### Game Start
```json
{
  "type": "gameStart",
  "gameId": "uuid-string",
  "payload": {
    "id": "uuid-string",
    "board": [[0,0,0,...], ...],
    "currentTurn": 1,
    "status": "in_progress",
    "player1": {
      "id": "player1",
      "username": "player1",
      "isBot": false
    },
    "player2": {
      "id": "player2",
      "username": "player2",
      "isBot": false
    }
  }
}
```

#### Game State Update
```json
{
  "type": "gameState",
  "gameId": "uuid-string",
  "payload": {
    "id": "uuid-string",
    "board": [[0,0,0,...], ...],
    "currentTurn": 2,
    "status": "in_progress" | "completed" | "draw",
    "lastMove": {
      "row": 5,
      "column": 3,
      "player": 1
    },
    "winner": {
      "username": "player1"
    }
  }
}
```

#### Leaderboard Update
```json
{
  "type": "leaderboardUpdate",
  "payload": {
    "gameId": "uuid-string",
    "winner": "player1",
    "isDraw": false
  }
}
```

#### Error
```json
{
  "type": "error",
  "gameId": "uuid-string",
  "payload": "Error message"
}
```

## 🎯 Game Rules

- **Board Size**: 7 columns × 6 rows
- **Objective**: Connect 4 discs horizontally, vertically, or diagonally
- **Turns**: Players alternate dropping discs into columns
- **Winning**: First to connect 4 wins
- **Draw**: Board fills up with no winner

## 🤖 Bot Features

The AI bot uses:
- **Minimax Algorithm** with alpha-beta pruning
- **Strategic Decision Making**:
  1. Checks for immediate winning moves
  2. Blocks opponent's winning moves
  3. Evaluates board position for optimal moves
- **Depth**: 6 levels deep for optimal play

## 🔄 Reconnection & Matchmaking

### Matchmaking
- **Friend Mode**: Wait for another player
- **Auto-Bot Fallback**: If no player joins within 10 seconds, automatically match with AI bot
- **Computer Mode**: Immediately start game with AI bot

### Reconnection
- **30-Second Window**: Players can rejoin within 30 seconds of disconnection
- **Game State Preservation**: Game state is maintained during reconnection window
- **Auto-Forfeit**: If not reconnected within 30 seconds, game is forfeited

## 🚀 Deployment

### Backend Deployment

1. Build the binary:
```bash
cd backend/cmd/server
go build -o server main.go
```

2. Set environment variables on your server

3. Run the server:
```bash
./server
```

Or use a process manager like `systemd`, `supervisord`, or `PM2`.

### Frontend Deployment

1. Build for production:
```bash
npm run build
```

2. Serve the `build/` directory using:
   - **Nginx**: Configure to serve static files
   - **Apache**: Serve from `build/` directory
   - **Netlify/Vercel**: Deploy the `build/` folder

3. Update `REACT_APP_WS_URL` and `REACT_APP_API_URL` to point to your production backend

### Docker Deployment (Optional)

Create a `Dockerfile` for the backend:

```dockerfile
FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY backend/ ./backend/
RUN cd backend && go build -o server ./cmd/server

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/backend/server .
CMD ["./server"]
```

## 🐛 Troubleshooting

### Backend Issues

**Problem**: Server won't start
- Check if port 8080 is available
- Verify Go version: `go version` (should be 1.24+)
- Check environment variables

**Problem**: Database connection fails
- Verify PostgreSQL is running
- Check database credentials
- Ensure database `connect4` exists
- Note: Database is optional - server will run without it

**Problem**: Kafka connection fails
- Verify Kafka is running
- Check `KAFKA_BROKERS` environment variable
- Note: Kafka is optional - server will run without it

### Frontend Issues

**Problem**: Can't connect to WebSocket
- Verify backend is running on port 8080
- Check `REACT_APP_WS_URL` in `.env`
- Check browser console for errors

**Problem**: Leaderboard not loading
- Verify backend is running
- Check `REACT_APP_API_URL` in `.env`
- Check browser network tab for API calls

### Common Issues

**Problem**: "Module not found" errors
- Run `npm install` in the frontend directory
- Run `go mod download` in the backend directory

**Problem**: CORS errors
- Check `ALLOWED_ORIGINS` environment variable
- Ensure frontend URL is in the allowed origins list

## 📝 Development Notes

### Running Tests

```bash
# Frontend tests
npm test

# Backend tests (if implemented)
cd backend
go test ./...
```

### Code Structure

- **Backend**: Follows Go standard project layout
- **Frontend**: React with TypeScript
- **State Management**: React hooks and local storage
- **WebSocket**: Gorilla WebSocket library

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of a backend engineering assignment.

## 👨‍💻 Author

Built as a real-time multiplayer Connect 4 game with Go backend and React frontend.

---

**Note**: This project requires Go 1.24.0+ and Node.js 16+. Database and Kafka are optional but recommended for full functionality.


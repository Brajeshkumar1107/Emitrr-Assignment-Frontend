# Leaderboard "No Record Found" Issue - Explanation & Solution

## Why the Leaderboard is Empty

The leaderboard view in the database only shows players who have played **at least one completed game** (`games_played > 0`). This is by design - it prevents cluttering the leaderboard with users who have only logged in but never played.

### Root Cause
```sql
CREATE OR REPLACE VIEW leaderboard AS
SELECT username, games_played, games_won, win_percentage
FROM players
WHERE games_played > 0  -- ← Only shows players with completed games
ORDER BY games_won DESC, win_percentage DESC;
```

## How to Get Records on the Leaderboard

### Step 1: Play a Complete Game
1. Login with your username
2. Select Game Mode (Friend or Computer)
3. **Complete the game** (win, lose, or draw)
4. The game result will be saved to the database

### Step 2: Check the Leaderboard
After completing at least one game:
- The leaderboard will show your stats: Games Played, Games Won, Win %
- Visit: `https://emitrr-assignment-backend-production.up.railway.app/leaderboard`

## Database Requirements for Leaderboard to Work

The backend must have the following environment variables set on Railway:
```
DB_HOST=<PostgreSQL host>
DB_USER=<database user>
DB_PASSWORD=<database password>
DB_NAME=connect4
```

### Database Setup (if not already configured)
1. Create PostgreSQL database named `connect4`
2. Run the schema file: `backend/internal/database/schema.sql`
3. This creates:
   - `players` table (stores user stats)
   - `games` table (stores game records)
   - `leaderboard` view (queries top players with games_played > 0)

## Testing the Leaderboard Locally

### Start Backend with Database
```bash
cd connect4/backend/cmd/server
export DB_HOST=localhost
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_NAME=connect4
export SERVER_PORT=8080
go run main.go
```

### Configure Frontend for Local Backend
Create/update `.env`:
```
REACT_APP_WS_URL=ws://localhost:8080/ws
REACT_APP_API_URL=http://localhost:8080
```

### Start Frontend
```bash
cd connect4
npm install
npm start
```

### Test Workflow
1. Play a complete game (vs Computer or Friend)
2. Open leaderboard endpoint: `http://localhost:8080/leaderboard`
3. Should show your stats with games_played > 0

## What Gets Saved to Database

When a game finishes:
1. **Game record** is created with game_state (board, moves, etc.)
2. **Winner/Draw** is recorded in games.winner_id
3. **Player stats** are updated:
   - `games_played` increments by 1
   - `games_won` increments by 1 (for winner only)
   - Auto-calculated `win_percentage` = (games_won / games_played) × 100

## Frontend Environment Variables

Update `.env` in the root connect4 folder:

### For Production (Railway)
```
REACT_APP_WS_URL=wss://emitrr-assignment-backend-production.up.railway.app/ws
REACT_APP_API_URL=https://emitrr-assignment-backend-production.up.railway.app
```

### For Local Development
```
REACT_APP_WS_URL=ws://localhost:8080/ws
REACT_APP_API_URL=http://localhost:8080
```

## Troubleshooting

### "Cannot GET /leaderboard"
- Backend is not running
- Check: `http://localhost:8080/` should return 404 (expected)

### Empty Leaderboard (401 or 500 error)
- Database connection failed
- Check backend logs for DB_HOST/DB_USER/DB_PASSWORD errors
- Ensure PostgreSQL is running and `connect4` database exists

### No Leaderboard Updates After Game Finish
- Database is not configured (DB_HOST not set)
- Backend continues without DB (shown in logs: "Continuing without database")
- Game results are still broadcast to clients, but not persisted

---

**TL;DR**: Play a complete game first, then the leaderboard will show your stats. The backend must have database environment variables configured for stats to persist.

# YouTube Content Intelligence MVP

A FastAPI-based backend system that analyzes and compares YouTube channels, providing insights into engagement metrics, posting frequency, and optimal upload times.

## Features

- **Channel Analysis**: Fetch comprehensive channel statistics from YouTube API
- **Video Metrics**: Analyze recent videos for engagement patterns
- **Channel Comparison**: Compare metrics between two channels
- **Caching**: Smart caching system with 24-hour TTL to reduce API calls
- **RESTful API**: Clean and intuitive REST endpoints
- **Database Persistence**: SQLite database with SQLAlchemy ORM

## Setup

### Prerequisites
- Python 3.8+
- YouTube API Key ([Get one here](https://console.cloud.google.com/))

### Installation

1. **Create and activate virtual environment**
   ```bash
   python -m venv .venv
   .venv\Scripts\activate  # Windows
   source .venv/bin/activate  # macOS/Linux
   ```

2. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   - Copy `.env.template` to `.env`
   - Add your YouTube API key:
     ```
     YOUTUBE_API_KEY=your_api_key_here
     ```

### Running the Server

#### Option 1: Batch File (Windows)
```bash
run_server.bat
```

#### Option 2: Direct Command
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Server will be available at: `http://localhost:8000`

## API Endpoints

### 1. Get Channel Analysis
```
GET /analyze?channel_id={channel_id}&force_refresh={boolean}
```
**Parameters:**
- `channel_id`: YouTube channel ID, handle (@username), or URL
- `force_refresh`: (Optional) Bypass cache and fetch fresh data

**Response:**
```json
{
  "channel_id": "UCX6OQ3DkcsbYNE6H8uQQuVA",
  "insights": {
    "channel_title": "MKBHD",
    "subscribers": 19000000,
    "total_views": 4200000000,
    "video_count": 850,
    "average_engagement_rate_percent": 3.45,
    "best_upload_hour_utc": 14,
    "avg_days_between_uploads": 3.2,
    "recent_video_sample_size": 50,
    "upload_hours_history": {14: 450000, 15: 425000}
  },
  "cached": false
}
```

### 2. Compare Two Channels
```
GET /compare?channel_id_1={id1}&channel_id_2={id2}&force_refresh={boolean}
```
**Parameters:**
- `channel_id_1`: First channel identifier
- `channel_id_2`: Second channel identifier
- `force_refresh`: (Optional) Bypass cache

**Response:**
```json
{
  "comparison": {
    "channel_1": { ...insights... },
    "channel_2": { ...insights... }
  },
  "conclusion": {
    "higher_engagement": "UCX6OQ3DkcsbYNE6H8uQQuVA"
  }
}
```

### 3. Frontend
```
GET /
```
Serves the main dashboard interface.

## Project Structure

```
├── main.py                 # FastAPI application and endpoints
├── database.py             # Database configuration
├── models.py               # SQLAlchemy ORM models
├── youtube_client.py       # YouTube API client
├── requirements.txt        # Python dependencies
├── .env.template          # Environment variables template
├── run_server.bat         # Windows batch launcher
├── services/
│   ├── __init__.py
│   └── processing.py      # Analytics calculations
├── static/
│   ├── index.html         # Frontend interface
│   ├── script.js          # Frontend logic
│   └── style.css          # Frontend styling
└── .env                   # Local environment config (git-ignored)
```

## Code Optimization Features

- **Modular Functions**: Helper functions for cache checking, video saving, and metrics calculation
- **Error Handling**: Try-catch blocks with logging for API calls
- **Type Hints**: Python type annotations for better code clarity
- **Docstrings**: Comprehensive documentation for all functions
- **Database Indexes**: Optimized indexes on frequently queried fields
- **Cascade Relationships**: Automatic cleanup of related records

## Metrics Explained

- **Engagement Rate**: (Likes + Comments) / Views × 100
- **Best Upload Hour**: UTC hour with highest average view count
- **Posting Frequency**: Average days between uploads
- **Sample Size**: Number of recent videos analyzed (up to 50)

## Performance Considerations

- 24-hour cache TTL reduces API quota usage
- Batch video fetching minimizes API requests
- Database indexes on youtube_id for fast lookups
- Cascade deletes prevent orphaned records

## Troubleshooting

### "YOUTUBE_API_KEY is not set or invalid"
- Verify `.env` file exists with correct API key
- Restart the server after updating `.env`

### "Channel not found"
- Check channel ID format (should start with UC for IDs)
- Try using @handle format instead
- Verify channel exists and is public

### Slow responses
- First load will be slower (API fetch + processing)
- Subsequent requests use cache (24h TTL)
- Use `?force_refresh=true` to bypass cache

## License

MIT License - Feel free to use and modify for personal or commercial projects.

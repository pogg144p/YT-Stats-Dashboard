# Development Guide

## Architecture Overview

### API Layer (main.py)
- FastAPI application with dependency injection
- Three main endpoints: `/`, `/analyze`, `/compare`
- Helper functions for cache management and data persistence

### Database Layer (database.py)
- SQLAlchemy ORM setup
- Session management and connection pooling
- Environment-based configuration

### Models (models.py)
- **Channel**: Stores YouTube channel metadata and cache
- **Video**: Stores recent video metrics linked to channels
- Database indexes for optimal query performance

### YouTube Integration (youtube_client.py)
- Handles API authentication
- Channel identifier normalization (ID, handle, URL, username)
- Video fetching and statistics retrieval
- Error handling and logging

### Analytics Engine (services/processing.py)
- Calculates engagement metrics
- Determines optimal posting times
- Analyzes posting frequency
- Helper functions for metric calculation

## Development Workflow

### Adding New Endpoints

1. Define the endpoint in `main.py`
2. Use dependency injection for database sessions
3. Add docstrings explaining parameters and response

```python
@app.get("/new-endpoint")
def new_endpoint(channel_id: str, db: Session = Depends(get_db)):
    """Brief description of endpoint."""
    # Implementation
```

### Adding Database Models

1. Create new class in `models.py` extending `Base`
2. Define columns with appropriate types
3. Add relationships if needed
4. Run database migration (SQLAlchemy creates tables automatically)

### Extending YouTube API Integration

1. Add new functions to `youtube_client.py`
2. Include error handling and logging
3. Document parameter formats

### Adding New Metrics

1. Create helper function in `services/processing.py`
2. Add calculation logic with proper error handling
3. Update `calculate_channel_metrics()` to include new metric

## Testing

### Manual API Testing
```bash
# Analyze channel
curl "http://localhost:8000/analyze?channel_id=UCX6OQ3DkcsbYNE6H8uQQuVA"

# Compare channels
curl "http://localhost:8000/compare?channel_id_1=UCX6OQ3DkcsbYNE6H8uQQuVA&channel_id_2=UCtFO9MlYrLn5w0kT2iyStpQ"

# Force refresh (bypass cache)
curl "http://localhost:8000/analyze?channel_id=UCX6OQ3DkcsbYNE6H8uQQuVA&force_refresh=true"
```

### Database Access
```python
from database import SessionLocal
from models import Channel, Video

db = SessionLocal()
channels = db.query(Channel).all()
db.close()
```

## Configuration

### Environment Variables
```
YOUTUBE_API_KEY=your_api_key_here
DATABASE_URL=sqlite:///./yt_stats.db  # Optional, defaults to SQLite
```

### Constants (main.py)
- `CACHE_DURATION_HOURS`: Cache TTL (default: 24 hours)
- `MAX_RECENT_VIDEOS`: Videos analyzed per channel (default: 50)

## Performance Optimization Tips

1. **API Quotas**: Each channel analysis uses ~100 quota units
   - Daily limit: 10,000 quota (approximately 100 channel analyses)
   - Cache reduces quota usage significantly

2. **Database Optimization**
   - Indexes on `youtube_id` reduce query time
   - Cascade deletes prevent orphaned records

3. **Response Time**
   - Cached responses: <100ms
   - Fresh API fetch: 2-5 seconds

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| API quota exceeded | Wait 24h or upgrade API tier |
| Slow first response | Expected (API fetch + processing) |
| Channel not found | Verify channel is public |
| Database locked | Restart server |
| Import errors | Reinstall requirements: `pip install -r requirements.txt` |

## Future Enhancements

- [ ] Authentication and rate limiting per user
- [ ] Advanced metrics (thumbnail analysis, transcript analysis)
- [ ] Trend analysis and predictions
- [ ] Batch channel analysis
- [ ] Export metrics to CSV/JSON
- [ ] Scheduled data collection
- [ ] Database migrations system
- [ ] Unit tests and integration tests

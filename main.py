import os
import json
import logging
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from youtube_client import fetch_channel_data, fetch_recent_videos
from services.processing import calculate_channel_metrics
import models

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Create all DB tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="YouTube Content Intelligence MVP",
    description=(
        "Backend-driven data system that analyzes and compares "
        "YouTube channels."
    ),
    version="1.0.0"
)

# Get the directory of the current script for absolute paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

# Constants
CACHE_DURATION_HOURS = 24
MAX_RECENT_VIDEOS = 50

os.makedirs(STATIC_DIR, exist_ok=True)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def root():
    """Serve the main frontend page."""
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


def _check_cache(existing_channel: models.Channel, force_refresh: bool) -> dict | None:
    """Check if cached channel data is still valid."""
    if force_refresh or not existing_channel:
        return None

    cache_age = (
        datetime.now(timezone.utc) -
        existing_channel.updated_at.replace(tzinfo=timezone.utc)
    )
    
    if cache_age >= timedelta(hours=CACHE_DURATION_HOURS):
        return None

    if existing_channel.insights_cache:
        try:
            return json.loads(existing_channel.insights_cache)
        except json.JSONDecodeError:
            logger.warning(f"Failed to parse cached insights for channel {existing_channel.youtube_id}")
            return None
    
    return None


def _save_videos_to_db(db: Session, recent_videos: list, channel_id: int) -> None:
    """Save or update videos in the database."""
    for v in recent_videos:
        v_id = v.get("id")
        existing_video = db.query(models.Video).filter(
            models.Video.youtube_id == v_id
        ).first()

        if not existing_video:
            existing_video = models.Video(
                youtube_id=v_id,
                channel_id=channel_id
            )
            db.add(existing_video)

        v_stats = v.get("statistics", {})
        existing_video.title = v.get("snippet", {}).get("title")
        existing_video.view_count = int(v_stats.get("viewCount", 0))
        existing_video.like_count = int(v_stats.get("likeCount", 0))
        existing_video.comment_count = int(v_stats.get("commentCount", 0))
        existing_video.updated_at = datetime.now(timezone.utc)

    db.commit()


@app.get("/analyze")
def analyze_channel(
    channel_id: str,
    db: Session = Depends(get_db),
    force_refresh: bool = Query(False)
):
    """Analyze a YouTube channel and return metrics."""
    # 1. Check for cached version in DB
    existing_channel = db.query(models.Channel).filter(
        models.Channel.youtube_id == channel_id
    ).first()

    cached_insights = _check_cache(existing_channel, force_refresh)
    if cached_insights:
        return {
            "channel_id": channel_id,
            "insights": cached_insights,
            "cached": True,
            "last_updated": existing_channel.updated_at.isoformat()
        }

    # 2. Fetch from YouTube API if needed
    logger.info(f"Fetching data for channel: {channel_id}")
    channel_data = fetch_channel_data(channel_id)
    if not channel_data:
        raise HTTPException(status_code=404, detail="Channel not found")

    # Update or create channel in DB
    if not existing_channel:
        existing_channel = models.Channel(youtube_id=channel_id)
        db.add(existing_channel)

    stats = channel_data.get("statistics", {})
    existing_channel.title = channel_data.get("snippet", {}).get("title")
    existing_channel.subscriber_count = int(stats.get("subscriberCount", 0))
    existing_channel.view_count = int(stats.get("viewCount", 0))
    existing_channel.video_count = int(stats.get("videoCount", 0))
    existing_channel.updated_at = datetime.now(timezone.utc)

    db.flush()
    db.refresh(existing_channel)

    # 3. Fetch recent videos
    upl_pl = channel_data.get("contentDetails", {}).get(
        "relatedPlaylists", {}
    ).get("uploads")
    recent_videos = []
    if upl_pl:
        recent_videos = fetch_recent_videos(upl_pl, max_results=MAX_RECENT_VIDEOS)

    # 4. Save videos to DB
    _save_videos_to_db(db, recent_videos, existing_channel.id)

    # 5. Process data into insights
    insights = calculate_channel_metrics(channel_data, recent_videos)

    # 6. Cache insights
    existing_channel.insights_cache = json.dumps(insights)
    db.commit()

    return {"channel_id": channel_id, "insights": insights}


@app.get("/compare")
def compare_channels(
    channel_id_1: str,
    channel_id_2: str,
    db: Session = Depends(get_db),
    force_refresh: bool = Query(False)
):
    """Compare metrics between two YouTube channels."""
    res_1 = analyze_channel(channel_id_1, db, force_refresh)
    res_2 = analyze_channel(channel_id_2, db, force_refresh)

    # Compare engagement rates
    eng_1 = res_1["insights"].get("average_engagement_rate_percent", 0)
    eng_2 = res_2["insights"].get("average_engagement_rate_percent", 0)
    better_engagement = channel_id_1 if eng_1 > eng_2 else channel_id_2

    return {
        "comparison": {
            "channel_1": res_1["insights"],
            "channel_2": res_2["insights"]
        },
        "conclusion": {
            "higher_engagement": better_engagement
        }
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)

import os
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from database import engine, Base, get_db
from youtube_client import fetch_channel_data, fetch_recent_videos
from services.processing import calculate_channel_metrics
import models

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

# Line 21 was import os (moved)
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/")
def root():
    return FileResponse("static/index.html")


@app.get("/analyze")
def analyze_channel(
    channel_id: str,
    db: Session = Depends(get_db),
    force_refresh: bool = Query(False)
):
    # 1. Check for cached version in DB
    existing_channel = db.query(models.Channel).filter(
        models.Channel.youtube_id == channel_id
    ).first()

    # If we have a fresh cache (less than 24h) and not forced, return it
    if not force_refresh and existing_channel:
        cache_age = (
            datetime.now(timezone.utc) -
            existing_channel.updated_at.replace(tzinfo=timezone.utc)
        )
        if cache_age < timedelta(hours=24):
            # Return cached data structure
            return {
                "channel_id": channel_id,
                "insights": {
                    "channel_title": existing_channel.title,
                    "subscribers": existing_channel.subscriber_count,
                    "total_views": existing_channel.view_count,
                    "video_count": existing_channel.video_count,
                    "cached": True,
                    "last_updated": existing_channel.updated_at.isoformat()
                }
            }

    # 2. Fetch from YouTube API if needed
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

    # Flush so the channel gets its ID before we reference it in videos
    db.flush()
    db.refresh(existing_channel)

    upl_pl = channel_data.get("contentDetails", {}).get(
        "relatedPlaylists", {}
    ).get("uploads")
    recent_videos = []
    if upl_pl:
        recent_videos = fetch_recent_videos(upl_pl, max_results=50)

    # 3. Save videos to DB (optional but good for caching)
    for v in recent_videos:
        v_id = v.get("id")
        existing_video = db.query(models.Video).filter(
            models.Video.youtube_id == v_id
        ).first()

        if not existing_video:
            existing_video = models.Video(
                youtube_id=v_id,
                channel_id=existing_channel.id
            )
            db.add(existing_video)

        v_stats = v.get("statistics", {})
        existing_video.title = v.get("snippet", {}).get("title")
        existing_video.view_count = int(v_stats.get("viewCount", 0))
        existing_video.like_count = int(v_stats.get("likeCount", 0))
        existing_video.comment_count = int(v_stats.get("commentCount", 0))
        existing_video.updated_at = datetime.now(timezone.utc)

    db.commit()

    # 4. Process data into insights
    insights = calculate_channel_metrics(channel_data, recent_videos)

    return {"channel_id": channel_id, "insights": insights}


@app.get("/compare")
def compare_channels(
    channel_id_1: str,
    channel_id_2: str,
    db: Session = Depends(get_db),
    force_refresh: bool = Query(False)
):
    res_1 = analyze_channel(channel_id_1, db, force_refresh)
    res_2 = analyze_channel(channel_id_2, db, force_refresh)

    # Create simple comparative analysis
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

from fastapi import FastAPI, HTTPException, Depends
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
    description="Backend-driven data system that analyzes and compares YouTube channels.",
    version="1.0.0"
)

import os
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
def root():
    return FileResponse("static/index.html")

@app.get("/analyze")
def analyze_channel(channel_id: str, db: Session = Depends(get_db)):
    # 1. Fetch channel info
    channel_data = fetch_channel_data(channel_id)
    if not channel_data:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    # Optional: Save channel data to DB
    # Using `get_or_create` pattern ideally, here we focus on insights.
    
    uploads_playlist = channel_data.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
    recent_videos = []
    if uploads_playlist:
        recent_videos = fetch_recent_videos(uploads_playlist, max_results=50)

    # 2. Process data into insights
    insights = calculate_channel_metrics(channel_data, recent_videos)
    
    return {"channel_id": channel_id, "insights": insights}

@app.get("/compare")
def compare_channels(channel_id_1: str, channel_id_2: str, db: Session = Depends(get_db)):
    res_1 = analyze_channel(channel_id_1, db)
    res_2 = analyze_channel(channel_id_2, db)
    
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

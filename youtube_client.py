"""YouTube API client for fetching channel and video data."""
import os
import logging
from urllib.parse import urlparse
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")


def get_youtube_client():
    """Returns an authenticated YouTube API client."""
    if not YOUTUBE_API_KEY or YOUTUBE_API_KEY == "paste_your_api_key_here":
        raise ValueError(
            "YOUTUBE_API_KEY is not set or invalid in environment variables."
        )
    return build("youtube", "v3", developerKey=YOUTUBE_API_KEY)


def normalize_channel_identifier(identifier: str) -> str:
    """Normalize a channel input to a channel ID, handle, or username."""
    identifier = identifier.strip()
    
    # Handle URL inputs
    if "youtube.com" in identifier or "youtu.be" in identifier:
        parsed = urlparse(identifier)
        parts = [p for p in (parsed.path or "").split("/") if p]
        if not parts:
            return identifier
            
        if parts[0] == "channel" and len(parts) > 1:
            return parts[1]
        if parts[0] in {"c", "user"} and len(parts) > 1:
            return parts[1]
        if parts[0].startswith("@"):
            return parts[0]
        return parts[0]
    
    return identifier


def fetch_channel_data(identifier: str):
    """Fetches base data for a channel using an ID, Handle, Username, or URL."""
    try:
        youtube = get_youtube_client()
        identifier = normalize_channel_identifier(identifier)

        # Try handle format (e.g., @channelname)
        if identifier.startswith("@"):
            request = youtube.channels().list(
                part="snippet,statistics,contentDetails", forHandle=identifier
            )
            response = request.execute()
            if response.get("items"):
                return response["items"][0]
            identifier = identifier[1:]

        # Try channel ID format
        if identifier.startswith("UC") and len(identifier) >= 24:
            request = youtube.channels().list(
                part="snippet,statistics,contentDetails", id=identifier
            )
            response = request.execute()
            if response.get("items"):
                return response["items"][0]

        # Try handle form if plain handle was entered
        request = youtube.channels().list(
            part="snippet,statistics,contentDetails",
            forHandle=f"@{identifier}"
        )
        response = request.execute()
        if response.get("items"):
            return response["items"][0]

        # Try username format
        request = youtube.channels().list(
            part="snippet,statistics,contentDetails", forUsername=identifier
        )
        response = request.execute()
        if response.get("items"):
            return response["items"][0]

        return None
    except Exception as e:
        logger.error(f"Error fetching channel data for {identifier}: {e}")
        return None


def fetch_recent_videos(uploads_playlist_id: str, max_results: int | None = 50):
    """Fetches latest videos from a channel's upload playlist.

    If `max_results` is None, paginate through the entire playlist and return
    all video items. Otherwise, fetch up to `max_results` items (YouTube API
    limits `maxResults` per request to 50).
    """
    try:
        youtube = get_youtube_client()

        video_ids = []
        next_token = None
        fetched = 0

        # If max_results is None, fetch all pages until exhausted.
        per_page = 50
        while True:
            req_max = per_page if (max_results is None) else min(per_page, max_results - fetched)
            if req_max <= 0:
                break

            playlist_request = youtube.playlistItems().list(
                part="snippet,contentDetails",
                playlistId=uploads_playlist_id,
                maxResults=req_max,
                pageToken=next_token
            )
            playlist_response = playlist_request.execute()

            items = playlist_response.get("items", [])
            video_ids.extend([item["contentDetails"]["videoId"] for item in items])
            fetched += len(items)

            next_token = playlist_response.get('nextPageToken')
            if not next_token or (max_results is not None and fetched >= max_results):
                break

        if not video_ids:
            return []

        # Fetch video statistics + contentDetails (needed for Shorts detection)
        # The videos.list endpoint accepts up to 50 ids per request; split if needed
        all_video_items = []
        for i in range(0, len(video_ids), 50):
            chunk = video_ids[i:i+50]
            videos_request = youtube.videos().list(
                part="snippet,statistics,contentDetails",
                id=",".join(chunk)
            )
            videos_response = videos_request.execute()
            all_video_items.extend(videos_response.get("items", []))

        return all_video_items
    except Exception as e:
        logger.error(f"Error fetching recent videos: {e}")
        return []

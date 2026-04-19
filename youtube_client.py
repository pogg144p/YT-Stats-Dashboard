import os
from urllib.parse import urlparse
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")


def get_youtube_client():
    """Returns an authenticated YouTube API client."""
    if not YOUTUBE_API_KEY or YOUTUBE_API_KEY == "paste_your_api_key_here":
        raise ValueError(
            "YOUTUBE_API_KEY is not set or invalid in "
            "the environment variables."
        )
    return build("youtube", "v3", developerKey=YOUTUBE_API_KEY)


def normalize_channel_identifier(identifier: str) -> str:
    """Normalize a channel input to a channel ID, handle, or username."""
    identifier = identifier.strip()
    if "youtube.com" in identifier or "youtu.be" in identifier:
        parsed = urlparse(identifier)
        parts = [part for part in (parsed.path or "").split("/") if part]
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
    """
    Fetches base data for a channel using an ID, Handle, Username, or URL.
    """
    youtube = get_youtube_client()
    identifier = normalize_channel_identifier(identifier)

    if identifier.startswith("@"):
        request = youtube.channels().list(
            part="snippet,statistics,contentDetails", forHandle=identifier
        )
        response = request.execute()
        if response.get("items"):
            return response["items"][0]
        identifier = identifier[1:]

    if identifier.startswith("UC") and len(identifier) >= 24:
        request = youtube.channels().list(
            part="snippet,statistics,contentDetails", id=identifier
        )
        response = request.execute()
        if response.get("items"):
            return response["items"][0]

    # Try handle form if the user entered a plain handle without @.
        request = youtube.channels().list(
            part="snippet,statistics,contentDetails",
            forHandle=f"@{identifier}"
        )
        response = request.execute()
        if response.get("items"):
            return response["items"][0]

        request = youtube.channels().list(
            part="snippet,statistics,contentDetails", forUsername=identifier
        )
        response = request.execute()
        if response.get("items"):
            return response["items"][0]

    return None


def fetch_recent_videos(uploads_playlist_id: str, max_results: int = 50):
    """Fetches latest videos from a channel's upload playlist."""
    youtube = get_youtube_client()

    # First, get playlist items
    playlist_request = youtube.playlistItems().list(
        part="snippet,contentDetails",
        playlistId=uploads_playlist_id,
        maxResults=max_results
    )
    playlist_response = playlist_request.execute()

    items = playlist_response.get("items", [])
    video_ids = [item["contentDetails"]["videoId"] for item in items]

    if not video_ids:
        return []

    # Then fetch rich video statistics for those ids
    video_request = youtube.videos().list(
        part="snippet,statistics,contentDetails",
        id=",".join(video_ids)
    )
    video_response = video_request.execute()

    return video_response.get("items", [])

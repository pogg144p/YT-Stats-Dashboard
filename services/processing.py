"""YouTube analytics processing and metrics calculation."""
import logging
from typing import List, Dict, Any
from datetime import datetime

logger = logging.getLogger(__name__)


def _extract_video_stats(video: dict) -> tuple[int, int, int, datetime]:
    """Extract and parse video statistics."""
    stats = video.get("statistics", {})
    views = int(stats.get("viewCount", 0))
    likes = int(stats.get("likeCount", 0))
    comments = int(stats.get("commentCount", 0))
    
    pub_str = video["snippet"]["publishedAt"]
    published_date = datetime.fromisoformat(pub_str.replace("Z", "+00:00"))
    
    return views, likes, comments, published_date


def _calculate_engagement_rate(total_views: int, total_engagement: int) -> float:
    """Calculate engagement rate as percentage."""
    if total_views <= 0:
        return 0.0
    return round(((total_engagement) / total_views) * 100, 2)


def _find_best_upload_hour(upload_hours: Dict[int, List[int]]) -> int | None:
    """Find the hour with highest average views."""
    if not upload_hours:
        return None
    
    best_hour = None
    max_avg_views = -1
    
    for hour, views_list in upload_hours.items():
        avg_views = sum(views_list) / len(views_list)
        if avg_views > max_avg_views:
            max_avg_views = avg_views
            best_hour = hour
    
    return best_hour


def _calculate_posting_frequency(published_dates: List[datetime]) -> float | None:
    """Calculate average days between posts."""
    if len(published_dates) <= 1:
        return None
    
    published_dates.sort(reverse=True)
    date_diffs = [
        (published_dates[i] - published_dates[i+1]).total_seconds() / 86400
        for i in range(len(published_dates) - 1)
    ]
    
    return round(sum(date_diffs) / len(date_diffs), 1)


def calculate_channel_metrics(
    channel_data: dict, recent_videos: List[dict]
) -> Dict[str, Any]:
    """Compute derived metrics for a YouTube channel based on raw data."""
    if not channel_data:
        return {}

    stats = channel_data.get("statistics", {})
    subscribers = int(stats.get("subscriberCount", 0))
    total_views = int(stats.get("viewCount", 0))
    video_count = int(stats.get("videoCount", 0))
    channel_title = channel_data.get("snippet", {}).get("title")

    if not recent_videos:
        return {
            "channel_title": channel_title,
            "subscribers": subscribers,
            "total_views": total_views,
            "video_count": video_count,
            "average_engagement_rate_percent": None,
            "best_upload_hour_utc": None,
            "avg_days_between_uploads": None,
            "recent_video_sample_size": 0,
            "upload_hours_history": {},
            "error": "No recent videos found to analyze engagement or upload patterns."
        }

    total_recent_views = 0
    total_engagement = 0
    upload_hours = {}
    published_dates = []

    # Process video data
    for video in recent_videos:
        try:
            views, likes, comments, pub_date = _extract_video_stats(video)
            total_recent_views += views
            total_engagement += likes + comments
            published_dates.append(pub_date)
            
            hour = pub_date.hour
            if hour not in upload_hours:
                upload_hours[hour] = []
            upload_hours[hour].append(views)
        except (KeyError, ValueError) as e:
            logger.warning(f"Error processing video stats: {e}")
            continue

    # Calculate metrics
    engagement_rate = _calculate_engagement_rate(total_recent_views, total_engagement)
    best_hour = _find_best_upload_hour(upload_hours)
    avg_days_between = _calculate_posting_frequency(published_dates)

    # Build upload hours history
    upload_hours_history = {
        hour: round(sum(views_list) / len(views_list))
        for hour, views_list in upload_hours.items()
    }

    return {
        "channel_title": channel_title,
        "subscribers": subscribers,
        "total_views": total_views,
        "video_count": video_count,
        "average_engagement_rate_percent": engagement_rate,
        "best_upload_hour_utc": best_hour,
        "avg_days_between_uploads": avg_days_between,
        "recent_video_sample_size": len(recent_videos),
        "upload_hours_history": upload_hours_history
    }

from typing import List, Dict, Any
from datetime import datetime

def calculate_channel_metrics(channel_data: dict, recent_videos: List[dict]) -> Dict[str, Any]:
    """
    Computes derived metrics for a YouTube channel based on raw data using pure Python.
    """
    if not channel_data:
        return {}

    stats = channel_data.get("statistics", {})
    subscribers = int(stats.get("subscriberCount", 0))
    total_views = int(stats.get("viewCount", 0))
    video_count = int(stats.get("videoCount", 0))

    if not recent_videos:
        return {
            "subscribers": subscribers,
            "total_views": total_views,
            "video_count": video_count,
            "error": "No recent videos found."
        }

    total_recent_views = 0
    total_recent_likes = 0
    total_recent_comments = 0
    upload_hours = {}
    published_dates = []

    for v in recent_videos:
        v_stats = v.get("statistics", {})
        views = int(v_stats.get("viewCount", 0))
        likes = int(v_stats.get("likeCount", 0))
        comments = int(v_stats.get("commentCount", 0))

        total_recent_views += views
        total_recent_likes += likes
        total_recent_comments += comments

        # Parse ISO 8601 date (e.g., 2024-04-16T15:30:00Z)
        pub_str = v["snippet"]["publishedAt"].replace('Z', '+00:00')
        dt = datetime.fromisoformat(pub_str)
        published_dates.append(dt)

        hour = dt.hour
        if hour not in upload_hours:
            upload_hours[hour] = []
        upload_hours[hour].append(views)

    # Engagement Rate
    if total_recent_views > 0:
        overall_engagement = ((total_recent_likes + total_recent_comments) / total_recent_views) * 100
    else:
        overall_engagement = 0.0

    # Best upload time
    best_hour = None
    max_avg_views = -1
    for hour, views_list in upload_hours.items():
        avg_v = sum(views_list) / len(views_list)
        if avg_v > max_avg_views:
            max_avg_views = avg_v
            best_hour = hour

    # Posting frequency
    avg_days_between_posts = None
    if len(published_dates) > 1:
        published_dates.sort(reverse=True)
        date_diffs = [(published_dates[i] - published_dates[i+1]).total_seconds() / 86400.0 for i in range(len(published_dates)-1)]
        avg_days_between_posts = round(sum(date_diffs) / len(date_diffs), 1)

    return {
        "channel_title": channel_data.get("snippet", {}).get("title"),
        "subscribers": subscribers,
        "total_views": total_views,
        "video_count": video_count,
        "average_engagement_rate_percent": round(overall_engagement, 2),
        "best_upload_hour_utc": best_hour,
        "avg_days_between_uploads": avg_days_between_posts,
        "recent_video_sample_size": len(recent_videos)
    }

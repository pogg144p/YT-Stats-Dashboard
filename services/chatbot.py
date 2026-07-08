"""Gemini AI chatbot — persistent multi-turn conversations (google-genai SDK)."""
import os
import logging

logger = logging.getLogger(__name__)

GEMINI_API_KEY = ""
_client = None

SYSTEM_PROMPT = (
    "You are an expert YouTube channel analyst and growth advisor. "
    "When channel metrics are provided, reference the actual numbers and give "
    "specific, data-driven advice. Be conversational, concise, and insightful. "
    "If you don't have data for something, say so honestly. "
    "Help creators understand their metrics and how to improve them."
)


def _is_configured() -> bool:
    return bool(os.environ.get("GEMINI_API_KEY", ""))


def _get_client():
    """Lazy-init the Gemini client (new google-genai SDK)."""
    global _client
    if not _client:
        from google import genai
        api_key = os.environ.get("GEMINI_API_KEY", "")
        _client = genai.Client(api_key=api_key)
    return _client


def _format_channel_context(insights: dict) -> str:
    """Serialise channel metrics into a text block for the AI prompt."""
    if not insights:
        return ""
    lines = ["[Current Channel Metrics]"]
    mapping = [
        ("channel_title",                   "Channel"),
        ("subscribers",                     "Subscribers"),
        ("total_views",                     "Total Views"),
        ("video_count",                     "Total Videos (all-time)"),
        ("shorts_count",                    "Shorts (recent 50)"),
        ("normal_video_count",              "Normal Videos (recent 50)"),
        ("shorts_percentage",               "Shorts % of recent uploads"),
        ("average_engagement_rate_percent", "Engagement Rate (%)"),
        ("best_upload_hour_utc",            "Best Upload Hour (UTC)"),
        ("avg_days_between_uploads",        "Avg Days Between Uploads"),
        ("recent_video_sample_size",        "Recent Video Sample Size"),
    ]
    for key, label in mapping:
        val = insights.get(key)
        if val is not None and val != "":
            lines.append(f"{label}: {val}")
    return "\n".join(lines)


def chat(
    user_message: str,
    history: list,
    channel_insights: dict | None = None,
) -> str:
    """
    Send a message to Gemini with conversation history and optional channel context.
    Returns the AI's text response.
    """
    if not _is_configured():
        return (
            "⚠️ AI chat is not yet configured on this server. "
            "Please add a GEMINI_API_KEY to the Render environment variables."
        )
    try:
        from google.genai import types

        client = _get_client()

        # Build contents list from stored history
        contents = []
        for m in history:
            role = "user" if m["role"] == "user" else "model"
            contents.append(
                types.Content(
                    role=role,
                    parts=[types.Part(text=m["content"])]
                )
            )

        # Augment the user's message with channel context if available
        context = _format_channel_context(channel_insights or {})
        full_message = f"{context}\n\n{user_message}" if context else user_message

        # Append current user message
        contents.append(
            types.Content(
                role="user",
                parts=[types.Part(text=full_message)]
            )
        )

        response = client.models.generate_content(
            model="gemini-1.5-flash",
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
            ),
        )
        return response.text

    except Exception as e:
        logger.error(f"Gemini chat error: {e}")
        return "Sorry, I ran into a problem. Please try again in a moment."

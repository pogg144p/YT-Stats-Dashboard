"""Gemini AI chatbot — persistent multi-turn conversations."""
import os
import logging

logger = logging.getLogger(__name__)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")

_model = None

SYSTEM_PROMPT = (
    "You are an expert YouTube channel analyst and growth advisor. "
    "When channel metrics are provided, reference the actual numbers and give "
    "specific, data-driven advice. Be conversational, concise, and insightful. "
    "If you don't have data for something, say so honestly. "
    "Help creators understand their metrics and how to improve them."
)


def _is_configured() -> bool:
    return bool(GEMINI_API_KEY)


def _get_model():
    """Lazy-init the Gemini model."""
    global _model
    if not _model:
        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        _model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction=SYSTEM_PROMPT,
        )
    return _model


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
        model = _get_model()

        # Build Gemini-format history from stored messages
        gemini_history = [
            {"role": "user" if m["role"] == "user" else "model",
             "parts": [m["content"]]}
            for m in history
        ]

        # Augment the user's message with channel context if available
        context = _format_channel_context(channel_insights or {})
        full_message = f"{context}\n\n{user_message}" if context else user_message

        chat_session = model.start_chat(history=gemini_history)
        response = chat_session.send_message(full_message)
        return response.text

    except Exception as e:
        logger.error(f"Gemini chat error: {e}")
        return "Sorry, I ran into a problem. Please try again in a moment."

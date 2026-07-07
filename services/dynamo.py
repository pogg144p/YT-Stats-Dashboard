"""AWS DynamoDB operations — chat history and saved channels."""
import os
import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
CHAT_TABLE = "yt_chat_history"
CHANNELS_TABLE = "yt_user_channels"

_dynamodb = None


def _is_configured() -> bool:
    return bool(
        os.environ.get("AWS_ACCESS_KEY_ID")
        and os.environ.get("AWS_SECRET_ACCESS_KEY")
    )


def _get_dynamodb():
    """Lazy-init the DynamoDB resource."""
    global _dynamodb
    if not _dynamodb:
        import boto3
        _dynamodb = boto3.resource(
            "dynamodb",
            region_name=AWS_REGION,
            aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        )
    return _dynamodb


# ── Chat History ──────────────────────────────────────────────────────────────

def get_chat_history(user_id: str, limit: int = 30) -> list:
    """Fetch the last N messages for a user, oldest-first for AI context."""
    if not _is_configured():
        return []
    try:
        from boto3.dynamodb.conditions import Key
        table = _get_dynamodb().Table(CHAT_TABLE)
        resp = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id),
            ScanIndexForward=False,  # newest first from DynamoDB
            Limit=limit,
        )
        items = resp.get("Items", [])
        items.reverse()  # return oldest-first for Gemini
        return items
    except Exception as e:
        logger.error(f"DynamoDB get_chat_history: {e}")
        return []


def save_chat_message(user_id: str, role: str, content: str) -> None:
    """Persist a single chat message."""
    if not _is_configured():
        return
    try:
        table = _get_dynamodb().Table(CHAT_TABLE)
        table.put_item(Item={
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "role": role,
            "content": content,
        })
    except Exception as e:
        logger.error(f"DynamoDB save_chat_message: {e}")


# ── Saved Channels ────────────────────────────────────────────────────────────

def get_user_channels(user_id: str) -> list:
    """Fetch all channels the user has saved."""
    if not _is_configured():
        return []
    try:
        from boto3.dynamodb.conditions import Key
        table = _get_dynamodb().Table(CHANNELS_TABLE)
        resp = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id),
        )
        return resp.get("Items", [])
    except Exception as e:
        logger.error(f"DynamoDB get_user_channels: {e}")
        return []


def save_user_channel(
    user_id: str,
    channel_id: str,
    channel_title: str,
    insights: dict,
) -> None:
    """Save or update a channel in the user's saved list."""
    if not _is_configured():
        return
    try:
        table = _get_dynamodb().Table(CHANNELS_TABLE)
        table.put_item(Item={
            "user_id": user_id,
            "channel_id": channel_id,
            "channel_title": channel_title,
            "insights": json.dumps(insights),
            "saved_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception as e:
        logger.error(f"DynamoDB save_user_channel: {e}")


def delete_user_channel(user_id: str, channel_id: str) -> None:
    """Remove a channel from the user's saved list."""
    if not _is_configured():
        return
    try:
        table = _get_dynamodb().Table(CHANNELS_TABLE)
        table.delete_item(Key={"user_id": user_id, "channel_id": channel_id})
    except Exception as e:
        logger.error(f"DynamoDB delete_user_channel: {e}")

import datetime
from datetime import timezone
from sqlalchemy import (
    Column, Integer, String, BigInteger, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database import Base


class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    youtube_id = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)

    view_count = Column(BigInteger, default=0)
    subscriber_count = Column(BigInteger, default=0)
    video_count = Column(Integer, default=0)

    created_at = Column(
        DateTime, default=lambda: datetime.datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(timezone.utc),
        onupdate=lambda: datetime.datetime.now(timezone.utc)
    )
    insights_cache = Column(Text, nullable=True)

    videos = relationship("Video", back_populates="channel")


class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    youtube_id = Column(String, unique=True, index=True, nullable=False)
    channel_id = Column(
        Integer, ForeignKey("channels.id"), nullable=False
    )

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    # YouTube returns ISO 8601 durations (e.g., PT15M33S)
    duration = Column(String, nullable=True)

    view_count = Column(BigInteger, default=0)
    like_count = Column(BigInteger, default=0)
    comment_count = Column(BigInteger, default=0)

    created_at = Column(
        DateTime, default=lambda: datetime.datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(timezone.utc),
        onupdate=lambda: datetime.datetime.now(timezone.utc)
    )

    channel = relationship("Channel", back_populates="videos")

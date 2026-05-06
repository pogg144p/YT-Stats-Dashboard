"""SQLAlchemy ORM models for YouTube channels and videos."""
import datetime
from datetime import timezone
from sqlalchemy import (
    Column, Integer, String, BigInteger, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from database import Base


class Channel(Base):
    """YouTube channel model with statistics and cache."""
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    youtube_id = Column(String, unique=True, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)

    view_count = Column(BigInteger, default=0)
    subscriber_count = Column(BigInteger, default=0)
    video_count = Column(Integer, default=0)

    created_at = Column(
        DateTime, 
        default=lambda: datetime.datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(timezone.utc),
        onupdate=lambda: datetime.datetime.now(timezone.utc)
    )
    insights_cache = Column(Text, nullable=True)

    videos = relationship("Video", back_populates="channel", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Channel(youtube_id={self.youtube_id}, title={self.title})>"


class Video(Base):
    """YouTube video model with engagement metrics."""
    __tablename__ = "videos"


    id = Column(Integer, primary_key=True, index=True)
    youtube_id = Column(String, unique=True, nullable=False)
    channel_id = Column(
        Integer, ForeignKey("channels.id", ondelete="CASCADE"), nullable=False
    )

    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    duration = Column(String, nullable=True)

    view_count = Column(BigInteger, default=0)
    like_count = Column(BigInteger, default=0)
    comment_count = Column(BigInteger, default=0)

    created_at = Column(
        DateTime, 
        default=lambda: datetime.datetime.now(timezone.utc)
    )
    updated_at = Column(
        DateTime,
        default=lambda: datetime.datetime.now(timezone.utc),
        onupdate=lambda: datetime.datetime.now(timezone.utc)
    )

    channel = relationship("Channel", back_populates="videos")

    def __repr__(self):
        return f"<Video(youtube_id={self.youtube_id}, title={self.title})>"

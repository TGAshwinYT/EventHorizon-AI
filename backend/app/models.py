from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password_hash = Column(String)
    api_key_gemini = Column(String, nullable=True)
    api_key_huggingface = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    chats = relationship("ChatHistory", back_populates="owner")

class ChatHistory(Base):
    __tablename__ = "chat_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text)
    sender = Column(String) # 'user' or 'ai'
    timestamp = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="chats")

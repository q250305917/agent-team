"""SQLAlchemy 数据库模型定义"""
import json
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


class Team(Base):
    """团队表"""
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    config_path = Column(String(512), default="")
    lead_agent_id = Column(String(255), default="")

    # 关联关系
    members = relationship("Member", back_populates="team", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="team", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="team", cascade="all, delete-orphan")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "config_path": self.config_path,
            "lead_agent_id": self.lead_agent_id,
            "member_count": len(self.members) if self.members else 0,
        }


class Member(Base):
    """成员表"""
    __tablename__ = "members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    name = Column(String(255), nullable=False)
    agent_id = Column(String(255), default="")
    agent_type = Column(String(100), default="")
    model = Column(String(100), default="")
    color = Column(String(50), default="")
    cwd = Column(String(512), default="")

    # 关联关系
    team = relationship("Team", back_populates="members")

    def to_dict(self):
        return {
            "id": self.id,
            "team_id": self.team_id,
            "name": self.name,
            "agent_id": self.agent_id,
            "agent_type": self.agent_type,
            "model": self.model,
            "color": self.color,
            "cwd": self.cwd,
        }


class Message(Base):
    """消息表"""
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    inbox_owner = Column(String(255), nullable=False)
    from_agent = Column(String(255), nullable=False)
    text = Column(Text, default="")
    summary = Column(String(512), default="")
    timestamp = Column(String(50), default="")
    color = Column(String(50), default="")
    read = Column(Boolean, default=False)
    msg_type = Column(String(50), default="normal")

    # 关联关系
    team = relationship("Team", back_populates="messages")

    def to_dict(self):
        return {
            "id": self.id,
            "team_id": self.team_id,
            "inbox_owner": self.inbox_owner,
            "from_agent": self.from_agent,
            "text": self.text,
            "summary": self.summary,
            "timestamp": self.timestamp,
            "color": self.color,
            "read": self.read,
            "msg_type": self.msg_type,
        }


class Task(Base):
    """任务表"""
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    task_id = Column(String(50), nullable=False)
    subject = Column(String(512), default="")
    description = Column(Text, default="")
    status = Column(String(50), default="pending")
    active_form = Column(String(255), default="")
    owner = Column(String(255), default="")
    blocks = Column(JSON, default=list)
    blocked_by = Column(JSON, default=list)

    # 关联关系
    team = relationship("Team", back_populates="tasks")

    def to_dict(self):
        return {
            "id": self.id,
            "team_id": self.team_id,
            "task_id": self.task_id,
            "subject": self.subject,
            "description": self.description,
            "status": self.status,
            "active_form": self.active_form,
            "owner": self.owner,
            "blocks": self.blocks or [],
            "blocked_by": self.blocked_by or [],
        }

"""Pydantic 请求/响应模型定义

统一 API 的请求参数验证和响应格式，包含：
- 请求模型：分页、筛选参数
- 响应模型：标准化的 API 响应包装
- 数据模型：各资源的详细数据结构
"""
from datetime import datetime
from typing import Any, Generic, TypeVar, Optional
from pydantic import BaseModel, Field, field_validator
from enum import Enum


# ============================================================
# 枚举类型
# ============================================================


class TaskStatus(str, Enum):
    """任务状态枚举"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELETED = "deleted"


class MessageType(str, Enum):
    """消息类型枚举"""
    NORMAL = "normal"
    IDLE = "idle"
    SHUTDOWN = "shutdown"
    TASK_ASSIGNMENT = "task_assignment"
    PLAN_APPROVAL = "plan_approval"


# ============================================================
# 分页与筛选基础模型
# ============================================================


class PaginationParams(BaseModel):
    """分页参数基础模型"""
    page: int = Field(default=1, ge=1, description="页码，从 1 开始")
    size: int = Field(default=20, ge=1, le=100, description="每页数量")

    @field_validator("size")
    @classmethod
    def validate_size(cls, v: int) -> int:
        if v > 100:
            raise ValueError("每页最大数量不能超过 100")
        return v

    @property
    def offset(self) -> int:
        """计算 offset 值"""
        return (self.page - 1) * self.size


class MessageFilterParams(BaseModel):
    """消息筛选参数"""
    sender: Optional[str] = Field(default=None, description="按发送者筛选")
    msg_type: Optional[MessageType] = Field(default=None, description="按消息类型筛选")
    search: Optional[str] = Field(default=None, description="关键词搜索")


class TaskFilterParams(BaseModel):
    """任务筛选参数"""
    status: Optional[TaskStatus] = Field(default=None, description="按状态筛选")
    owner: Optional[str] = Field(default=None, description="按负责人筛选")


# ============================================================
# 数据传输对象 (DTO)
# ============================================================


class TeamDTO(BaseModel):
    """团队数据传输对象"""
    id: int
    name: str
    description: str = ""
    created_at: Optional[str] = None
    config_path: str = ""
    lead_agent_id: str = ""
    member_count: int = 0


class MemberDTO(BaseModel):
    """成员数据传输对象"""
    id: int
    team_id: int
    name: str
    agent_id: str = ""
    agent_type: str = ""
    model: str = ""
    color: str = ""
    cwd: str = ""


class MessageDTO(BaseModel):
    """消息数据传输对象"""
    id: int
    team_id: int
    inbox_owner: str
    from_agent: str
    text: str = ""
    summary: str = ""
    timestamp: str = ""
    color: str = ""
    read: bool = False
    msg_type: str = "normal"


class TaskDTO(BaseModel):
    """任务数据传输对象"""
    id: int
    team_id: int
    task_id: str
    subject: str = ""
    description: str = ""
    status: str = "pending"
    active_form: str = ""
    owner: str = ""
    blocks: list[str] = []
    blocked_by: list[str] = []


class TeamDetailDTO(TeamDTO):
    """团队详情，包含成员列表"""
    members: list[MemberDTO] = []


# ============================================================
# 响应模型
# ============================================================


T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    """标准化的 API 响应包装器

    所有 API 响应都使用此格式：
    - success: 请求是否成功
    - data: 响应数据
    - message: 可选的消息文本
    - error: 可选的错误信息
    """
    success: bool = True
    data: Optional[T] = None
    message: Optional[str] = None
    error: Optional[str] = None

    @classmethod
    def ok(cls, data: T, message: Optional[str] = None) -> "ApiResponse[T]":
        """创建成功响应"""
        return cls(success=True, data=data, message=message)

    @classmethod
    def fail(cls, error: str, message: Optional[str] = None) -> "ApiResponse[T]":
        """创建失败响应"""
        return cls(success=False, error=error, message=message)


class PaginatedResponse(BaseModel, Generic[T]):
    """分页响应包装器

    包含分页元数据和数据列表：
    - items: 数据列表
    - total: 总数
    - page: 当前页码
    - size: 每页数量
    - total_pages: 总页数
    """
    items: list[T]
    total: int
    page: int
    size: int
    total_pages: int = 0

    @classmethod
    def create(
        cls,
        items: list[T],
        total: int,
        page: int,
        size: int
    ) -> "PaginatedResponse[T]":
        """创建分页响应"""
        total_pages = (total + size - 1) // size if size > 0 else 0
        return cls(
            items=items,
            total=total,
            page=page,
            size=size,
            total_pages=total_pages
        )


class StatsDTO(BaseModel):
    """统计数据传输对象"""
    team_count: int
    member_count: int
    message_count: int
    task_count: int
    completed_count: int
    completion_rate: float
    # 前端兼容字段
    teams: int
    members: int
    messages: int
    task_completion: float


class MessageFlowDTO(BaseModel):
    """消息流转数据传输对象"""
    team_name: str
    members: list[str]
    flows: list[dict[str, Any]]
    timeline: list[dict[str, Any]]
    type_stats: dict[str, int]
    mermaid: str


# ============================================================
# 错误响应模型
# ============================================================


class ErrorDetail(BaseModel):
    """错误详情"""
    code: str
    message: str
    details: Optional[dict[str, Any]] = None


class ApiErrorResponse(BaseModel):
    """API 错误响应"""
    success: bool = False
    error: ErrorDetail
    request_id: Optional[str] = None

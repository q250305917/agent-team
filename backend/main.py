"""FastAPI 后端服务入口

提供 Agent Teams Dashboard 的 REST API 和 WebSocket 实时推送服务。
启动时全量扫描 ~/.claude/teams/ 和 ~/.claude/tasks/ 目录，
运行时通过 watchdog 监听文件变化进行增量更新。
"""
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import json

from database import init_db, get_db, SessionLocal
from models import Team, Member, Message, Task
from scanner import full_scan
from watcher import start_watcher
from routes.teams import router as teams_router
from routes.messages import router as messages_router
from routes.tasks import router as tasks_router

# 日志配置
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# WebSocket 连接管理
connected_clients: set[WebSocket] = set()


async def broadcast_to_clients(event: dict):
    """向所有已连接的 WebSocket 客户端广播事件"""
    if not connected_clients:
        return
    message = json.dumps(event, ensure_ascii=False)
    disconnected = set()
    for client in connected_clients:
        try:
            await client.send_text(message)
        except Exception:
            disconnected.add(client)
    # 清理断开的连接
    connected_clients.difference_update(disconnected)


# 全局变量：文件监控器
_observer = None
_handler = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理：启动时初始化数据库和扫描，关闭时停止监控"""
    global _observer, _handler

    # 初始化数据库
    init_db()
    logger.info("数据库初始化完成")

    # 全量扫描
    full_scan()

    # 启动文件监控
    _observer, _handler = start_watcher(broadcast_to_clients)
    _handler.set_loop(asyncio.get_event_loop())
    logger.info("文件监控已启动")

    yield

    # 停止文件监控
    if _observer:
        _observer.stop()
        _observer.join()
        logger.info("文件监控已停止")


# 创建 FastAPI 应用
app = FastAPI(
    title="Agent Teams Dashboard API",
    description="Claude Code 团队通信消息查看 Dashboard 的后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 配置，允许前端开发服务器访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 挂载路由
app.include_router(teams_router)
app.include_router(messages_router)
app.include_router(tasks_router)


@app.get("/api/messages")
def get_all_messages(
    team: str | None = None,
    from_agent: str | None = None,
    msg_type: str | None = None,
    search: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    """获取全局消息列表，支持筛选"""
    db = SessionLocal()
    try:
        query = db.query(Message)
        if team:
            t = db.query(Team).filter(Team.name == team).first()
            if t:
                query = query.filter(Message.team_id == t.id)
        if from_agent:
            query = query.filter(Message.from_agent == from_agent)
        if msg_type:
            query = query.filter(Message.msg_type == msg_type)
        if search:
            query = query.filter(Message.text.contains(search))
        messages = query.order_by(Message.timestamp.desc()).offset(offset).limit(limit).all()
        return [m.to_dict() for m in messages]
    finally:
        db.close()


@app.get("/api/tasks")
def get_all_tasks(
    team: str | None = None,
    status: str | None = None,
):
    """获取全局任务列表，支持筛选"""
    db = SessionLocal()
    try:
        query = db.query(Task)
        if team:
            t = db.query(Team).filter(Team.name == team).first()
            if t:
                query = query.filter(Task.team_id == t.id)
        if status:
            query = query.filter(Task.status == status)
        tasks = query.order_by(Task.id).all()
        return [t.to_dict() for t in tasks]
    finally:
        db.close()


@app.get("/api/stats")
def get_stats():
    """获取统计数据：团队数、成员数、消息数、任务数及完成率"""
    db = SessionLocal()
    try:
        team_count = db.query(Team).count()
        member_count = db.query(Member).count()
        message_count = db.query(Message).count()
        task_count = db.query(Task).count()
        completed_count = db.query(Task).filter(Task.status == "completed").count()
        completion_rate = (completed_count / task_count * 100) if task_count > 0 else 0

        return {
            "team_count": team_count,
            "member_count": member_count,
            "message_count": message_count,
            "task_count": task_count,
            "completed_count": completed_count,
            "completion_rate": round(completion_rate, 1),
            # 前端兼容字段
            "teams": team_count,
            "members": member_count,
            "messages": message_count,
            "task_completion": round(completion_rate, 1),
        }
    finally:
        db.close()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    """WebSocket 端点：实时推送文件变化事件

    客户端连接后，当 ~/.claude/teams/ 或 ~/.claude/tasks/ 下的文件发生变化时，
    会收到 JSON 格式的事件通知：
    - {type: "team_update", data: {team: "xxx"}}
    - {type: "message_new", data: {team: "xxx"}}
    - {type: "task_update", data: {team: "xxx"}}
    """
    await ws.accept()
    connected_clients.add(ws)
    logger.info(f"WebSocket 客户端已连接，当前连接数: {len(connected_clients)}")
    try:
        while True:
            # 保持连接，等待客户端消息（心跳）
            await ws.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        connected_clients.discard(ws)
        logger.info(f"WebSocket 客户端已断开，当前连接数: {len(connected_clients)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)

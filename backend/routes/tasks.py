"""任务相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Team, Task

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


@router.get("/{team_name}")
def get_team_tasks(
    team_name: str,
    status: str | None = Query(None, description="按状态筛选: pending/in_progress/completed"),
    db: Session = Depends(get_db),
):
    """获取指定团队的任务列表"""
    team = db.query(Team).filter(Team.name == team_name).first()
    if not team:
        raise HTTPException(status_code=404, detail=f"团队 '{team_name}' 不存在")

    query = db.query(Task).filter(Task.team_id == team.id)

    if status:
        query = query.filter(Task.status == status)

    tasks = query.order_by(Task.task_id).all()
    return [t.to_dict() for t in tasks]

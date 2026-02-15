"""团队相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Team, Task

router = APIRouter(prefix="/api/teams", tags=["teams"])


@router.get("")
def list_teams(db: Session = Depends(get_db)):
    """获取所有团队列表"""
    teams = db.query(Team).all()
    return [t.to_dict() for t in teams]


@router.get("/{name}")
def get_team(name: str, db: Session = Depends(get_db)):
    """获取团队详情，包含成员列表"""
    team = db.query(Team).filter(Team.name == name).first()
    if not team:
        raise HTTPException(status_code=404, detail=f"团队 '{name}' 不存在")
    result = team.to_dict()
    result["members"] = [m.to_dict() for m in team.members]
    return result


@router.get("/{name}/tasks")
def get_team_tasks_by_name(name: str, db: Session = Depends(get_db)):
    """通过团队名获取任务列表"""
    team = db.query(Team).filter(Team.name == name).first()
    if not team:
        raise HTTPException(status_code=404, detail=f"团队 '{name}' 不存在")
    tasks = db.query(Task).filter(Task.team_id == team.id).order_by(Task.task_id).all()
    return [t.to_dict() for t in tasks]

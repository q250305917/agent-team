"""文件扫描器：扫描 ~/.claude/teams/ 和 ~/.claude/tasks/ 目录，解析数据并写入数据库"""
import os
import json
import logging
from datetime import datetime
from pathlib import Path
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Team, Member, Message, Task

logger = logging.getLogger(__name__)

# 数据源目录
TEAMS_DIR = os.path.expanduser("~/.claude/teams")
TASKS_DIR = os.path.expanduser("~/.claude/tasks")


def _is_safe_path(base_dir: str, target_path: str) -> bool:
    """验证目标路径是否在基础目录内，防止路径遍历攻击

    Args:
        base_dir: 基础目录路径
        target_path: 需要验证的目标路径

    Returns:
        如果目标路径在基础目录内返回 True，否则返回 False
    """
    base = Path(base_dir).resolve()
    target = Path(target_path).resolve()
    try:
        target.relative_to(base)
        return True
    except ValueError:
        logger.warning(f"路径遍历攻击尝试: {target_path} 不在 {base_dir} 内")
        return False


def detect_msg_type(text: str) -> str:
    """根据消息文本内容判断消息类型

    解析 JSON 格式的消息文本，提取 type 字段进行分类：
    - idle_notification -> idle
    - shutdown_request / shutdown_response -> shutdown
    - task_assignment -> task_assignment
    - plan_approval_request / plan_approval_response -> plan_approval
    - 其他或非 JSON -> normal
    """
    if not text or not text.strip().startswith("{"):
        return "normal"
    try:
        data = json.loads(text)
        msg_type = data.get("type", "")
        if "idle" in msg_type:
            return "idle"
        elif "shutdown" in msg_type:
            return "shutdown"
        elif "task_assignment" in msg_type:
            return "task_assignment"
        elif "plan_approval" in msg_type:
            return "plan_approval"
        else:
            return "normal"
    except (json.JSONDecodeError, AttributeError):
        return "normal"


def scan_team(team_dir: str, db: Session) -> Team | None:
    """扫描单个团队目录，解析 config.json 和 inboxes，写入数据库

    返回创建或更新后的 Team 对象
    """
    # 验证 team_dir 是否在 TEAMS_DIR 内，防止路径遍历攻击
    if not _is_safe_path(TEAMS_DIR, team_dir):
        logger.error(f"安全检查失败: {team_dir} 不在允许的目录内")
        return None

    config_path = os.path.join(team_dir, "config.json")
    # 验证 config_path 是否在安全范围内
    if not _is_safe_path(TEAMS_DIR, config_path):
        logger.error(f"安全检查失败: {config_path} 不在允许的目录内")
        return None

    if not os.path.exists(config_path):
        return None

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        logger.error(f"读取配置文件失败 {config_path}: {e}")
        return None

    team_name = config.get("name", os.path.basename(team_dir))

    # 查找或创建团队记录
    team = db.query(Team).filter(Team.name == team_name).first()
    if not team:
        team = Team(name=team_name)
        db.add(team)

    # 更新团队信息
    team.description = config.get("description", "")
    created_at_ms = config.get("createdAt")
    if created_at_ms:
        team.created_at = datetime.utcfromtimestamp(created_at_ms / 1000)
    team.config_path = config_path
    team.lead_agent_id = config.get("leadAgentId", "")

    db.flush()  # 获取 team.id

    # 清除旧的成员数据并重新写入
    db.query(Member).filter(Member.team_id == team.id).delete()
    for m in config.get("members", []):
        member = Member(
            team_id=team.id,
            name=m.get("name", ""),
            agent_id=m.get("agentId", ""),
            agent_type=m.get("agentType", ""),
            model=m.get("model", ""),
            color=m.get("color", ""),
            cwd=m.get("cwd", ""),
        )
        db.add(member)

    # 扫描 inboxes 目录中的消息
    inboxes_dir = os.path.join(team_dir, "inboxes")
    if os.path.isdir(inboxes_dir):
        # 清除旧消息并重新写入
        db.query(Message).filter(Message.team_id == team.id).delete()
        for inbox_file in os.listdir(inboxes_dir):
            if not inbox_file.endswith(".json"):
                continue
            inbox_owner = inbox_file.replace(".json", "")
            inbox_path = os.path.join(inboxes_dir, inbox_file)
            try:
                with open(inbox_path, "r", encoding="utf-8") as f:
                    messages = json.load(f)
                if not isinstance(messages, list):
                    continue
                for msg in messages:
                    text = msg.get("text", "")
                    message = Message(
                        team_id=team.id,
                        inbox_owner=inbox_owner,
                        from_agent=msg.get("from", ""),
                        text=text,
                        summary=msg.get("summary", ""),
                        timestamp=msg.get("timestamp", ""),
                        color=msg.get("color", ""),
                        read=msg.get("read", False),
                        msg_type=detect_msg_type(text),
                    )
                    db.add(message)
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"读取 inbox 文件失败 {inbox_path}: {e}")

    db.commit()
    return team


def scan_tasks_for_team(team_name: str, team_id: int, db: Session):
    """扫描指定团队的任务目录，解析任务 JSON 文件并写入数据库"""
    tasks_dir = os.path.join(TASKS_DIR, team_name)

    # 验证任务目录是否在 TASKS_DIR 内，防止路径遍历攻击
    if not _is_safe_path(TASKS_DIR, tasks_dir):
        logger.error(f"安全检查失败: 任务目录 {tasks_dir} 不在允许的目录内")
        return

    if not os.path.isdir(tasks_dir):
        return

    # 清除旧任务数据并重新写入
    db.query(Task).filter(Task.team_id == team_id).delete()

    for task_file in os.listdir(tasks_dir):
        if not task_file.endswith(".json"):
            continue
        task_path = os.path.join(tasks_dir, task_file)

        # 验证任务文件路径是否在安全范围内
        if not _is_safe_path(TASKS_DIR, task_path):
            logger.warning(f"安全检查失败: 跳过不安全的任务文件 {task_path}")
            continue
        try:
            with open(task_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            task = Task(
                team_id=team_id,
                task_id=data.get("id", task_file.replace(".json", "")),
                subject=data.get("subject", ""),
                description=data.get("description", ""),
                status=data.get("status", "pending"),
                active_form=data.get("activeForm", ""),
                owner=data.get("owner", ""),
                blocks=data.get("blocks", []),
                blocked_by=data.get("blockedBy", []),
            )
            db.add(task)
        except (json.JSONDecodeError, IOError) as e:
            logger.error(f"读取任务文件失败 {task_path}: {e}")

    db.commit()


def scan_all_tasks(db: Session):
    """扫描所有任务目录，将任务关联到对应团队

    遍历 TASKS_DIR 下所有子目录，如果目录名与团队名匹配，
    则将任务数据关联到该团队。
    """
    if not os.path.isdir(TASKS_DIR):
        return

    # 获取所有团队名和 ID 的映射
    teams = {t.name: t.id for t in db.query(Team).all()}

    for task_dir_name in os.listdir(TASKS_DIR):
        task_dir = os.path.join(TASKS_DIR, task_dir_name)
        if not os.path.isdir(task_dir):
            continue

        # 检查目录名是否匹配团队名
        team_id = teams.get(task_dir_name)
        if not team_id:
            continue

        # 清除旧任务数据并重新写入
        db.query(Task).filter(Task.team_id == team_id).delete()

        for task_file in os.listdir(task_dir):
            if not task_file.endswith(".json"):
                continue
            task_path = os.path.join(task_dir, task_file)
            try:
                with open(task_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                task = Task(
                    team_id=team_id,
                    task_id=data.get("id", task_file.replace(".json", "")),
                    subject=data.get("subject", ""),
                    description=data.get("description", ""),
                    status=data.get("status", "pending"),
                    active_form=data.get("activeForm", ""),
                    owner=data.get("owner", ""),
                    blocks=data.get("blocks", []),
                    blocked_by=data.get("blockedBy", []),
                )
                db.add(task)
            except (json.JSONDecodeError, IOError) as e:
                logger.error(f"读取任务文件失败 {task_path}: {e}")

    db.commit()


def full_scan():
    """全量扫描所有团队和任务数据

    扫描文件系统中的团队目录，同步到数据库。
    已从文件系统删除的团队会从数据库中清理。
    同时从消息记录中补充已离开但曾参与过的团队成员。
    """
    logger.info("开始全量扫描...")
    db = SessionLocal()
    try:
        if not os.path.isdir(TEAMS_DIR):
            logger.warning(f"团队目录不存在: {TEAMS_DIR}")
            return

        # 记录本次扫描到的团队名，用于清理已删除团队
        scanned_team_names = set()

        for team_dir_name in os.listdir(TEAMS_DIR):
            team_dir = os.path.join(TEAMS_DIR, team_dir_name)
            if not os.path.isdir(team_dir):
                continue
            team = scan_team(team_dir, db)
            if team:
                scanned_team_names.add(team.name)
                # 从消息中补充实际参与的成员
                _supplement_members_from_messages(team, db)
                logger.info(f"已扫描团队: {team.name}")

        # 扫描所有任务目录
        scan_all_tasks(db)
        logger.info("任务扫描完成")

        # 清理数据库中已不存在于文件系统的团队
        all_db_teams = db.query(Team).all()
        for team in all_db_teams:
            if team.name not in scanned_team_names:
                logger.info(f"清理已删除团队: {team.name}")
                db.query(Message).filter(Message.team_id == team.id).delete()
                db.query(Task).filter(Task.team_id == team.id).delete()
                db.query(Member).filter(Member.team_id == team.id).delete()
                db.delete(team)
        db.commit()

        logger.info("全量扫描完成")
    except Exception as e:
        logger.error(f"全量扫描出错: {e}")
        db.rollback()
    finally:
        db.close()


def _supplement_members_from_messages(team: Team, db: Session):
    """从消息记录中补充团队的实际参与成员

    config.json 中可能缺少已离开的成员（如团队结束后被移除），
    但消息记录中保留了这些 agent 的通信历史。
    通过消息中的 from_agent 和 inbox_owner 字段发现并补充这些成员。
    """
    # 获取当前数据库中已有的成员名
    existing_names = {m.name for m in db.query(Member).filter(Member.team_id == team.id).all()}

    # 从消息中收集所有 agent 名称
    messages = db.query(Message).filter(Message.team_id == team.id).all()
    agents_from_msgs = set()
    for msg in messages:
        if msg.from_agent:
            agents_from_msgs.add(msg.from_agent)
        if msg.inbox_owner:
            agents_from_msgs.add(msg.inbox_owner)

    # 补充缺少的成员
    # 为补充的成员生成不同颜色
    colors = ["#3b82f6", "#22c55e", "#ef4444", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"]
    color_idx = len(existing_names)
    for agent_name in sorted(agents_from_msgs - existing_names):
        member = Member(
            team_id=team.id,
            name=agent_name,
            agent_id="",
            agent_type="participant",
            model="",
            color=colors[color_idx % len(colors)],
            cwd="",
        )
        db.add(member)
        color_idx += 1
        logger.info(f"从消息中补充成员: {agent_name} -> 团队 {team.name}")

    db.flush()


def incremental_scan(changed_path: str) -> dict | None:
    """增量扫描：根据变化的文件路径，更新对应的数据

    返回变更事件字典，用于 WebSocket 推送
    """
    db = SessionLocal()
    try:
        path = Path(changed_path)
        path_str = str(path)

        # 验证路径是否在允许的目录内，防止路径遍历攻击
        is_in_teams = _is_safe_path(TEAMS_DIR, path_str)
        is_in_tasks = _is_safe_path(TASKS_DIR, path_str)

        if not is_in_teams and not is_in_tasks:
            logger.warning(f"安全检查失败: 变更路径 {changed_path} 不在允许的目录内")
            return None

        # 判断变化属于哪个团队
        if is_in_teams:
            # 从路径中提取团队名
            rel = path.relative_to(TEAMS_DIR)
            team_name = rel.parts[0] if rel.parts else None
            if not team_name:
                return None

            team_dir = os.path.join(TEAMS_DIR, team_name)
            team = scan_team(team_dir, db)
            if not team:
                return None

            # 判断是消息变化还是团队配置变化
            if "inboxes" in path_str:
                scan_tasks_for_team(team.name, team.id, db)
                return {"type": "message_new", "data": {"team": team.name}}
            else:
                scan_tasks_for_team(team.name, team.id, db)
                return {"type": "team_update", "data": {"team": team.name}}

        elif is_in_tasks:
            # 从路径中提取团队名
            rel = path.relative_to(TASKS_DIR)
            team_name = rel.parts[0] if rel.parts else None
            if not team_name:
                return None

            team = db.query(Team).filter(Team.name == team_name).first()
            if team:
                scan_tasks_for_team(team.name, team.id, db)
                return {"type": "task_update", "data": {"team": team.name}}

        return None
    except Exception as e:
        logger.error(f"增量扫描出错: {e}")
        db.rollback()
        return None
    finally:
        db.close()

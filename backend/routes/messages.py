"""消息相关 API 路由"""
from collections import defaultdict
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from models import Team, Message, Member

router = APIRouter(prefix="/api/teams", tags=["messages"])


@router.get("/{name}/messages")
def get_team_messages(
    name: str,
    sender: str | None = Query(None, description="按发送者筛选"),
    msg_type: str | None = Query(None, description="按消息类型筛选"),
    page: int = Query(1, ge=1, description="页码"),
    size: int = Query(20, ge=1, le=100, description="每页数量"),
    db: Session = Depends(get_db),
):
    """获取团队消息，支持分页和筛选"""
    team = db.query(Team).filter(Team.name == name).first()
    if not team:
        raise HTTPException(status_code=404, detail=f"团队 '{name}' 不存在")

    query = db.query(Message).filter(Message.team_id == team.id)

    # 筛选条件
    if sender:
        query = query.filter(Message.from_agent == sender)
    if msg_type:
        query = query.filter(Message.msg_type == msg_type)

    # 总数
    total = query.count()

    # 按时间戳降序排列，分页
    messages = (
        query.order_by(Message.timestamp.desc())
        .offset((page - 1) * size)
        .limit(size)
        .all()
    )

    return {
        "total": total,
        "page": page,
        "size": size,
        "items": [m.to_dict() for m in messages],
    }


@router.get("/{name}/message-flow")
def get_team_message_flow(
    name: str,
    agent: str | None = Query(None, description="按 agent 筛选，只显示该 agent 相关的消息流转"),
    db: Session = Depends(get_db),
):
    """获取团队消息流转分析数据，包括通信矩阵、时间线和 Mermaid 序列图

    支持 agent 参数：当指定 agent 时，只返回该 agent 发送或接收的消息流转。
    """
    team = db.query(Team).filter(Team.name == name).first()
    if not team:
        raise HTTPException(status_code=404, detail=f"团队 '{name}' 不存在")

    # 获取团队成员名称列表
    members = [m.name for m in db.query(Member).filter(Member.team_id == team.id).all()]

    # 获取该团队所有消息，按时间升序
    query = db.query(Message).filter(Message.team_id == team.id)

    # 如果指定了 agent，只获取该 agent 相关的消息
    if agent:
        query = query.filter(
            (Message.from_agent == agent) | (Message.inbox_owner == agent)
        )

    all_messages = query.order_by(Message.timestamp.asc()).all()

    # 聚合流转统计：from_agent -> inbox_owner 的数量和类型分布
    flow_map = defaultdict(lambda: {"count": 0, "types": defaultdict(int)})
    type_stats = defaultdict(int)

    for msg in all_messages:
        key = (msg.from_agent, msg.inbox_owner)
        flow_map[key]["count"] += 1
        flow_map[key]["types"][msg.msg_type or "normal"] += 1
        type_stats[msg.msg_type or "normal"] += 1

    flows = [
        {
            "from": k[0],
            "to": k[1],
            "count": v["count"],
            "types": dict(v["types"]),
        }
        for k, v in flow_map.items()
    ]

    # 生成时间线（过滤 idle 类型，保留有意义的交互）
    timeline = [
        {
            "from": msg.from_agent,
            "to": msg.inbox_owner,
            "msg_type": msg.msg_type or "normal",
            "summary": _extract_summary(msg.summary, msg.text),
            "timestamp": msg.timestamp,
        }
        for msg in all_messages
        if msg.msg_type != "idle"
    ]

    # 生成 Mermaid 序列图文本
    mermaid = _generate_mermaid(members, timeline)

    return {
        "team_name": name,
        "members": members,
        "flows": flows,
        "timeline": timeline,
        "type_stats": dict(type_stats),
        "mermaid": mermaid,
    }


def _escape_mermaid_label(text: str) -> str:
    """转义 Mermaid 标签中的特殊字符

    Mermaid 语法中冒号后是标签，标签中不能有未转义的特殊字符。
    需要移除或替换可能导致解析错误的字符。
    """
    if not text:
        return ""
    # 移除或替换特殊字符
    result = text
    # 移除换行符
    result = result.replace("\n", " ").replace("\r", "")
    # 移除未转义的引号（最关键的问题）
    result = result.replace('"', "").replace("'", "")
    # 移除反引号
    result = result.replace("`", "")
    # 移除中括号（可能导致 Mermaid 解析错误）
    result = result.replace("[", "").replace("]", "")
    # 移除花括号（JSON 对象的边界符）
    result = result.replace("{", "").replace("}", "")
    # 移除冒号（Mermaid 语法中冒号是标签分隔符）
    result = result.replace(":", " ")
    # 移除连续空格
    result = " ".join(result.split())
    return result[:50]  # 限制长度


def _extract_summary(summary: str, text: str) -> str:
    """提取消息摘要，优先从 JSON 格式中获取 subject 字段

    当 summary 或 text 是 JSON/Python 字典格式时，尝试提取 subject 字段作为可读摘要。
    """
    import ast

    # 优先处理 summary
    for candidate in [summary, text]:
        if not candidate:
            continue
        stripped = candidate.strip()
        if stripped.startswith("{") or stripped.startswith("'"):
            try:
                # 尝试使用 ast.literal_eval 解析 Python 字面量（支持单引号）
                data = ast.literal_eval(stripped)
                if isinstance(data, dict):
                    # 优先取 subject 字段
                    if "subject" in data:
                        return str(data["subject"])
                    # 其次取 summary 字段
                    if "summary" in data:
                        return str(data["summary"])
                    # 其次取 type 字段
                    if "type" in data:
                        return str(data["type"])
                    # 都没有就返回类型名
                    return "任务消息"
            except (ValueError, SyntaxError, TypeError):
                pass
        else:
            return candidate[:80] if candidate else ""

    return summary[:80] if summary else (text[:80] if text else "")


def _generate_mermaid(members: list[str], timeline: list[dict]) -> str:
    """根据成员和时间线生成 Mermaid 序列图文本"""
    lines = ["sequenceDiagram"]

    # 为每个成员生成 participant，使用缩写作为别名
    alias_map = {}
    for m in members:
        # 取名称首字母大写作为别名
        alias = "".join(word[0].upper() for word in m.split("-")) if "-" in m else m[:3].upper()
        # 避免别名冲突
        base_alias = alias
        counter = 1
        while alias in alias_map.values():
            alias = f"{base_alias}{counter}"
            counter += 1
        alias_map[m] = alias
        lines.append(f"    participant {alias} as {m}")

    # 遍历时间线生成消息箭头
    for item in timeline:
        sender = item["from"]
        receiver = item["to"]
        msg_type = item["msg_type"]
        summary = _escape_mermaid_label(item.get("summary", "")[:50])

        # 确保 sender 和 receiver 都有别名（可能有系统外的发送者）
        if sender not in alias_map:
            alias = sender[:3].upper()
            alias_map[sender] = alias
            lines.insert(1, f"    participant {alias} as {sender}")
        if receiver not in alias_map:
            alias = receiver[:3].upper()
            alias_map[receiver] = alias
            lines.insert(1, f"    participant {alias} as {receiver}")

        s_alias = alias_map[sender]
        r_alias = alias_map[receiver]

        if msg_type in ("shutdown_request", "shutdown_response", "shutdown", "shutdown_approved"):
            # 虚线箭头表示关机相关消息
            lines.append(f"    {s_alias}-->>{r_alias}: {msg_type} {summary}")
        elif msg_type == "task_assignment":
            # 带注释的实线箭头表示任务分配
            lines.append(f"    {s_alias}->>+{r_alias}: {summary}")
        else:
            # 普通实线箭头
            label = summary if summary else msg_type
            lines.append(f"    {s_alias}->>{r_alias}: {label}")

    return "\n".join(lines)

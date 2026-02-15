# Agent Teams Dashboard 设计文档

## 一、数据源分析

### 1.1 数据文件位置

| 数据类型 | 文件路径 | 格式 |
|---------|---------|------|
| 团队配置 | `~/.claude/teams/{team_name}/config.json` | JSON 对象 |
| 消息收件箱 | `~/.claude/teams/{team_name}/inboxes/{agent_name}.json` | JSON 数组 |
| 任务文件 | `~/.claude/tasks/{team_name}/{task_id}.json` | JSON 对象 |

### 1.2 数据源字段说明

**config.json 结构：**
```json
{
  "name": "teams-dashboard",
  "description": "团队描述",
  "createdAt": 1771137100855,
  "leadAgentId": "team-lead@teams-dashboard",
  "leadSessionId": "4bdc3508-26cc-403a-9981-beffbaf59df8",
  "members": [
    {
      "agentId": "team-lead@teams-dashboard",
      "name": "team-lead",
      "agentType": "team-lead",
      "model": "claude-opus-4-6",
      "prompt": "...",
      "color": "blue",
      "planModeRequired": false,
      "joinedAt": 1771137100855,
      "tmuxPaneId": "in-process",
      "cwd": "/path/to/working/dir",
      "subscriptions": [],
      "backendType": "in-process"
    }
  ]
}
```

**inboxes/{agent}.json 结构（数组）：**
```json
[
  {
    "from": "team-lead",
    "text": "普通文本消息或 JSON 字符串",
    "summary": "消息摘要",
    "timestamp": "2026-02-15T06:32:41.320Z",
    "color": "blue",
    "read": false
  }
]
```

消息 `text` 字段的特殊类型（以 JSON 字符串存储）：
- `{"type": "task_assignment", ...}` — 任务分配通知
- `{"type": "shutdown_request", "requestId": "...", ...}` — 关闭请求
- `{"type": "idle_notification", ...}` — 空闲通知
- 普通文本 — 常规消息

**tasks/{id}.json 结构：**
```json
{
  "id": "1",
  "subject": "任务标题",
  "description": "任务详细描述",
  "activeForm": "进行中的表单提示",
  "status": "pending | in_progress | completed",
  "blocks": ["2", "3"],
  "blockedBy": ["1"],
  "owner": "agent-name",
  "metadata": { "_internal": true }
}
```

---

## 二、SQLite 数据库表设计

### 2.1 建表 SQL

```sql
-- 团队表
CREATE TABLE IF NOT EXISTS teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,          -- 团队名称，对应目录名
    description TEXT DEFAULT '',         -- 团队描述
    created_at INTEGER DEFAULT 0,        -- 创建时间戳（毫秒）
    lead_agent_id TEXT DEFAULT '',       -- 团队负责人的 agentId
    lead_session_id TEXT DEFAULT '',     -- 负责人 sessionId
    config_path TEXT DEFAULT '',         -- config.json 完整路径
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP  -- 记录更新时间
);

-- 成员表
CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,            -- 关联团队
    name TEXT NOT NULL,                  -- 成员名称
    agent_id TEXT NOT NULL,              -- 完整的 agentId（如 "architect@teams-dashboard"）
    agent_type TEXT DEFAULT 'general-purpose', -- 角色类型：team-lead / general-purpose
    model TEXT DEFAULT '',               -- 使用的模型（如 claude-opus-4-6, sonnet）
    color TEXT DEFAULT '',               -- 显示颜色标识
    cwd TEXT DEFAULT '',                 -- 工作目录
    joined_at INTEGER DEFAULT 0,         -- 加入时间戳（毫秒）
    backend_type TEXT DEFAULT '',        -- 后端类型（如 in-process）
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 消息表
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,            -- 关联团队
    inbox_owner TEXT NOT NULL,           -- 收件箱所属成员名称
    from_agent TEXT NOT NULL,            -- 发送者名称
    text TEXT DEFAULT '',                -- 消息正文（原始内容）
    summary TEXT DEFAULT '',             -- 消息摘要
    timestamp TEXT NOT NULL,             -- 消息时间（ISO 8601 字符串）
    color TEXT DEFAULT '',               -- 发送者颜色
    read INTEGER DEFAULT 0,             -- 是否已读（0=未读, 1=已读）
    msg_type TEXT DEFAULT 'normal',      -- 消息类型：normal / task_assignment / shutdown_request / idle_notification
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE
);

-- 为消息表创建索引，加速常用查询
CREATE INDEX IF NOT EXISTS idx_messages_team_id ON messages(team_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_from_agent ON messages(from_agent);
CREATE INDEX IF NOT EXISTS idx_messages_msg_type ON messages(msg_type);

-- 任务表
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL,            -- 关联团队
    task_id TEXT NOT NULL,               -- 原始任务 ID（如 "1", "2"）
    subject TEXT DEFAULT '',             -- 任务标题
    description TEXT DEFAULT '',         -- 任务详细描述
    status TEXT DEFAULT 'pending',       -- 状态：pending / in_progress / completed
    active_form TEXT DEFAULT '',         -- 进行中显示文本
    owner TEXT DEFAULT '',               -- 任务负责人
    blocks TEXT DEFAULT '[]',            -- 阻塞的任务 ID 列表（JSON 数组字符串）
    blocked_by TEXT DEFAULT '[]',        -- 被阻塞的任务 ID 列表（JSON 数组字符串）
    is_internal INTEGER DEFAULT 0,       -- 是否为内部任务（metadata._internal = true）
    FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    UNIQUE(team_id, task_id)             -- 同一团队内任务 ID 唯一
);

CREATE INDEX IF NOT EXISTS idx_tasks_team_id ON tasks(team_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
```

### 2.2 消息类型判断逻辑

扫描消息时，通过解析 `text` 字段判断 `msg_type`：

```python
import json

def detect_msg_type(text: str) -> str:
    """解析消息文本，判断消息类型"""
    try:
        data = json.loads(text)
        if isinstance(data, dict) and "type" in data:
            type_val = data["type"]
            if type_val in ("task_assignment", "shutdown_request", "idle_notification"):
                return type_val
    except (json.JSONDecodeError, TypeError):
        pass
    return "normal"
```

---

## 三、REST API 接口规范

### 3.1 基础信息

- **基地址**: `http://localhost:8000`
- **响应格式**: JSON
- **CORS 允许源**: `http://localhost:5173`

### 3.2 通用响应格式

成功响应：
```json
{
  "code": 0,
  "data": { ... },
  "message": "ok"
}
```

错误响应：
```json
{
  "code": 1,
  "data": null,
  "message": "错误描述"
}
```

分页响应：
```json
{
  "code": 0,
  "data": {
    "items": [ ... ],
    "total": 100,
    "page": 1,
    "size": 20
  },
  "message": "ok"
}
```

### 3.3 API 端点详细说明

#### 3.3.1 获取团队列表

```
GET /api/teams
```

**响应 data：**
```json
[
  {
    "id": 1,
    "name": "teams-dashboard",
    "description": "开发 Agent Teams Dashboard",
    "created_at": 1771137100855,
    "lead_agent_id": "team-lead@teams-dashboard",
    "member_count": 3,
    "message_count": 15,
    "task_count": 4
  }
]
```

#### 3.3.2 获取团队详情

```
GET /api/teams/{name}
```

**路径参数：**
- `name` (string) — 团队名称

**响应 data：**
```json
{
  "id": 1,
  "name": "teams-dashboard",
  "description": "开发 Agent Teams Dashboard",
  "created_at": 1771137100855,
  "lead_agent_id": "team-lead@teams-dashboard",
  "lead_session_id": "4bdc3508-...",
  "members": [
    {
      "id": 1,
      "name": "team-lead",
      "agent_id": "team-lead@teams-dashboard",
      "agent_type": "team-lead",
      "model": "claude-opus-4-6",
      "color": "",
      "cwd": "/Users/mask/python3/agent-team",
      "joined_at": 1771137100855,
      "backend_type": ""
    }
  ]
}
```

#### 3.3.3 获取团队消息

```
GET /api/teams/{name}/messages?sender=&msg_type=&page=1&size=20&search=
```

**路径参数：**
- `name` (string) — 团队名称

**查询参数：**
- `sender` (string, 可选) — 按发送者过滤
- `msg_type` (string, 可选) — 按消息类型过滤：normal / task_assignment / shutdown_request / idle_notification
- `page` (int, 默认 1) — 页码
- `size` (int, 默认 20) — 每页条数
- `search` (string, 可选) — 搜索消息内容

**响应 data：**
```json
{
  "items": [
    {
      "id": 1,
      "inbox_owner": "architect",
      "from_agent": "team-lead",
      "text": "消息内容",
      "summary": "消息摘要",
      "timestamp": "2026-02-15T06:32:41.320Z",
      "color": "blue",
      "read": false,
      "msg_type": "normal"
    }
  ],
  "total": 50,
  "page": 1,
  "size": 20
}
```

#### 3.3.4 获取任务列表

```
GET /api/tasks/{team_name}?status=&include_internal=false
```

**路径参数：**
- `team_name` (string) — 团队名称

**查询参数：**
- `status` (string, 可选) — 按状态过滤：pending / in_progress / completed
- `include_internal` (bool, 默认 false) — 是否包含内部任务（metadata._internal = true）

**响应 data：**
```json
[
  {
    "id": 1,
    "task_id": "1",
    "subject": "设计数据库模型和 API 接口",
    "description": "...",
    "status": "in_progress",
    "active_form": "设计数据库模型和API接口",
    "owner": "architect",
    "blocks": ["2", "3"],
    "blocked_by": [],
    "is_internal": false
  }
]
```

#### 3.3.5 获取统计数据

```
GET /api/stats
```

**响应 data：**
```json
{
  "team_count": 3,
  "total_members": 8,
  "total_messages": 45,
  "total_tasks": 12,
  "tasks_by_status": {
    "pending": 5,
    "in_progress": 4,
    "completed": 3
  }
}
```

#### 3.3.6 手动触发扫描

```
POST /api/scan
```

**说明：** 手动触发全量扫描，更新数据库。

**响应 data：**
```json
{
  "teams_scanned": 3,
  "messages_scanned": 45,
  "tasks_scanned": 12
}
```

---

## 四、WebSocket 消息协议

### 4.1 连接方式

```
ws://localhost:8000/ws
```

### 4.2 消息格式

服务端推送消息格式：

```json
{
  "type": "事件类型",
  "data": { ... },
  "timestamp": "2026-02-15T06:32:41.320Z"
}
```

### 4.3 事件类型

| 事件类型 | 触发条件 | data 内容 |
|---------|---------|----------|
| `team_update` | config.json 文件变化 | 更新后的团队对象（含成员） |
| `message_new` | inboxes/*.json 文件变化 | 新增的消息对象 |
| `task_update` | tasks/*.json 文件变化 | 更新后的任务对象 |
| `scan_complete` | 全量扫描完成 | `{"teams_scanned": 3}` |

### 4.4 事件 data 示例

**team_update：**
```json
{
  "type": "team_update",
  "data": {
    "name": "teams-dashboard",
    "description": "...",
    "member_count": 3
  },
  "timestamp": "2026-02-15T06:35:00.000Z"
}
```

**message_new：**
```json
{
  "type": "message_new",
  "data": {
    "team_name": "teams-dashboard",
    "inbox_owner": "architect",
    "from_agent": "team-lead",
    "text": "任务已完成",
    "summary": "完成通知",
    "msg_type": "normal",
    "timestamp": "2026-02-15T06:35:00.000Z"
  },
  "timestamp": "2026-02-15T06:35:00.000Z"
}
```

**task_update：**
```json
{
  "type": "task_update",
  "data": {
    "team_name": "teams-dashboard",
    "task_id": "1",
    "subject": "设计数据库模型和 API 接口",
    "status": "completed",
    "owner": "architect"
  },
  "timestamp": "2026-02-15T06:35:00.000Z"
}
```

---

## 五、后端项目结构

```
backend/
├── main.py              # FastAPI 入口：CORS 配置、路由挂载、启动事件
├── database.py          # SQLAlchemy 引擎、Session 管理、建表
├── models.py            # SQLAlchemy ORM 模型（Team, Member, Message, Task）
├── scanner.py           # 文件扫描器：全量扫描 ~/.claude/teams/ 和 ~/.claude/tasks/
├── watcher.py           # 文件监控：watchdog 监听目录变化，触发增量更新
├── routes/
│   ├── __init__.py
│   ├── teams.py         # GET /api/teams, GET /api/teams/{name}
│   ├── messages.py      # GET /api/teams/{name}/messages
│   └── tasks.py         # GET /api/tasks/{team_name}
├── ws_manager.py        # WebSocket 连接管理与消息广播
├── requirements.txt     # Python 依赖
└── data.db              # SQLite 数据库文件（运行时自动创建）
```

### 5.1 依赖清单 (requirements.txt)

```
fastapi>=0.104.0
uvicorn>=0.24.0
sqlalchemy>=2.0.0
watchdog>=3.0.0
websockets>=12.0
aiofiles>=23.0.0
```

---

## 六、前端项目结构

```
frontend/
├── src/
│   ├── App.tsx              # 根组件：路由配置、布局
│   ├── main.tsx             # 入口文件
│   ├── api/
│   │   └── index.ts         # API 请求封装（fetch）
│   ├── hooks/
│   │   └── useWebSocket.ts  # WebSocket 连接 Hook
│   ├── pages/
│   │   ├── Dashboard.tsx    # 总览页：统计卡片、最近活动
│   │   ├── TeamDetail.tsx   # 团队详情：成员、消息、任务
│   │   ├── Messages.tsx     # 消息浏览页：筛选、搜索
│   │   └── Tasks.tsx        # 任务管理页：看板/列表视图
│   ├── components/
│   │   ├── Layout.tsx       # 布局组件：侧边栏 + 内容区
│   │   ├── StatCard.tsx     # 统计卡片
│   │   ├── MessageItem.tsx  # 消息条目
│   │   ├── TaskCard.tsx     # 任务卡片
│   │   └── MemberBadge.tsx  # 成员标签
│   └── types/
│       └── index.ts         # TypeScript 类型定义
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.js
└── tsconfig.json
```

---

## 七、关键设计决策

1. **消息去重**: 通过 `(team_id, inbox_owner, from_agent, timestamp)` 组合判断消息是否已存在，避免重复插入。

2. **增量更新**: watchdog 监听文件变化事件（created/modified），仅重新解析变化的文件，而非全量扫描。

3. **内部任务过滤**: `metadata._internal = true` 的任务默认不在 API 中返回（用于系统内部追踪），可通过 `include_internal=true` 参数获取。

4. **消息类型解析**: 消息 `text` 字段可能是普通文本或 JSON 字符串。扫描时尝试 JSON 解析，提取 `type` 字段分类；解析失败则视为普通消息。

5. **时间格式**: 团队和成员的时间戳为毫秒级 Unix 时间戳（整数），消息时间戳为 ISO 8601 字符串。前端统一转换为本地时间展示。

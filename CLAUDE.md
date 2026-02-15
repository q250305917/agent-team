# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目简介

Agent Teams Dashboard — 用于可视化查看 Claude Code 多 Agent 团队协作数据的 Web 应用。后端扫描 `~/.claude/teams/` 和 `~/.claude/tasks/` 目录中的 JSON 文件，解析团队配置、成员消息和任务数据存入 SQLite，通过 REST API 和 WebSocket 提供给前端展示。

## 开发命令

### 一键启动

```bash
./start.sh
```

启动后端 http://localhost:8000 和前端 http://127.0.0.1:5173。

### 后端（FastAPI + SQLite）

```bash
cd backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
# 带热重载
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

安装依赖：`pip install -r requirements.txt`

### 前端（React + Vite + Tailwind v4）

```bash
cd frontend
npm install
npm run dev      # 开发服务器 :5173
npm run build    # 生产构建
npm run lint     # ESLint 检查
```

## 架构概览

### 数据流

```
~/.claude/teams/{name}/config.json     ──┐
~/.claude/teams/{name}/inboxes/*.json  ──┤── scanner.py 全量/增量扫描 ──> SQLite (data.db)
~/.claude/tasks/{name}/*.json          ──┘         │
                                                   ├── REST API (routes/)
         watchdog 文件监控 (watcher.py) ────────────┤
                                                   └── WebSocket 实时推送 ──> 前端
```

### 后端核心模块

- `main.py` — FastAPI 入口，CORS 配置，WebSocket 端点 (`/ws`)，全局 API 路由 (`/api/stats`, `/api/messages`, `/api/tasks`)
- `scanner.py` — 文件扫描核心逻辑。`full_scan()` 启动时全量扫描，`incremental_scan()` 处理单文件变更。消息类型通过 `detect_msg_type()` 解析 JSON text 字段自动分类（normal/idle/shutdown/task_assignment/plan_approval）
- `watcher.py` — 基于 watchdog 的文件系统监控，检测到变化时调用增量扫描并通过 WebSocket 广播
- `models.py` — SQLAlchemy ORM 模型：Team、Member、Message、Task，每个模型有 `to_dict()` 序列化方法
- `database.py` — SQLAlchemy 引擎和 Session 管理，SQLite 存储
- `routes/` — 按资源拆分的 API 路由：teams、messages、tasks

### 前端页面结构

- `App.jsx` — 路由配置（react-router-dom v7）
- `pages/OverviewPage.jsx` — 总览仪表盘
- `pages/TeamDetailPage.jsx` — 团队详情（成员、消息、任务）
- `pages/MessagesPage.jsx` — 消息浏览与筛选
- `pages/TasksPage.jsx` — 任务管理
- `pages/MessageFlowPage.jsx` — 消息流可视化（Mermaid 图表）
- `hooks/useWebSocket.js` — WebSocket 连接 Hook
- `api.js` — API 请求封装

### API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stats` | 统计数据 |
| GET | `/api/teams` | 团队列表 |
| GET | `/api/teams/{name}` | 团队详情（含成员） |
| GET | `/api/teams/{name}/messages` | 团队消息（支持分页/筛选） |
| GET | `/api/tasks/{team_name}` | 团队任务 |
| GET | `/api/messages` | 全局消息（支持筛选） |
| GET | `/api/tasks` | 全局任务 |
| WS | `/ws` | 实时事件推送 |

### 数据源

后端从文件系统读取 Claude Code 的团队协作数据：
- 团队配置：`~/.claude/teams/{team_name}/config.json`
- 消息收件箱：`~/.claude/teams/{team_name}/inboxes/{agent_name}.json`
- 任务文件：`~/.claude/tasks/{team_name}/{task_id}.json`

扫描器会自动从消息记录中补充 config.json 中缺失的已离开成员（`_supplement_members_from_messages`）。

## 技术栈

- **后端**: Python 3.12, FastAPI, SQLAlchemy, watchdog, SQLite
- **前端**: React 19, Vite 7, Tailwind CSS v4, react-router-dom v7, Mermaid
- **虚拟环境**: `backend/.venv`

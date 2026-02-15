# Agent Teams Dashboard

用于可视化查看 Claude Code 多 Agent 团队协作数据的 Web 应用。

后端扫描 `~/.claude/teams/` 和 `~/.claude/tasks/` 目录，解析团队配置、成员消息和任务数据，通过 REST API 和 WebSocket 实时推送给前端展示。

## 功能特点

- 团队总览仪表盘（成员数、消息数、任务完成率）
- 团队详情查看（成员列表、消息流、任务看板）
- 消息浏览与筛选（按发送者、消息类型、关键词搜索）
- 任务管理（按状态过滤、依赖关系展示）
- 消息流可视化（Mermaid 时序图）
- WebSocket 实时更新

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Python 3.12, FastAPI, SQLAlchemy, SQLite, watchdog |
| 前端 | React 19, Vite 7, Tailwind CSS v4, react-router-dom v7, Mermaid |

## 快速开始

### 一键启动

```bash
./start.sh
```

### 分别启动

**后端：**
```bash
cd backend
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

**前端：**
```bash
cd frontend
npm install
npm run dev
```

### 访问地址

- Dashboard: http://127.0.0.1:5173
- API 文档: http://localhost:8000/docs

## 项目结构

```
├── backend/              # FastAPI 后端
│   ├── main.py           # 入口：CORS、路由、WebSocket
│   ├── scanner.py        # 文件扫描器（全量/增量）
│   ├── watcher.py        # watchdog 文件监控
│   ├── models.py         # SQLAlchemy ORM 模型
│   ├── database.py       # 数据库引擎与 Session
│   └── routes/           # API 路由（teams/messages/tasks）
├── frontend/             # React 前端
│   └── src/
│       ├── pages/        # 页面组件
│       ├── components/   # 通用组件
│       ├── hooks/        # WebSocket Hook
│       └── api.js        # API 请求封装
├── start.sh              # 一键启动脚本
├── DESIGN.md             # 详细设计文档
└── CLAUDE.md             # Claude Code 工作指南
```

#!/bin/bash
# Agent Teams Dashboard 启动脚本
# 一键启动前端和后端服务

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

echo "=== Agent Teams Dashboard ==="
echo ""

# 启动后端
echo "[1/2] 启动后端服务 (FastAPI + SQLite)..."
cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
echo "  后端 PID: $BACKEND_PID (http://localhost:8000)"

# 等待后端就绪
sleep 2

# 启动前端
echo "[2/2] 启动前端服务 (React + Vite)..."
cd "$FRONTEND_DIR"
npx vite --port 5173 --host 127.0.0.1 &
FRONTEND_PID=$!
echo "  前端 PID: $FRONTEND_PID (http://127.0.0.1:5173)"

echo ""
echo "=== 服务已启动 ==="
echo "  Dashboard: http://127.0.0.1:5173"
echo "  API 文档:  http://localhost:8000/docs"
echo ""
echo "按 Ctrl+C 停止所有服务..."

# 捕获退出信号，清理子进程
cleanup() {
    echo ""
    echo "正在停止服务..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "服务已停止"
}
trap cleanup EXIT INT TERM

# 等待子进程
wait

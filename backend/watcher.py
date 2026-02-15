"""文件监控：使用 watchdog 监听 ~/.claude/teams/ 和 ~/.claude/tasks/ 目录变化"""
import os
import asyncio
import logging
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from scanner import TEAMS_DIR, TASKS_DIR, incremental_scan

logger = logging.getLogger(__name__)


class FileChangeHandler(FileSystemEventHandler):
    """文件变化事件处理器

    监听 JSON 文件的创建和修改事件，触发增量扫描并通过回调推送变更通知
    """

    def __init__(self, callback):
        """
        Args:
            callback: 异步回调函数，接收变更事件字典用于 WebSocket 推送
        """
        super().__init__()
        self.callback = callback
        self._loop = None

    def set_loop(self, loop):
        """设置事件循环引用，用于在同步回调中调度异步任务"""
        self._loop = loop

    def _handle_event(self, event):
        """处理文件变化事件"""
        if event.is_directory:
            return
        # 只关注 JSON 文件变化
        if not event.src_path.endswith(".json"):
            return

        logger.debug(f"检测到文件变化: {event.src_path}")
        result = incremental_scan(event.src_path)
        if result and self._loop:
            # 在事件循环中调度异步回调
            asyncio.run_coroutine_threadsafe(self.callback(result), self._loop)

    def on_created(self, event):
        self._handle_event(event)

    def on_modified(self, event):
        self._handle_event(event)


def start_watcher(callback) -> tuple[Observer, FileChangeHandler]:
    """启动文件监控

    监控 ~/.claude/teams/ 和 ~/.claude/tasks/ 两个目录

    Args:
        callback: 异步回调函数，文件变化时被调用

    Returns:
        (observer, handler) 元组，observer 为 watchdog 观察者实例
    """
    handler = FileChangeHandler(callback)
    observer = Observer()

    # 监控团队目录
    if os.path.isdir(TEAMS_DIR):
        observer.schedule(handler, TEAMS_DIR, recursive=True)
        logger.info(f"开始监控目录: {TEAMS_DIR}")

    # 监控任务目录
    if os.path.isdir(TASKS_DIR):
        observer.schedule(handler, TASKS_DIR, recursive=True)
        logger.info(f"开始监控目录: {TASKS_DIR}")

    observer.start()
    return observer, handler

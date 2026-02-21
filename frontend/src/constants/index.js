/**
 * 共享常量定义
 * - 任务状态相关
 * - 消息类型相关
 * - 通用样式映射
 */

// ==================== 任务状态 ====================

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  DELETED: 'deleted',
};

export const TASK_STATUS_LABELS = {
  [TASK_STATUS.PENDING]: '待办',
  [TASK_STATUS.IN_PROGRESS]: '进行中',
  [TASK_STATUS.COMPLETED]: '已完成',
  [TASK_STATUS.DELETED]: '已删除',
};

export const TASK_STATUS_COLORS = {
  [TASK_STATUS.PENDING]: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  [TASK_STATUS.IN_PROGRESS]: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  [TASK_STATUS.COMPLETED]: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  [TASK_STATUS.DELETED]: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    dot: 'bg-red-400',
  },
};

export const TASK_STATUS_LIST = [
  TASK_STATUS.PENDING,
  TASK_STATUS.IN_PROGRESS,
  TASK_STATUS.COMPLETED,
];

// ==================== 消息类型 ====================

export const MESSAGE_TYPES = {
  NORMAL: 'normal',
  IDLE: 'idle',
  SHUTDOWN: 'shutdown',
  SHUTDOWN_REQUEST: 'shutdown_request',
  SHUTDOWN_RESPONSE: 'shutdown_response',
  TASK_ASSIGNMENT: 'task_assignment',
  BROADCAST: 'broadcast',
  PLAN_APPROVAL: 'plan_approval',
};

export const MESSAGE_TYPE_LABELS = {
  [MESSAGE_TYPES.NORMAL]: '普通消息',
  [MESSAGE_TYPES.IDLE]: '空闲通知',
  [MESSAGE_TYPES.SHUTDOWN]: '关闭',
  [MESSAGE_TYPES.SHUTDOWN_REQUEST]: '关闭请求',
  [MESSAGE_TYPES.SHUTDOWN_RESPONSE]: '关闭响应',
  [MESSAGE_TYPES.TASK_ASSIGNMENT]: '任务分配',
  [MESSAGE_TYPES.BROADCAST]: '广播',
  [MESSAGE_TYPES.PLAN_APPROVAL]: '计划审批',
};

export const MESSAGE_TYPE_STYLES = {
  [MESSAGE_TYPES.NORMAL]: {
    bg: 'bg-slate-800/60',
    border: 'border-slate-700',
  },
  [MESSAGE_TYPES.IDLE]: {
    bg: 'bg-slate-800/30',
    border: 'border-slate-700/50',
    opacity: 'opacity-70',
  },
  [MESSAGE_TYPES.SHUTDOWN]: {
    bg: 'bg-red-900/20',
    border: 'border-red-500/30',
  },
  [MESSAGE_TYPES.SHUTDOWN_REQUEST]: {
    bg: 'bg-red-900/20',
    border: 'border-red-500/30',
  },
  [MESSAGE_TYPES.SHUTDOWN_RESPONSE]: {
    bg: 'bg-red-900/20',
    border: 'border-red-500/30',
  },
  [MESSAGE_TYPES.TASK_ASSIGNMENT]: {
    bg: 'bg-green-900/20',
    border: 'border-green-500/30',
  },
  [MESSAGE_TYPES.BROADCAST]: {
    bg: 'bg-purple-900/20',
    border: 'border-purple-500/30',
  },
  [MESSAGE_TYPES.PLAN_APPROVAL]: {
    bg: 'bg-blue-900/20',
    border: 'border-blue-500/30',
  },
};

// ==================== 统计卡片主题 ====================

export const ACCENT_THEMES = {
  blue: {
    text: 'text-blue-400',
    border: 'border-blue-500/30',
    bg: 'bg-blue-500/20',
  },
  emerald: {
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    bg: 'bg-emerald-500/20',
  },
  amber: {
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/20',
  },
  purple: {
    text: 'text-purple-400',
    border: 'border-purple-500/30',
    bg: 'bg-purple-500/20',
  },
  red: {
    text: 'text-red-400',
    border: 'border-red-500/30',
    bg: 'bg-red-500/20',
  },
};

// ==================== 工具函数 ====================

/**
 * 获取任务状态的样式类
 */
export function getTaskStatusStyle(status) {
  return TASK_STATUS_COLORS[status] || TASK_STATUS_COLORS[TASK_STATUS.PENDING];
}

/**
 * 获取任务状态的标签
 */
export function getTaskStatusLabel(status) {
  return TASK_STATUS_LABELS[status] || status;
}

/**
 * 获取消息类型的样式
 */
export function getMessageTypeStyle(msgType) {
  return MESSAGE_TYPE_STYLES[msgType] || MESSAGE_TYPE_STYLES[MESSAGE_TYPES.NORMAL];
}

/**
 * 获取消息类型的标签
 */
export function getMessageTypeLabel(msgType) {
  return MESSAGE_TYPE_LABELS[msgType] || msgType;
}

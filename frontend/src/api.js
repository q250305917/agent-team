/** API 调用封装，基地址 http://localhost:8000 */

const BASE_URL = 'http://localhost:8000';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

// ---- 团队相关 ----

/** 获取所有团队 */
export function fetchTeams() {
  return request('/api/teams');
}

/** 获取单个团队详情（含成员） */
export function fetchTeam(name) {
  return request(`/api/teams/${name}`);
}

// ---- 消息相关 ----

/** 获取消息列表，支持筛选参数 */
export function fetchMessages(params = {}) {
  const query = new URLSearchParams();
  if (params.team) query.set('team', params.team);
  if (params.from_agent) query.set('from_agent', params.from_agent);
  if (params.msg_type) query.set('msg_type', params.msg_type);
  if (params.search) query.set('search', params.search);
  if (params.limit) query.set('limit', params.limit);
  if (params.offset) query.set('offset', params.offset);
  const qs = query.toString();
  return request(`/api/messages${qs ? '?' + qs : ''}`);
}

/** 获取某个团队的消息 */
export function fetchTeamMessages(teamName) {
  return request(`/api/teams/${teamName}/messages`);
}

/** 获取团队消息流转分析数据，支持 agent 筛选 */
export function fetchMessageFlow(teamName, agent) {
  const qs = agent ? `?agent=${encodeURIComponent(agent)}` : '';
  return request(`/api/teams/${teamName}/message-flow${qs}`);
}

// ---- 任务相关 ----

/** 获取任务列表，支持筛选 */
export function fetchTasks(params = {}) {
  const query = new URLSearchParams();
  if (params.team) query.set('team', params.team);
  if (params.status) query.set('status', params.status);
  const qs = query.toString();
  return request(`/api/tasks${qs ? '?' + qs : ''}`);
}

/** 获取某个团队的任务 */
export function fetchTeamTasks(teamName) {
  return request(`/api/teams/${teamName}/tasks`);
}

// ---- 统计相关 ----

/** 获取总览统计数据 */
export function fetchStats() {
  return request('/api/stats');
}

/** 手动触发数据同步 */
export function triggerSync() {
  return request('/api/sync', { method: 'POST' });
}

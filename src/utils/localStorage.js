// src/utils/storage.js
module.exports =  {
  // 保存消息（自动覆盖旧数据）
  saveApp(id, app) {
    const apps = JSON.parse(localStorage.getItem('mqttApps') || '{}');
    apps[id] = app;
    localStorage.setItem('mqttApps', JSON.stringify(apps));
  },

  // 根据 ID 查询消息
  getApp(id) {
    const apps = JSON.parse(localStorage.getItem('mqttApps') || '{}');
    return apps[id] || null; // 未找到时返回 null
  },

  // 获取所有消息（调试用）
  getAllApp() {
    return JSON.parse(localStorage.getItem('mqttApps') || '{}');
  },

};
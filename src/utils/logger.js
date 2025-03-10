// src/utils/logger.js
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

// 日志目录路径
const LOG_DIR = path.join(app.getAppPath(), 'logs');
const LOG_FILE = path.join(LOG_DIR, `app-${new Date().toISOString().split('T')[0]}.log`);

// 确保日志目录存在
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// 日志级别枚举
const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR'
};

// 核心日志函数
function log(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({
    timestamp,
    level,
    message,
    context
  }) + '\n';

  // 写入日志文件
  fs.appendFile(LOG_FILE, logEntry, (err) => {
    if (err) console.error('日志写入失败:', err);
  });
}

// 公开日志方法
module.exports = {
  debug: (msg, ctx) => log(LogLevel.DEBUG, msg, ctx),
  info: (msg, ctx) => log(LogLevel.INFO, msg, ctx),
  warn: (msg, ctx) => log(LogLevel.WARN, msg, ctx),
  error: (msg, ctx) => log(LogLevel.ERROR, msg, ctx),
  getLogs: () => {
    try {
      return fs.readFileSync(LOG_FILE, 'utf-8').split('\n').filter(Boolean).map(JSON.parse);
    } catch (err) {
      return [];
    }
  }
};
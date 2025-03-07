const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');

class AudioRecorder {
  constructor() {
    this.writer = null;
    this.filePath = '';
    this.isRecording = false;
  }

  initialize() {
    console.log('[主进程] 初始化IPC监听器');
    this.registerHandlers();
  }

  registerHandlers() {
    ipcMain.handle('audio-start', () => this.start());
    ipcMain.on('audio-chunk', (_, chunk) => this.writeChunk(chunk));
    ipcMain.handle('audio-stop', () => this.stop());
  }

  start() {
    console.log("start");
    return new Promise((resolve, reject) => {
      try {
        this.filePath = path.join(
          app.getPath('documents'),
          `recording_${Date.now()}.webm`
        );
        this.writer = fs.createWriteStream(this.filePath);
        this.isRecording = true;
        console.log('[Recorder] 录音开始:', this.filePath);
        resolve(this.filePath);
      } catch (err) {
        reject(`启动失败: ${err.message}`);
      }
    });
  }

  writeChunk(chunk) {
    console.log("writeChunk");
    if (!this.isRecording || !this.writer) {
      console.error('[Recorder] 写入失败: 录音未启动');
      return;
    }
    
    try {
      this.writer.write(Buffer.from(chunk));
    } catch (err) {
      console.error('[Recorder] 写入错误:', err);
      this.cleanup();
    }
  }

  stop() {
    console.log("stop");
    return new Promise((resolve, reject) => {
      if (!this.isRecording) {
        reject('录音未启动');
        return;
      }

      this.writer.end(() => {
        console.log('[Recorder] 录音已保存:', this.filePath);
        this.cleanup();
        resolve(this.filePath);
      });

      // 超时处理
      setTimeout(() => {
        reject('文件保存超时');
        this.cleanup();
      }, 5000);
    });
  }

  cleanup() {
    if (this.writer) {
      try {
        this.writer.destroy();
      } catch (err) {
        console.error('[Recorder] 清理错误:', err);
      }
    }
    
    this.writer = null;
    this.isRecording = false;
    this.filePath = '';
  }
}

module.exports = AudioRecorder;
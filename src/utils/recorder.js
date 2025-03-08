const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const apis=require('./api');

class AudioRecorder {
  constructor() {
    this.writer = null;
    this.filePath = '';
    this.isRecording = false;
    this.initialized = false;
    // 定义录音文件存储目录
    this.recordDir = path.join(app.getAppPath(), 'RecorderFolder');
    this.verifyStorageDir(); // 初始化时验证目录
  }

   // 验证并创建存储目录
   verifyStorageDir() {
    try {
      if (!fs.existsSync(this.recordDir)) {
        fs.mkdirSync(this.recordDir, { recursive: true });
        console.log(`[存储] 已创建录音目录: ${this.recordDir}`);
      }
      // 验证目录可写性
      fs.accessSync(this.recordDir, fs.constants.W_OK);
    } catch (err) {
      console.error(`[存储] 目录初始化失败: ${err.message}`);
      throw new Error('无法创建录音存储目录');
    }
  }

  initialize() {
    if (this.initialized) {
      console.warn('[Recorder] 模块已初始化');
      return;
    }
    try {
      console.log('[Recorder] 开始初始化');
      this.registerIPC();
      this.initialized = true;
      console.log('[Recorder] 初始化完成');
    } catch (err) {
      console.error('[Recorder] 初始化失败:', err);
      throw new Error('录音模块初始化失败');
    }
  }

  registerIPC() {
    // 清理旧监听器
    this.cleanupIPC();

    // 注册新处理器
    ipcMain.handle('audio-start', this.handleStart.bind(this));
    ipcMain.on('audio-chunk', this.handleChunk.bind(this));
    ipcMain.handle('audio-stop', this.handleStop.bind(this));

    console.log('[Recorder] IPC事件注册成功:', ipcMain.eventNames());
  }

  cleanupIPC() {
    try {
      ipcMain.removeHandler('audio-start');
      ipcMain.removeHandler('audio-stop');
      ipcMain.removeAllListeners('audio-chunk');
    } catch (err) {
      console.error('[Recorder] 清理IPC失败:', err);
    }
  }


  sanitizeFilename(name) {
    return name.replace(/[/\\?%*:|"<>]/g, '_');
  }

  async handleStart() {
    if (this.isRecording) {
      throw new Error('录音已在进行中');
    }
    try {
        // 生成安全文件名
        const safePath = this.sanitizeFilename(`recording_${Date.now()}`);
         // 生成带时间戳的文件名
        this.filePath = path.join(
        this.recordDir,
          `${safePath}.webm`
        );
        // 验证路径可写性
        try {
          await fs.promises.access(path.dirname(this.filePath), fs.constants.W_OK);
        } catch (err) {
          throw new Error(`无写入权限: ${this.filePath}`);
        }
        this.writer = fs.createWriteStream(this.filePath);
        this.isRecording = true;
      
        console.log(`[Recorder] 录音开始: ${this.filePath}`);
        return { success: true, path: this.filePath };
    } catch (err) {
      this.isRecording = false;
      throw new Error(`录音启动失败: ${err.message}`);
    }
  }

  handleChunk(event, chunk) {
    if (!this.isRecording || !this.writer) {
      console.error('[Recorder] 无效的音频块写入请求');
      return;
    }

    try {
      this.writer.write(Buffer.from(chunk));
    } catch (err) {
      console.error('[Recorder] 写入失败:', err);
      this.cleanup();
      throw new Error('音频数据写入失败');
    }
  }

  async handleStop() {
    return new Promise((resolve, reject) => {

      console.log("writer");
      console.log(this.writer);
      if (!this.writer) {
        reject(new Error('写入流未初始化'));
        return;
      }

      let cleanupCalled = false;
      const finalCleanup = () => {
        if (!cleanupCalled) {
          this.cleanup();
          cleanupCalled = true;
        }
      };

      this.writer.on('error', (err) => {
        reject(new Error(`写入错误: ${err.message}`));
        finalCleanup();
      });

      this.writer.end(async () => {
        try {
          // 添加文件存在性验证
          await this.verifyFile();
          const stats = fs.statSync(this.filePath);
          //console.log('[Recorder] 文件验证成功，大小:', stats.size);
          //请求语音转文字接口
          // 'audio/wav',
          // 'audio/mpeg',
          // 'audio/webm'
          // 'application/octet-stream'
          var result={ 
            success: false, 
            path: this.filePath,
            size: stats.size,
            message:""
          }
          resolve(result);
          // var formData = FormData();
          // const fileStream = fs.createReadStream(this.filePath);
          // formData.append('audio', fileStream, {
          //   filename: path.basename(filePath),
          //   contentType: 'audio/webm'
          // });
          // apis.hnc_stt(formData).then((res)=>{
          //   if(res && res.code=="200"){
          //     result.success=true;
          //     result.message=res.message;
          //   }else{
          //     result.message=res?.message;
          //   }
          //   resolve(result);
          // });
        } catch (err) {
          reject(new Error(`文件验证失败: ${err.message}`));
        } finally {
          this.cleanup();
        }
      });
  
      setTimeout(() => {
        reject(new Error('文件保存超时'));
        this.cleanup();
      }, 5000);
    });
  }

  async verifyFile() {
    return new Promise((resolve, reject) => {
      const check = () => {
        fs.access(this.filePath, fs.constants.F_OK, (err) => {
          if (err) {
            if (Date.now() - startTime < 5000) {
              setTimeout(check, 100);
            } else {
              reject(new Error('文件未生成'));
            }
          } else {
            resolve();
          }
        });
      };
      const startTime = Date.now();
      check();
    });
  }

  cleanup() {
    if (this.writer) {
      try {
        this.writer.destroy();
      } catch (err) {
        console.error('[Recorder] 流销毁失败:', err);
      }
    }
    this.writer = null;
    this.isRecording = false;
    this.filePath = '';
  }
}

module.exports = new AudioRecorder();
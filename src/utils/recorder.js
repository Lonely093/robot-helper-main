const { ipcMain, app } = require('electron');
const fs = require('fs');
const path = require('path');
const wav = require('waveheader'); 
const ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked')
ffmpeg.setFfmpegPath(ffmpegPath)
const apis=require('./api');
const FormData = require('form-data');

class AudioRecorder {
  constructor() {
    this.writer = null;
    this.filePath = '';
    this.isRecording = false;
    this.initialized = false;
    // 定义录音文件存储目录
    this.recordDir = path.join(app.getAppPath(), 'RecorderFolder');
    this.verifyStorageDir(); // 初始化时验证目录

    this.asrClient = null
    this.currentSessionId = null
    //音频参数配置
    this.audioConfig = {
      sampleRate: 16000,    // 采样率
      bitDepth: 16,         // 位深
      channels: 1,          // 声道数
      audioFormat: 'wav'    // 文件格式
    };
  }


  // 新增初始化方法
  initASR(config) {
    this.asrClient = new ASRWebSocket(
      config.asrServerURL,
      config.apiToken
    )
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

  setupASRHandlers() {
    this.asrClient.ws.onmessage = (event) => {
      const result = JSON.parse(event.data)
      
      // 通过IPC转发到渲染进程
      ipcMain.webContents.send('asr-transcript', {
        sessionId: this.currentSessionId,
        text: result.text,
        isFinal: result.is_final
      })
    }

    this.asrClient.ws.onerror = (err) => {
      ipcMain.webContents.send('asr-error', {
        type: 'websocket',
        message: err.message
      })
    }
  }

   // 生成 WAV 文件头
   generateWavHeader(options = {}) {
    const defaultOptions = {
      sampleRate: this.audioConfig.sampleRate,
      bitDepth: this.audioConfig.bitDepth,
      channels: this.audioConfig.channels,
    };

    const mergedOptions = { ...defaultOptions, ...options };
    return wav(null, mergedOptions);
  }

  async handleStart() {
    if (this.isRecording) {
      throw new Error('录音已在进行中');
    }
    try {

        // 新增ASR连接
        // try {
        //   await this.asrClient.connect()
        //   this.setupASRHandlers()
        // } catch (err) {
        //   console.error('ASR连接失败:', err)
        //   throw new Error('语音服务不可用')
        // }

         // 生成带时间戳的文件名
          this.filePath = path.join(
          this.recordDir,
          `recording_${Date.now()}.webm`
          //`recording_${Date.now()}.${this.audioConfig.audioFormat}`
        );
        // 验证路径可写性
        try {
          await fs.promises.access(path.dirname(this.filePath), fs.constants.W_OK);
        } catch (err) {
          throw new Error(`无写入权限: ${this.filePath}`);
        }
        this.writer = fs.createWriteStream(this.filePath);
        // 生成 WAV 文件头
        // const header = this.generateWavHeader();
        // this.writer.write(header);
        this.isRecording = true;
      
        //console.log(`[Recorder] 录音开始: ${this.filePath}`);
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
      // 转换Float32到Int16 PCM
      //const pcmData = this.convertAudioData(chunk)
      this.writer.write(Buffer.from(chunk));
    } catch (err) {
      console.error('[Recorder] 写入失败:', err);
      this.cleanup();
      throw new Error('音频数据写入失败');
    }

    // 新增发送到ASR服务器
    // if (this.asrClient?.isConnected) {
    //   const processedChunk = this.processAudioChunk(chunk)
    //   this.asrClient.sendAudio(processedChunk)
    // }

  }
  
  //音频文件格式转换
  convertAudioData(float32Array) {
    const int16Array = new Int16Array(float32Array.length)
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]))
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
    }
    return Buffer.from(int16Array.buffer)
  }

  // 音频预处理（根据ASR服务要求）
  processAudioChunk(rawChunk) {
    // 示例：转换为16kHz 16bit PCM
    return this.convertToPCM(rawChunk)
  }


  convertWebmToWav(inputPath) {
    return new Promise((resolve, reject) => {
      const outputPath = inputPath.replace('.webm', '.wav')
      
      ffmpeg(inputPath)
        .inputOptions([
          '-hide_banner',
          '-loglevel error'
        ])
        .audioCodec('pcm_s16le') // 16-bit PCM
        .audioFrequency(16000)   // 采样率
        .audioChannels(1)        // 单声道
        .format('wav')
        .on('end', () => resolve(outputPath))
        .on('error', reject)
        .save(outputPath)
    })
  }

  async handleStop() {
     
    return new Promise(async (resolve, reject) => {

       // 同时检查 writer 和录音状态
      if (!this.writer || !this.isRecording) {
        reject(new Error('写入流未初始化或录音未开始'));
        return;
      }

      //  // 生成临时文件路径
      //  const tempPath = this.filePath + '.tmp';
      
      //  // 关闭写入流并重命名
      //  await new Promise((res, rej) => {
      //    this.writer.end(() => {
      //      fs.rename(this.filePath, tempPath, (err) => {
      //        err ? rej(err) : res();
      //      });
      //    });
      //  });
 
      //  // 读取临时文件数据
      //  const rawData = await fs.promises.readFile(tempPath);
       
      //  // 生成正确长度的新头
      //  const dataSize = rawData.length - 44; // 减去初始头大小
      //  const header = this.generateWavHeader({
      //    size: dataSize + 36 // 根据WAV规范计算
      //  });

      //  // 替换文件头
      //  const finalBuffer = Buffer.concat([
      //    header, 
      //    rawData.subarray(44)
      //  ]);
 
      //  // 写入最终文件
      //  await fs.promises.writeFile(this.filePath, finalBuffer);
       
      //  // 清理临时文件
      //  await fs.promises.unlink(tempPath);
 
      //  // 验证文件
      //  await this.verifyFile();

      //  resolve({ success: true, path: this.filePath });

      // this.writer.on('finish', async () => {
      //   try {
      //     // 读取原始数据
      //     const rawData = await fs.promises.readFile(this.filePath)
          
      //     // 生成正确头文件
      //     const header = this.generateWAVHeader({
      //       size: rawData.length - 8  // RIFF块大小 = 文件总大小 - 8字节
      //     })
          
      //     // 写入最终文件
      //     await fs.promises.writeFile(
      //       this.filePath,
      //       Buffer.concat([header, rawData.subarray(44)])
      //     )
          
      //     resolve({ success: true, path: this.filePath })
      //   } catch (err) {
      //     console.error('最终处理失败:', err)
      //     resolve({ success: false })
      //   } finally {
      //     this.cleanup()
      //   }
      // })

      // this.writer.end()

      let cleanupCalled = false;
      const finalCleanup = () => {
        if (!cleanupCalled) {
          this.cleanup();
          cleanupCalled = true;
        }
      };

      const timeoutId = setTimeout(() => {
        reject(new Error('文件保存超时'));
        finalCleanup();
      }, 5000);

      this.writer.on('error', (err) => {
        clearTimeout(timeoutId);
        reject(new Error(`写入错误: ${err.message}`));
        finalCleanup();
      });

      this.writer.end(() => {
        (async () => {
          try {
            await this.verifyFile();
            const stats = fs.statSync(this.filePath);
            clearTimeout(timeoutId); // 清除超时
            //文件转换
            const newpath = await this.convertWebmToWav(this.filePath);
            fs.unlinkSync(this.filePath) // 删除原始webm文件
            var result={ 
              success: false, 
              path: newpath,
              message:"",
              res2:null
            }
            const fileStream = fs.createReadStream(newpath);
            const form = new FormData();
            // 添加文件字段（核心参数）
            form.append(
              'audio_file',            // 字段名（必须与后端定义一致）
              fileStream, // 使用 Stream 避免大文件内存溢出
              {
                filename: newpath.split('/').pop(),   // 自定义文件名（可选）
                contentType: 'audio/wav',     // 明确 MIME 类型（强烈建议）
                knownLength: stats        // 声明文件大小（优化性能）
              }
            );
            var res=await apis.hnc_tti("请打开程序管理也买你");
             result.res2=res;
            // if(res && res.code=="200"){
            //   result.success=true;
            //   result.message=res.message;
            // }else{
            //   result.message=res?.message;
            // }
           
            //   apis.hnc_stt(formData).then(res=>{
            //     console.log(res);
            //     result.res2=res;
            //     if(res && res.code=="200"){
            //       result.success=true;
            //       result.message=res.message;
            //     }else{
            //       result.message=res?.message;
            //     }
            //     resolve(result);
            // });
            resolve(result);
            
          } catch (err) {
            clearTimeout(timeoutId);
            reject(new Error(`文件验证失败: ${err.message}`));
          } finally {
            finalCleanup();
            // 发送结束标记
            //  if (this.asrClient) {
            //   this.asrClient.sendAudio(JSON.stringify({ action: 'EOS' }))
            //   await new Promise(resolve => setTimeout(resolve, 1000)) // 等待最终结果
            //   this.asrClient.close()
            // }
          }
        })();
      });
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

  // async verifyFile() {
  //   return new Promise((resolve, reject) => {
  //     const check = async () => {
  //       try {
  //         // 检查文件存在性
  //         await fs.promises.access(this.filePath, fs.constants.F_OK);
          
  //         // 检查文件头有效性
  //         const fd = await fs.promises.open(this.filePath, 'r');
  //         const header = Buffer.alloc(44);
  //         await fd.read(header, 0, 44, 0);
  //         await fd.close();
  
  //         if (!header.slice(0, 4).equals(Buffer.from('RIFF'))) {
  //           throw new Error('无效的WAV文件头');
  //         }
          
  //         resolve();
  //       } catch (err) {
  //         if (Date.now() - startTime < 5000) {
  //           setTimeout(check, 100);
  //         } else {
  //           reject(err);
  //         }
  //       }
  //     };
  
  //     const startTime = Date.now();
  //     check();
  //   });
  // }

  cleanup() {
    if (this.writer) {
      try {
        // 确保流关闭
        if (!this.writer.destroyed) {
          this.writer.destroy();
        }
        // 清理未完成的临时文件
        const tempPath = this.filePath + '.tmp';
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      } catch (err) {
        console.error('清理失败:', err);
      }
    }
    
    this.writer = null;
    this.isRecording = false;
    this.filePath = '';
  }
}


class ASRWebSocket {
  constructor(url, token) {
    this.ws = null
    this.url = url
    this.token = token
    this.isConnected = false
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(`${this.url}?token=${this.token}`)
      
      this.ws.onopen = () => {
        this.isConnected = true
        resolve()
      }

      this.ws.onerror = (err) => {
        this.isConnected = false
        reject(err)
      }

      this.ws.onclose = () => {
        this.isConnected = false
      }
    })
  }

  sendAudio(chunk) {
    if (this.isConnected) {
      this.ws.send(chunk)
    }
  }

  close() {
    if (this.ws) {
      this.ws.close()
    }
  }
}

module.exports = new AudioRecorder();
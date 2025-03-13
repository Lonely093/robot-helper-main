const { ipcRenderer } = require("electron");
const Vue = require('vue')
const { formatterTime } = require("../../utils/date.js")
const { getConfig, defaultConfig } = require("../../utils/store.js")
const path = require('path');
const fs = require('fs');
const configManager = require("../../utils/configManager");


let currConfig = {}
/**
 * Vue应用组件 - 提示框
 * 
 * 创建一个提示框组件,用于显示悬浮球相关的提示信息
 * 功能包括:
 * - 显示提示文本
 * - 监听悬浮球事件更新提示
 * - 接收主进程消息更新提示
 * - 10秒后自动关闭
 * - 提示内容更新时重置倒计时
 * 
 * @component
 * @listens message-to-renderer - 监听主进程消息
 * @emits close-tip - 发送关闭提示框事件到主进程
 */
const app = Vue.createApp({

  data() {
    return {
      showtext: false,
      showinput: false,
      userInput: "",
      tipText: '请问你需要什么帮助？',
      IsMouseLeave:true,
      isMouseOnFloatBall:true,
      tipCloseTimeoutId: null,

      lastruningtime:new Date(),
      isStopRecording: false,
      isRecording: false,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId: null,
      maxDuration : parseInt(configManager.maxDuration),
      isUserStop : false,
      placeholdertext:"有问题尽管问我...",
      isruning : false,
    }
  },

  mounted() {

    ipcRenderer.on('message-to-renderer', (event, data) => {
      //鼠标在机器人上
      if(data.type == 4){ 
        if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId) 
        this.isMouseOnFloatBall = true;
      }
      //鼠标离开了机器人
      else if(data.type == 5){ 
        this.isMouseOnFloatBall = false;
      }
      //显示文字
      else {  
        this.isruning = false;
        this.userInput =data.message;
        //值变化时，且鼠标不在悬浮窗则启动关闭
        if(this.IsMouseLeave && !this.isMouseOnFloatBall) 
        {
          this.startTipCloseTimer();
        }
      }
    });

    //页面启动，默认清空录音记录
    ipcRenderer.invoke('audio-clear');
    //再启动录音
    this.startRecording();

  },
  beforeUnmount() {
    if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId)
  },
  methods: {

    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'tip--' + msg, ctx });
    },

    changeInput() {
      this.showinput = true;
      this.showtext = false;
      this.userInput = "";
      //同时将消息发送至悬浮窗，      3  暂停录音
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball', // 指定目标窗口
        data: { type: 3 , message : "暂停录音" }
      });
    },

    sendMessage() {
      if (this.userInput.trim() !== '') {
        //同时将消息发送至悬浮窗
        ipcRenderer.send('message-from-renderer', {
          target: 'floatball', // 指定目标窗口
          data: {
            type: 4,
            message: this.userInput
          }
        });
        this.isruning=true;
      }
    },

    startTipCloseTimer() {
      if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId) // 清除旧定时器
      this.tipCloseTimeoutId = setTimeout(() => {
        ipcRenderer.send("close-tip");
        },  parseInt(configManager.pagehidetime) * 1000)  
    },

    hanleMouseEnter() {
      this.IsMouseLeave=false;
      if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId);
      //通知floatball取消关闭定时器
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball', // 指定目标窗口
        data: {
          type: 5,
          message:"鼠标悬浮在tip上"
        }
      });
    },

    hanleMouseLeave() {
      this.IsMouseLeave=true;
      if(this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId);
      this.startTipCloseTimer();
    },

    //鼠标按下输入框，暂停录音并不做后续处理
    async handleMouseDown(e) {
      this.isUserStop=true;
      await this.stopRecording();
    },
    
    // ***********************麦克风录音 ***************//

    //录音消息
    RecordingErrorMessage(type,message){
      this.isRecording=false;
      //this.userInput=message;
    },
    async toggleRecording() {
      
      //在1秒间隔内点击 则不触发事件
      const diff = Math.abs(new Date() - this.lastruningtime);
      if(diff  < 1000)   return;
      this.lastruningtime = new Date();

      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }
    },

    async startRecording() {
      //是否正在录音
      if (this.isRecording || this.isStopRecording) {
        return;
      }
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          if (err.message == "Requested device not found") {
            this.RecordingErrorMessage(99, "未检测到麦克风设备");
          }
          this.log('[Renderer] 麦克风访问被拒绝:', err.message);
          return;
        }
        // 初始化音频分析
        this.setupAudioAnalysis();
        // 通知主进程开始录音
        const { path } = await ipcRenderer.invoke('audio-start');
        this.log(`[Renderer] 录音文件路径: ${path}`);
        // 创建媒体录音器
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.setupDataHandler();
        this.isRecording = true;
        this.userInput="";
        this.placeholdertext = "倾听中...";
        this.startMonitoring();
        if(this.maxDuration > 2){
          setTimeout(() => this.stopRecording(), this.maxDuration * 1000);
        }
      } catch (err) {
        this.RecordingErrorMessage(99, '启动麦克风失败 ');
        this.log('启动麦克风失败:', err.message);
      }
    },
    setupAudioAnalysis() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      //this.log('[Renderer] 音频上下文采样率:', this.audioContext.sampleRate);
    },
    setupDataHandler() {
      this.mediaRecorder.ondataavailable = async (e) => {
        try {
          const buffer = await e.data.arrayBuffer();
          ipcRenderer.send('audio-chunk', buffer);
        } catch (err) {
          this.RecordingErrorMessage(99, '音频数据处理失败 ');
          this.log('[Renderer] 数据处理失败:', err.message);
        }
      };
      this.mediaRecorder.start(500); // 每0.5秒收集数据
      //this.log('[Renderer] 媒体录音器已启动');
    },
    startMonitoring() {
      const checkStatus = () => {
        if (!this.isRecording) return;
        // 分析音量
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);
        const volume = Math.max(...dataArray) / 255;

        // 静音检测
        this.checkSilence(volume);

        this.animationFrameId = requestAnimationFrame(checkStatus);
      };
      checkStatus();
    },
    checkSilence(volume) {
      if (this.isStopRecording) return;
      const SILENCE_THRESHOLD = 0.7; //可调整的静音阈值 最大值为1  
      //this.log(volume);
      //此处为超过1s检测到的麦克风电流小于0.6则停止录音
      if (volume < SILENCE_THRESHOLD) {
        this.silenceCount += 1 / 60;
        if (this.silenceCount >= 2) {
          this.log('[Renderer] 检测到持续静音，自动停止');
          this.stopRecording();
        }
      } else {
        this.silenceCount = 0;
      }
    },
    async stopRecording() {
      if (!this.isRecording) return;
      if (this.isStopRecording) return;
      var result = {
        success: false,
        message: "",
        path: null,
      }
      try {
        this.isRecording = false;
        this.isStopRecording = true;
        // 停止媒体录音器
        if (this.mediaRecorder?.state === 'recording') {
          this.mediaRecorder.stop();
        }
        // 通知主进程停止 保存录音文件并上传接口，返回结果
        result = await ipcRenderer.invoke('audio-stop');
        this.log('[Renderer] 录音保存结果:', result);
      } catch (err) {
        this.RecordingErrorMessage(99, '音频数据处理失败 ');
        this.log('[Renderer] 音频数据处理失败:', err.message);
        result.message = err.message;
      } finally {
        //如果是用户暂停的，则不进行后续调用接口操作
        if (!this.isUserStop) {
            await this.handlestopRecordAfter(result);
        } else {
          if(result.path)
          {
            const normalizedPath = path.normalize(result.path);
            fs.unlinkSync(normalizedPath) // 删除文件
          }
          this.cleanup();
        }
        this.isUserStop = false;
      }
    },

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result) {
      try {
        if (!result.success) {
          this.RecordingErrorMessage(99, "语音输入故障 ");
          return;
        }
        const normalizedPath = path.normalize(result.path);
        const uploadres = await ipcRenderer.invoke('hnc_stt', normalizedPath);
        fs.unlinkSync(normalizedPath) // 删除文件
        if (!uploadres || uploadres.code != 200) {
          this.RecordingErrorMessage(99, "语音识别故障 " + (uploadres?.data?.message ? uploadres?.data?.message : ""));
          return;
        }
        result.message = uploadres.data.result;
        //如果出现为空，说明没有说话，进行提示
        if (result.message.trim() == '' || result.message.trim() == "") {
          this.RecordingErrorMessage(99, "未检测到声音 ");
          return;
        }
        //发送消息给悬浮窗处理
        this.userInput=result.message;
        this.sendMessage();
      } catch (error) {
        this.RecordingErrorMessage(99, "语音交互异常 ");
        this.log("语音交互异常 ", error.message);
      } finally {
        //等所有的接口处理完成之后，在进行录音资源释放
        this.cleanup();
      }
    },

    cleanup() {
      // 清理资源
      if (this.animationFrameId) {
        cancelAnimationFrame(this.animationFrameId);
      }
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
      if (this.audioContext) {
        this.audioContext.close();
        this.audioContext = null;
      }

      this.isRecording = false;
      this.isStopRecording = false;
      this.silenceCount = 0;
      this.placeholdertext = "有问题尽管问我...";
      this.log('[Renderer] 资源已清理');
    },

    // ***********************麦克风录音结束 ***************//

  },
  watch: {
    tipText(newVal) {
      //this.startTipCloseTimer() // 值变化时重置倒计时
    }
  }
})
app.mount("#app")
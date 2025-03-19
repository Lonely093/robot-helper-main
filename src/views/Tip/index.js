const { ipcRenderer } = require("electron");
const Vue = require('vue')
const path = require('path');
const fs = require('fs');
const configManager = require("../../utils/configManager");

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
  // created() {
  //   const urlParams = new URLSearchParams(window.location.search);
  //   console.log("urlParams.get('reverse')",urlParams.get('reverse'));
  //   this.reverse = urlParams.get('reverse') === 'true';
  //   console.log("urlParams.get('reverse')222222222",this.reverse);
  // },
  data() {
    return {
      reverse: false,
      dfmessage: "你好，我是智能语音助手",
      topmessage: "你好，我是智能语音助手",
      userInput: "",
      IsMouseLeave: true,
      isMouseOnFloatBall: true,
      tipCloseTimeoutId: null,
      autoSendMessageId: null,
      lastruningtime: new Date(),
      isCanRecording: true,
      deviceCheckTimer: null,
      isStopRecording: false,
      isSpeacking: false,
      recordingStartTime: 0,
      isRecording: false,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId: null,
      maxDuration: parseInt(configManager.maxDuration),
      silenceHold: parseInt(configManager.silenceHold),
      silenceStop: parseInt(configManager.silenceStop),
      isUserStop: false,
      placeholdertext: "",
      isruning: false,
      isFirst: true,
      canvasCtx: null,
      dataArray: null,
      canvsanimationFrameId: null,
    }
  },

  async mounted() {
    ipcRenderer.on("tip-reverse", (e, data) => {
      if (data == "left") {
        this.reverse = true;
      } else {
        this.reverse = false;
      }
    })
    ipcRenderer.on('message-to-renderer', (event, data) => {
      //鼠标在机器人上
      if (data.type == 4) {
        if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId)
        this.isMouseOnFloatBall = true;
      }
      //鼠标离开了机器人
      else if (data.type == 5) {
        this.isMouseOnFloatBall = false;
        if (this.IsMouseLeave && !this.isRecording && !this.isStopRecording) {
          this.startTipCloseTimer();
        }
      }
      //显示文字
      else {
        this.isruning = false;
        this.userInput = "";
        this.topmessage = data.message;
        //值变化时，且鼠标不在悬浮窗则启动关闭
        if (this.IsMouseLeave && !this.isMouseOnFloatBall) {
          this.startTipCloseTimer();
        }
      }
    });

    //页面启动，默认清空录音记录
    ipcRenderer.invoke('audio-clear');

    //初始化画布
    this.initCanvas();

    // 初始化设备变化监听
    navigator.mediaDevices.addEventListener('devicechange',
      () => this.checkMicrophoneState()
    );

    //检测录音设备  是否支持录音
    await this.checkMicrophoneState();
    this.deviceCheckTimer = setInterval(() => this.checkMicrophoneState(), 5000);

    if (this.isCanRecording) {
      //间隔一秒启动录音
      setTimeout(async () => {
        await this.startRecording();
        this.isFirst = false;
      }, 800);
    } else {
      this.isFirst = false;
    }
  },
  beforeUnmount() {
    if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId)
    if (this.autoSendMessageId) clearTimeout(this.autoSendMessageId)
    if (this.deviceCheckTimer) clearTimeout(this.deviceCheckTimer)
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId)
    if (this.canvsanimationFrameId) cancelAnimationFrame(this.canvsanimationFrameId)
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
        data: { type: 3, message: "暂停录音" }
      });
    },
    async handleMouseDown(e) {
      if (this.autoSendMessageId) clearTimeout(this.autoSendMessageId)
    },
    sendMessage() {
      if (this.autoSendMessageId) clearTimeout(this.autoSendMessageId)
      if (this.userInput.trim() !== '') {
        this.isruning = true;
        this.topmessage = "好的，正在为您执行";
        //同时将消息发送至悬浮窗
        ipcRenderer.send('message-from-renderer', {
          target: 'floatball', // 指定目标窗口
          data: {
            type: 4,
            message: this.userInput
          }
        });
        //this.userInput="";
      }
    },

    startTipCloseTimer() {
      if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId) // 清除旧定时器
      this.tipCloseTimeoutId = setTimeout(() => {
        if (this.IsMouseLeave && !this.isRecording && !this.isStopRecording) {
          ipcRenderer.send("close-tip");
        }
      }, parseInt(configManager.pagehidetime) * 1000)
    },

    hanleMouseEnter() {
      this.IsMouseLeave = false;
      if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId);
    },

    hanleMouseLeave() {
      this.IsMouseLeave = true;
      if (this.tipCloseTimeoutId) clearTimeout(this.tipCloseTimeoutId);
      if (!this.isRecording && !this.isStopRecording && !this.isruning) {
        this.startTipCloseTimer();
      }
    },

    //暂停录音并不做后续处理
    async userStopRecording() {
      this.isUserStop = true;
      await this.stopRecording();
      this.isUserStop = false;
    },

    // ***********************麦克风录音 ***************//

    // 核心检测方法
    async checkMicrophoneState() {
      try {
        // 1. 检查权限状态
        const permissionStatus = await navigator.permissions.query({
          name: 'microphone'
        });
        // 2. 枚举音频设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        // 3. 组合状态判断
        const state = {
          hasPermission: permissionStatus.state === 'granted',
          hasDevice: audioInputs.length > 0,
          isDeviceReady: audioInputs.some(d => d.label) // 有标签表示已授权
        };

        // 4. 状态变化处理
        if (state.hasDevice && state.hasDevice && state.isDeviceReady) {
          this.isCanRecording = true;
        } else {
          this.isCanRecording = false;
        }
      } catch (error) {
        this.isCanRecording = false;
        this.log('检测失败:', error.message);
      }
    },

    //录音消息
    RecordingErrorMessage(type, message) {
      this.topmessage = message;
      this.isRecording = false;
    },
    async toggleRecording() {

      //在1秒间隔内点击 则不触发事件
      const diff = Math.abs(new Date() - this.lastruningtime);
      if (diff < 1000) return;
      this.lastruningtime = new Date();

      if (this.autoSendMessageId) clearTimeout(this.autoSendMessageId)
      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }
    },

    async startRecording() {
      if (!this.isCanRecording) return;
      //是否正在录音
      if (this.isRecording || this.isStopRecording) {
        return;
      }
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          //this.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          if (err.message == "Requested device not found") {
            this.RecordingErrorMessage(99, "无法启用语音，请试试手动输入吧");
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
        this.userInput = "";
        this.topmessage = this.dfmessage;
        this.recordingStartTime = new Date();
        this.startMonitoring();
        if (this.maxDuration > 2) {
          setTimeout(() => this.stopRecording(), this.maxDuration * 1000);
        }
      } catch (err) {
        this.RecordingErrorMessage(99, '无法启用语音，请试试手动输入吧');
        this.log('启动麦克风失败:', err.message);
      }
    },
    setupAudioAnalysis() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;

      const bufferLength = this.analyser.frequencyBinCount
      this.dataArray = new Uint8Array(bufferLength)

      source.connect(this.analyser);

      //启动绘制循环
      this.draw()
    },

    // 绘制音浪
    draw() {
      if (!this.analyser) return

      const canvas = this.$refs.waveCanvas
      const WIDTH = canvas.width / (window.devicePixelRatio || 1)
      const HEIGHT = canvas.height / (window.devicePixelRatio || 1)
      // 使用透明背景替代原来的半透明黑色
      this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)
      // 获取频率数据
      this.analyser.getByteFrequencyData(this.dataArray)
      this.drawBars(WIDTH, HEIGHT);

      //this.drawFrequencyBars(this.canvasCtx,canvas);

      // 循环绘制
      this.canvsanimationFrameId = requestAnimationFrame(this.draw)
    },

    /* 1. 基础柱状图 */
    drawBars(width, height) {
      const barWidth = (width / this.dataArray.length) * 15
      let x = 0

      for (let i = 0; i < this.dataArray.length; i++) {
        const barHeight = (this.dataArray[i] / 255) * height
        const gradient = this.canvasCtx.createLinearGradient(0, height - barHeight, 0, height)
        gradient.addColorStop(0, '#13cccf')
        gradient.addColorStop(1, '#13cccf')

        this.canvasCtx.fillStyle = gradient
        this.canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight)
        x += barWidth + 2
      }
    },

    // 初始化画布
    initCanvas() {
      const canvas = this.$refs.waveCanvas
      const container = canvas.parentElement

      // 高清屏适配
      const dpr = window.devicePixelRatio || 1
      canvas.width = 275 * dpr
      canvas.height = 55 * dpr
      canvas.style.width = canvas.width + 'px'
      canvas.style.height = canvas.height + 'px'

      this.canvasCtx = canvas.getContext('2d')
      this.canvasCtx.scale(dpr, dpr)

      //this.createClipPath()
    },
    // 创建圆形裁剪区域
    createClipPath() {
      const canvas = this.$refs.waveCanvas
      const rect = canvas.getBoundingClientRect()
      this.canvasCtx.beginPath()
      this.canvasCtx.moveTo(10, 0)
      this.canvasCtx.arcTo(rect.width, 0, rect.width, rect.height, 10)
      this.canvasCtx.arcTo(rect.width, rect.height, 0, rect.height, 10)
      this.canvasCtx.arcTo(0, rect.height, 0, 0, 10)
      this.canvasCtx.arcTo(0, 0, rect.width, 0, 10)
      this.canvasCtx.closePath()
      this.canvasCtx.clip()
    },

    setupDataHandler() {
      this.mediaRecorder.ondataavailable = async (e) => {
        try {
          const buffer = await e.data.arrayBuffer();
          ipcRenderer.send('audio-chunk', buffer);
        } catch (err) {
          this.RecordingErrorMessage(99, '无法启用语音，请试试手动输入吧');
          this.log('[Renderer] 数据处理失败:', err.message);
        }
      };
      this.mediaRecorder.start(200); // 每0.5秒收集数据
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
      if (!this.isSpeacking) {
        //两种情况判定为开始检测   1 检测到说话  2超过两秒钟
        const diff = Math.abs(new Date() - this.recordingStartTime);
        if (diff >= 2000) this.isSpeacking = true;
        if (volume * 100 >= this.silenceHold) this.isSpeacking = true;
      }
      if (!this.isSpeacking) return;

      //麦克风电流小于 silenceHold 超过 silenceStop 秒则停止录音
      if (volume * 100 < this.silenceHold) {
        this.silenceCount += 1 / 60;
        if (this.silenceCount >= this.silenceStop) {
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
        this.RecordingErrorMessage(99, '无法启用语音，请试试手动输入吧');
        this.log('[Renderer] 音频数据处理失败:', err.message);
        result.message = err.message;
      } finally {
        //如果是用户暂停的，则不进行后续调用接口操作
        if (!this.isUserStop) {
          await this.handlestopRecordAfter(result);
        } else {
          if (result.path) {
            const normalizedPath = path.normalize(result.path);
            fs.unlinkSync(normalizedPath) // 删除文件
          }
          this.cleanup();
        }
      }
    },

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result) {
      try {
        if (!result.success) {
          this.RecordingErrorMessage(99, "无法启用语音，请试试手动输入吧");
          return;
        }
        const normalizedPath = path.normalize(result.path);
        const uploadres = await ipcRenderer.invoke('hnc_stt', normalizedPath);
        fs.unlinkSync(normalizedPath) // 删除文件
        if (!uploadres || uploadres.code != 200) {
          this.RecordingErrorMessage(99, "无法启用语音，请试试手动输入吧");
          return;
        }
        result.message = uploadres.data.result;
        //如果出现为空，说明没有说话，进行提示
        if (result.message.trim() == '' || result.message.trim() == "") {
          this.RecordingErrorMessage(99, "没听清您的声音，请重试");
          return;
        }
        //发送消息给悬浮窗处理
        this.userInput = result.message;
        //两秒钟后自动发送，若两秒钟内点击输入框则停止发送
        //this.autoSendMessageId= setTimeout(() => {
        this.sendMessage();
        //}, 800);
      } catch (error) {
        this.RecordingErrorMessage(99, "无法启用语音，请试试手动输入吧");
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
      if (this.canvsanimationFrameId) {
        cancelAnimationFrame(this.canvsanimationFrameId);
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
      this.placeholdertext = "";
      this.isSpeacking = false;
      this.recordingStartTime = 0;
      //this.log('[Renderer] 资源已清理');
    },

    // ***********************麦克风录音结束 ***************//

  },
  watch: {

  }
})
app.mount("#app")
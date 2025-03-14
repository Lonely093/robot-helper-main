const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { formatterTime } = require("../../utils/date.js")
const { applyConfig } = require("../../utils/store.js")
const path = require('path');
const fs = require('fs');
const configManager = require("../../utils/configManager");

applyConfig()

const app = Vue.createApp({

  data: () => {
    return {
      userInput: '',
      placeholdertext:"有问题尽管问我...",
      // dfmessage: "当前是故障诊断页面，您有相关问题可以进行咨询",
      messages: [
        {
          text: ' **参数配置不合理的原因及解决方案**  \n   - 参数配置不合理的原因包括：坐标轴参数103517“最高速度限制” 是否设置正确；坐标轴参数103587“电机额定转速” 是否设置正确；轴参数中的103005“电子齿轮比分母”、103067 “轴每转脉冲数”、设备接口参数中的503015“反馈位置循环脉冲数”数值设置不一致；系统超速的限值(每个周期的最大长度增量)是否正确计算；以及超速系数是否设置正确。  \n   - 对应的解决方案：检查上述参数是否设置正确，计算超速限值，确保参数配置正确，必要时进行调整。  \n\n2. **编码器反馈信号异常的原因及解决方案**  \n   - 编码器反馈信号异常的原因包括：驱动单元或电机参数（如103005“电子齿轮比分母”、103067 “轴每转脉冲数”）设置不正确；编码器线缆或反馈信号异常。  \n   - 对应的解决方案：更换驱动单元或电机，通过交换法逐一排查；检查编码器线缆，更换并测试。',
          type: 'bot',
          commandlist: [
            {
              "app_id": "(hmi_id)103005",
              "command": "103005"
            },
            {
              "app_id": "(hmi_id)103034",
              "command": "103034"
            },
            {
              "app_id": "(hmi_id)103048",
              "command": "103048"
            },
            {
              "app_id": "(hmi_id)103067",
              "command": "103067"
            },
            {
              "app_id": "(hmi_id)103517",
              "command": "103517"
            },
            {
              "app_id": "(hmi_id)103526",
              "command": "103526"
            },
            {
              "app_id": "(hmi_id)103587",
              "command": "103587"
            },
            {
              "app_id": "(hmi_id)503015",
              "command": "503015"
            }
          ],
        }
      ],
      // commandlist: [
      //   {
      //     "app_id": "(hmi_id)103005",
      //     "command": "103005"
      //   },
      //   {
      //     "app_id": "(hmi_id)103034",
      //     "command": "103034"
      //   },
      //   {
      //     "app_id": "(hmi_id)103048",
      //     "command": "103048"
      //   },
      //   {
      //     "app_id": "(hmi_id)103067",
      //     "command": "103067"
      //   },
      //   {
      //     "app_id": "(hmi_id)103517",
      //     "command": "103517"
      //   },
      //   {
      //     "app_id": "(hmi_id)103526",
      //     "command": "103526"
      //   },
      //   {
      //     "app_id": "(hmi_id)103587",
      //     "command": "103587"
      //   },
      //   {
      //     "app_id": "(hmi_id)503015",
      //     "command": "503015"
      //   }
      // ],

      isStopRecording: false,
      isRecording: false,
      mediaStream: null,
      audioContext: null,
      analyser: null,
      silenceCount: 0,
      animationFrameId: null,
      isruning: false,
      maxDuration : parseInt(configManager.maxDuration),
      reverse: false,
    }
  },

  mounted() {
    ipcRenderer.on("todo-reverse", (e, data) => {
      console.log(data)
      if(data == "left"){
        this.reverse = true;
      }else{
        this.reverse = false;
      }
    })
    //悬浮窗传递过来的消息
    ipcRenderer.on('message-to-renderer', (event, data) => {
      //this.log('收到消息:', data);
      //  data.type 0 错误消息  1 正常消息   
      //  data.message  
      //  data.commandlist    注意可能存在  undefined  null 数据，需要判断一下
      let botMessage = data.message;
      let messageType = "bot";
      let commandlist = [];
      if (data.type == 3) {
        messageType = "user";
      } else if (data.type == 0) {
        botMessage = data.message;
      } else if (data.type == 1) {
        const separator = "</think>\n\n";
        const separatorIndex = data.message.indexOf(separator);
        if (separatorIndex !== -1) {
          // 从分隔符结束的位置开始截取，直到字符串末尾
          const startIndex = separatorIndex + separator.length;
          botMessage = data.message.substring(startIndex);
          commandlist = data.commandlist;
        }
      }
      this.messages.push({ text: botMessage, type: messageType, commandlist: commandlist })
      this.scrollToBottom();

    });

    //页面启动，默认清空录音记录
    ipcRenderer.invoke('audio-clear');

  },
  created() {
    // 创建全局事件桥接
    window.commandClickHandler = this.handleCommandClick;
  },
  unmounted() {
    // 清理全局事件
    delete window.commandClickHandler;
  },
  methods: {

    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'todo--' + msg, ctx });
    },

    // ***********************麦克风录音 ***************//
    async toggleRecording() {

      //防止重复点击
      if (this.isruning) return;
      this.isruning = true

      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }

      setTimeout(() => {
        this.isruning = false
      }, 1000)
    },
    async startRecording() {
      if (this.isRecording || this.isStopRecording)  return;
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          this.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          this.log('[Renderer] 麦克风访问被拒绝:', err.message);
          if (err.message == "Requested device not found") {
            this.sendErrorMessage( "无法启用语音，请试试手动输入吧");
          }
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
        this.placeholdertext = "倾听中...";
        this.startMonitoring();
        if(this.maxDuration > 2){
          setTimeout(() => this.stopRecording(), this.maxDuration * 1000);
        }
      } catch (err) {
        this.sendErrorMessage("无法启用语音，请试试手动输入吧");
        this.log('启动麦克风失败:', err.message);
      }
    },
    setupAudioAnalysis() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      this.log('[Renderer] 音频上下文采样率:', this.audioContext.sampleRate);
    },
    setupDataHandler() {
      this.mediaRecorder.ondataavailable = async (e) => {
        try {
          const buffer = await e.data.arrayBuffer();
          ipcRenderer.send('audio-chunk', buffer);
        } catch (err) {
          this.log('[Renderer] 音频数据处理失败:', err.message);
          this.sendErrorMessage("无法启用语音，请试试手动输入吧");
        }
      };

      this.mediaRecorder.start(500); // 每1秒收集数据
      this.log('[Renderer] 媒体录音器已启动');
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
      //此处为超过2s检测到的麦克风电流小于0.7则停止录音
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
        message: ""
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
        this.sendErrorMessage("无法启用语音，请试试手动输入吧");
        this.log('[Renderer] 停止失败:', err.message);
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

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result) {
      if (!result.success ) {
        this.sendErrorMessage("无法启用语音，请试试手动输入吧");
      } else {
        const normalizedPath = path.normalize(result.path);
        const uploadres = await ipcRenderer.invoke('hnc_stt', normalizedPath);
        fs.unlinkSync(normalizedPath) // 删除文件
        if (!uploadres || uploadres.code != 200) {
          this.sendErrorMessage("无法启用语音，请试试手动输入吧");
        } else {
          this.userInput = uploadres.data.result;
          if (this.userInput.trim() !== '') {
            this.sendMessage();
          }else{
            this.sendErrorMessage("没太听清您的声音，请重试...");
          }
        }
      }
      //等所有的接口处理完成之后，在进行录音资源释放
      this.cleanup();
    },

    //鼠标按下输入框，暂停录音并不做后续处理
    async handleMouseDown(e) {
      this.isUserStop = true;
      await this.stopRecording();
    },

    // ***********************麦克风录音结束 ***************//


    handleWindowClose() {
      ipcRenderer.send("close-todo")
    },
    formatText(message) {
      //this.log("formatText(message)", message.text)
      // 生成正则表达式匹配所有指令参数
      let commands = [];
      if (message.type == 'bot') {
        commands = message.commandlist.map(c => c.command).join('|');
      }

      const regex = new RegExp(`\\b(${commands})\\b`, 'g');

      // 分步处理文本
      return message.text
        .replace(/\n/g, '<br>')  // 处理换行
        .replace(regex, (match) => {
          const target = message.commandlist.find(c => c.command === match);
          return target ?
            `<a class="command-link" 
          data-command="${target.command}"
          onclick="commandClickHandler('${target.command}','${target.app_id}')"
          onmouseover="this.style.color='#79bbff'"
          onmouseout="this.style.color='#13CCCF'">
          ${match}
          </a>`:
            match;
        });
    },
    handleCommandClick(appCommand, appId) {
      this.log('选择执行指令:', appCommand, appId);
      let resp = '选择执行指令:' + appCommand;
      this.messages.push({ text: resp, type: 'user', commandlist: [] });
      this.scrollToBottom();

      //同时将消息发送至悬浮窗，      2 表示执行指令
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball', // 指定目标窗口
        data: {
          type: 2, command: {
            command: appCommand,
            app_id: appId
          }
        }
      });

    },

    sendVoiceMessage() {
      setTimeout(() => {
        this.messages.push({ text: '这是AI机器人的回复。', type: 'bot', commandlist: [] })
        this.scrollToBottom()
      }, 1000)
    },
    sendMessage() {
      if (this.userInput.trim() !== '') {
        // this.messages.push({ text: this.userInput, type: 'user', commandlist: [] })
        // this.scrollToBottom()

        //同时将消息发送至悬浮窗，   type  1 表示进行故障诊断   2 表示执行指令
        ipcRenderer.send('message-from-renderer', {
          target: 'floatball', // 指定目标窗口
          data: { type: 1, message: this.userInput }
        });
        this.userInput = ''
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const messagesContainer = document.querySelector('.messages')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      })
    },
    sendErrorMessage(message){
      this.messages.push({ text: message, type: 'bot' ,commandlist:[]})
      this.scrollToBottom();
      this.placeholdertext = "有问题尽管问我...";
    }
  }
})

app.mount("#app")
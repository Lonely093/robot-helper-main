const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { formatterTime } = require("../../utils/date.js")
const { applyConfig } = require("../../utils/store.js")
const path = require('path');
const fs = require('fs');

applyConfig()

const app = Vue.createApp({

  data: () => {
    return {
      userInput: '',
      messages: [
        {
          text: '1. **参数配置不合理的原因及解决方案**  \n   - 参数配置不合理的原因包括：坐标轴参数103517“最高速度限制” 是否设置正确；坐标轴参数103587“电机额定转速” 是否设置正确；轴参数中的103005“电子齿轮比分母”、103067 “轴每转脉冲数”、设备接口参数中的503015“反馈位置循环脉冲数”数值设置不一致；系统超速的限值(每个周期的最大长度增量)是否正确计算；以及超速系数是否设置正确。  \n   - 对应的解决方案：检查上述参数是否设置正确，计算超速限值，确保参数配置正确，必要时进行调整。  \n\n2. **编码器反馈信号异常的原因及解决方案**  \n   - 编码器反馈信号异常的原因包括：驱动单元或电机参数（如103005“电子齿轮比分母”、103067 “轴每转脉冲数”）设置不正确；编码器线缆或反馈信号异常。  \n   - 对应的解决方案：更换驱动单元或电机，通过交换法逐一排查；检查编码器线缆，更换并测试。',
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

    }
  },

  mounted() {
    window.addEventListener('floatball-todo', (event) => {
      //type 0 错误消息    1 正常 故障诊断消息
      const { type, commandlist, message } = event.detail;
    });

    //悬浮窗传递过来的消息
    ipcRenderer.on('message-to-renderer', (event, data) => {
      console.log('收到消息:', data);
      //  data.type 0 错误消息  1 正常消息   
      //  data.message  
      //  data.commandlist    注意可能存在  undefined  null 数据，需要判断一下
      let botMessage = data.message;
      let messageType = "bot";
      let commandlist = [];
      if (data.type == 3) {
        messageType="user";
      }else if (data.type == 0) {
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


    // ***********************麦克风录音 ***************//
    async toggleRecording() {
      if (this.isRecording) {
        await this.stopRecording();
      } else {
        await this.startRecording();
      }
    },
    async startRecording() {
      if (this.isRecording) {
        return;
      }
      try {
        // 初始化音频流
        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('[Renderer] 已获得麦克风权限');
        } catch (err) {
          console.error('[Renderer] 麦克风访问被拒绝:', err);
          this.$emit('error', '请允许麦克风访问权限');
          return;
        }
        // 初始化音频分析
        this.setupAudioAnalysis();
        // 通知主进程开始录音
        const { pathurl } = await ipcRenderer.invoke('audio-start');
        console.log(`[Renderer] 录音文件路径: ${pathurl}`);
        // 创建媒体录音器
        this.mediaRecorder = new MediaRecorder(this.mediaStream);
        this.setupDataHandler();
        this.isRecording = true;
        this.startMonitoring();
      } catch (err) {
        console.error('录音启动失败:', err);
      }
    },
    setupAudioAnalysis() {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      console.log('[Renderer] 音频上下文采样率:', this.audioContext.sampleRate);
    },
    setupDataHandler() {
      this.mediaRecorder.ondataavailable = async (e) => {
        try {
          const buffer = await e.data.arrayBuffer();
          ipcRenderer.send('audio-chunk', buffer);
        } catch (err) {
          console.error('[Renderer] 数据处理失败:', err);
          this.$emit('error', '音频数据发送失败');
        }
      };

      this.mediaRecorder.start(500); // 每1秒收集数据
      console.log('[Renderer] 媒体录音器已启动');
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
      const SILENCE_THRESHOLD = 0.6; //可调整的静音阈值 最大值为1  
      //console.log(volume);
      //此处为超过1s检测到的麦克风电流小于0.2则停止录音
      if (volume < SILENCE_THRESHOLD) {
        this.silenceCount += 1 / 60;
        if (this.silenceCount >= 2) {
          console.log('[Renderer] 检测到持续静音，自动停止');
          console.log(Date.now());
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
        console.log('[Renderer] 录音保存结果:', result);
        console.log(Date.now());
        this.$emit('record-complete', result);
      } catch (err) {
        console.error('[Renderer] 停止失败:', err);
        this.$emit('error', err.message);
        result.message = err.message;
      } finally {
        this.handlestopRecordAfter(result);
        this.isStopRecording = false;
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
      this.silenceCount = 0;
      console.log('[Renderer] 资源已清理');
    },

    //获取录音 文字之后的处理 成功：调用人机交互接口  失败：提示网络故障，请重试，并给出错误原因=result.message
    async handlestopRecordAfter(result) {
      if (!result.success) {
        this.userInput = "录音故障:" + result.message;
      } else {
        const normalizedPath = path.normalize(result.path);
        console.log(normalizedPath);
        const uploadres = await ipcRenderer.invoke('hnc_stt', normalizedPath);
        fs.unlinkSync(normalizedPath) // 删除文件
        console.log("uploadres:", uploadres);
        if (!uploadres || uploadres.code != 200) {
          this.userInput = "上传录音文件故障 " + uploadres?.data?.message;
        } else {
          this.userInput = uploadres.data.result;
          if (this.userInput.trim() !== '') {
            this.sendMessage();
            //同时将消息发送至悬浮窗，   type  1 表示进行故障诊断   2 表示执行指令
            ipcRenderer.send('message-from-renderer', {
              target: 'floatball', // 指定目标窗口
              data: { type: 1, message: uploadres.data.result }
            });
          }
        }
      }
      //等所有的接口处理完成之后，在进行录音资源释放
      this.cleanup();
    },

    // ***********************麦克风录音结束 ***************//


    handleWindowClose() {
      ipcRenderer.send("close-todo")
    },
    formatText(message) {
      console.log("formatText(message)", message)
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
          onmouseout="this.style.color='#409eff'">
          ${match}
          </a>`:
            match;
        });
    },
    handleCommandClick(appCommand, appId) {
      console.log('Selected app_id:', appCommand, appId);
      let resp = 'Selected app_id:' + appCommand + appId;
      this.messages.push({ text: resp, type: 'bot', commandlist: [] });
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
        this.messages.push({ text: this.userInput, type: 'user', commandlist: [] })



        this.userInput = ''
        // 模拟AI回复
        setTimeout(() => {
          this.messages.push({ text: '这是AI机器人的回复。', type: 'bot', commandlist: [] })
          this.scrollToBottom()
        }, 1000)

        this.scrollToBottom()
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const messagesContainer = document.querySelector('.messages')
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight
        }
      })
    }
  }
})

app.mount("#app")
const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { formatterTime } = require("../../utils/date.js")
const { applyConfig } = require("../../utils/store.js")


applyConfig()
/**
 * Vue应用实例 - Todo组件
 * 实现一个带有消息交互和命令处理功能的聊天界面
 * 
 * @component
 * 
 * @property {String} userInput - 用户输入的消息内容
 * @property {Array} messages - 消息历史记录列表,包含用户和机器人的对话
 * @property {Array} command_list - 可点击命令列表,包含command和app_id
 * 
 * @listens floatball-todo - 监听悬浮球事件
 * @listens close-todo - 监听关闭窗口事件
 * 
 * @method handleWindowClose - 处理窗口关闭
 * @method formatText - 格式化文本,将命令转换为可点击链接
 * @method handleCommandClick - 处理命令点击事件
 * @method sendMessage - 发送用户消息并模拟AI回复
 * @method scrollToBottom - 滚动消息容器到底部
 */
const app = Vue.createApp({

  data: () => {
    return {
      userInput: '',
      messages: [
        {
          text: '1. **参数配置不合理的原因及解决方案**  \n   - 参数配置不合理的原因包括：坐标轴参数103517“最高速度限制” 是否设置正确；坐标轴参数103587“电机额定转速” 是否设置正确；轴参数中的103005“电子齿轮比分母”、103067 “轴每转脉冲数”、设备接口参数中的503015“反馈位置循环脉冲数”数值设置不一致；系统超速的限值(每个周期的最大长度增量)是否正确计算；以及超速系数是否设置正确。  \n   - 对应的解决方案：检查上述参数是否设置正确，计算超速限值，确保参数配置正确，必要时进行调整。  \n\n2. **编码器反馈信号异常的原因及解决方案**  \n   - 编码器反馈信号异常的原因包括：驱动单元或电机参数（如103005“电子齿轮比分母”、103067 “轴每转脉冲数”）设置不正确；编码器线缆或反馈信号异常。  \n   - 对应的解决方案：更换驱动单元或电机，通过交换法逐一排查；检查编码器线缆，更换并测试。',
          type: 'bot'
        }
      ],
      command_list: [
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
      ]

    }
  },

  mounted() {
    window.addEventListener('floatball-todo', (event) => {
      //type 0 错误消息    1 正常 故障诊断消息
      const { type, commandlist, message } = event.detail;
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
    handleWindowClose() {
      ipcRenderer.send("close-todo")
    },
    formatText(text) {
      // 生成正则表达式匹配所有指令参数
      const commands = this.command_list.map(c => c.command).join('|');
      const regex = new RegExp(`\\b(${commands})\\b`, 'g');

      // 分步处理文本
      return text
        .replace(/\n/g, '<br>')  // 处理换行
        .replace(regex, (match) => {
          const target = this.command_list.find(c => c.command === match);
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
      this.messages.push({ text: resp, type: 'bot' });
      this.scrollToBottom();
    },

    sendVoiceMessage() {
      setTimeout(() => {
        this.messages.push({ text: '这是AI机器人的回复。', type: 'bot' })
        this.scrollToBottom()
      }, 1000)
    },
    sendMessage() {
      if (this.userInput.trim() !== '') {
        this.messages.push({ text: this.userInput, type: 'user' })



        this.userInput = ''
        // 模拟AI回复
        setTimeout(() => {
          this.messages.push({ text: '这是AI机器人的回复。', type: 'bot' })
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
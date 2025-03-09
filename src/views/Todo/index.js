const { ipcRenderer } = require("electron");
const Vue = require('vue')

const { formatterTime } = require("../../utils/date.js")
const { applyConfig } = require("../../utils/store.js")


applyConfig()
const app = Vue.createApp({

  data: () => {
    return {
      userInput: '',
      messages: [
        { text: '1. **参数配置不合理的原因及解决方案**  \n   - 参数配置不合理的原因包括：坐标轴参数103517“最高速度限制” 是否设置正确；坐标轴参数103587“电机额定转速” 是否设置正确；轴参数中的103005“电子齿轮比分母”、103067 “轴每转脉冲数”、设备接口参数中的503015“反馈位置循环脉冲数”数值设置不一致；系统超速的限值(每个周期的最大长度增量)是否正确计算；以及超速系数是否设置正确。  \n   - 对应的解决方案：检查上述参数是否设置正确，计算超速限值，确保参数配置正确，必要时进行调整。  \n\n2. **编码器反馈信号异常的原因及解决方案**  \n   - 编码器反馈信号异常的原因包括：驱动单元或电机参数（如103005“电子齿轮比分母”、103067 “轴每转脉冲数”）设置不正确；编码器线缆或反馈信号异常。  \n   - 对应的解决方案：更换驱动单元或电机，通过交换法逐一排查；检查编码器线缆，更换并测试。', type: 'bot' }
      ],

    }
  },

  mounted() {

  },
  methods: {
    handleWindowClose() {
      ipcRenderer.send("close-todo")
    },
    sendMessage() {
      if (userInput.value.trim() !== '') {
        messages.value.push({ text: userInput.value, type: 'user' })
        userInput.value = ''
        // 模拟AI机器人回复
        setTimeout(() => {
          messages.value.push({ text: '这是AI机器人的回复。', type: 'bot' })
          // scrollToBottom()
        }, 1000)
        // 滚动到底部
        // scrollToBottom()
      }
    },
    // scrollToBottom() {
    //   nextTick(() => {
    //     const messagesContainer = document.querySelector('.messages')
    //     messagesContainer.scrollTop = messagesContainer.scrollHeight
    //   })
    // }
  }
})

app.mount("#app")
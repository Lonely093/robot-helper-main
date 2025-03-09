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
        { text: '你好！我是AI机器人，有什么可以帮你的吗？', type: 'bot' }
      ],

    }
  },

  mounted() {
    window.addEventListener('floatball-todo', (event)=>{
      
      const { commandlist,message } = event.detail;

    });
  },
  methods: {
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
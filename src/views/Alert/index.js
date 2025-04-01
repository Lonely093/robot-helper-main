const { ipcRenderer } = require("electron");
const Vue = require('vue')

const app = Vue.createApp({
  // created() {
  // },
  data() {
    return {
      GcodePath: "",
    }
  },

  async mounted() {
    ipcRenderer.on('message-to-renderer', (event, data) => {
      this.GcodePath = data.message;
    });
  },
  beforeUnmount() {

  },
  methods: {
    handleConfirm() {
      //处理加工  发送指令给HMI
      ipcRenderer.send('message-from-renderer', {
        target: 'floatball',
        data: { type: 32, command: "LOADFILE", message: GcodePath }
      });
      ipcRenderer.send("close-alert")
    },
    handleCancel() {
      ipcRenderer.send("close-alert")
    },
    //发送日志记录
    log(msg, ctx) {
      ipcRenderer.invoke('app-log', { msg: 'alert--' + msg, ctx });
    },


  },
  watch: {

  }
})
app.mount("#app")
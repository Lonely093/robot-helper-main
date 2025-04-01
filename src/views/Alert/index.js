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
const { ipcRenderer } = require("electron");
const Vue = require('vue')

const app = Vue.createApp({
  // created() {
  // },
  data() {
    return {

    }
  },

  async mounted() {

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
const { ipcRenderer } = require("electron");
const Vue = require('vue')
const { formatterTime } = require("../../utils/date.js")
const { getConfig, defaultConfig } = require("../../utils/store.js")


let currConfig = {}
const app = Vue.createApp({

  data() {
    return {
      tipText: '请问你需要什么帮助？',
    }
  },

  mounted() {

  },
  methods: {

  }
})
app.mount("#app")
const mqtt = require("mqtt");
const stateStore = require("./localStorage");
const readConfig = require('./configManager');

class MqttClient {
  constructor(options = {}) {
    // 合并配置参数
    this.options = Object.assign({
      brokerUrl: readConfig.mqtt.brokerUrl,
      clientId: readConfig.mqtt.clientId,
      username: readConfig.mqtt.username,
      password: readConfig.mqtt.password,
      clean: false,  //启用持久会话
      reconnectPeriod: 5000, // 重连间隔
      connectTimeout: 30 * 1000, // 连接超时
      autoReconnect: true,         // 启用自动重连
      reconnectInterval: 5000,     // 重连间隔
      maxReconnectAttempts: 10,    // 最大重连次数
      // will: {
      //   topic:"App/Exit/",
      //   payload:{
      //     "app_id": "robot-ai",
      //     "timestamp": Date.now(),
      //   },
      //   qos:2,
      //   retain:false,
      // }, // 遗嘱消息配置
    }, options)

    this.client = null
    this.subscriptions = new Map() // 存储订阅回调
    this.reconnectCount = 0
    this.isConnected = false // 连接状态标识
    this.pendingSubscribes = [] // 待处理的订阅队列
    this.pendingPublishes = [] // 待处理的发布队列
    this.reconnectAttempts = 0     // 当前重连尝试次数
    this.reconnectTimer = null      // 重连定时器
    this.setoptions = { qos: 1, retain: false }  //设置发布订阅的消息等级  以及是否存储
  }

  _test() {
    console.log("_test");
    const event = new CustomEvent('floatball-test', {
      detail: { type: 1, message: "teste121212" }
    });
    window.dispatchEvent(event);
  }

  // 格式化遗嘱消息
  _formatWillMessage() {
    if (!this.options.will) return null
    const will = {
      ...this.options.will,
      payload: this._convertPayload(this.options.will.payload),
      properties: {
        willDelayInterval: this.options.will.delayInterval || 0 // MQTT 5.0属性
      }
    }

    // 保留标准字段
    return {
      topic: will.topic,
      payload: will.payload,
      qos: will.qos || 0,
      retain: will.retain || false,
      properties: will.properties
    }
  }

  // 通用消息转换
  _convertPayload(payload) {
    return typeof payload === 'object'
      ? JSON.stringify(payload)
      : payload.toString()
  }

  // 连接MQTT服务
  async connect() {
    if (this.client && this.isConnected) return
    // 清除旧连接
    if (this.client) {
      await this._safeDisconnect()
    }
    // 初始化连接
    return new Promise((resolve, reject) => {
      this.client = mqtt.connect(this.options.brokerUrl, {
        clientId: this.options.clientId,
        username: this.options.username,
        password: this.options.password,
        clean: this.options.clean,
        connectTimeout: this.options.connectTimeout,
        reconnectPeriod: 0, // 禁用内置自动重连
        //will: this._formatWillMessage() // 添加遗嘱消息
      })
      // 连接成功回调
      this.client.once('connect', () => {
        this._handleConnectSuccess()
        resolve()
      })
      // 首次连接错误处理
      this.client.once('error', (error) => {
        this._handleConnectionError(error, reject)
      })

      // 通用事件监听
      this._setupEventListeners()
    })
  }

  // 处理连接成功
  _handleConnectSuccess() {
    console.log('MQTT Connected')
    this.isConnected = true
    this.reconnectAttempts = 0
    clearTimeout(this.reconnectTimer)

    // 恢复订阅
    this.subscriptions.forEach((callback, topic) => {
      this.client.subscribe(topic, this.setoptions)
    })

    // 处理待订阅主题
    this.pendingSubscribes.forEach(({ topic, callback }) => {
      try {
        this._realSubscribe(topic, callback)
      } catch (error) {
        console.error(`订阅失败 [${topic}]:`, error)
      }
    })
    this.pendingSubscribes = []

    // 处理待发布消息
    this.pendingPublishes.forEach(({ topic, message, options }) => {
      try {
        this._realPublish(topic, message, options)
      } catch (error) {
        console.error(`发布失败 [${topic}]:`, error)
      }
    })
    this.pendingPublishes = []

    //新增初始化订阅
    this.initialize();
  }

  // 处理连接错误
  _handleConnectionError(error, reject) {
    console.error('Initial connection failed:', error)

    if (this.options.autoReconnect) {
      this._scheduleReconnect()
      reject(new Error('Initial connection failed, starting reconnect...'))
    } else {
      reject(error)
    }
  }

  // 安排重连
  _scheduleReconnect() {
    if (!this.options.autoReconnect) return
    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      console.error('Maximum reconnect attempts reached')
      return
    }

    this.reconnectAttempts++
    const delay = this.options.reconnectInterval * Math.pow(2, this.reconnectAttempts)
    console.log(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`)
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect()
      } catch (error) {
        this._scheduleReconnect()
      }
    }, Math.min(delay, 30000)) // 最大间隔30秒
  }

  // 安全断开连接
  async _safeDisconnect() {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, {}, () => {
          this.client = null
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  // 设置事件监听
  _setupEventListeners() {
    // 连接断开处理
    this.client.on('close', () => {
      if (!this.isConnected) return
      console.log('MQTT Disconnected')
      this.isConnected = false
      this._scheduleReconnect()
    })

    // 消息处理
    this.client.on('message', (topic, message) => {
      const msg = this.parseMessage(message)
      const callback = this.subscriptions.get(topic)
      callback && callback(topic, msg)
    })
  }

  //实际订阅方法
  _realSubscribe(topic, callback) {
    this.subscriptions.set(topic, callback)
    this.client.subscribe(topic, this.setoptions, (err) => {
      if (err) {
        console.error('Subscribe error:', err)
      }
    })
  }

  // 订阅主题
  subscribe(topic, callback) {
    if (this.isConnected) {
      this._realSubscribe(topic, callback)
    } else {
      this.pendingSubscribes.push({ topic, callback })
    }
  }

  // 取消订阅
  unsubscribe(topic) {
    if (!this.client || !this.client.connected) return

    this.subscriptions.delete(topic)
    this.client.unsubscribe(topic)
  }

  // 实际发布方法
  _realPublish(topic, message, options) {
    const payload = typeof message === 'object'
      ? JSON.stringify(message)
      : message.toString()
    this.client.publish(topic, payload, options)
  }

  // 发布消息
  publish(topic, message, options = this.setoptions) {
    if (this.isConnected) {
      this._realPublish(topic, message, options)
    } else {
      this.pendingPublishes.push({ topic, message, options })
    }
  }

  // 断开连接
  disconnect() {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.end(false, {}, () => {
          this.isConnected = false
          this.subscriptions.clear()
          this.pendingSubscribes = []
          this.pendingPublishes = []
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  // 解析消息（自动处理JSON格式）
  parseMessage(message) {
    try {
      return JSON.parse(message.toString())
    } catch (e) {
      return message.toString()
    }
  }

  //初始化MQTT 订阅基础的APP注册，并根据获取到的注册结果，进行各个APP消息注册
  initialize() {
    //APP注册发布
    if (this.subscriptions.length > 0) return;
    this.subscriptions.set('AppCenter/Apps', (topic, message) => {
      //根据获取到的结果进行APP消息订阅  将APP注册数据持久化存储
      console.log("AppCenter:", message);

      if (message.apps && message.apps.length > 0) {
        message.apps.forEach(app => {
          app.state = "0";//默认设置为未启动
          stateStore.saveApp(app.app_id, app);
          //根据app是否支持启动，来订阅  启动/关闭/指令执行功能
          if (app.ai_interaction.action) {
            this.subscribe("App/Launch/" + app.app_id, (topic, message) => {
              this.AppLaunch(topic, message)
            });
            this.subscribe("App/Exit/" + app.app_id, (topic, message) => {
              this.AppExit(topic, message)
            });
            this.subscribe("App/Message/" + app.app_id, (topic, message) => {
              this.AppMessage(topic, message)
            });
          }
          //是否可执行指令
          if (app.ai_interaction.exec) {
            this.subscribe("App/Reply/" + app.app_id, (topic, message) => {
              this.AppReply(topic, message)
            });
          }
        });
      }
    })
    this.client.subscribe('AppCenter/Apps', { qos: 2, retain: true });
  }

  AppLaunch(topic, message) {
    console.log("AppLaunch:", message);
    var app = stateStore.getApp(message.app_id);
    if (app) {
      app.state = "1";
      stateStore.saveApp(app.app_id, app);
      this.triggerAppLaunchEvent(app.app_id);
    } 
  }

  AppExit(topic, message) {
    console.log("AppExit:", message);
    var app = stateStore.getApp(message.app_id);
    if (app) {
      app.state = "0";
      stateStore.saveApp(app.app_id, app);
    }
  }

  //指令执行反馈
  AppReply(topic, message) {
    console.log("AppReply:", message);
    this.triggerCommandResultEvent(message.app_id, message.reply);
  }

  GetConnected(){
    return this.isConnected;
  }

  AppMessage(topic, message) {
    this.triggerAppMessagetEvent(message.app_id, message.message);
  }

  triggerAppLaunchEvent(appId) {
    const event = new CustomEvent('app-launch', {
      detail: { appId }
    });
    window.dispatchEvent(event);
  }

  triggerCommandResultEvent(appId, msg) {
    const event = new CustomEvent('app-command-result', {
      detail: { appId, msg }
    });
    window.dispatchEvent(event);
  }

  triggerAppMessagetEvent(appId, msg) {
    const event = new CustomEvent('app-message', {
      detail: { appId, msg }
    });
    window.dispatchEvent(event);
  }

}

// 创建单例实例
module.exports = new MqttClient();

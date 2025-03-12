
//默认连接配置
const DEFAULT_CONFIG = {
  http: {
    hnc_stt: 'http://172.20.11.80:9000/api/hnc_stt',
    hnc_tti: 'http://172.20.11.80:9001/api/hnc_tti',
    hnc_fd: 'http://172.20.11.80:9002/api/hnc_fd'
  },
  mqtt: {
    brokerUrl: 'ws://127.0.0.1:8083/mqtt',
    clientId: 'AIRobot', //`robot-ai${Math.random().toString(16).substr(2, 8)}`,
    username: '',
    password: '',
  },
  pagehidetime : 5,        //配置鼠标离开窗口后 自动隐藏的时间 单位秒
  maxDuration : 30,       //配置最大录音时长 最少2秒     单位秒
  about:{
    appname:"语音助手APP",
    version : "1.0.0",
    info : "支持语音交互，识别指令，自动执行指令，故障诊断，手动执行指令等功能"
  }
};

// 读取配置
module.exports = DEFAULT_CONFIG;

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
  }
};

// 读取配置
module.exports = DEFAULT_CONFIG;
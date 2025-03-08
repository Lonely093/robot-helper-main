// instruction-manager.js
class InstructionManager {
    constructor(mqttClient) {
      this.mqttClient = mqttClient;
      this.instructionQueue = [];
      this.isProcessing = false;
      this.currentInstructionId = null;
      this.completionTopic = 'app/instructions/complete';
      
      // 订阅完成通知主题
      this.mqttClient.subscribe(this.completionTopic);
      this.mqttClient.on('message', this.handleCompletionMessage.bind(this));
    }
  
    // 添加指令到队列
    addInstruction(instruction) {
      return new Promise((resolve, reject) => {
        this.instructionQueue.push({
          ...instruction,
          resolve,
          reject
        });
        this.processQueue();
      });
    }
  
    // 处理队列
    async processQueue() {
      if (this.isProcessing || this.instructionQueue.length === 0) return;
  
      this.isProcessing = true;
      const currentTask = this.instructionQueue.shift();
  
      try {
        // 生成唯一指令ID
        currentTask.instructionId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
        this.currentInstructionId = currentTask.instructionId;
  
        // 发送指令（包含唯一ID）
        await this.publishInstruction(currentTask);
        
        // 等待完成通知（带超时）
        const result = await Promise.race([
          this.waitForCompletion(currentTask.instructionId),
          this.timeout(15000) // 15秒超时
        ]);
  
        currentTask.resolve(result);
      } catch (error) {
        currentTask.reject(error);
      } finally {
        this.isProcessing = false;
        this.currentInstructionId = null;
        this.processQueue();
      }
    }
  
    // 发送MQTT指令
    async publishInstruction(task) {
      return new Promise((resolve, reject) => {
        this.mqttClient.publish(
          'app/instructions/request',
          JSON.stringify({
            id: task.instructionId,
            command: task.command,
            params: task.params
          }),
          { qos: 1 },
          (err) => {
            if (err) reject(new Error('指令发送失败'));
            else resolve();
          }
        );
      });
    }
  
    // 等待完成通知
    waitForCompletion(instructionId) {
      return new Promise((resolve, reject) => {
        this.completionResolve = resolve;
        this.completionReject = reject;
        this.expectedInstructionId = instructionId;
      });
    }
  
    // 处理完成消息
    handleCompletionMessage(topic, message) {
      if (topic !== this.completionTopic) return;
      
      try {
        const { id, success, data } = JSON.parse(message.toString());
        
        if (id !== this.expectedInstructionId) return;
  
        if (success) {
          this.completionResolve(data);
        } else {
          this.completionReject(new Error(`指令执行失败: ${data.message}`));
        }
      } catch (e) {
        this.completionReject(new Error('无效的完成消息格式'));
      }
    }
  
    // 超时控制
    timeout(ms) {
      return new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`指令超时 (${ms}ms)`));
        }, ms);
      });
    }
  }
  
  // 使用示例
  // 初始化MQTT客户端
  const mqttClient = mqtt.connect('mqtt://broker.example.com');
  const instructionManager = new InstructionManager(mqttClient);
  
  // 添加顺序指令
  async function executeWorkflow() {
    try {
      // 执行第一个指令
      const result1 = await instructionManager.addInstruction({
        command: 'START_PROCESS',
        params: { mode: 'fast' }
      });
      
      // 执行第二个指令（在前一个完成后执行）
      const result2 = await instructionManager.addInstruction({
        command: 'LOAD_CONFIG',
        params: { version: 'v2' }
      });
  
      // 执行第三个指令
      const result3 = await instructionManager.addInstruction({
        command: 'RUN_TASK',
        params: { taskId: 'task_001' }
      });
  
      console.log('所有指令执行完成');
    } catch (error) {
      console.error('流程执行失败:', error);
    }
  }
  
  // 启动流程
  executeWorkflow();
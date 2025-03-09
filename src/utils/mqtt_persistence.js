const Dexie= require("dexie");


// 使用IndexedDB进行持久化
const db = new Dexie('AppStateDatabase');
db.version(2).stores({
  currentStates: '&appId, data, updatedAt',
  stateHistory: '++id, appId, [appId+updatedAt]'
});

class StateStore {
  // 更新当前状态
   updateState(appId, state) {
    const record = {
      appId,
      data: state,
      updatedAt: Date.now()
    };
    db.transaction('rw', db.currentStates, db.stateHistory,  () => {
       db.currentStates.put(record);
       db.stateHistory.add({...record, id: undefined});
    });
  }

  // 获取当前状态
   getCurrentState(appId) {
     var app = db.currentStates.get(appId);
     return app.value;
  }

  // 获取全部应用状态
  getAllStates() {
    return db.currentStates.toArray();
  }

  // 获取历史记录
   getHistory(appId, limit = 100) {
    return db.stateHistory
      .where('appId').equals(appId)
      .reverse()
      .limit(limit)
      .toArray();
  }
}

module.exports = new StateStore();
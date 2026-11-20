// 在浏览器控制台粘贴运行，注入一个全地图解锁的 80 级女巫存档
// 运行后刷新页面即可看到角色

(async () => {
  const DB_NAME = 'sanctuary-h5';
  const STORE = 'characters';

  // 全部路径点 ID（从 catalog 里的区域数据，有 waypoint:true 的区域）
  const ALL_WAYPOINTS = [
    1,3,4,5,6,8,10,11,       // Act1
    40,41,43,44,45,46,47,48,  // Act2
    75,77,78,79,80,81,83,85,  // Act3
    103,106,107,108,          // Act4
    109,110,111,112,113,114,115,116,117,118,120,121,122,123,124,125,126,127,128  // Act5
  ];

  // 全部任务完成（三难度）
  const quests = {};
  const difficulties = ['normal', 'nightmare', 'hell'];
  const questIds = ['a1q1','a1q2','a1q3','a1q4','a1q5','a1q6',
                    'a2q1','a2q2','a2q3','a2q4','a2q5','a2q6',
                    'a3q1','a3q2','a3q3','a3q4','a3q5','a3q6',
                    'a4q1','a4q2','a4q3',
                    'a5q1','a5q2','a5q3','a5q4','a5q5','a5q6'];
  for (const d of difficulties) {
    for (const q of questIds) quests[`${d}:${q}`] = 3;
    quests[`${d}:cowPortal`] = 1;
  }

  const player = {
    classId: 'sor',
    name: '测试女巫',
    level: 80,
    experience: 3600000000,
    difficulty: 'hell',
    strength: 80, dexterity: 60, vitality: 300, energy: 200,
    statPoints: 50,
    skillPoints: 20,
    skills: { 56: 20, 59: 20, 65: 20 }, // 火球、冰刺、流星
    life: 800, mana: 600, stamina: 400,
    bonusLife: 0, bonusResist: 0,
    gold: 9999999,
    inventory: [], stash: [], cube: [], equipment: {}, belt: Array(16).fill(null),
    weaponSwap: false,
    quests,
    waypoints: ALL_WAYPOINTS,
    unlockedActs: 5,
    unlockedDifficulties: 3,
  };

  const record = {
    id: 'debug-' + Date.now(),
    version: 1,
    player,
    seed: 12345678,
    timestamp: Date.now(),
  };

  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
    };
  });

  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const req = tx.objectStore(STORE).put(record);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });

  db.close();
  console.log('✅ 存档注入成功，ID:', record.id, '— 刷新页面即可看到角色');
})();

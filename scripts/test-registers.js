const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3003');

const tests = [
  { name: '读取居家/离家状态 (1034)', msg: { type: 'read_register', address: 1034 } },
  { name: '读取加湿状态 (1168)', msg: { type: 'read_register', address: 1168 } },
];

let testIndex = 0;
let ready = false;

ws.on('open', () => {
  console.log('✅ 已连接 WebSocket\n');
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());

  // 忽略状态更新消息
  if (response.type === 'dependency_status') return;

  if (response.type === 'connection') {
    console.log('📡 Modbus 连接状态:', response.data.connected ? '已连接' : '未连接');
    if (response.data.connected && !ready) {
      ready = true;
      setTimeout(runNextTest, 300);
    }
    return;
  }

  if (response.type === 'read_response') {
    const value = response.values ? response.values[0] : response.value;
    console.log(`✅ 寄存器 ${response.address} = ${value}`);
    console.log('---');
    testIndex++;
    if (testIndex < tests.length) {
      setTimeout(runNextTest, 500);
    } else {
      printDone();
    }
    return;
  }

  if (response.type === 'error') {
    console.log('❌ 错误:', response.data.message);
    console.log('---');
    testIndex++;
    if (testIndex < tests.length) {
      setTimeout(runNextTest, 500);
    } else {
      printDone();
    }
    return;
  }
});

ws.on('error', (err) => {
  console.error('❌ 连接错误:', err.message);
});

function runNextTest() {
  if (testIndex >= tests.length) return;
  const test = tests[testIndex];
  console.log(`📤 ${test.name}`);
  ws.send(JSON.stringify(test.msg));
}

function printDone() {
  console.log('\n✅ 读取测试完成！');
  console.log('\n要测试写入操作，请运行:');
  console.log('  node scripts/test-write.js home       # 设置居家模式');
  console.log('  node scripts/test-write.js away       # 设置离家模式');
  console.log('  node scripts/test-write.js humid-on   # 开启加湿');
  console.log('  node scripts/test-write.js humid-off  # 关闭加湿');
  ws.close();
}

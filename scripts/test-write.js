const WebSocket = require('ws');

const command = process.argv[2];

const commands = {
  'home': { address: 1034, value: 1, desc: '设置居家模式' },
  'away': { address: 1034, value: 0, desc: '设置离家模式' },
  'humid-on': { address: 1168, value: 1, desc: '开启加湿' },
  'humid-off': { address: 1168, value: 0, desc: '关闭加湿' },
};

if (!command || !commands[command]) {
  console.log('用法: node scripts/test-write.js <command>');
  console.log('\n可用命令:');
  console.log('  home       - 设置居家模式 (寄存器 1034 = 1)');
  console.log('  away       - 设置离家模式 (寄存器 1034 = 0)');
  console.log('  humid-on   - 开启加湿 (寄存器 1168 = 1)');
  console.log('  humid-off  - 关闭加湿 (寄存器 1168 = 0)');
  process.exit(1);
}

const { address, value, desc } = commands[command];

const ws = new WebSocket('ws://localhost:3003');

ws.on('open', () => {
  console.log(`📤 ${desc} (寄存器 ${address} = ${value})`);
  ws.send(JSON.stringify({ type: 'write_register', address, value }));
});

ws.on('message', (data) => {
  const response = JSON.parse(data.toString());

  // 忽略状态更新消息
  if (response.type === 'connection') return;
  if (response.type === 'dependency_status') return;

  if (response.type === 'write_response') {
    console.log('✅ 写入成功!');
    console.log(`   寄存器: ${response.address}`);
    console.log(`   写入值: ${response.verified}`);
    ws.close();
  } else if (response.type === 'error') {
    console.log('❌ 写入失败:', response.data.message);
    ws.close();
  }
});

ws.on('error', (err) => {
  console.error('❌ 连接错误:', err.message);
});

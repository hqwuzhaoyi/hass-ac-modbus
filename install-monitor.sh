#!/bin/bash

echo "🏠 安装4房间空调监控系统..."
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js"
    exit 1
fi

echo "✅ Node.js 版本: $(node --version)"

# 进入项目目录
cd ac-monitor-nextjs

echo "📦 安装依赖..."
npm install

echo "🔧 配置完成!"
echo ""
echo "🚀 启动命令:"
echo "   node start.js"
echo ""
echo "🌐 访问地址:"
echo "   http://localhost:3002"
echo ""
echo "📊 功能特性:"
echo "   ✓ 实时寄存器监控"
echo "   ✓ 变化追踪记录"
echo "   ✓ 可视化控制界面"
echo "   ✓ 寄存器扫描功能"
echo "   ✓ 4房间空调支持"
echo ""
echo "🎉 安装完成！现在可以启动监控系统了"
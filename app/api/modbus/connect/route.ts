import { NextRequest, NextResponse } from 'next/server';
import { getModbusManager } from '@/lib/modbus-client';

export async function POST() {
  try {
    const manager = getModbusManager();
    const connected = await manager.connect();
    
    return NextResponse.json({ 
      success: connected,
      message: connected ? 'Connected successfully' : 'Connection failed'
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { getModbusManager } from '@/lib/modbus-client';

export async function POST(request: NextRequest) {
  try {
    const { address, count = 1 } = await request.json();
    
    if (!address && address !== 0) {
      return NextResponse.json(
        { error: 'Address is required' },
        { status: 400 }
      );
    }

    const manager = getModbusManager();
    const values = await manager.readRegister(parseInt(address), count);
    
    return NextResponse.json({
      success: true,
      address: parseInt(address),
      values: values,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const manager = getModbusManager();
    const registers = await manager.getAllRegisters();
    
    return NextResponse.json({
      success: true,
      registers: Array.from(registers.values()),
      count: registers.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
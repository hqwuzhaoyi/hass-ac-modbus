import { NextRequest, NextResponse } from 'next/server';
import { getModbusManager } from '@/lib/modbus-client';

export async function POST(request: NextRequest) {
  try {
    const { address, value } = await request.json();
    
    if ((!address && address !== 0) || (!value && value !== 0)) {
      return NextResponse.json(
        { error: 'Address and value are required' },
        { status: 400 }
      );
    }

    const manager = getModbusManager();
    const result = await manager.writeRegister(parseInt(address), parseInt(value));
    
    return NextResponse.json({
      success: true,
      address: parseInt(address),
      written: parseInt(value),
      verified: result.verified,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
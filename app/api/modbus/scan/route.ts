import { NextRequest, NextResponse } from 'next/server';
import { getModbusManager } from '@/lib/modbus-client';

export async function POST(request: NextRequest) {
  try {
    const { start, end } = await request.json();
    
    if ((!start && start !== 0) || (!end && end !== 0)) {
      return NextResponse.json(
        { error: 'Start and end addresses are required' },
        { status: 400 }
      );
    }

    if (parseInt(end) - parseInt(start) > 200) {
      return NextResponse.json(
        { error: 'Scan range too large (max 200 registers)' },
        { status: 400 }
      );
    }

    const manager = getModbusManager();
    const results = await manager.scanRange(parseInt(start), parseInt(end));
    
    return NextResponse.json({
      success: true,
      range: `${start}-${end}`,
      results: Object.fromEntries(results),
      count: results.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
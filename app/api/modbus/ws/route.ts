import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  return new Response('WebSocket server should be running on port 3003. Connect directly to ws://localhost:3003', { 
    status: 200,
    headers: {
      'Content-Type': 'text/plain'
    }
  });
}
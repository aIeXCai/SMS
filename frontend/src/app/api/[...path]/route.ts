import { NextRequest, NextResponse } from 'next/server';

const DJANGO_API = 'http://127.0.0.1:8000/api';

export async function GET(req: NextRequest) {
  return proxy(req);
}

export async function POST(req: NextRequest) {
  return proxy(req);
}

export async function PUT(req: NextRequest) {
  return proxy(req);
}

export async function PATCH(req: NextRequest) {
  return proxy(req);
}

export async function DELETE(req: NextRequest) {
  return proxy(req);
}

async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname.replace(/^\/api/, '');
  const url = `${DJANGO_API}${path}${req.nextUrl.search}`;

  try {
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      if (!['host', 'connection'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    });

    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.text();

    const backendRes = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    const data = await backendRes.text();
    const contentType = backendRes.headers.get('content-type') || 'application/json';

    return new NextResponse(data, {
      status: backendRes.status,
      headers: { 'content-type': contentType },
    });
  } catch {
    return NextResponse.json({ error: 'proxy_error' }, { status: 502 });
  }
}

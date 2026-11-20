import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export async function POST(request:NextRequest) {
  const origin = request.headers.get('origin');
  let sameOrigin = false;
  try { sameOrigin = !!origin && new URL(origin).host === request.headers.get('host'); } catch {}
  if (!sameOrigin) return NextResponse.json({message:'Invalid request origin.'},{status:403});
  if (Number(request.headers.get('content-length') || 0) > 8192) return NextResponse.json({message:'Request too large.'},{status:413});
  const base = process.env.API_INTERNAL_BASE_URL?.replace(/\/+$/, '');
  if (!base) return NextResponse.json({message:'Admin backend is not configured.'},{status:503});
  try {
    const text = await request.text();
    if (Buffer.byteLength(text) > 8192) return NextResponse.json({message:'Request too large.'},{status:413});
    const fields = JSON.parse(text);
    const upstream = await fetch(base + '/maintenance/login', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({email:fields.email,password:fields.password,otp:fields.otp}),
      cache:'no-store',signal:AbortSignal.timeout(15000),
    });
    const data = await upstream.json();
    if (!upstream.ok) return NextResponse.json({message:data.message || 'Admin sign-in failed.'},{status:[400,401,429].includes(upstream.status)?upstream.status:503,headers:{'Cache-Control':'no-store'}});
    if (typeof data.token !== 'string' || !data.user || !['ADMIN','OWNER','DEV'].includes(String(data.user.role).trim().toUpperCase())) throw new Error('Invalid admin response');
    const response = NextResponse.json(data,{headers:{'Cache-Control':'no-store'}});
    response.cookies.set('gb_admin_session',data.token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:3600});
    return response;
  } catch { return NextResponse.json({message:'Admin verification is temporarily unavailable. Try again shortly.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}

import { NextResponse } from 'next/server';

export function middleware(request) {
    const { pathname } = request.nextUrl;
    const userAgent = request.headers.get('user-agent') || '';

    // 🌟 سطر الحماية الذكي المطور لـ Electron والمتصفح:
    // إذا كان الطلب قادم من تطبيق إلكترون، يتخطى الفحص تماماً ليترك الواجهة الرئيسية (page.tsx) تتعامل مع الحساب
    if (
        pathname.includes('_next') || 
        pathname.includes('index.html') || 
        process.env.NEXT_PHASE === 'phase-export' ||
        userAgent.toLowerCase().includes('electron')
    ) {
        return NextResponse.next();
    }

    // 1. جلب بيانات الجلسة من الـ Cookies لموقع الويب
    const isLoggedIn = request.cookies.get('clinic_admin_logged')?.value === 'true';
    const userRole = request.cookies.get('user_role')?.value;

    // 2. حماية الموقع: إذا لم يكن مسجل دخول ويحاول دخول أي صفحة داخل النظام
    if (!isLoggedIn && pathname !== '/') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 3. 🔒 نظام حماية الأقسام بناءً على الصلاحيات لموقع الويب
    if ((pathname.startsWith('/store') || pathname.startsWith('/settings')) && userRole !== 'admin') {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (pathname.startsWith('/whatsapp') && !['admin', 'reception'].includes(userRole)) {
        return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (pathname.startsWith('/dashboard') && !['admin', 'doctor'].includes(userRole)) {
        return NextResponse.redirect(new URL('/patients', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico).*)', // مراقبة كل المسارات عدا الملفات الثابتة
    ],
};
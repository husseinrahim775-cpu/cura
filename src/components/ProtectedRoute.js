'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation'; // <-- استيراد الموجه برمجياً

export default function ProtectedRoute({ children }) {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter(); // <-- تفعيل الموجه

    useEffect(() => {
        const savedLogin = localStorage.getItem('clinic_admin_logged');
        const savedRole = localStorage.getItem('user_role');
        
        console.log("=== فحص الجلسة في الحارس المحلي ===");
        console.log("هل مسجل دخول مسبقاً؟:", savedLogin);
        console.log("الدور الحالي المخزن:", savedRole);

        if (savedLogin === 'true') {
            setIsLoggedIn(true);
            setIsLoading(false);
        } else {
            setIsLoggedIn(false);
            setIsLoading(false);
            // إذا لم يكن مسجل دخول، نوجهه فوراً لصفحة الدخول بدون الاعتماد على الميدل وير الميت!
            router.push('/'); 
        }
    }, [router]);

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#0f172a', color: 'white', fontFamily: "'Cairo', sans-serif" }}>
                <h3>جاري تحميل النظام بأمان...</h3>
            </div>
        );
    }

    // إذا كان مسجل دخول، يسمح بمرور الصفحات
    return isLoggedIn ? children : null;
}
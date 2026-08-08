'use client';
import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Dashboard from '../components/Dashboard';
import Store from '../components/Store';
import Patients from '../components/Patients';
import Whatsapp from '../components/Whatsapp';
import Settings from '../components/Settings';

import { auth, db } from '../firebase'; 
import { 
    onAuthStateChanged, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    sendEmailVerification, 
    sendPasswordResetEmail, 
    signOut, 
    User 
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'; 

const hashPasswordSecure = async (password: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + "AlRazi_Optical_Secure_2026_Salt"); 
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

export default function Home() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [currentUserRole, setCurrentUserRole] = useState('admin');
    const [currentUsername, setCurrentUsername] = useState('');
    const [accountStatus, setAccountStatus] = useState('active'); 

    const [isSignUpMode, setIsSignUpMode] = useState(false); 

    const [usernameInput, setUsernameInput] = useState('');
    const [emailInput, setEmailInput] = useState(''); 
    const [passwordInput, setPasswordInput] = useState('');
    const [loginError, setLoginError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [resetLoading, setResetLoading] = useState(false);

    const [isEmployeeVerified, setIsEmployeeVerified] = useState(false);
    const [employeesList, setEmployeesList] = useState<any[]>([]);
    const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
    const [employeePasscode, setEmployeePasscode] = useState('');
    const [employeeError, setEmployeeError] = useState('');

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
            if (user && user.emailVerified) {
                try {
                    const clinicRef = doc(db, 'users', user.uid);
                    const clinicDoc = await getDoc(clinicRef);
                    if (clinicDoc.exists()) {
                        const role = clinicDoc.data()?.role || 'admin';
                        const username = clinicDoc.data()?.username || 'الأدمن الرئيسي';
                        const status = clinicDoc.data()?.status || 'active'; 
                        
                        setAccountStatus(status); 
                        localStorage.setItem('user_id', user.uid);

                        if (status === 'pending') {
                            setCurrentUserRole('admin');
                            setCurrentUsername(username);
                            setIsEmployeeVerified(true); 
                            setIsLoggedIn(true);
                            setIsLoading(false);
                            return;
                        }

                        const savedEmployee = localStorage.getItem('current_employee_name');
                        const savedRole = localStorage.getItem('user_role');

                        if (savedEmployee && savedRole) {
                            setCurrentUsername(savedEmployee);
                            setCurrentUserRole(savedRole);
                            setIsEmployeeVerified(true);
                            if (savedRole === 'reception') {
                                setActiveTab('patients');
                            }
                        } else {
                            let emps: any[] = [];

                            try {
                                const empRef = collection(db, 'users', user.uid, 'staff');
                                const empSnap = await getDocs(empRef);
                                empSnap.forEach(doc => {
                                    emps.push({ id: doc.id, ...doc.data() });
                                });
                            } catch (e) {
                                console.log("⚠️ تم حجب صلاحية القراءة الفرعية أو لا توجد بيانات.");
                            }

                            if (emps.length === 0) {
                                try {
                                    const rootEmpRef = collection(db, 'employees');
                                    const rootEmpSnap = await getDocs(rootEmpRef);
                                    rootEmpSnap.forEach(doc => {
                                        const data = doc.data();
                                        if (data.clinicId === user.uid || data.adminUid === user.uid) {
                                            emps.push({ id: doc.id, ...data });
                                        }
                                    });
                                } catch (e) {
                                    console.log("⚠️ تم حجب صلاحية القراءة الرئيسية أو لا توجد بيانات.");
                                }
                            }

                            setEmployeesList(emps);

                            if (emps.length === 0) {
                                setCurrentUserRole('admin');
                                setCurrentUsername(username);
                                setIsEmployeeVerified(true);
                            } else {
                                setIsEmployeeVerified(false);
                            }
                        }
                    }
                    setIsLoggedIn(true);
                } catch (err) {
                    console.error("Security Error fetching user role:", err);
                    setIsLoggedIn(false);
                }
            } else {
                setIsLoggedIn(false);
                setIsEmployeeVerified(false);
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleSignUpSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoginError('');
        setSuccessMessage('');
        setIsSubmitting(true);

        const cleanUsername = usernameInput.trim().toLowerCase();
        const cleanEmail = emailInput.trim();

        try {
            const usernameRef = doc(db, 'usernames', cleanUsername);
            const usernameDoc = await getDoc(usernameRef);

            if (usernameDoc.exists()) {
                setLoginError('⚠️ اسم المستخدم هذا محجوز مسبقاً، اختر اسماً آخر!');
                setIsSubmitting(false);
                return;
            }

            const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, passwordInput);
            const user = userCredential.user;

            await setDoc(usernameRef, {
                uid: user.uid,
                email: cleanEmail
            });

            await setDoc(doc(db, 'users', user.uid), {
                username: cleanUsername,
                email: cleanEmail,
                role: 'admin',
                status: 'pending', 
                createdAt: new Date()
            });

            await sendEmailVerification(user);

            setSuccessMessage('🎉 تم إنشاء حساب العيادة بنجاح! أرسلنا رابط تأكيد إلى حساب الـ (Gmail) الخاص بك، يرجى تفعيله والانتظار للموافقة على اشتراكك.');
            setIsSignUpMode(false);
            setPasswordInput('');

        } catch (error: any) {
            if (error.code === 'auth/email-already-in-use') {
                setLoginError('⚠️ هذا الإيميل مسجل به حساب آخر بالفعل!');
            } else {
                setLoginError('حدث خطأ أثناء التسجيل: ' + error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLoginSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoginError('');
        setSuccessMessage('');
        setIsSubmitting(true);
        
        setIsEmployeeVerified(false);
        localStorage.removeItem('current_employee_name');

        const cleanUsername = usernameInput.trim().toLowerCase();

        try {
            const usernameRef = doc(db, 'usernames', cleanUsername);
            const usernameDoc = await getDoc(usernameRef);

            if (!usernameDoc.exists()) {
                setLoginError('❌ اسم المستخدم هذا غير مسجل في النظام!');
                setIsSubmitting(false);
                return;
            }

            const realEmail = usernameDoc.data()?.email;

            const userCredential = await signInWithEmailAndPassword(auth, realEmail, passwordInput);
            const user = userCredential.user;

            if (!user.emailVerified) {
                setLoginError('🔒 حسابك غير مؤكد! يرجى الذهاب لبريدك الإلكتروني (الجيميل) والضغط على رابط التفعيل أولاً للتمكن من الدخول.');
                await signOut(auth); 
                setIsSubmitting(false);
                return;
            }

            const clinicRef = doc(db, 'users', user.uid);
            const clinicDoc = await getDoc(clinicRef);
            
            const status = clinicDoc.exists() ? clinicDoc.data()?.status || 'active' : 'active';
            const username = clinicDoc.exists() ? clinicDoc.data()?.username || 'الأدمن' : 'الأدمن';
            setAccountStatus(status); 

            localStorage.setItem('clinic_admin_logged', 'true');
            localStorage.setItem('user_id', user.uid);
            localStorage.setItem('clinic_main_username', cleanUsername);

            if (typeof document !== 'undefined') {
                document.cookie = "clinic_admin_logged=true; path=/; max-age=86400; SameSite=Strict";
                document.cookie = `user_id=${user.uid}; path=/; max-age=86400; SameSite=Strict`;
            }

            setIsLoggedIn(true);

        } catch (error: any) {
            if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
                setLoginError('⚠️ رمز المرور أو اسم المستخدم غير صحيح!');
            } else {
                setLoginError('حدث خطأ أثناء تسجيل الدخول: ' + error.message);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEmployeeVerifySubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setEmployeeError('');
        setIsSubmitting(true);

        const selectedEmp = employeesList.find(emp => emp.id === selectedEmployeeId);
        if (!selectedEmp) {
            setEmployeeError('❌ الرجاء اختيار موظف من القائمة أولاً!');
            setIsSubmitting(false);
            return;
        }

        const dbPassword = selectedEmp.password || selectedEmp.pin || selectedEmp.passcode;
        const hashedInputPasscode = await hashPasswordSecure(employeePasscode.trim());

        if (dbPassword && dbPassword.toString() === hashedInputPasscode) {
            const empRole = selectedEmp.role || 'reception';
            const empName = selectedEmp.name || selectedEmp.username || 'موظف عيادة';

            setCurrentUserRole(empRole);
            setCurrentUsername(empName);

            localStorage.setItem('current_employee_name', empName);
            localStorage.setItem('user_username', empName);
            localStorage.setItem('user_role', empRole);

            if (empRole === 'reception') {
                setActiveTab('patients');
            } else {
                setActiveTab('dashboard');
            }

            setIsEmployeeVerified(true);
        } else {
            setEmployeeError('⚠️ الرمز السري لهذا الموظف غير صحيح، حاول مجدداً!');
        }
        setIsSubmitting(false);
    };

    const handleForgotPassword = async () => {
        const cleanUsername = usernameInput.trim().toLowerCase();

        if (!cleanUsername) {
            setLoginError('⚠️ يرجى كتابة اسم المستخدم أولاً في الحقل أعلاه.');
            return;
        }

        try {
            setLoginError('');
            setSuccessMessage('');
            setResetLoading(true);

            const usernameRef = doc(db, 'usernames', cleanUsername);
            const usernameDoc = await getDoc(usernameRef);

            if (!usernameDoc.exists()) {
                setLoginError('❌ اسم المستخدم هذا غير موجود في النظام.');
                return;
            }

            const realEmail = usernameDoc.data()?.email;
            await sendPasswordResetEmail(auth, realEmail);

            setSuccessMessage(`🎉 تم إرسال رابط إعادة تعيين كلمة المرور إلى البريد (${realEmail}) بنجاح.`);
            
        } catch (error: any) {
            setLoginError('حدث خطأ: ' + error.message);
        } finally {
            setResetLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#F8FAFC', color: '#0F172A', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <style>{`
                    @keyframes medicalPulse {
                        0% { transform: scale(0.95); opacity: 0.6; box-shadow: 0 0 10px rgba(2, 132, 199, 0.3); }
                        50% { transform: scale(1.05); opacity: 1; box-shadow: 0 0 25px rgba(2, 132, 199, 0.5); }
                        100% { transform: scale(0.95); opacity: 0.6; box-shadow: 0 0 10px rgba(2, 132, 199, 0.3); }
                    }
                    @keyframes spinFast {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `}</style>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{
                            position: 'absolute',
                            width: '100%',
                            height: '100%',
                            borderRadius: '50%',
                            border: '3px solid #E2E8F0',
                            borderTopColor: '#0284C7',
                            borderRightColor: '#0284C7',
                            animation: 'spinFast 0.8s linear infinite'
                        }}></div>
                        <div style={{
                            width: '20px',
                            height: '20px',
                            backgroundColor: '#0284C7',
                            borderRadius: '50%',
                            animation: 'medicalPulse 1.2s ease-in-out infinite'
                        }}></div>
                    </div>
                    <h3 style={{ color: '#334155', fontSize: '14px', letterSpacing: '0.5px', fontWeight: '600' }}>جاري التحقق وتجهيز البيانات...</h3>
                </div>
            </div>
        );
    }

    if (!isLoggedIn) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh', 
                backgroundColor: '#F8FAFC', 
                backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(2, 132, 199, 0.08) 0%, transparent 60%)',
                fontFamily: 'system-ui, -apple-system, sans-serif', 
                direction: 'rtl', 
                padding: '20px' 
            }}>
                <style>{`
                    @keyframes spinFast {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes pulseDot {
                        0%, 100% { opacity: 0.3; transform: scale(0.8); }
                        50% { opacity: 1; transform: scale(1.2); }
                    }
                `}</style>
                <div style={{ 
                    background: '#FFFFFF', 
                    padding: '40px 32px', 
                    borderRadius: '24px', 
                    boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.07), 0 0 0 1px #E2E8F0', 
                    width: '100%', 
                    maxWidth: '430px', 
                    border: '1px solid #E2E8F0', 
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #0284C7, transparent)' }}></div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)', marginBottom: '20px' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0284C7', background: 'rgba(2, 132, 199, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(2, 132, 199, 0.18)' }}>
                            CURA SYSTEM GATEWAY
                        </span>
                    </div>

                    <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: '700', margin: '8px 0 6px 0', letterSpacing: '-0.3px' }}>
                        {isSignUpMode ? 'تسجيل عيادة جديدة' : 'نظام إدارة العيادة الذكي'}
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 28px 0', lineHeight: '1.5' }}>
                        {isSignUpMode ? 'أدخل معلوماتك بدقة لتفعيل السستم على سيرفراتنا السحابية' : 'الرجاء تسجيل الدخول لفتح كامل صلاحيات السستم'}
                    </p>

                    {successMessage && <p style={{ color: '#059669', fontSize: '13px', background: 'rgba(16, 185, 129, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)', margin: '0 0 20px 0', textAlign: 'right' }}>{successMessage}</p>}
                    {loginError && <p style={{ color: '#DC2626', fontSize: '13px', background: 'rgba(239, 68, 68, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', margin: '0 0 20px 0', textAlign: 'right' }}>⚠️ {loginError}</p>}

                    <form onSubmit={isSignUpMode ? handleSignUpSubmit : handleLoginSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'right' }}>
                        <div>
                            <label style={{ color: '#334155', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                                اسم المستخدم (Username)
                            </label>
                            <input 
                                type="text" 
                                value={usernameInput} 
                                onChange={(e) => setUsernameInput(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                                placeholder="cura_clinic" 
                                style={{ 
                                    width: '100%', 
                                    padding: '13px 16px', 
                                    borderRadius: '12px', 
                                    border: '1px solid #CBD5E1', 
                                    background: '#F8FAFC', 
                                    color: '#0F172A', 
                                    fontSize: '14px',
                                    outline: 'none',
                                    opacity: isSubmitting ? 0.6 : 1,
                                    boxSizing: 'border-box'
                                }} 
                            />
                        </div>

                        {isSignUpMode && (
                            <div>
                                <label style={{ color: '#334155', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                                    البريد الإلكتروني (Gmail)
                                </label>
                                <input 
                                    type="email" 
                                    value={emailInput} 
                                    onChange={(e) => setEmailInput(e.target.value)} 
                                    required 
                                    disabled={isSubmitting}
                                    placeholder="doctor@gmail.com" 
                                    style={{ 
                                        width: '100%', 
                                        padding: '13px 16px', 
                                        borderRadius: '12px', 
                                        border: '1px solid #CBD5E1', 
                                        background: '#F8FAFC', 
                                        color: '#0F172A', 
                                        fontSize: '14px',
                                        outline: 'none',
                                        opacity: isSubmitting ? 0.6 : 1,
                                        boxSizing: 'border-box'
                                    }} 
                                />
                            </div>
                        )}

                        <div>
                            <label style={{ color: '#334155', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                                كلمة المرور
                            </label>
                            <input 
                                type="password" 
                                value={passwordInput} 
                                onChange={(e) => setPasswordInput(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                                placeholder="••••••••"
                                style={{ 
                                    width: '100%', 
                                    padding: '13px 16px', 
                                    borderRadius: '12px', 
                                    border: '1px solid #CBD5E1', 
                                    background: '#F8FAFC', 
                                    color: '#0F172A', 
                                    fontSize: '14px',
                                    outline: 'none',
                                    opacity: isSubmitting ? 0.6 : 1,
                                    boxSizing: 'border-box'
                                }} 
                            />
                        </div>

                        {!isSignUpMode && (
                            <div style={{ textAlign: 'left', marginTop: '-4px' }}>
                                <span 
                                    onClick={handleForgotPassword} 
                                    style={{ color: '#0284C7', cursor: resetLoading ? 'not-allowed' : 'pointer', fontSize: '12px', fontWeight: '600' }}
                                >
                                    {resetLoading ? 'جاري التحقق...' : 'نسيت كلمة المرور؟'}
                                </span>
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            style={{ 
                                width: '100%', 
                                padding: '14px', 
                                borderRadius: '12px', 
                                border: 'none', 
                                background: isSignUpMode ? '#059669' : 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', 
                                color: '#ffffff', 
                                fontWeight: '700', 
                                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                marginTop: '6px', 
                                fontSize: '14px',
                                boxShadow: isSignUpMode ? '0 8px 20px rgba(5, 150, 105, 0.2)' : '0 8px 20px rgba(2, 132, 199, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                opacity: isSubmitting ? 0.85 : 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {isSubmitting ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ position: 'relative', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{
                                            position: 'absolute',
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            border: '2.5px solid transparent',
                                            borderTopColor: '#ffffff',
                                            borderRightColor: '#ffffff',
                                            animation: 'spinFast 0.6s linear infinite'
                                        }}></div>
                                        <div style={{
                                            width: '6px',
                                            height: '6px',
                                            backgroundColor: '#ffffff',
                                            borderRadius: '50%',
                                            animation: 'pulseDot 1s ease-in-out infinite'
                                        }}></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span>{isSignUpMode ? 'إنشاء حساب العيادة' : 'دخول النظام'}</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
                        <p style={{ color: '#64748B', fontSize: '13px', margin: 0 }}>
                            {isSignUpMode ? 'لديك حساب عيادة مسبقاً؟ ' : 'طبيب جديد وتريد تفعيل النظام؟ '}
                            <button 
                                type="button"
                                onClick={() => { setIsSignUpMode(!isSignUpMode); setLoginError(''); setSuccessMessage(''); }} 
                                style={{ background: 'none', border: 'none', color: '#0284C7', fontWeight: '700', cursor: 'pointer', marginRight: '4px', textDecoration: 'underline' }}
                            >
                                {isSignUpMode ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
                            </button>
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (accountStatus === 'pending') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#F8FAFC', fontFamily: 'system-ui, -apple-system, sans-serif', direction: 'rtl', padding: '20px' }}>
                <div style={{ background: '#FFFFFF', padding: '40px', borderRadius: '24px', boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.08)', width: '100%', maxWidth: '480px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                    <span style={{ fontSize: '50px' }}>⏳</span>
                    <h2 style={{ color: '#0F172A', fontSize: '22px', fontWeight: '700', marginTop: '15px', marginBottom: '10px' }}>الحساب قيد المراجعة والتدقيق</h2>
                    <p style={{ color: '#64748B', fontSize: '14px', lineHeight: '1.6', marginBottom: '25px' }}>
                        أهلاً بك في نظام <strong style={{ color: '#0284C7' }}>CURA</strong>. تم استلام طلب العيادة الخاص بك بنجاح، يرجى التواصل مع إدارة النظام لتفعيل باقة الاشتراك السنوية وفتح السيرفر المباشر لك.
                    </p>
                    
                    <a 
                        href={`https://wa.me/9647838338499?text=مرحبا، قمت بإنشاء حساب عيادة جديد باسم المستخدم: (@${localStorage.getItem('clinic_main_username') || 'clinic_user'}) وأود تفعيل السستم.`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ display: 'block', width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: '#25D366', color: 'white', fontWeight: 'bold', textDecoration: 'none', fontSize: '14px', boxShadow: '0 4px 12px rgba(37, 211, 102, 0.25)' }}
                    >
                        💬 تفعيل الحساب عبر الواتساب
                    </a>
                    
                    <button 
                        onClick={() => signOut(auth)} 
                        style={{ background: 'none', border: 'none', color: '#DC2626', marginTop: '20px', cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', fontWeight: '600' }}
                    >
                        تسجيل الخروج والعودة
                    </button>
                </div>
            </div>
        );
    }

    if (!isEmployeeVerified) {
        return (
            <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                minHeight: '100vh', 
                backgroundColor: '#F8FAFC', 
                backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(2, 132, 199, 0.08) 0%, transparent 60%)',
                fontFamily: 'system-ui, -apple-system, sans-serif', 
                direction: 'rtl', 
                padding: '20px' 
            }}>
                <style>{`
                    @keyframes spinFast {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                    @keyframes pulseDot {
                        0%, 100% { opacity: 0.3; transform: scale(0.8); }
                        50% { opacity: 1; transform: scale(1.2); }
                    }
                `}</style>
                <div style={{ 
                    background: '#FFFFFF', 
                    padding: '40px 32px', 
                    borderRadius: '24px', 
                    boxShadow: '0 20px 40px -15px rgba(15, 23, 42, 0.07), 0 0 0 1px #E2E8F0', 
                    width: '100%', 
                    maxWidth: '430px', 
                    border: '1px solid #E2E8F0', 
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, transparent, #0284C7, transparent)' }}></div>

                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(2, 132, 199, 0.08)', border: '1px solid rgba(2, 132, 199, 0.2)', marginBottom: '20px' }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px', textTransform: 'uppercase', color: '#0284C7', background: 'rgba(2, 132, 199, 0.08)', padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(2, 132, 199, 0.18)' }}>
                            CURA AUTHENTICATION
                        </span>
                    </div>

                    <h2 style={{ color: '#0F172A', fontSize: '20px', fontWeight: '700', margin: '8px 0 6px 0', letterSpacing: '-0.3px' }}>
                        التحقق من هوية المستخدم
                    </h2>
                    <p style={{ color: '#64748B', fontSize: '13px', margin: '0 0 28px 0', lineHeight: '1.5' }}>
                        يرجى اختيار حسابك الوظيفي وإدخال رمز الوصول للبدء بالجلسة
                    </p>
                    
                    {employeeError && (
                        <div style={{ color: '#DC2626', fontSize: '13px', background: 'rgba(239, 68, 68, 0.08)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)', margin: '0 0 20px 0', textAlign: 'right', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span>⚠️</span>
                            <span>{employeeError}</span>
                        </div>
                    )}
                    
                    <form onSubmit={handleEmployeeVerifySubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'right' }}>
                        <div>
                            <label style={{ color: '#334155', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                                الحساب الوظيفي
                            </label>
                            <div style={{ position: 'relative' }}>
                                <select 
                                    value={selectedEmployeeId} 
                                    onChange={(e) => setSelectedEmployeeId(e.target.value)} 
                                    required 
                                    disabled={isSubmitting}
                                    style={{ 
                                        width: '100%', 
                                        padding: '13px 16px', 
                                        borderRadius: '12px', 
                                        border: '1px solid #CBD5E1', 
                                        background: '#F8FAFC', 
                                        color: '#0F172A', 
                                        cursor: 'pointer', 
                                        fontSize: '14px',
                                        outline: 'none',
                                        appearance: 'none',
                                        WebkitAppearance: 'none',
                                        opacity: isSubmitting ? 0.6 : 1,
                                        boxSizing: 'border-box'
                                    }}
                                >
                                    <option value="" disabled style={{ background: '#FFFFFF', color: '#94A3B8' }}>-- حدد مستخدم من القائمة --</option>
                                    {employeesList.map((emp) => (
                                        <option key={emp.id} value={emp.id} style={{ background: '#FFFFFF', color: '#0F172A' }}>
                                            {emp.name || emp.username} ({emp.role === 'admin' ? 'مدير النظام' : emp.role === 'doctor' ? 'طبيب ممارس' : 'موظف استقبال'})
                                        </option>
                                    ))}
                                </select>
                                <span style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748B', fontSize: '11px' }}>▼</span>
                            </div>
                        </div>

                        <div>
                            <label style={{ color: '#334155', fontSize: '12px', fontWeight: '600', display: 'block', marginBottom: '8px' }}>
                                رمز المرور الشخصي (PIN)
                            </label>
                            <input 
                                type="password" 
                                value={employeePasscode} 
                                onChange={(e) => setEmployeePasscode(e.target.value)} 
                                required 
                                disabled={isSubmitting}
                                placeholder="••••••••" 
                                style={{ 
                                    width: '100%', 
                                    padding: '13px 16px', 
                                    borderRadius: '12px', 
                                    border: '1px solid #CBD5E1', 
                                    background: '#F8FAFC', 
                                    color: '#0F172A',
                                    fontSize: '14px',
                                    outline: 'none',
                                    letterSpacing: '2px',
                                    opacity: isSubmitting ? 0.6 : 1,
                                    boxSizing: 'border-box'
                                }} 
                            />
                        </div>
                        
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            style={{ 
                                width: '100%', 
                                padding: '14px', 
                                borderRadius: '12px', 
                                border: 'none', 
                                background: 'linear-gradient(135deg, #0284C7 0%, #0369A1 100%)', 
                                color: '#ffffff', 
                                fontWeight: '700', 
                                cursor: isSubmitting ? 'not-allowed' : 'pointer', 
                                marginTop: '6px', 
                                fontSize: '14px',
                                boxShadow: '0 8px 20px rgba(2, 132, 199, 0.25)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '10px',
                                opacity: isSubmitting ? 0.85 : 1,
                                transition: 'all 0.3s ease'
                            }}
                        >
                            {isSubmitting ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div style={{ position: 'relative', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <div style={{
                                            position: 'absolute',
                                            width: '100%',
                                            height: '100%',
                                            borderRadius: '50%',
                                            border: '2.5px solid transparent',
                                            borderTopColor: '#ffffff',
                                            borderRightColor: '#ffffff',
                                            animation: 'spinFast 0.6s linear infinite'
                                        }}></div>
                                        <div style={{
                                            width: '6px',
                                            height: '6px',
                                            backgroundColor: '#ffffff',
                                            borderRadius: '50%',
                                            animation: 'pulseDot 1s ease-in-out infinite'
                                        }}></div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <span>تسجيل الدخول للنظام</span>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path></svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div style={{ marginTop: '24px', borderTop: '1px solid #E2E8F0', paddingTop: '18px' }}>
                        <button 
                            onClick={() => {
                                signOut(auth);
                                setIsEmployeeVerified(false);
                                localStorage.removeItem('current_employee_name');
                            }} 
                            style={{ 
                                background: 'none', 
                                border: 'none', 
                                color: '#64748B', 
                                fontWeight: '500', 
                                cursor: 'pointer', 
                                fontSize: '12px'
                            }}
                        >
                            الخروج من العيادة والعودة لشاشة الدخول الرئيسية
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F8FAFC', direction: 'rtl' }}>            
            <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={currentUserRole} username={currentUsername} />
            
            <div style={{ flexGrow: 1, height: '100vh', overflowY: 'scroll', scrollbarWidth: 'none', msOverflowStyle: 'none' }} className="no-scrollbar">
                {activeTab === 'dashboard' && (currentUserRole === 'admin' || currentUserRole === 'doctor') && <Dashboard />}
                {activeTab === 'store' && currentUserRole === 'admin' && <Store />}
                {activeTab === 'patients' && <Patients />}
                {activeTab === 'whatsapp' && (currentUserRole === 'admin' || currentUserRole === 'reception') && <Whatsapp />}
                {activeTab === 'settings' && currentUserRole === 'admin' && <Settings />}
            </div>
        </div>
    );
}
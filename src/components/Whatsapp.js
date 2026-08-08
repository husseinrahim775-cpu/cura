'use client';
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/firebase'; // 🌟 استيراد auth الموثق بسيرفر النظام
import { 
    collection, 
    getDocs, 
    query, 
    orderBy, 
    doc, 
    updateDoc, 
    increment,
    where // 🌟 استيراد شرط الفلترة للتأمين
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth'; // 🌟 لمراقبة جلسة المستخدم النشط

// المكون الحركي للعدادات الرقمية الفاخرة
function AnimatedNumber({ value, suffix = '', duration = 600 }) {
    const [display, setDisplay] = useState(Number(value) || 0);
    const prevValueRef = useRef(Number(value) || 0);

    useEffect(() => {
        const start = prevValueRef.current;
        const end = Number(value) || 0;
        if (start === end) { setDisplay(end); return; }

        const startTime = performance.now();
        let frameId;
        const step = (now) => {
            const progress = Math.min((now - startTime) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // خروج سلس
            const current = start + (end - start) * eased;
            setDisplay(current);
            if (progress < 1) {
                frameId = requestAnimationFrame(step);
            } else {
                setDisplay(end);
                prevValueRef.current = end;
            }
        };
        frameId = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frameId);
    }, [value, duration]);

    return <span>{Math.round(display).toLocaleString()}{suffix}</span>;
}

export default function Whatsapp() {
    // 🌟 حالة لتخزين معرف المستخدم الحالي لمنع تداخل الحسابات والعيادات
    const [currentUserId, setCurrentUserId] = useState(null);

    // states إدارة البيانات والمرضى
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); 
    const [recordsLimit, setRecordsLimit] = useState(50);
    
    // إحصائيات الجلسة والعدادات
    const [sentCounter, setSentCounter] = useState(0);
    const [failedCounter, setFailedCounter] = useState(0);
    const [isConnected, setIsConnected] = useState(true);

    // ربط الـ API والإعدادات الافتراضية
    const [instanceId, setInstanceId] = useState('instance99999');
    const [apiToken, setApiToken] = useState('your_api_key_here');
    const [showSettingsModal, setShowSettingsModal] = useState(false);

    // قوالب الرسائل الجاهزة والتخصيص
    const [activeTemplate, setActiveTemplate] = useState('visit_reminder');
    const [templates, setTemplates] = useState({
        visit_reminder: 'مرحباً السيد/ة {{الأسم}}، نود تذكيرك بموعد مراجعة والفحص القادم في{اسم العيادة الخاص بكم }  بتاريخ {{التاريخ}} بانتظار تشريفك لنا.',
        glasses_ready: 'يسعدنا إعلامك السيد/ة {{الأسم}} بأن{ نوع المنتج او الفحص } قد تم تجهيزها وفحص جودتها بنجاح بالكامل وهي جاهزة للاستلام الآن.',
        follow_up: 'السلام عليكم السيد/ة {{الأسم}}، نرجو أن تكون{ نوع المنتج او العلاج }، يسعدنا دائماً الاطمئنان على سلامتكم ومتابعة ارتياح نظركم.',
        custom_msg: 'مرحباً {{الأسم}}، نود إعلامكم بوجود تحديثات جديدة بخصوص حالتك الطبية في العيادة.'
    });

    // جلب الإعدادات والثيم والبيانات عند الإقلاع الأول مع فلترة الجلسة الأمنية
    useEffect(() => {
        // التحقق ومراقبة جلسة المستخدم الحالي
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.href = '/login';
            } else {
                setCurrentUserId(user.uid);
                fetchPatients(user.uid); // جلب المرضى مباشرة بواسطة الـ ID الفرعي له
            }
        });

        if (typeof window !== 'undefined') {
            const savedInstance = localStorage.getItem('wa_instance');
            const savedToken = localStorage.getItem('wa_token');
            if (savedInstance) setInstanceId(savedInstance);
            if (savedToken) setApiToken(savedToken);
        }
        
        checkApiStatus();

        return () => unsubscribe();
    }, []);

    const checkApiStatus = async () => {
        if (!instanceId || apiToken === 'your_api_key_here') {
            setIsConnected(false);
            return;
        }
        try {
            const res = await fetch(`https://api.ultramsg.com/${instanceId}/instance/status?token=${apiToken}`);
            const data = await res.json();
            if (data && data.status === 'qrcode') {
                setIsConnected(false);
            } else {
                setIsConnected(true);
            }
        } catch (e) {
            setIsConnected(false);
        }
    };

   // 🌟 دالة جلب المرضى معدلة لتقرأ من المسار الفرعي المعزول والمحمي الخاص بكل مستخدم
const fetchPatients = async (userId) => {
    const activeUserId = userId || currentUserId;
    if (!activeUserId) return;

    setLoading(true);
    try {
        // ✅ التعديل السحري: الدخول مباشرة لمسار العيادة داخل كولكشن users الموحد
        const patientsRef = collection(db, 'users', activeUserId, 'patients');
        
        // الترتيب التنازلي حسب تاريخ الإنشاء (تم حذف الـ where لأن الداتا معزولة تلقائياً)
        const q = query(
            patientsRef,
            orderBy('createdAt', 'desc')
        );
        
        const querySnapshot = await getDocs(q);
        const list = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPatients(list);
    } catch (error) {
        console.error("Error fetching patients: ", error);
    } finally {
        setLoading(false);
    }
};

    const generateMessage = (patient, templateKey) => {
        let text = templates[templateKey] || '';
        const latestVisitDate = patient.visits && patient.visits.length > 0 ? patient.visits[0].date : patient.date || 'غير محدد';
        text = text.replace(/{{الأسم}}/g, patient.name || '');
        text = text.replace(/{{التاريخ}}/g, latestVisitDate);
        return text;
    };

    const handleSendWhatsApp = async (patient, templateKey) => {
        const rawPhone = patient.phone || '';
        let cleanPhone = rawPhone.replace(/\D/g, '');
        
        if (cleanPhone.startsWith('07')) {
            cleanPhone = '964' + cleanPhone.substring(1);
        } else if (cleanPhone.startsWith('7')) {
            cleanPhone = '964' + cleanPhone;
        }

        const messageText = generateMessage(patient, templateKey);

        if (apiToken === 'your_api_key_here' || !apiToken) {
            const encodedText = encodeURIComponent(messageText);
            const waUrl = `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
            window.open(waUrl, '_blank');
            setSentCounter(prev => prev + 1);
            return;
        }

        try {
            const response = await fetch(`https://api.ultramsg.com/${instanceId}/messages/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({
                    token: apiToken,
                    to: `+${cleanPhone}`,
                    body: messageText
                })
            });

            const data = await response.json();
            if (data.sent === "true" || response.ok) {
                setSentCounter(prev => prev + 1);
                const patientRef = doc(db, 'patients', patient.id);
                await updateDoc(patientRef, {
                    lastReminderSent: new Date().toISOString(),
                    remindersCount: increment(1)
                });
                
                // تحديث الـ state محلياً حتى تظهر البيانات بدون إعادة تحميل الصفحة بالكامل
                setPatients(prev => prev.map(p => p.id === patient.id ? { ...p, remindersCount: (p.remindersCount || 0) + 1 } : p));

            } else {
                setFailedCounter(prev => prev + 1);
                alert(`❌ فشل إرسال الرسالة الآلية: ${data.message || 'يرجى التحقق من الاشتراك'}`);
            }
        } catch (error) {
            setFailedCounter(prev => prev + 1);
            alert("❌ خطأ بالاتصال: تأكد من اتصالات الشبكة وبوابة فائقة الإرسال.");
        }
    };

    const saveApiSettings = () => {
        localStorage.setItem('wa_instance', instanceId);
        localStorage.setItem('wa_token', apiToken);
        setShowSettingsModal(false);
        checkApiStatus();
        alert('✅ تم حفظ إعدادات الربط للواتساب بنجاح.');
    };

    const filteredPatients = patients.filter(p => {
        const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || p.phone?.includes(searchQuery);
        if (statusFilter === 'all') return matchesSearch;
        if (statusFilter === 'reminded') return matchesSearch && p.remindersCount > 0;
        if (statusFilter === 'not_reminded') return matchesSearch && (!p.remindersCount || p.remindersCount === 0);
        return matchesSearch;
    }).slice(0, recordsLimit);

    return (
        <div className="whatsapp-page-wrapper" style={{ 
            padding: '4vw 3vw', 
            backgroundColor: '#F8FAFC', 
            backgroundImage: 'radial-gradient(circle at 15% 15%, rgba(14, 165, 233, 0.05) 0%, transparent 40%), radial-gradient(circle at 85% 75%, rgba(37, 99, 235, 0.04) 0%, transparent 50%), radial-gradient(circle at 50% 50%, #F8FAFC 0%, #F1F5F9 100%)',
            backgroundAttachment: 'fixed',
            fontFamily: "'Exo 2', 'Cairo', sans-serif", 
            direction: 'rtl', 
            minHeight: '100vh', 
            color: '#0F172A', 
            boxSizing: 'border-box', 
            width: '100%', 
            maxWidth: '100vw', 
            overflowX: 'hidden' 
        }}>
            
            <style>{`
                .modern-card {
                    background: #FFFFFF !important;
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid #E2E8F0 !important;
                    border-radius: 24px !important;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.02);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .modern-card:hover {
                    transform: translateY(-4px);
                    border-color: #CBD5E1 !important;
                    background: #FFFFFF !important;
                    box-shadow: 0 20px 35px rgba(14, 165, 233, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03);
                }
                .responsive-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 35px;
                    background: #FFFFFF;
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    padding: 20px 30px;
                    border-radius: 24px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
                    border: 1px solid #E2E8F0;
                }
                .responsive-grid-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                    gap: 25px;
                    margin-bottom: 35px;
                }
                .stat-card-title {
                    font-size: 13px;
                }
                .stat-card-number {
                    font-size: clamp(24px, 2.5vw, 28px);
                }
                .stat-card-unit {
                    font-size: 13px;
                }
                .table-scroll-container {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .custom-select-dark {
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    padding: 10px 14px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #0F172A;
                    cursor: pointer;
                    outline: none;
                    border-radius: 12px;
                    width: 100%;
                    transition: all 0.2s ease;
                }
                .custom-select-dark:focus {
                    border-color: #0284C7;
                    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
                }
                .custom-select-dark option {
                    background-color: #FFFFFF;
                    color: #0F172A;
                }
                .custom-input-dark {
                    width: 100%;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border: 1px solid #CBD5E1;
                    background: #FFFFFF;
                    color: #0F172A;
                    font-size: 13px;
                    outline: none;
                    transition: all 0.2s ease;
                }
                .custom-input-dark:focus {
                    border-color: #0284C7;
                    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
                }
                .custom-input-dark::placeholder {
                    color: #94A3B8;
                }
                @media (max-width: 991px) {
                    .responsive-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 20px;
                        padding: 20px;
                    }
                    .header-controls-wrapper {
                        width: 100%;
                        flex-wrap: wrap;
                        justify-content: space-between;
                    }
                }
                @media (max-width: 768px) {
                    .whatsapp-page-wrapper {
                        padding: 12px 10px !important;
                    }
                    .responsive-header {
                        padding: 14px !important;
                        margin-bottom: 16px !important;
                        border-radius: 16px !important;
                        gap: 12px !important;
                    }
                    .responsive-header h1 {
                        font-size: 17px !important;
                    }
                    .responsive-header p {
                        font-size: 11px !important;
                    }
                    .header-controls-wrapper {
                        gap: 8px !important;
                    }
                    .header-controls-wrapper button, 
                    .header-controls-wrapper div {
                        padding: 8px 12px !important;
                        font-size: 11px !important;
                        border-radius: 12px !important;
                    }
                    .responsive-grid-cards {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 10px !important;
                        margin-bottom: 16px !important;
                    }
                    .responsive-grid-cards .modern-card {
                        padding: 12px 10px !important;
                        border-radius: 16px !important;
                    }
                    .stat-card-title {
                        font-size: 10px !important;
                    }
                    .stat-card-number {
                        font-size: 18px !important;
                        margin: 6px 0 !important;
                    }
                    .stat-card-unit {
                        font-size: 10px !important;
                    }
                    .modern-card {
                        padding: 14px !important;
                        margin-bottom: 16px !important;
                        border-radius: 16px !important;
                    }
                    .modern-card h3 {
                        font-size: 14px !important;
                    }
                    .modern-card p {
                        font-size: 11px !important;
                        margin-bottom: 12px !important;
                    }
                    .template-btn {
                        padding: 8px 12px !important;
                        font-size: 11px !important;
                        border-radius: 10px !important;
                    }
                    .template-textarea {
                        font-size: 12px !important;
                        padding: 10px !important;
                    }
                    .filter-bar {
                        padding: 12px !important;
                        gap: 8px !important;
                    }
                }
                @media (max-width: 380px) {
                    .responsive-grid-cards {
                        grid-template-columns: 1fr !important;
                    }
                    .header-controls-wrapper {
                        flex-direction: column;
                        align-items: stretch;
                        width: 100%;
                    }
                }
            `}</style>

            {/* الهيدر العلوي ونظام الربط الحركي */}
            <div className="responsive-header">
                <div>
                    <h1 style={{ fontSize: 'clamp(22px, 2.5vw, 26px)', fontWeight: '700', color: '#0F172A', margin: 0, letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                        </svg>
                        نظام الرسائل وحملات الواتساب الذكية
                    </h1>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', fontWeight: '500' }}>
                        إرسال التذكيرات ومتابعة تجهيز النظارات الطبية والفحوصات الدورية للمرضى.
                    </p>
                </div>

                <div className="header-controls-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <button 
                        onClick={() => setShowSettingsModal(true)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', color: '#334155', padding: '12px 20px', borderRadius: '16px', border: '1px solid #CBD5E1', cursor: 'pointer', fontSize: '13px', fontWeight: '600', transition: 'all 0.2s ease' }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="3"/>
                            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                        </svg>
                        إعدادات البوابة API
                    </button>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: isConnected ? '#F0FDF4' : '#FEF2F2', color: isConnected ? '#15803D' : '#991B1B', padding: '12px 20px', borderRadius: '16px', border: `1px solid ${isConnected ? '#BBF7D0' : '#FECACA'}`, fontSize: '13px', fontWeight: '600' }}>
                        <span style={{ width: '9px', height: '9px', borderRadius: '50%', backgroundColor: isConnected ? '#16A34A' : '#DC2626', display: 'inline-block', boxShadow: isConnected ? '0 0 8px rgba(22, 163, 74, 0.4)' : '0 0 8px rgba(220, 38, 38, 0.4)' }}></span>
                        <span>{isConnected ? 'البوابة متصلة وجاهزة' : 'الوضع اليدوي (طلب ربط)'}</span>
                    </div>
                </div>
            </div>

            {/* صف كروت الإحصائيات الفاخرة الموازية للداشبورد */}
            <div className="responsive-grid-cards">
                
                {/* 1. إجمالي المسجلين بالسستم */}
                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#6366F1' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
                        <div>
                            <p className="stat-card-title" style={{ color: '#64748B', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                                    <circle cx="9" cy="7" r="4"/>
                                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                                </svg>
                                مراجعين مسجلين بالسستم
                            </p>
                            <h2 className="stat-card-number" style={{ fontWeight: '700', color: '#4F46E5', margin: '12px 0' }}>
                                <AnimatedNumber value={patients.length} /> <span className="stat-card-unit" style={{ fontWeight: '500', color: '#64748B' }}>مريض</span>
                            </h2>
                        </div>
                    </div>
                </div>

                {/* 2. تم إرسالها بنجاح */}
                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10B981' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
                        <div>
                            <p className="stat-card-title" style={{ color: '#64748B', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M22 2L11 13"/>
                                    <path d="M22 2l-7 20-4-9-9-4 20-7z"/>
                                </svg>
                                تم إرسالها بنجاح
                            </p>
                            <h2 className="stat-card-number" style={{ fontWeight: '700', color: '#059669', margin: '12px 0' }}>
                                <AnimatedNumber value={sentCounter} /> <span className="stat-card-unit" style={{ fontWeight: '500', color: '#64748B' }}>رسالة</span>
                            </h2>
                        </div>
                    </div>
                </div>

                {/* 3. محاولات معلقة / يدوية */}
                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#EF4444' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
                        <div>
                            <p className="stat-card-title" style={{ color: '#64748B', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                                    <line x1="12" y1="9" x2="12" y2="13"/>
                                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                                </svg>
                                محاولات معلقة / يدوية
                            </p>
                            <h2 className="stat-card-number" style={{ fontWeight: '700', color: '#DC2626', margin: '12px 0' }}>
                                <AnimatedNumber value={failedCounter} /> <span className="stat-card-unit" style={{ fontWeight: '500', color: '#64748B' }}>حالة</span>
                            </h2>
                        </div>
                    </div>
                </div>

                {/* 4. تذكيرات مخصصة جاهزة */}
                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0284C7' }}></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '10px' }}>
                        <div>
                            <p className="stat-card-title" style={{ color: '#64748B', margin: 0, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <circle cx="12" cy="12" r="6"/>
                                    <circle cx="12" cy="12" r="2"/>
                                </svg>
                                تذكيرات مخصصة جاهزة
                            </p>
                            <h2 className="stat-card-number" style={{ fontWeight: '700', color: '#0284C7', margin: '12px 0' }}>
                                <AnimatedNumber value={Object.keys(templates).length} /> <span className="stat-card-unit" style={{ fontWeight: '500', color: '#64748B' }}>قوالب</span>
                            </h2>
                        </div>
                    </div>
                </div>
            </div>

            {/* لوحة التحكم بالقوالب وصياغة نص التذكير */}
            <div className="modern-card" style={{ padding: '25px', marginBottom: '35px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                    تخصيص وصياغة قوالب التذكير الفورية
                </h3>
                <p style={{ color: '#64748B', fontSize: '12.5px', margin: '0 0 20px 0' }}>
                    يمكنك استخدام الرموز الديناميكية مثل <code style={{ background: '#E0F2FE', padding: '2px 6px', borderRadius: '4px', color: '#0369A1', fontWeight: '600' }}>{"{{الأسم}}"}</code> أو <code style={{ background: '#E0F2FE', padding: '2px 6px', borderRadius: '4px', color: '#0369A1', fontWeight: '600' }}>{"{{التاريخ}}"}</code> ليقوم النظام باستبدالها تلقائياً.
                </p>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
                    {[
                        { 
                            id: 'visit_reminder', 
                            label: 'موعد فحص دوري',
                            icon: (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTemplate === 'visit_reminder' ? '#FFFFFF' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                                    <line x1="16" y1="2" x2="16" y2="6"/>
                                    <line x1="8" y1="2" x2="8" y2="6"/>
                                    <line x1="3" y1="10" x2="21" y2="10"/>
                                </svg>
                            )
                        },
                        { 
                            id: 'glasses_ready', 
                            label: 'مكتملة',
                            icon: (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTemplate === 'glasses_ready' ? '#FFFFFF' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                            )
                        },
                        { 
                            id: 'follow_up', 
                            label: 'متابعة سلامة',
                            icon: (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTemplate === 'follow_up' ? '#FFFFFF' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                            )
                        },
                        { 
                            id: 'custom_msg', 
                            label: 'إشعار مخصص عام',
                            icon: (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={activeTemplate === 'custom_msg' ? '#FFFFFF' : '#475569'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                                    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                                </svg>
                            )
                        }
                    ].map(btn => (
                        <button 
                            key={btn.id}
                            onClick={() => setActiveTemplate(btn.id)}
                            className="template-btn"
                            style={{
                                padding: '12px 18px',
                                backgroundColor: activeTemplate === btn.id ? '#0284C7' : '#F8FAFC',
                                color: activeTemplate === btn.id ? '#FFFFFF' : '#334155',
                                border: activeTemplate === btn.id ? '1px solid #0284C7' : '1px solid #E2E8F0',
                                borderRadius: '14px', cursor: 'pointer', fontWeight: '600', fontSize: '13px', transition: 'all 0.2s ease',
                                display: 'flex', alignItems: 'center', gap: '8px',
                                boxShadow: activeTemplate === btn.id ? '0 4px 12px rgba(2, 132, 199, 0.25)' : 'none'
                            }}
                        >
                            {btn.icon}
                            {btn.label}
                        </button>
                    ))}
                </div>
                
                <textarea 
                    value={templates[activeTemplate]}
                    onChange={(e) => setTemplates({ ...templates, [activeTemplate]: e.target.value })}
                    rows="3"
                    className="template-textarea"
                    style={{ width: '100%', padding: '14px', borderRadius: '16px', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#0F172A', fontSize: '13.5px', lineHeight: '1.6', outline: 'none', fontFamily: "inherit", resize: 'vertical' }}
                />
            </div>

            {/* شريط الفلاتر والبحث المتقدم */}
            <div className="modern-card filter-bar" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', marginBottom: '35px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: '1 1 300px' }}>
                    <div style={{ position: 'relative', flex: '2 1 200px', display: 'flex', alignItems: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', right: '12px', pointerEvents: 'none' }}>
                            <circle cx="11" cy="11" r="8"/>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                        <input 
                            type="text" 
                            placeholder="ابحث باسم المريض أو رقم الهاتف الفعال..." 
                            value={searchQuery} 
                            onChange={(e) => setSearchQuery(e.target.value)} 
                            className="custom-input-dark"
                            style={{ paddingRight: '36px' }}
                        />
                    </div>
                    
                    <select 
                        value={statusFilter} 
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="custom-select-dark"
                        style={{ flex: '1 1 150px' }}
                    >
                        <option value="all">كل الحالات الطبية</option>
                        <option value="reminded">مراجعين تم تذكيرهم سابقاً</option>
                        <option value="not_reminded">لم يرسل لهم تذكير بعد</option>
                    </select>
                </div>

                <select 
                    value={recordsLimit} 
                    onChange={(e) => setRecordsLimit(Number(e.target.value))}
                    className="custom-select-dark"
                    style={{ flex: '0 1 120px' }}
                >
                    <option value={20}>عرض 20 مريض</option>
                    <option value={50}>عرض 50 مريض</option>
                    <option value={100}>عرض 100 مريض</option>
                </select>
            </div>

            {/* جدول البيانات الرئيسي لعرض وتتبع الإرسال الفوري */}
            <div className="modern-card" style={{ padding: '25px', minWidth: 0 }}>
                <div className="table-scroll-container">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px', minWidth: '850px' }}>
                        <thead>
                            <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#475569', backgroundColor: '#F8FAFC' }}>
                                <th style={{ padding: '14px 12px', fontWeight: '700' }}>اسم المريض الفعال</th>
                                <th style={{ padding: '14px 12px', fontWeight: '700' }}>رقم الهاتف</th>
                                <th style={{ padding: '14px 12px', fontWeight: '700' }}>تاريخ الزيارة/المراجعة</th>
                                <th style={{ padding: '14px 12px', fontWeight: '700', textAlign: 'center' }}>عدد التذكيرات</th>
                                <th style={{ padding: '14px 12px', fontWeight: '700' }}>نص الرسالة للمعاينة السري</th>
                                <th style={{ padding: '14px 12px', fontWeight: '700', textAlign: 'center' }}>التحكم الفوري</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '40px 0', textAlign: 'center', color: '#64748B' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                                                <line x1="12" y1="2" x2="12" y2="6"/>
                                                <line x1="12" y1="18" x2="12" y2="22"/>
                                                <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/>
                                                <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/>
                                                <line x1="2" y1="12" x2="6" y2="12"/>
                                                <line x1="18" y1="12" x2="22" y2="12"/>
                                                <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/>
                                                <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/>
                                            </svg>
                                            <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
                                            جاري تحميل سجلات العيادة وتحديث البيانات...
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredPatients.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ padding: '40px 0', textAlign: 'center', color: '#64748B' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                                            </svg>
                                            لم يتم العثور على أي نتائج تطابق خيارات البحث.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredPatients.map(patient => {
                                    const latestDate = patient.visits && patient.visits.length > 0 ? patient.visits[0].date : patient.date || '---';
                                    return (
                                        <tr key={patient.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#334155', transition: 'background-color 0.15s ease' }}>
                                            <td style={{ padding: '14px 12px', fontWeight: '600', color: '#0F172A' }}>{patient.name}</td>
                                            <td style={{ padding: '14px 12px', color: '#0284C7', fontWeight: '600' }}>{patient.phone}</td>
                                            <td style={{ padding: '14px 12px', color: '#64748B' }}>{latestDate}</td>
                                            <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                                                <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '700' }}>
                                                    {patient.remindersCount || 0}
                                                </span>
                                            </td>
                                            <td style={{ padding: '14px 12px', fontSize: '12px', color: '#64748B', maxWidth: '260px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {generateMessage(patient, activeTemplate)}
                                            </td>
                                            <td style={{ padding: '14px 12px', textAlign: 'center' }}>
                                                <button 
                                                    onClick={() => handleSendWhatsApp(patient, activeTemplate)}
                                                    style={{ background: '#16A34A', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '600', transition: 'all 0.2s ease', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(22, 163, 74, 0.25)' }}
                                                    onMouseEnter={(e) => e.currentTarget.style.background = '#15803D'}
                                                    onMouseLeave={(e) => e.currentTarget.style.background = '#16A34A'}
                                                >
                                                    {/* أيقونة الواتساب الرسمية الدقيقة مأخوذة مباشرة من Flaticon باللون الأبيض */}
                                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#FFFFFF">
                                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414-.074-.124-.272-.198-.57-.347m-5.421 7.461c-1.808 0-3.582-.486-5.138-1.408l-.368-.218-3.82 1.002 1.019-3.723-.239-.38c-1.013-1.612-1.548-3.483-1.548-5.399 0-5.512 4.485-9.997 9.997-9.997 2.67 0 5.18 1.039 7.067 2.927 1.888 1.888 2.927 4.398 2.927 7.067-.001 5.513-4.486 9.998-9.998 9.998m0-20.001C5.3 1.842 0 7.142 0 13.684c0 2.091.545 4.133 1.578 5.922L0 25.526l6.104-1.601a11.8 11.8 0 0 0 5.737 1.474h.005c6.541 0 11.841-5.3 11.841-11.842 0-3.165-1.233-6.14-3.473-8.38C17.973 3.075 14.999 1.842 11.841 1.842"/>
                                                    </svg>
                                                    إرسال التذكير الآمن
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* مودال إعدادات الـ API والمفاتيح الرقمية */}
            {showSettingsModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(8px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100, padding: '16px' }}>
                    <div className="modern-card" style={{ padding: '30px', width: '100%', maxWidth: '460px', background: '#FFFFFF !important', border: '1px solid #CBD5E1 !important', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '17px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"/>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                            </svg>
                            ربط بوابة إرسال الواتساب الآلي
                        </h3>
                        <p style={{ color: '#64748B', fontSize: '12.5px', margin: '0 0 20px 0' }}>أدخل معرف الـ Instance وكود التوكن الخاص بحساب UltraMsg لفتح خط الإرسال الخلفي المباشر.</p>
                        
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>معرف الـ Instance ID:</label>
                            <input type="text" value={instanceId} onChange={(e) => setInstanceId(e.target.value)} className="custom-input-dark" />
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>مفتاح التوكن (Token Authentication):</label>
                            <input type="password" value={apiToken} onChange={(e) => setApiToken(e.target.value)} className="custom-input-dark" />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowSettingsModal(false)} style={{ padding: '10px 18px', background: '#F1F5F9', border: '1px solid #CBD5E1', borderRadius: '12px', color: '#475569', fontSize: '13px', cursor: 'pointer', fontWeight: '600' }}>إلغاء</button>
                            <button onClick={saveApiSettings} style={{ padding: '10px 18px', background: '#0284C7', border: 'none', borderRadius: '12px', color: '#FFFFFF', fontSize: '13px', cursor: 'pointer', fontWeight: '600', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.3)' }}>حفظ التعديلات</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
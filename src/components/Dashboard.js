'use client';
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/firebase';
import { collection, query, getDocs } from 'firebase/firestore'; 
import { signOut, sendPasswordResetEmail, onAuthStateChanged } from 'firebase/auth'; 

export default function Dashboard() {
    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentDateStr, setCurrentDateStr] = useState('');
    const [statsTimeframe, setStatsTimeframe] = useState('today'); 
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]); 
    const [showAdminMenu, setShowAdminMenu] = useState(false);
    
    const adminMenuRef = useRef(null);
    const tableRef = useRef(null);

    const [currentUsername, setCurrentUsername] = useState('مدير النظام');
    const [selectedPointIndex, setSelectedPointIndex] = useState(null);

    const [patientsCount, setPatientsCount] = useState(0);
    const [lowStockCount, setLowStockCount] = useState(0);
    const [totalPatientsCount, setTotalPatientsCount] = useState(0);
    const [filteredPatientsList, setFilteredPatientsList] = useState([]);
    const [recentPurchases, setRecentPurchases] = useState([]);
    const [criticalStockItems, setCriticalStockItems] = useState([]);

    const [totalSalesValue, setTotalSalesValue] = useState(0);       
    const [totalExpensesValue, setTotalExpensesValue] = useState(0);   
    const [netProfitValue, setNetProfitValue] = useState(0);           

    // بيانات النقاط الموزعة للمخطط البياني
    const [chartDataPoints, setChartDataPoints] = useState([]);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (!user) {
                window.location.href = '/login';
            } else {
                setCurrentUserId(user.uid);
                fetchDashboardData(user.uid);
            }
        });

        const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        setCurrentDateStr(new Date().toLocaleDateString('ar-EG', options));

        if (typeof window !== 'undefined') {
            const savedUser = localStorage.getItem('user_username'); 
            if (savedUser) setCurrentUsername(savedUser);
        }

        return () => unsubscribe(); 
    }, [statsTimeframe, customDate]); 

    // 🚀 تحديث جلب البيانات تلقائياً للهواتف الذكية عند تغيير التاريخ أو النطاق الزمني
    useEffect(() => {
        if (currentUserId) {
            fetchDashboardData(currentUserId);
        }
    }, [customDate, statsTimeframe]);

    useEffect(() => {
        function handleClickOutside(event) {
            if (adminMenuRef.current && !adminMenuRef.current.contains(event.target)) {
                setShowAdminMenu(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleFullLogout = async () => {
        try {
            await signOut(auth); 
            localStorage.clear(); 
            if (typeof document !== 'undefined') {
                document.cookie = "clinic_admin_logged=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
                document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            }
            window.location.reload(); 
        } catch (error) {
            console.error("خطأ أثناء تسجيل الخروج الكامل:", error);
        }
    };

    const handleChangePassword = async () => {
        const user = auth.currentUser;
        if (user && user.email) {
            try {
                await sendPasswordResetEmail(auth, user.email);
                alert(`📧 تم إرسال رابط إعادة تعيين كلمة السر بنجاح إلى البريد الإلكتروني: (${user.email})`);
            } catch (error) {
                alert("حدث خطأ أثناء محاولة إرسال رابط التغيير: " + error.message);
            }
        } else {
            alert("🔒 لم نتمكن من كشف بريدك الإلكتروني للجلسة الحالية.");
        }
    };

    // دالة تحويل الكائنات والتخاريف التاريخية لتاريخ قياسي
    const parseItemDate = (rawValue) => {
        if (!rawValue) return null;
        if (typeof rawValue === 'object' && rawValue.seconds !== undefined) {
            return new Date(rawValue.seconds * 1000);
        }
        if (rawValue instanceof Date) return rawValue;
        try {
            let dateStr = rawValue.toString().trim();
            const arabicNorm = {'٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','/':'-','\\':'-'};
            dateStr = dateStr.replace(/[٠-٩/\\]/g, d => arabicNorm[d] || d);
            dateStr = dateStr.split(' ')[0].split(',')[0];
            let parsedD = new Date(dateStr);
            if (!isNaN(parsedD.getTime())) return parsedD;
        } catch(e) { return null; }
        return null;
    };

    // --- دالة جلب البيانات مع توزيعها الديناميكي على المخطط البياني ---
    const fetchDashboardData = async (userId) => {
        const activeUserId = userId || currentUserId;
        if (!activeUserId) return;

        try {
            // 1. حساب النواقص
            const storeRef = collection(db, 'users', activeUserId, 'store');
            const storeSnapshot = await getDocs(query(storeRef));
            let totalLowStock = 0; let criticalItems = [];
            storeSnapshot.forEach((doc) => {
                const data = doc.data();
                const currentStock = Number(data.currentStock || data.qty || 0);
                const minAlertQty = Number(data.minAlertQty || 2);
                if (currentStock <= minAlertQty) {
                    totalLowStock++;
                    criticalItems.push({ name: data.itemName || 'صنف غير مسمى', stock: currentStock });
                }
            });
            setLowStockCount(totalLowStock);
            setCriticalStockItems(criticalItems.slice(0, 5));

            // 2. إعداد المحاور البيانية ديناميكياً بناءً على المدى الزمني المختار
            let chartBuckets = [];
            const now = new Date();

            if (statsTimeframe === 'today') {
                const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                
                // حساب بداية أسبوع اليوم الحالي (السبت)
                const currentDayIndex = now.getDay(); 
                const saturdayOffset = (currentDayIndex + 1) % 7;
                
                for (let i = 0; i < 7; i++) {
                    const d = new Date(now);
                    d.setDate(now.getDate() - saturdayOffset + i);
                    d.setHours(0, 0, 0, 0);
                    chartBuckets.push({
                        label: daysOfWeek[d.getDay()],
                        subLabel: `${d.getDate()}/${d.getMonth()+1}`,
                        dateObj: d,
                        sales: 0,
                        profit: 0,
                        expenses: 0,
                        isCurrent: d.toDateString() === now.toDateString()
                    });
                }
            } else if (statsTimeframe === 'custom') {
                // عرض اليوم المختار المخصص فقط
                const selectedDateObj = new Date(customDate);
                const daysOfWeek = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
                selectedDateObj.setHours(0, 0, 0, 0);
                
                chartBuckets = [{
                    label: daysOfWeek[selectedDateObj.getDay()],
                    subLabel: `${selectedDateObj.getDate()}/${selectedDateObj.getMonth()+1}`,
                    dateObj: selectedDateObj,
                    sales: 0,
                    profit: 0,
                    expenses: 0,
                    isCurrent: true
                }];
            } else if (statsTimeframe === 'month') {
                chartBuckets = [
                    { label: 'الأسبوع 1', weekNum: 1, sales: 0, profit: 0, expenses: 0 },
                    { label: 'الأسبوع 2', weekNum: 2, sales: 0, profit: 0, expenses: 0 },
                    { label: 'الأسبوع 3', weekNum: 3, sales: 0, profit: 0, expenses: 0 },
                    { label: 'الأسبوع 4', weekNum: 4, sales: 0, profit: 0, expenses: 0 },
                ];
            } else if (statsTimeframe === 'year') {
                const monthsAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
                chartBuckets = monthsAr.map((m, idx) => ({
                    label: m,
                    monthIdx: idx,
                    sales: 0,
                    profit: 0,
                    expenses: 0
                }));
            }

            // دالة تحديد مكان القيمة داخل الـ Buckets
            const assignToBucket = (itemDate, salesAmt, profitAmt, expAmt) => {
                if (!itemDate) return;

                if (statsTimeframe === 'today' || statsTimeframe === 'custom') {
                    const itemDateStr = itemDate.toDateString();
                    const bucket = chartBuckets.find(b => b.dateObj && b.dateObj.toDateString() === itemDateStr);
                    if (bucket) {
                        bucket.sales += salesAmt;
                        bucket.profit += profitAmt;
                        bucket.expenses += expAmt;
                    }
                } else if (statsTimeframe === 'month') {
                    if (itemDate.getMonth() === now.getMonth() && itemDate.getFullYear() === now.getFullYear()) {
                        const dayOfMonth = itemDate.getDate();
                        const weekIdx = Math.min(Math.floor((dayOfMonth - 1) / 7), 3);
                        chartBuckets[weekIdx].sales += salesAmt;
                        chartBuckets[weekIdx].profit += profitAmt;
                        chartBuckets[weekIdx].expenses += expAmt;
                    }
                } else if (statsTimeframe === 'year') {
                    if (itemDate.getFullYear() === now.getFullYear()) {
                        const mIdx = itemDate.getMonth();
                        chartBuckets[mIdx].sales += salesAmt;
                        chartBuckets[mIdx].profit += profitAmt;
                        chartBuckets[mIdx].expenses += expAmt;
                    }
                }
            };

            // 3. جلب حركات المخزن وتوزيعها
            let backupPurchasesList = [];
            const movementsSnapshot = await getDocs(query(collection(db, 'users', activeUserId, 'store_movements')));

            movementsSnapshot.forEach((doc) => {
                const data = doc.data();
                const itemDate = parseItemDate(data.date || data.createdAt);
                const type = data.type; 
                const qty = Number(data.qty || 1);
                const price = Number(data.price || data.cost || 0); 
                const wholesalePrice = Number(data.wholesalePrice || 0);
                const detailsText = data.details || data.note || ''; 
                const isOldReturn = detailsText.includes('استرجاع') || detailsText.includes('مرتجع') || detailsText.includes('حذف');

                const targetDateStr = statsTimeframe === 'custom' ? new Date(customDate).toDateString() : now.toDateString();
                const isMatchingCurrentPeriod = itemDate && itemDate.toDateString() === targetDateStr;

                if (type === 'صادر') {
                    const s = price * qty;
                    const p = (price - wholesalePrice) * qty;
                    assignToBucket(itemDate, s, p, 0);
                } 
                else if (type === 'مسترجع' || (type === 'وارد' && isOldReturn)) {
                    const s = -(price * qty);
                    const p = -((price - wholesalePrice) * qty);
                    assignToBucket(itemDate, s, p, 0);
                } 
                else if (type === 'وارد') {
                    const e = price * qty;
                    assignToBucket(itemDate, 0, 0, e);
                    
                    if (isMatchingCurrentPeriod || statsTimeframe === 'month' || statsTimeframe === 'year') {
                        backupPurchasesList.push({
                            title: data.itemName || 'بضاعة واردة',
                            qty: qty,
                            date: data.date || 'اليوم'
                        });
                    }
                }
            });
            setRecentPurchases(backupPurchasesList.slice(0, 5));

            // 4. جلب المراجعين وتوزيع مبيعات الكشف والعدسات
            const patientsSnapshot = await getDocs(query(collection(db, 'users', activeUserId, 'patients')));
            setTotalPatientsCount(patientsSnapshot.size);
            let filteredPatients = [];

            patientsSnapshot.forEach((doc) => {
                const data = doc.data();
                const visits = data.visits || [];

                const processVisit = (vDate, vTime, vStatus, cFee, lPrice) => {
                    const parsedD = parseItemDate(vDate);
                    
                    // تحديد فلترة جدول المراجعين بدقة (اليوم حصراً إذا كانت اليومية حية)
                    let isAllowedInTable = false;
                    if (statsTimeframe === 'today') {
                        isAllowedInTable = parsedD && parsedD.toDateString() === now.toDateString();
                    } else if (statsTimeframe === 'custom') {
                        isAllowedInTable = parsedD && parsedD.toDateString() === new Date(customDate).toDateString();
                    } else if (statsTimeframe === 'month') {
                        isAllowedInTable = parsedD && parsedD.getMonth() === now.getMonth() && parsedD.getFullYear() === now.getFullYear();
                    } else if (statsTimeframe === 'year') {
                        isAllowedInTable = parsedD && parsedD.getFullYear() === now.getFullYear();
                    }

                    if (isAllowedInTable) {
                        filteredPatients.push({
                            id: `${doc.id}_${Math.random()}`,
                            name: data.name,
                            phone: data.phone || '---',
                            time: vTime || '00:00',
                            status: vStatus || 'فحص',
                            date: vDate || ''
                        });
                    }

                    const totalEarning = Number(cFee || 0) + Number(lPrice || 0);
                    assignToBucket(parsedD, totalEarning, totalEarning, 0);
                };

                if (Array.isArray(visits) && visits.length > 0) {
                    visits.forEach((v) => {
                        processVisit(v.date || v.createdAt, v.time, v.status || 'مراجعة', v.consultationFee, v.customLensPrice);
                    });
                } else {
                    processVisit(data.date || data.createdAt, data.time, data.status, data.consultationFee, data.customLensPrice);
                }
            });
            setPatientsCount(filteredPatients.length);
            setFilteredPatientsList(filteredPatients);

            // 5. جلب المصاريف التشغيلية وتوزيعها
            const expensesSnapshot = await getDocs(query(collection(db, 'users', activeUserId, 'expenses')));
            expensesSnapshot.forEach((doc) => {
                const data = doc.data();
                const expDate = parseItemDate(data.date || data.createdAt);
                const amt = Number(data.amount || data.price || 0);
                assignToBucket(expDate, 0, -amt, amt);
            });

            // 6. حساب المجاميع للبطاقات العلوية
            let overallSales = 0;
            let overallProfit = 0;
            let overallExpenses = 0;

            if (statsTimeframe === 'today') {
                // في حالة "اليومية حية" نأخذ فقط قراءة تاريخ اليوم الحالي من الـ Buckets
                const todayBucket = chartBuckets.find(b => b.isCurrent);
                if (todayBucket) {
                    overallSales = todayBucket.sales;
                    overallProfit = todayBucket.profit;
                    overallExpenses = todayBucket.expenses;
                }
            } else {
                // باقي الخيارات يجمع كامل الـ Buckets المعروضة
                chartBuckets.forEach(b => {
                    overallSales += b.sales;
                    overallProfit += b.profit;
                    overallExpenses += b.expenses;
                });
            }

            setTotalSalesValue(Math.max(0, overallSales));
            setTotalExpensesValue(Math.max(0, overallExpenses));
            setNetProfitValue(Math.max(0, overallProfit));

            // حفظ بيانات المخطط البياني
            setChartDataPoints(chartBuckets);

            // تحديد النقطة النشطة للرسم البياني
            const activeIdx = chartBuckets.findIndex(b => b.isCurrent);
            setSelectedPointIndex(activeIdx !== -1 ? activeIdx : 0);

        } catch (error) {
            console.error("خطأ بالحسابات الشاملة المحدثة:", error);
        }
    };

    // حساب نقاط المسارات لمنحنيات SVG
    const maxGraphVal = Math.max(...chartDataPoints.map(p => Math.max(p.sales, p.profit, p.expenses)), 100000);
    const bucketCount = chartDataPoints.length || 1;
    const stepX = bucketCount > 1 ? (680 / (bucketCount - 1)) : 0;

    const computedPoints = chartDataPoints.map((pt, i) => {
        const x = bucketCount === 1 ? 380 : 40 + (i * stepX);
        const salesY = 260 - (pt.sales > 0 ? (pt.sales / maxGraphVal) * 190 : 0);
        const profitY = 260 - (pt.profit > 0 ? (pt.profit / maxGraphVal) * 190 : 0);
        const expY = 260 - (pt.expenses > 0 ? (pt.expenses / maxGraphVal) * 190 : 0);
        return { ...pt, x, salesY, profitY, expY };
    });

    const createSmoothPath = (pts, key) => {
        if (!pts || pts.length === 0) return '';
        if (pts.length === 1) return `M ${pts[0].x} ${pts[0][key]}`;
        let d = `M ${pts[0].x} ${pts[0][key]}`;
        for (let i = 0; i < pts.length - 1; i++) {
            const curr = pts[i];
            const next = pts[i + 1];
            const mx = (curr.x + next.x) / 2;
            d += ` C ${mx} ${curr[key]}, ${mx} ${next[key]}, ${next.x} ${next[key]}`;
        }
        return d;
    };

    const salesPath = createSmoothPath(computedPoints, 'salesY');
    const profitPath = createSmoothPath(computedPoints, 'profitY');
    const expPath = createSmoothPath(computedPoints, 'expY');

    const activePoint = computedPoints[selectedPointIndex] || computedPoints[0] || { label: '---', sales: 0, profit: 0, expenses: 0 };

    return (
        <div style={{ 
            padding: '4vw 3vw', 
            backgroundColor: '#F8FAFC', 
            backgroundImage: 'radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(16, 185, 129, 0.05) 0%, transparent 40%), linear-gradient(180deg, #F8FAFC 0%, #F1F5F9 100%)',
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
                body {
                    background-color: #F8FAFC !important;
                    color: #0F172A !important;
                    margin: 0;
                    padding: 0;
                }
                .modern-card {
                    background: #FFFFFF !important;
                    backdrop-filter: blur(20px) !important;
                    -webkit-backdrop-filter: blur(20px) !important;
                    border: 1px solid #E2E8F0 !important;
                    border-radius: 20px !important;
                    box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.04), 0 8px 10px -6px rgba(15, 23, 42, 0.02) !important;
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                    box-sizing: border-box !important;
                }
                .modern-card:hover {
                    transform: translateY(-4px) !important;
                    border-color: #CBD5E1 !important;
                    box-shadow: 0 20px 30px -10px rgba(15, 23, 42, 0.08), 0 10px 12px -8px rgba(15, 23, 42, 0.04) !important;
                }
                .responsive-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 35px;
                    background: #FFFFFF !important;
                    backdrop-filter: blur(20px) !important;
                    -webkit-backdrop-filter: blur(20px) !important;
                    padding: 20px 30px;
                    border-radius: 20px;
                    box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05) !important;
                    border: 1px solid #E2E8F0 !important;
                    position: relative;
                    z-index: 9999 !important;
                    box-sizing: border-box !important;
                }
                .responsive-grid-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 25px;
                    margin-bottom: 35px;
                    position: relative;
                    z-index: 1;
                }
                .responsive-row-split {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 25px;
                    margin-bottom: 35px;
                    position: relative;
                    z-index: 1;
                    align-items: stretch;
                }
                .table-scroll-container {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .custom-select-dark {
                    border: none;
                    background: none;
                    padding: 6px 10px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #0F172A !important;
                    cursor: pointer;
                    outline: none;
                }
                .custom-select-dark option {
                    background-color: #FFFFFF !important;
                    color: #0F172A !important;
                }
                .card-icon-box {
                    padding: 12px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .card-icon-box svg {
                    width: 22px;
                    height: 22px;
                }

                @media (max-width: 991px) {
                    .responsive-header {
                        flex-direction: column;
                        align-items: flex-start;
                        gap: 16px;
                        padding: 16px 20px;
                        margin-bottom: 20px;
                    }
                    .header-controls-wrapper {
                        width: 100%;
                        flex-wrap: wrap;
                        justify-content: space-between;
                    }
                    .responsive-row-split {
                        grid-template-columns: 1fr;
                        gap: 16px;
                        margin-bottom: 20px;
                    }
                }

                @media (max-width: 768px) {
                    .responsive-grid-cards {
                        grid-template-columns: repeat(2, 1fr);
                        gap: 12px;
                        margin-bottom: 20px;
                    }
                    .modern-card {
                        padding: 14px !important;
                        border-radius: 16px !important;
                    }
                    .card-content-wrap {
                        display: flex;
                        flex-direction: column-reverse;
                        align-items: flex-start;
                        gap: 8px;
                    }
                    .card-icon-box {
                        padding: 6px !important;
                        border-radius: 10px !important;
                    }
                    .card-icon-box svg {
                        width: 16px !important;
                        height: 16px !important;
                    }
                    .card-title {
                        font-size: 11px !important;
                    }
                    .card-value {
                        font-size: 16px !important;
                        margin: 4px 0 !important;
                    }
                }
            `}</style>

          {/* الهيدر الأعلى */}
<div className="responsive-header">
    <div>
        <h1 style={{ fontSize: 'clamp(20px, 2.5vw, 26px)', fontWeight: '700', color: '#0F172A', margin: 0, letterSpacing: '-0.3px' }}>لوحة الإحصائيات الشاملة</h1>
        <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0', fontWeight: '500' }}>✨ {currentDateStr}</p>
    </div>
    
    <div className="header-controls-wrapper" style={{ display: 'flex', alignItems: 'center', gap: '15px', position: 'relative', zIndex: 10000 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', padding: '6px 14px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            
            {/* القائمة المنسدلة - تعمل الآن مع جميع الخيارات فوراً على الهاتف */}
            <select 
                value={statsTimeframe} 
                onChange={(e) => {
                    const selectedValue = e.target.value;
                    setStatsTimeframe(selectedValue);
                    // جلب البيانات مباشرة للأنواع الأخرى فور الاختيار
                    if (selectedValue !== 'custom' && currentUserId) {
                        fetchDashboardData(currentUserId, selectedValue);
                    }
                }} 
                className="custom-select-dark"
            >
                <option value="today">اليومية حية</option>
                <option value="month">الشهر الحالي</option>
                <option value="custom">تاريخ مخصص 📅</option>
                <option value="year">الحصيلة السنوية</option>
            </select>

            {/* حقل التاريخ المخصص */}
            {statsTimeframe === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input 
                        type="date" 
                        value={customDate} 
                        onChange={(e) => {
                            const val = e.target.value;
                            setCustomDate(val);
                            if (val && currentUserId) {
                                fetchDashboardData(currentUserId, 'custom', val);
                            }
                        }}
                        style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '4px 8px', fontSize: '11px', color: '#0F172A', background: '#FFFFFF', outline: 'none' }} 
                    />
                    <button 
                        type="button"
                        onClick={() => fetchDashboardData(currentUserId, 'custom', customDate)}
                        style={{ background: '#0EA5E9', color: 'white', border: 'none', borderRadius: '8px', padding: '5px 8px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}
                    >
                        جلب
                    </button>
                </div>
            )}
        </div>

        <div style={{ position: 'relative', cursor: 'pointer' }}>
            <div style={{ background: '#F1F5F9', padding: '10px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={lowStockCount > 0 ? "#EF4444" : "#64748B"} strokeWidth="2"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
            </div>
            {lowStockCount > 0 && <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#EF4444', color: 'white', fontSize: '10px', fontWeight: '700', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)' }}>{lowStockCount}</span>}
        </div>

        <div style={{ position: 'relative' }} ref={adminMenuRef}>
            <button onClick={() => setShowAdminMenu(!showAdminMenu)} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)', color: 'white', padding: '10px 16px', borderRadius: '14px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '600', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.25)' }}>
                <span>{currentUsername}</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" style={{ transform: showAdminMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {showAdminMenu && (
                <div style={{ position: 'absolute', top: '50px', left: 0, background: '#FFFFFF', borderRadius: '16px', width: '200px', border: '1px solid #E2E8F0', zIndex: 99999, overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}>
                    <div style={{ padding: '12px', background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
                        <p style={{ margin: 0, fontSize: '12px', fontWeight: '600', color: '#0F172A' }}>{currentUsername}</p>
                    </div>
                    <button onClick={handleChangePassword} style={{ width: '100%', padding: '10px 12px', background: 'transparent', color: '#334155', border: 'none', cursor: 'pointer', textAlign: 'right', fontSize: '12px', transition: 'background 0.2s' }}>تغيير كلمة السر</button>
                    <button onClick={handleFullLogout} style={{ width: '100%', padding: '10px 12px', background: '#FEF2F2', color: '#EF4444', border: 'none', cursor: 'pointer', textAlign: 'right', fontSize: '12px', fontWeight: '600' }}>تسجيل الخروج</button>
                </div>
            )}
        </div>
    </div>
</div>
            {/* بطاقات المال */}
            <div className="responsive-grid-cards">
                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '4px', background: '#10B981' }}></div>
                    <div className="card-content-wrap" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <p className="card-title" style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>صافي الأرباح المحققة</p>
                            <h2 className="card-value" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: '800', color: '#059669', margin: '12px 0' }}>
                                {netProfitValue.toLocaleString('en-US')} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>د.ع</span>
                            </h2>
                            <span className="card-subtext" style={{ fontSize: '11px', color: '#059669', fontWeight: '500' }}>🟢 الإيرادات بعد خصم كافة النفقات</span>
                        </div>
                        <div className="card-icon-box" style={{ background: '#ECFDF5' }}><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg></div>
                    </div>
                </div>

                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '4px', background: '#0EA5E9' }}></div>
                    <div className="card-content-wrap" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <p className="card-title" style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>مجموع المبيعات والإيرادات</p>
                            <h2 className="card-value" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: '800', color: '#0284C7', margin: '12px 0' }}>
                                {totalSalesValue.toLocaleString()} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>د.ع</span>
                            </h2>
                            <span className="card-subtext" style={{ fontSize: '11px', color: '#0284C7', fontWeight: '500' }}>📊 يشمل الكشفيات والبيع المباشر</span>
                        </div>
                        <div className="card-icon-box" style={{ background: '#F0F9FF' }}><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0EA5E9" strokeWidth="2"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg></div>
                    </div>
                </div>

                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '4px', background: '#EF4444' }}></div>
                    <div className="card-content-wrap" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <p className="card-title" style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>المصاريف والمشتريات</p>
                            <h2 className="card-value" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: '800', color: '#DC2626', margin: '12px 0' }}>
                                {totalExpensesValue.toLocaleString()} <span style={{ fontSize: '12px', color: '#64748B', fontWeight: '500' }}>د.ع</span>
                            </h2>
                            <span className="card-subtext" style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>💸 النفقات وتكلفة البضاعة العامة</span>
                        </div>
                        <div className="card-icon-box" style={{ background: '#FEF2F2' }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                                <rect width="20" height="14" x="2" y="5" rx="2" />
                                <line x1="2" y1="10" x2="22" y2="10" />
                            </svg>
                        </div>
                    </div>
                </div>

                <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, left: 0, height: '4px', background: '#8B5CF6' }}></div>
                    <div className="card-content-wrap" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <div>
                            <p className="card-title" style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>الزيارات بالمدى الزمني</p>
                            <h2 className="card-value" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: '800', color: '#7C3AED', margin: '12px 0' }}>{patientsCount}</h2>
                            <span className="card-subtext" onClick={() => tableRef.current?.scrollIntoView({ behavior: 'smooth' })} style={{ fontSize: '11px', color: '#059669', cursor: 'pointer', textDecoration: 'underline', fontWeight: '600' }}>📈 الزيارات النشطة بالفلتر</span>
                        </div>
                        <div className="card-icon-box" style={{ background: '#F5F3FF' }}><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg></div>
                    </div>
                </div>
            </div>

            {/* الصف الأول: جدول المسجلين والمراجعين + نواقص المخزن */}
            <div className="responsive-row-split">
                <div ref={tableRef} className="modern-card" style={{ padding: '24px', minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '16px', color: '#0F172A', margin: 0, fontWeight: '700' }}>جدول المسجلين والمراجعين بالمدى الحالي</h3>
                        <span style={{ background: '#E0F2FE', color: '#0369A1', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '700' }}>{filteredPatientsList.length} زيارة</span>
                    </div>
                    <div className="table-scroll-container">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '13px', minWidth: '450px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #E2E8F0', color: '#475569' }}>
                                    <th style={{ padding: '12px 8px', fontWeight: '700' }}>الاسم المراجع</th>
                                    <th style={{ padding: '12px 8px', fontWeight: '700' }}>رقم الهاتف</th>
                                    <th style={{ padding: '12px 8px', fontWeight: '700' }}>التاريخ والوقت</th>
                                    <th style={{ padding: '12px 8px', fontWeight: '700' }}>نوع الإجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPatientsList.length === 0 ? (
                                    <tr><td colSpan={4} style={{ padding: '30px 0', textAlign: 'center', color: '#94A3B8' }}>لا يوجد مراجعين مسجلين بالمدى المحدد حالياً.</td></tr>
                                ) : (
                                    filteredPatientsList.map((patient) => (
                                        <tr key={patient.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                            <td style={{ padding: '12px 8px', color: '#0F172A', fontWeight: '600' }}>{patient.name}</td>
                                            <td style={{ padding: '12px 8px', color: '#0284C7', fontWeight: '600', direction: 'ltr', textAlign: 'right' }}>{patient.phone}</td>
                                            <td style={{ padding: '12px 8px', color: '#64748B' }}>{patient.date} - {patient.time}</td>
                                            <td style={{ padding: '12px 8px' }}><span style={{ background: '#F1F5F9', color: '#334155', padding: '4px 10px', borderRadius: '8px', fontSize: '11px', fontWeight: '600' }}>{patient.status}</span></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="modern-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', color: '#0F172A', marginBottom: '20px', fontWeight: '700' }}>مراقبة نواقص المخزن ({lowStockCount})</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {criticalStockItems.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>جميع أصناف المخزن متوفرة وبكميات آمنة.</div>
                        ) : (
                            criticalStockItems.map((item, index) => (
                                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#FEF2F2', borderRadius: '12px', border: '1px solid #FCA5A5', borderRightWidth: '4px', borderRightColor: '#EF4444' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '13px', color: '#991B1B', fontWeight: '700' }}>{item.name}</h4>
                                        <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#DC2626', fontWeight: '500' }}>المتبقي: {item.stock} قطع</p>
                                    </div>
                                    <span style={{ background: '#FEE2E2', color: '#991B1B', fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', alignSelf: 'center' }}>نواقص</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* الصف الثاني: المخطط البياني التفاعلي الشامل + الأصناف المضافة حديثاً بجانبه */}
            <div className="responsive-row-split">
                <div className="modern-card" style={{ padding: '24px', width: '100%', boxSizing: 'border-box' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                        <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#0F172A', margin: 0 }}>
                            مخطط الإحصائيات (
                            {statsTimeframe === 'today' && 'الأسبوع الحالي'}
                            {statsTimeframe === 'month' && 'أسابيع الشهر الحالي'}
                            {statsTimeframe === 'year' && 'أشهر السنة'}
                            {statsTimeframe === 'custom' && 'التاريخ المخصص'}
                            )
                        </h3>
                        <span style={{ fontSize: '11px', color: '#0369A1', background: '#E0F2FE', padding: '4px 12px', borderRadius: '12px', border: '1px solid #BAE6FD', fontWeight: '600' }}>
                             مرر أو اضغط لعرض تفاصيل القراءة
                        </span>
                    </div>

                    {/* SVG ديناميكي */}
                    <div style={{ width: '100%', overflow: 'hidden', position: 'relative' }}>
                        <svg 
                            viewBox="0 0 760 320" 
                            preserveAspectRatio="xMidYMid meet"
                            style={{ 
                                width: '100%', 
                                height: 'auto', 
                                maxHeight: '350px',
                                display: 'block',
                                overflow: 'visible'
                            }}
                        >
                            <defs>
                                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.2"/>
                                    <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0"/>
                                </linearGradient>
                                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10B981" stopOpacity="0.25"/>
                                    <stop offset="100%" stopColor="#10B981" stopOpacity="0"/>
                                </linearGradient>
                                <linearGradient id="expGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#EF4444" stopOpacity="0.15"/>
                                    <stop offset="100%" stopColor="#EF4444" stopOpacity="0"/>
                                </linearGradient>
                                <filter id="glowGreen" x="-20%" y="-20%" width="140%" height="140%">
                                    <feGaussianBlur stdDeviation="2" result="blur" />
                                    <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                </filter>
                            </defs>

                            {/* شبكة الأرقام الأفقية */}
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                                const val = Math.round(maxGraphVal * ratio);
                                const y = 260 - (ratio * 190);
                                return (
                                    <g key={idx}>
                                        <line x1="30" y1={y} x2="730" y2={y} stroke="#E2E8F0" strokeDasharray="4 4" />
                                        <text x="25" y={y + 4} fill="#64748B" fontSize="10" fontWeight="500" textAnchor="end">{val === 0 ? '0' : `${(val / 1000).toFixed(0)}k`}</text>
                                    </g>
                                );
                            })}

                            {/* التعبئة الخلفية */}
                            {computedPoints.length > 0 && (
                                <>
                                    <path d={`${salesPath} L ${computedPoints[computedPoints.length - 1].x} 260 L ${computedPoints[0].x} 260 Z`} fill="url(#salesGrad)" />
                                    <path d={`${profitPath} L ${computedPoints[computedPoints.length - 1].x} 260 L ${computedPoints[0].x} 260 Z`} fill="url(#netGrad)" />
                                    <path d={`${expPath} L ${computedPoints[computedPoints.length - 1].x} 260 L ${computedPoints[0].x} 260 Z`} fill="url(#expGrad)" />
                                </>
                            )}

                            {/* رسم الخطوط البيانية */}
                            <path d={salesPath} fill="none" stroke="#0EA5E9" strokeWidth="3" strokeLinecap="round" />
                            <path d={profitPath} fill="none" stroke="#10B981" strokeWidth="3.5" strokeLinecap="round" filter="url(#glowGreen)" />
                            <path d={expPath} fill="none" stroke="#EF4444" strokeWidth="3" strokeLinecap="round" />

                            {/* التفاعل والضغط */}
                            {computedPoints.map((pt, i) => {
                                const isSelected = selectedPointIndex === i;

                                return (
                                    <g 
                                        key={i} 
                                        onClick={() => setSelectedPointIndex(i)}
                                        onMouseEnter={() => setSelectedPointIndex(i)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <rect x={pt.x - (stepX / 2 || 100)} y="10" width={stepX || 200} height="270" fill="transparent" />

                                        {isSelected && (
                                            <g>
                                                <line x1={pt.x} y1="20" x2={pt.x} y2="260" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="4 4" />
                                                <circle cx={pt.x} cy="260" r="8" fill="rgba(14, 165, 233, 0.15)" />
                                            </g>
                                        )}

                                        <circle cx={pt.x} cy={pt.salesY} r={isSelected ? "6" : "4"} fill="#0EA5E9" stroke="#FFFFFF" strokeWidth="2" />
                                        <circle cx={pt.x} cy={pt.profitY} r={isSelected ? "8" : "5"} fill="#10B981" stroke="#FFFFFF" strokeWidth="2.5" />
                                        <circle cx={pt.x} cy={pt.expY} r={isSelected ? "6" : "4"} fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" />

                                        <text x={pt.x} y="280" fill={isSelected ? '#059669' : pt.isCurrent ? '#0284C7' : '#64748B'} fontSize={isSelected ? "12" : "10"} fontWeight={isSelected || pt.isCurrent ? '700' : '500'} textAnchor="middle">
                                            {pt.label}
                                        </text>
                                        {pt.subLabel && (
                                            <text x={pt.x} y="295" fill="#94A3B8" fontSize="9" textAnchor="middle">
                                                {pt.subLabel}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    </div>

                    {/* دلالات الألوان */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '20px', marginTop: '12px', flexWrap: 'wrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#0EA5E9', display: 'inline-block' }}></span>
                            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>المبيعات</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#10B981', display: 'inline-block', boxShadow: '0 0 6px rgba(16, 185, 129, 0.4)' }}></span>
                            <span style={{ fontSize: '12px', color: '#0F172A', fontWeight: '700' }}>صافي الأرباح</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#EF4444', display: 'inline-block' }}></span>
                            <span style={{ fontSize: '12px', color: '#475569', fontWeight: '600' }}>المصاريف</span>
                        </div>
                    </div>

                    {/* القارئ التفاعلي */}
                    <div style={{ marginTop: '20px', background: '#F8FAFC', padding: '14px 18px', borderRadius: '16px', border: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div>
                            <span style={{ fontSize: '12px', color: '#0284C7', fontWeight: '700' }}>📊 قراءة ({activePoint.label} {activePoint.subLabel ? ` - ${activePoint.subLabel}` : ''}): </span>
                            {activePoint.isCurrent && (
                                <span style={{ fontSize: '11px', color: '#059669', fontWeight: '700' }}>(اليوم الحالي)</span>
                            )}
                        </div>
                        
                        <div style={{ display: 'flex', gap: '18px', fontSize: '12px', flexWrap: 'wrap' }}>
                            <div>
                                <span style={{ color: '#64748B', fontWeight: '500' }}>المبيعات: </span>
                                <strong style={{ color: '#0284C7' }}>{activePoint.sales.toLocaleString()} د.ع</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748B', fontWeight: '500' }}>الصافي: </span>
                                <strong style={{ color: '#059669' }}>{activePoint.profit.toLocaleString()} د.ع</strong>
                            </div>
                            <div>
                                <span style={{ color: '#64748B', fontWeight: '500' }}>المصاريف: </span>
                                <strong style={{ color: '#DC2626' }}>{activePoint.expenses.toLocaleString()} د.ع</strong>
                            </div>
                        </div>
                    </div>
                </div>

                {/* الأصناف المضافة حديثاً للمخزن */}
                <div className="modern-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', color: '#0F172A', marginBottom: '20px', fontWeight: '700' }}>الأصناف المضافة حديثاً للمخزن</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {recentPurchases.length === 0 ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: '#94A3B8', fontSize: '12px' }}>لا توجد أصناف مضافة مؤخراً بالمدى الحالي.</div>
                        ) : (
                            recentPurchases.map((purchase, index) => (
                                <div key={index} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: '#F8FAFC', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                                    <div>
                                        <h4 style={{ margin: 0, fontSize: '12px', color: '#0F172A', fontWeight: '600' }}>{purchase.title}</h4>
                                        <p style={{ margin: '3px 0 0 0', fontSize: '10px', color: '#64748B' }}>الكمية المضافة: {purchase.qty} قطع • {purchase.date}</p>
                                    </div>
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5" style={{ alignSelf: 'center' }}><polyline points="20 6 9 17 4 12"/></svg>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
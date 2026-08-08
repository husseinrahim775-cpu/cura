'use client';
import { useState, useEffect, useRef } from 'react'; 
import { createPortal } from 'react-dom'; 
import { db, auth } from '@/firebase'; 
import { collection, addDoc, getDocs, serverTimestamp, doc, getDoc, updateDoc, query, orderBy, writeBatch } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// ==================== عداد متحرك للأرقام المالية (Count-up Animation) ====================
function AnimatedNumber({ value, suffix = ' د.ع', duration = 700 }) {
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
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
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

export default function Patients() {
    // --- معرف الحساب الحالي المعزول ---
    const [userId, setUserId] = useState(null);

    // --- حالات إعدادات العيادة الديناميكية ---
    const [clinicName, setClinicName] = useState('  CURA.IQ');
    const [clinicAddress, setClinicAddress] = useState('بغداد - المنصور');
    const [clinicPhone1, setClinicPhone1] = useState('');
    const [clinicPhone2, setClinicPhone2] = useState('');
    const [clinicLogo, setClinicLogo] = useState('');

    // --- حماية الجلسة والتحقق من الصلاحيات والأمان + جلب إعدادات العيادة مباشرة ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = '/login';
            } else {
                setUserId(user.uid); // حفظ الآيدي الفريد للحساب لعزل الداتا بناءً عليه
                
                // جلب بيانات الإعدادات الخاصة بالعيادة مباشرة من وثيقة المستخدم
                try {
                    const userDocRef = doc(db, 'users', user.uid); 
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();
                        setClinicName(data.clinicName || 'CURA.IQ  ');
                        setClinicAddress(data.clinicAddress || 'بغداد - المنصور');
                        setClinicPhone1(data.clinicPhone1 || '');
                        setClinicPhone2(data.clinicPhone2 || '');
                        setClinicLogo(data.clinicLogo || ''); // يحتوي على نص الـ Base64 للشعار
                    }
                } catch (error) {
                    console.error("Error fetching clinic settings from user doc:", error);
                }
            }
        });
        return () => unsubscribe();
    }, []);

    // --- حالات البيانات الرئيسية ---
    const [patients, setPatients] = useState([]);
    const [storeItems, setStoreItems] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    // --- حالة فتح قائمة إضافة مريض منسدلة ---
    const [showAddPatientDropdown, setShowAddPatientDropdown] = useState(false);

    // --- حالة عرض وتعديل المريض المختار ---
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showNewVisitForm, setShowNewVisitForm] = useState(false);

    // --- حالات تعديل زيارة سابقة ---
    const [editingVisit, setEditingVisit] = useState(null); 
    const [editConsultationFee, setEditConsultationFee] = useState(0);

    // --- حالة عرض تفاصيل الفحص الطبي لكل زيارة سابقة ---
    const [expandedExamVisits, setExpandedExamVisits] = useState({});

    // --- حالة تعديل رقم هاتف المريض ---
    const [editingPhone, setEditingPhone] = useState(false);
    const [editPhoneValue, setEditPhoneValue] = useState('');

    // --- بيانات المريض الأساسية ---
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [age, setAge] = useState('');

    // --- تبويبات الفحص الفنية ---
    const [activeTab, setActiveTab] = useState('clinical'); // clinical or billing
    const [notes, setNotes] = useState('');

    // ==================== حقول الفحص والتشخيص المطلوبة ====================
    const [autorefractionOS, setAutorefractionOS] = useState({ sph: '', cyl: '', axis: '' });
    const [autorefractionOD, setAutorefractionOD] = useState({ sph: '', cyl: '', axis: '' });
    
    const [kReadingOS, setKReadingOS] = useState({ k1: '', axis1: '', k2: '', axis2: '' });
    const [kReadingOD, setKReadingOD] = useState({ k1: '', axis1: '', k2: '', axis2: '' });
    
    const [ucvaOS, setUcvaOS] = useState('');
    const [ucvaOD, setUcvaOD] = useState('');
    
    const [pinHoleOS, setPinHoleOS] = useState('');
    const [pinHoleOD, setPinHoleOD] = useState('');
    
    const [bcvaOS, setBcvaOS] = useState({ sph: '', cyl: '', axis: '' });
    const [bcvaOD, setBcvaOD] = useState({ sph: '', cyl: '', axis: '' });
    
    const [oldGlassesOS, setOldGlassesOS] = useState({ sph: '', cyl: '', axis: '' });
    const [oldGlassesOD, setOldGlassesOD] = useState({ sph: '', cyl: '', axis: '' });
    
    const [manifestRefractionOS, setManifestRefractionOS] = useState({ sph: '', cyl: '', axis: '' });
    const [manifestRefractionOD, setManifestRefractionOD] = useState({ sph: '', cyl: '', axis: '' });
    
    const [cycloplegicOS, setCycloplegicOS] = useState({ sph: '', cyl: '', axis: '' });
    const [cycloplegicOD, setCycloplegicOD] = useState({ sph: '', cyl: '', axis: '' });
    
    const [nearOS, setNearOS] = useState({ sph: '', cyl: '', axis: '' });
    const [nearOD, setNearOD] = useState({ sph: '', cyl: '', axis: '' });
    
    const [ipd, setIpd] = useState('');
    const [iopOS, setIopOS] = useState('');
    const [iopOD, setIopOD] = useState('');

    // --- حسابات المحاسبة وتجهيز النظارات ---
    const [lensType, setLensType] = useState('Single Vision');
    const [lensDetails, setLensDetails] = useState(''); 
    const [customLensPrice, setCustomLensPrice] = useState(0); 
    const [consultationFee, setConsultationFee] = useState(0);
    const [cart, setCart] = useState([]);
    const [selectedItemId, setSelectedItemId] = useState('');
    const [selectedQty, setSelectedQty] = useState(1);

    // --- حالات تذكير الفحص الدوري مالت الواتساب ---
    const [recallInterval, setRecallInterval] = useState('none'); 
    const [customRecallDate, setCustomRecallDate] = useState('');

    const sanitizeInput = (text) => {
        if (typeof text !== 'string') return '';
        return text.replace(/[<>'"/;`%]/g, '').trim();
    };

    const calculateNextRecallDate = () => {
        if (recallInterval === 'none') return '';
        const today = new Date();
        if (recallInterval === '3_months') {
            today.setMonth(today.getMonth() + 3);
            return today.toISOString().split('T')[0]; 
        }
        if (recallInterval === '6_months') {
            today.setMonth(today.getMonth() + 6);
            return today.toISOString().split('T')[0]; 
        }
        if (recallInterval === 'custom' && customRecallDate) {
            return sanitizeInput(customRecallDate);
        }
        return '';
    };

    const sendWhatsAppRecall = (patientName, patientPhone, recallDate) => {
        if (!patientPhone) return alert('خطأ: لا يوجد رقم هاتف مسجل للمريض!');
        
        let formattedPhone = patientPhone.trim().replace(/\s+/g, '');
        if (formattedPhone.startsWith('0')) {
            formattedPhone = '964' + formattedPhone.substring(1);
        } else if (!formattedPhone.startsWith('964') && formattedPhone.length === 10) {
            formattedPhone = '964' + formattedPhone;
        }

        const message = `مرحباً أستاذ/ة *${patientName}* المحترم/ة 🌹\n\nنود تذكيركم بموعد فحص العيون الدوري الخاص بكم لدى *${clinicName}* 👁️✨.\n\n📅 الموعد المحدد لفحصكم القادم: *${recallDate}*\n\nنتمنى لكم دوام الصحة والعافية وسعة النظر! يسعدنا تشريفكم بأي وقت للعيادة. ❤️`;
        
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
        
        window.open(whatsappUrl, '_blank');
    };

    // --- جلب البيانات المعزولة للحساب الحالي فقط ---
    const fetchData = async () => {
        if (!userId) return;
        try {
            const qP = query(collection(db, 'users', userId, 'patients'), orderBy('createdAt', 'desc'));
            const pSnapshot = await getDocs(qP);
            const pList = pSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setPatients(pList);

            const sSnapshot = await getDocs(collection(db, 'users', userId, 'store'));
            const sList = sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStoreItems(sList);
        } catch (error) {
            console.error("حدث خطأ في جلب البيانات المعزولة:", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [userId]);

    const resetVisitForm = () => {
        setNotes('');
        setAutorefractionOS({ sph: '', cyl: '', axis: '' }); setAutorefractionOD({ sph: '', cyl: '', axis: '' });
        setKReadingOS({ k1: '', axis1: '', k2: '', axis2: '' }); setKReadingOD({ k1: '', axis1: '', k2: '', axis2: '' });
        setUcvaOS(''); setUcvaOD('');
        setPinHoleOS(''); setPinHoleOD('');
        setBcvaOS({ sph: '', cyl: '', axis: '' }); setBcvaOD({ sph: '', cyl: '', axis: '' });
        setOldGlassesOS({ sph: '', cyl: '', axis: '' }); setOldGlassesOD({ sph: '', cyl: '', axis: '' });
        setManifestRefractionOS({ sph: '', cyl: '', axis: '' }); setManifestRefractionOD({ sph: '', cyl: '', axis: '' });
        setCycloplegicOS({ sph: '', cyl: '', axis: '' }); setCycloplegicOD({ sph: '', cyl: '', axis: '' });
        setNearOS({ sph: '', cyl: '', axis: '' }); setNearOD({ sph: '', cyl: '', axis: '' });
        setIpd('');
        setIopOS(''); setIopOD('');
        setLensType('Single Vision');
        setLensDetails(''); 
        setCustomLensPrice(0); 
        setConsultationFee(0);
        setCart([]);
        setSelectedItemId('');
        setSelectedQty(1);
        setRecallInterval('none');
        setCustomRecallDate('');
    };

    const addToCart = () => {
        if (!selectedItemId) return;
        const item = storeItems.find(i => i.id === selectedItemId);
        if (!item) return;

        const currentStock = Number(item.currentStock) || 0;
        if (currentStock < selectedQty) {
            alert(`الكمية المطلوبة غير كافية! المتوفر في المخزن هو: ${currentStock}`);
            return;
        }

        const sellPrice = Number(item.sellingPrice) || 0;
        const wholesalePrice = Number(item.wholesalePrice) || 0;

        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + (Number(selectedQty) || 1) } : c));
        } else {
            setCart([...cart, { 
                id: item.id, 
                itemName: item.itemName, 
                price: sellPrice, 
                wholesalePrice: wholesalePrice, 
                qty: Number(selectedQty) || 1 
            }]);
        }
        setSelectedItemId('');
        setSelectedQty(1);
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(c => c.id !== id));
    };

    const calculateCartTotal = () => {
        return cart.reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
    };
    
    const totalInvoiceAmount = (Number(consultationFee) || 0) + calculateCartTotal() + (Number(customLensPrice) || 0);

    const compileVisitData = () => {
       const todayStr = new Date().toLocaleDateString('en-US');
       const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
       const calculatedRecallDate = calculateNextRecallDate();

        return {
            visitId: 'v_' + Date.now(),
            date: todayStr,
            time: timeStr,
            notes: sanitizeInput(notes),
            autorefractionOS, autorefractionOD,
            kReadingOS, kReadingOD,
            ucvaOS: sanitizeInput(ucvaOS), ucvaOD: sanitizeInput(ucvaOD),
            pinHoleOS: sanitizeInput(pinHoleOS), pinHoleOD: sanitizeInput(pinHoleOD),
            bcvaOS, bcvaOD,
            oldGlassesOS, oldGlassesOD,
            manifestRefractionOS, manifestRefractionOD,
            cycloplegicOS, cycloplegicOD,
            nearOS, nearOD,
            ipd: sanitizeInput(ipd),
            iopOS: sanitizeInput(iopOS), iopOD: sanitizeInput(iopOD),
            lensType: sanitizeInput(lensType),
            lensDetails: sanitizeInput(lensDetails), 
            customLensPrice: Number(customLensPrice) || 0, 
            consultationFee: Number(consultationFee) || 0,
            cart,
            totalPaid: Number(totalInvoiceAmount) || 0,
            recallInterval: recallInterval,
            nextRecallDate: calculatedRecallDate
        };
    };

    const handleCreateNewPatient = async (e) => {
        e.preventDefault();
        if (!userId) return alert('خطأ في الصلاحيات، الحساب غير مسجل حالياً.');
        const trimmedName = sanitizeInput(name);
        const trimmedPhone = phone.trim();

        if (!trimmedName || !trimmedPhone) return alert('الرجاء كتابة اسم المريض ورقم هاتفه!');
        if (trimmedName.length < 3) return alert('الرجاء إدخال اسم المريض كاملاً (3 أحرف على الأقل).');
        if (!/^\d{7,15}$/.test(trimmedPhone)) return alert('رقم الهاتف غير صحيح! يجب أن يحتوي على أرقام فقط (7 إلى 15 رقماً).');

        const duplicatePatient = patients.find(p => (p.phone || '').replace(/\s/g, '') === trimmedPhone);
        if (duplicatePatient) {
            return alert(`⚠️ رقم الهاتف هذا مسجل مسبقاً للمريض: ${duplicatePatient.name}\nالرجاء التأكد من الرقم، أو ابحث عن المريض وافتح ملفه بدل تسجيله من جديد.`);
        }

        setLoading(true);

        try {
            const firstVisit = compileVisitData();
            const patientData = {
                name: trimmedName,
                phone: trimmedPhone,
                age: age ? (Number(age) || '') : '', 
                visits: [firstVisit],
                createdAt: serverTimestamp(),
                date: firstVisit.date,
                time: firstVisit.time,
                paid: Number(totalInvoiceAmount) || 0, 
                status: cart.length > 0 ? 'مبيعات وفحص كامل' : 'فحص سريري تخصصي',
                recallInterval: recallInterval,
                nextRecallDate: firstVisit.nextRecallDate
            };

            await addDoc(collection(db, 'users', userId, 'patients'), patientData);
            await processStockDeductions(cart, trimmedName, firstVisit.date);

            alert('تم حفظ كارت المريض الجديد بجميع قياسات الفحص بنجاح!');
            setName(''); setPhone(''); setAge('');
            resetVisitForm();
            setShowAddPatientDropdown(false);
            fetchData();
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء المزامنة وحفظ المريض.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddNewVisit = async (e) => {
        e.preventDefault();
        if (!selectedPatient || !userId) return;
        setLoading(true);

        try {
            const newVisit = compileVisitData();
            const updatedVisits = [newVisit, ...(selectedPatient.visits || [])];
            
            const oldPaidAccumulated = Number(selectedPatient.paid) || 0;
            const finalCumulativePaid = oldPaidAccumulated + totalInvoiceAmount;

            const patientRef = doc(db, 'users', userId, 'patients', selectedPatient.id);

            await updateDoc(patientRef, {
                visits: updatedVisits,
                date: newVisit.date,
                time: newVisit.time,
                paid: Number(finalCumulativePaid) || 0, 
                status: (cart.length > 0 || customLensPrice > 0) ? 'شراء نظارة ومراجعة جديدة' : 'مراجعة دورية',
                recallInterval: recallInterval,
                nextRecallDate: newVisit.nextRecallDate
            });

            await processStockDeductions(cart, selectedPatient.name, newVisit.date);

            alert('تم تجديد الزيارة وتحديث الأرشيف التراكمي للمريض بنجاح!');
            
            const updatedPatientObj = { 
                ...selectedPatient, 
                visits: updatedVisits,
                paid: Number(finalCumulativePaid) || 0,
                nextRecallDate: newVisit.nextRecallDate
            };
            setSelectedPatient(updatedPatientObj);
            setShowNewVisitForm(false);
            resetVisitForm();
            fetchData();
        } catch (error) {
            console.error(error);
            alert('فشل في إضافة الزيارة الجديدة.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteVisit = async (visitToDelete) => {
        if (!userId) return;
        if (!window.confirm("هل أنت متأكد من رغبتك بحذف هذه الزيارة بالكامل؟ سيتم إرجاع أي منتجات مباعة فيها للمخزن تلقائياً.")) return;
        setLoading(true);

        try {
            const visitCart = visitToDelete.cart || [];
            const batch = writeBatch(db);

            for (const item of visitCart) {
                const itemDocRef = doc(db, 'users', userId, 'store', item.id);
                const currentStoreItem = storeItems.find(i => i.id === item.id);
                if (currentStoreItem) {
                    const restoredStock = (Number(currentStoreItem.currentStock) || 0) + (Number(item.qty) || 0);
                    batch.update(itemDocRef, { currentStock: restoredStock });
                }

                const movementRef = doc(collection(db, 'users', userId, 'store_movements'));
                batch.set(movementRef, {
                    itemId: item.id,
                    itemName: item.itemName,
                    type: 'مسترجع', 
                    qty: Number(item.qty) || 0,
                    price: Number(item.price) || 0,
                    wholesalePrice: Number(item.wholesalePrice) || 0,
                    date: new Date().toISOString().split('T')[0],
                    details: `مسترجع بسبب حذف زيارة المريض: ${selectedPatient.name}`, 
                    createdAt: serverTimestamp()
                });
            }

            const remainingVisits = selectedPatient.visits.filter(v => v.visitId !== visitToDelete.visitId);
            const newCumulativePaid = remainingVisits.reduce((sum, v) => sum + (Number(v.totalPaid) || 0), 0);
            
            const patientRef = doc(db, 'users', userId, 'patients', selectedPatient.id);
            batch.update(patientRef, {
                visits: remainingVisits,
                paid: Number(newCumulativePaid) || 0
            });

            await batch.commit();

            alert("تم حذف الزيارة، إرجاع القطعة للمخزن، وتحديث الحسابات بنجاح!");
            
            const updatedPatientObj = { 
                ...selectedPatient, 
                visits: remainingVisits,
                paid: Number(newCumulativePaid) || 0
            };
            setSelectedPatient(updatedPatientObj);
            fetchData();
        } catch (error) {
            console.error("خطأ في حذف الزيارة:", error);
            alert("حدث خطأ أثناء محاولة حذف الزيارة.");
        } finally {
            setLoading(false);
        }
    };

    const handleSaveEditVisit = async (e) => {
        e.preventDefault();
        if (!editingVisit || !userId) return;
        setLoading(true);

        try {
            const currentCartTotal = (editingVisit.cart || []).reduce((sum, item) => sum + ((Number(item.price) || 0) * (Number(item.qty) || 0)), 0);
            const currentCustomPrice = Number(editingVisit.customLensPrice) || 0;
            const validConsultationFee = Number(editConsultationFee) || 0;
            
            const newVisitValue = validConsultationFee + currentCartTotal + currentCustomPrice;
            
            const updatedVisits = selectedPatient.visits.map(v => {
                if (v.visitId === editingVisit.visitId) {
                    return {
                        ...v,
                        consultationFee: validConsultationFee,
                        totalPaid: Number(newVisitValue) || 0
                    };
                }
                return v;
            });

            const newCumulativePaid = updatedVisits.reduce((sum, v) => sum + (Number(v.totalPaid) || 0), 0);

            const patientRef = doc(db, 'users', userId, 'patients', selectedPatient.id);
            await updateDoc(patientRef, {
                visits: updatedVisits,
                paid: Number(newCumulativePaid) || 0
            });

            alert("تم تعديل الكشفية وتحديث الحسابات والداشبورد فوراً!");
            setSelectedPatient({
                ...selectedPatient,
                visits: updatedVisits,
                paid: Number(newCumulativePaid) || 0
            });
            setEditingVisit(null);
            fetchData();
        } catch (error) {
            console.error("خطأ أثناء تعديل الزيارة:", error);
            alert("فشل في تعديل بيانات الزيارة.");
        } finally {
            setLoading(false);
        }
    };

    const processStockDeductions = async (itemsCart, patientName, todayStr) => {
        if (!userId) return;
        for (const cartItem of itemsCart) {
            const storeItemRef = doc(db, 'users', userId, 'store', cartItem.id);
            const originalItem = storeItems.find(i => i.id === cartItem.id);
            if (originalItem) {
                const newStock = (Number(originalItem.currentStock) || 0) - (Number(cartItem.qty) || 0);
                await updateDoc(storeItemRef, { currentStock: newStock });

                await addDoc(collection(db, 'users', userId, 'store_movements'), {
                    itemId: cartItem.id,
                    itemName: cartItem.itemName,
                    type: 'صادر',
                    qty: Number(cartItem.qty) || 0,
                    price: Number(cartItem.price) || 0,
                    wholesalePrice: Number(cartItem.wholesalePrice) || 0,
                    date: todayStr,
                    note: `فحوصات ومبيعات المريض: ${patientName}`,
                    createdAt: serverTimestamp()
                });
            }
        }
    };

    const handleUpdatePatientPhone = async () => {
        if (!userId) return;
        const trimmedPhone = editPhoneValue.trim();
        if (!/^\d{7,15}$/.test(trimmedPhone)) {
            return alert('رقم الهاتف غير صحيح! يجب أن يحتوي على أرقام فقط (7 إلى 15 رقماً).');
        }
        const duplicate = patients.find(p => p.id !== selectedPatient.id && (p.phone || '').replace(/\s/g, '') === trimmedPhone);
        if (duplicate) {
            return alert(`⚠️ هذا الرقم مستخدم مسبقاً لمريض آخر: ${duplicate.name}`);
        }

        setLoading(true);
        try {
            const patientRef = doc(db, 'users', userId, 'patients', selectedPatient.id);
            await updateDoc(patientRef, { phone: trimmedPhone });
            setSelectedPatient({ ...selectedPatient, phone: trimmedPhone });
            setEditingPhone(false);
            alert('✅ تم تحديث رقم هاتف المريض بنجاح، وكل سجل زياراته وفحوصاته السابقة محفوظ بدون أي تغيير.');
            fetchData();
        } catch (error) {
            console.error("خطأ في تحديث رقم الهاتف:", error);
            alert('حدث خطأ أثناء تحديث رقم الهاتف.');
        } finally {
            setLoading(false);
        }
    };

    const filteredPatients = patients.filter(p => 
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        p.phone?.includes(searchQuery)
    );

    const formatRefraction = (val) => {
        if (!val) return '---';
        if (typeof val === 'object') {
            return `Axis: ${val.axis || '0'} | CYL: ${val.cyl || '0'} | SPH: ${val.sph || '0'}`;
        }
        return val;
    };

    const formatKReading = (val) => {
        if (!val) return '---';
        if (typeof val === 'object') {
            return `K1: ${val.k1 || '---'} / Axis1: ${val.axis1 || '---'} | K2: ${val.k2 || '---'} / Axis2: ${val.axis2 || '---'}`;
        }
        return val;
    };

    const toggleExamDetails = (key) => {
        setExpandedExamVisits(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handlePrintPrescription = (patient, visit) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 20px; color: #0f172a; line-height: 1.6; }
                    .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #0284c7; padding-bottom: 10px; margin-bottom: 20px; }
                    .clinic-title { font-size: 24px; font-weight: bold; color: #0284c7; margin: 0; }
                    .logo-img { max-width: 100px; max-height: 100px; object-fit: contain; }
                    .patient-card { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 20px; display: grid; grid-template-columns: 1fr 1fr; gap: 15px; font-size: 13px; }
                    .section-header { font-size: 15px; font-weight: bold; color: #0284c7; border-right: 4px solid #0284c7; padding-right: 8px; margin-top: 20px; margin-bottom: 10px; }
                    table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 12px; text-align: center; }
                    th, td { border: 1px solid #cbd5e1; padding: 8px; }
                    th { background-color: #f1f5f9; font-weight: bold; }
                    .highlight-row { background-color: #fefbeb; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header-container">
                    <div>
                        <p class="clinic-title">${clinicName}</p>
                        <p style="margin: 5px 0; color: #475569;">${clinicAddress}</p>
                        <p style="margin: 0; color: #64748b; font-size: 14px;">الهاتف: ${clinicPhone1} ${clinicPhone2 ? ` - ${clinicPhone2}` : ''}</p>
                    </div>
                    ${clinicLogo ? `<div><img src="${clinicLogo}" class="logo-img" alt="Logo"/></div>` : ''}
                </div>
                <div class="patient-card">
                    <div><strong>اسم المريض:</strong> ${patient.name}</div>
                    <div><strong>رقم الهاتف:</strong> ${patient.phone}</div>
                    <div><strong>العمر:</strong> ${patient.age || '---'} سنة</div>
                    <div><strong>تاريخ وتوقيت الزيارة:</strong> ${visit.date} • ${visit.time}</div>
                </div>
                <div class="section-header">🔍 القياسات والفحوصات الطبية المعتمدة</div>
                <table>
                    <thead>
                        <tr>
                            <th>الفحص المطلوب (Test)</th>
                            <th style="background-color: #e8f5e9;">العين اليسرى (OS)</th>
                            <th style="background-color: #e1f5fe;">العين اليمنى (OD)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Autorefraction</td><td>${formatRefraction(visit.autorefractionOS)}</td><td>${formatRefraction(visit.autorefractionOD)}</td></tr>
                        <tr><td>K Reading</td><td>${formatKReading(visit.kReadingOS)}</td><td>${formatKReading(visit.kReadingOD)}</td></tr>
                        <tr><td>UCVA</td><td>${visit.ucvaOS || '---'}</td><td>${visit.ucvaOD || '---'}</td></tr>
                        <tr><td>Pin Hole</td><td>${visit.pinHoleOS || '---'}</td><td>${visit.pinHoleOD || '---'}</td></tr>
                        <tr><td>BCVA</td><td>${formatRefraction(visit.bcvaOS)}</td><td>${formatRefraction(visit.bcvaOD)}</td></tr>
                        <tr class="highlight-row"><td><strong>Old Glasses</strong></td><td><strong>${formatRefraction(visit.oldGlassesOS)}</strong></td><td><strong>${formatRefraction(visit.oldGlassesOD)}</strong></td></tr>
                        <tr><td>Manifest Refraction</td><td>${formatRefraction(visit.manifestRefractionOS)}</td><td>${formatRefraction(visit.manifestRefractionOD)}</td></tr>
                        <tr><td>Cycloplegic</td><td>${formatRefraction(visit.cycloplegicOS)}</td><td>${formatRefraction(visit.cycloplegicOD)}</td></tr>
                        <tr><td>Near</td><td>${formatRefraction(visit.nearOS)}</td><td>${formatRefraction(visit.nearOD)}</td></tr>
                        <tr><td>IOP Pressure</td><td>${visit.iopOS || '---'}</td><td>${visit.iopOD || '---'}</td></tr>
                        <tr><td>IPD</td><td colspan="2">${visit.ipd || '---'} mm</td></tr>
                    </tbody>
                </table>
                ${visit.notes ? `<div class="section-header">ملاحظات إضافية</div><p style="font-size: 13px; background:#fafafa; padding:10px; border-radius:5px;">${visit.notes}</p>` : ''}
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const handlePrintInvoice = (patient, visit) => {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
            <head>
                <title>فاتورة ووصل صرف - ${patient.name}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    body { font-family: 'Cairo', sans-serif; direction: rtl; padding: 25px; max-width: 400px; margin: auto; border: 1px solid #e2e8f0; }
                    .header-container { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px dashed #cbd5e1; padding-bottom: 10px; margin-bottom: 15px; }
                    .clinic-title { font-size: 16px; font-weight: bold; color: #0284c7; margin: 0; }
                    .logo-img { max-width: 60px; max-height: 60px; object-fit: contain; }
                    table { width: 100%; border-collapse: collapse; font-size: 12px; }
                    th, td { border-bottom: 1px solid #f1f5f9; padding: 8px 4px; text-align: right; }
                </style>
            </head>
            <body onload="window.print()">
                <div class="header-container">
                    <div>
                        <h3 class="clinic-title">وصل تجهيز مبيعات ونظارات</h3>
                        <p style="font-size:11px; margin:5px 0 0 0; color:#64748b;">${clinicName}</p>
                        <p style="font-size:10px; margin:2px 0 0 0; color:#64748b;">${clinicAddress}</p>
                    </div>
                    ${clinicLogo ? `<div><img src="${clinicLogo}" class="logo-img" alt="Logo"/></div>` : ''}
                </div>
                <p style="font-size: 12px;"><strong>المريض:</strong> ${patient.name}</p>
                <p style="font-size: 12px;"><strong>التاريخ:</strong> ${visit.date} - ${visit.time}</p>
                <table>
                    <thead>
                        <tr><th>الصنف/الخدمة</th><th>الكمية</th><th>السعر</th></tr>
                    </thead>
                    <tbody>
                        ${Number(visit.consultationFee || 0) > 0 ? `<tr><td>كشفية وفحص عيون شامل</td><td>1</td><td>${Number(visit.consultationFee).toLocaleString()} د.ع</td></tr>` : ''}
                        ${visit.lensType ? `<tr><td>نوع العدسة: ${visit.lensType} ${visit.lensDetails ? `(${visit.lensDetails})` : ''}</td><td>1</td><td>${Number(visit.customLensPrice || 0).toLocaleString()} د.ع</td></tr>` : ''}
                        ${(visit.cart || []).map(item => `<tr><td>${item.itemName}</td><td>${item.qty}</td><td>${(item.price * item.qty).toLocaleString()} د.ع</td></tr>`).join('')}
                    </tbody>
                </table>
                <h4 style="margin-top:20px; text-align:left; color:#10b981;">الإجمالي الكلي المسدد: ${Number(visit.totalPaid || 0).toLocaleString()} د.ع</h4>
            </body>
            </html>
        `);
        printWindow.document.close();
    };

    const isPhoneFormatValid = phone.trim() === '' || /^\d{7,15}$/.test(phone.trim());
    const duplicatePhonePatient = phone.trim() ? patients.find(p => (p.phone || '').replace(/\s/g, '') === phone.trim()) : null;
    const isEditPhoneFormatValid = editPhoneValue.trim() === '' || /^\d{7,15}$/.test(editPhoneValue.trim());
    const editPhoneDuplicate = (editPhoneValue.trim() && selectedPatient) ? patients.find(p => p.id !== selectedPatient.id && (p.phone || '').replace(/\s/g, '') === editPhoneValue.trim()) : null;

    return (
        <div style={{ 
            padding: '4vw 3vw', 
            backgroundColor: '#F8FAFC', 
            backgroundImage: 'radial-gradient(circle at 15% 15%, rgba(2, 132, 199, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 75%, rgba(14, 165, 233, 0.05) 0%, transparent 50%), radial-gradient(circle at 50% 50%, rgba(248, 250, 252, 1) 0%, rgba(241, 245, 249, 1) 100%)',
            backgroundAttachment: 'fixed',
            fontFamily: "'Exo 2', 'Cairo', sans-serif", 
            direction: 'rtl', 
            minHeight: '100vh', 
            color: '#1E293B', 
            boxSizing: 'border-box', 
            width: '100%', 
            maxWidth: '100vw', 
            overflowX: 'hidden' 
        }}>
            
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
            <style>{`
                .modern-card {
                    background: #FFFFFF !important;
                    backdrop-filter: blur(20px) saturate(160%);
                    -webkit-backdrop-filter: blur(20px) saturate(160%);
                    border: 1px solid #E2E8F0 !important;
                    border-radius: 24px !important;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.03), 0 1px 3px rgba(0, 0, 0, 0.05);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .modern-card:hover {
                    transform: translateY(-3px);
                    border-color: #CBD5E1 !important;
                    background: #FFFFFF !important;
                    box-shadow: 0 20px 35px rgba(2, 132, 199, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04);
                }
                table th {
                    background-color: #F8FAFC !important;
                    color: #475569 !important;
                    font-weight: 700;
                    border-bottom: 2px solid #E2E8F0 !important;
                }
                .table-responsive-wrapper {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .custom-input-dark {
                    width: 100%;
                    padding: 10px 14px;
                    border-radius: 12px;
                    border: 1px solid #CBD5E1;
                    font-size: 13px;
                    outline: none;
                    color: #0F172A;
                    background: #FFFFFF;
                    transition: all 0.3s;
                }
                .custom-input-dark:focus {
                    border-color: #0284C7;
                    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
                }
                .patients-mobile-cards {
                    display: none;
                }
                @media (max-width: 768px) {
                    .top-bar {
                        flex-direction: column !important;
                        align-items: flex-start !important;
                        gap: 12px !important;
                        padding: 12px 14px !important;
                        border-radius: 18px !important;
                        margin-bottom: 16px !important;
                    }
                    .patient-grid {
                        grid-template-columns: 1fr !important;
                        gap: 16px !important;
                    }
                    .clinical-row {
                        flex-direction: column !important;
                        align-items: stretch !important;
                        gap: 8px !important;
                    }
                    .clinical-row > span {
                        flex: none !important;
                        width: 100% !important;
                        margin-right: 0 !important;
                    }
                    .clinical-row > div {
                        flex: none !important;
                        width: 100% !important;
                    }
                    .visit-header-actions {
                        width: 100% !important;
                        justify-content: flex-start !important;
                        margin-top: 8px !important;
                        gap: 6px !important;
                    }
                    .table-responsive-wrapper {
                        display: none !important;
                    }
                    .patients-mobile-cards {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr);
                        gap: 10px;
                    }
                    .patient-mobile-card {
                        background: #FFFFFF;
                        border: 1px solid #E2E8F0;
                        border-radius: 14px;
                        padding: 12px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        box-sizing: border-box;
                        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
                    }
                    .patient-mobile-card h4 {
                        font-size: 13px;
                        font-weight: 700;
                        color: #0F172A;
                        margin: 0 0 4px 0;
                        line-height: 1.2;
                        word-break: break-word;
                    }
                    .patient-mobile-card p {
                        margin: 2px 0;
                        font-size: 11px;
                        color: #64748B;
                    }
                    .patient-mobile-card .phone-num {
                        color: #0284C7;
                        font-weight: 600;
                    }
                    .patient-mobile-card .status-badge {
                        background: #F1F5F9;
                        border: 1px solid #E2E8F0;
                        color: #334155;
                        padding: 2px 6px;
                        border-radius: 6px;
                        font-size: 10px;
                        display: inline-block;
                        margin-top: 4px;
                    }
                    .patient-mobile-card button {
                        margin-top: 8px;
                        padding: 6px;
                        font-size: 11px;
                        width: 100%;
                        justify-content: center;
                    }
                }
                @media (max-width: 380px) {
                    .patients-mobile-cards {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>

<div className="top-bar flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white/90 backdrop-blur-xl p-5 md:px-6 md:py-4 rounded-3xl shadow-lg border border-slate-200">                <div>
                    <h1 className="text-xl md:text-2xl font-black text-slate-900 flex items-center gap-3">
                        <i className="fa-solid fa-file-waveform text-[#0284C7]"></i> 
                        أرشيف وسجلات {clinicName}
                    </h1>
                    <p className="text-xs md:text-sm text-slate-500 mt-1 font-medium">
                        ✨ نظام إدارة وفحوصات المرضى الموحد والمؤمن بالكامل
                    </p>
                </div>
                
                <div className="flex items-center gap-3 w-full md:w-auto justify-content-end">
                    {!selectedPatient && (
                        <div className="w-full md:w-auto">
                            <button 
                                onClick={() => { setShowAddPatientDropdown(true); resetVisitForm(); }} 
                                className="w-full md:w-auto flex items-center justify-center gap-2 bg-[#0284C7] text-white px-5 py-3 rounded-2xl border border-[#0284C7] hover:bg-[#0369A1] cursor-pointer text-sm font-bold shadow-[0_4px_14px_rgba(2,132,199,0.25)] transition-all"
                            >
                                <i className="fa-solid fa-user-plus text-white"></i>
                                <span>فتح سجل مريض جديد</span>
                                <i className="fa-solid fa-chevron-down text-[11px] mr-1"></i>
                            </button>

                            {showAddPatientDropdown && createPortal(
                                <>
                                    <div 
                                        onClick={() => setShowAddPatientDropdown(false)}
                                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity duration-300 z-[1000] opacity-100 visible"
                                    />

                                    <div 
                                        className="fixed top-0 left-0 bottom-0 bg-white p-4 md:p-6 border-r border-slate-200 shadow-2xl w-full max-w-[1100px] z-[1050] h-screen overflow-y-auto rounded-r-3xl transition-all duration-320 ease-out translate-x-0 opacity-100 visible"
                                    >
                                        <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
                                            <h3 className="text-lg md:text-xl font-extrabold text-slate-900 flex items-center gap-2">
                                                <i className="fa-solid fa-address-card text-[#0284C7]"></i>
                                                استمارة فتح ملف طبي جديد
                                            </h3>
                                            <button 
                                                type="button" 
                                                onClick={() => setShowAddPatientDropdown(false)} 
                                                className="bg-slate-100 hover:bg-slate-200 border-none w-8 h-8 rounded-lg cursor-pointer text-slate-600 flex items-center justify-center text-sm transition-colors"
                                            >
                                                <i className="fa-solid fa-xmark"></i>
                                            </button>
                                        </div>

                                        <form onSubmit={handleCreateNewPatient} className="flex flex-col gap-5">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-2">اسم المريض الثلاثي *</label>
                                                    <input 
                                                        type="text" 
                                                        required 
                                                        value={name} 
                                                        onChange={e => setName(e.target.value)} 
                                                        className="custom-input-dark" 
                                                    />
                                                </div>
                                                
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-2">رقم الموبايل الفعال *</label>
                                                    <input 
                                                        type="text" 
                                                        required 
                                                        value={phone} 
                                                        onChange={e => setPhone(e.target.value)} 
                                                        className={`custom-input-dark ${
                                                            (duplicatePhonePatient || !isPhoneFormatValid) 
                                                            ? 'border-rose-500 bg-rose-50 focus:border-rose-500' 
                                                            : ''
                                                        }`}
                                                    />
                                                    {!isPhoneFormatValid && (
                                                        <span className="block text-rose-600 text-[11px] mt-1.5 font-semibold">
                                                            ⚠️ الرقم يجب أن يحتوي على أرقام فقط (7 إلى 15 رقماً).
                                                        </span>
                                                    )}
                                                    {isPhoneFormatValid && duplicatePhonePatient && (
                                                        <span className="block text-rose-600 text-[11px] mt-1.5 font-semibold">
                                                            ⚠️ هذا الرقم مسجل مسبقاً للمريض: {duplicatePhonePatient.name}
                                                        </span>
                                                    )}
                                                </div>

                                                <div>
                                                    <label className="block text-xs font-bold text-slate-600 mb-2">العمر</label>
                                                    <input 
                                                        type="number" 
                                                        value={age} 
                                                        onChange={e => setAge(e.target.value)} 
                                                        className="custom-input-dark" 
                                                    />
                                                </div>
                                            </div>

                                            <div className="flex gap-3 mt-3 flex-wrap">
                                                <button 
                                                    type="button" 
                                                    onClick={() => setActiveTab('clinical')} 
                                                    className={`flex-1 min-w-[160px] p-3 text-xs md:text-sm rounded-xl font-bold cursor-pointer flex items-center justify-center gap-2 transition-all border ${
                                                        activeTab === 'clinical' 
                                                        ? 'bg-[#0284C7] text-white border-transparent shadow-md shadow-[#0284C7]/20' 
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <i className="fa-solid fa-stethoscope"></i> 
                                                    الفحوصات والقياسات الطبية
                                                </button>
                                                
                                                <button 
                                                    type="button" 
                                                    onClick={() => setActiveTab('billing')} 
                                                    className={`flex-1 min-w-[160px] p-3 text-xs md:text-sm rounded-xl font-bold cursor-pointer flex items-center justify-center gap-2 transition-all border ${
                                                        activeTab === 'billing' 
                                                        ? 'bg-[#0284C7] text-white border-transparent shadow-md shadow-[#0284C7]/20' 
                                                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                >
                                                    <i className="fa-solid fa-calculator"></i> 
                                                    الحسابات وتجهيز النظارات
                                                </button>
                                            </div>

                                            {activeTab === 'clinical' ? (
                                                <ClinicalFieldsForm
                                                    autorefractionOS={autorefractionOS} setAutorefractionOS={setAutorefractionOS}
                                                    autorefractionOD={autorefractionOD} setAutorefractionOD={setAutorefractionOD}
                                                    kReadingOS={kReadingOS} setKReadingOS={setKReadingOS}
                                                    kReadingOD={kReadingOD} setKReadingOD={setKReadingOD}
                                                    ucvaOS={ucvaOS} setUcvaOS={setUcvaOS}
                                                    ucvaOD={ucvaOD} setUcvaOD={setUcvaOD}
                                                    pinHoleOS={pinHoleOS} setPinHoleOS={setPinHoleOS}
                                                    pinHoleOD={pinHoleOD} setPinHoleOD={setPinHoleOD}
                                                    bcvaOS={bcvaOS} setBcvaOS={setBcvaOS}
                                                    bcvaOD={bcvaOD} setBcvaOD={setBcvaOD}
                                                    oldGlassesOS={oldGlassesOS} setOldGlassesOS={setOldGlassesOS}
                                                    oldGlassesOD={oldGlassesOD} setOldGlassesOD={setOldGlassesOD}
                                                    manifestRefractionOS={manifestRefractionOS} setManifestRefractionOS={setManifestRefractionOS}
                                                    manifestRefractionOD={manifestRefractionOD} setManifestRefractionOD={setManifestRefractionOD}
                                                    cycloplegicOS={cycloplegicOS} setCycloplegicOS={setCycloplegicOS}
                                                    cycloplegicOD={cycloplegicOD} setCycloplegicOD={setCycloplegicOD}
                                                    nearOS={nearOS} setNearOS={setNearOS}
                                                    nearOD={nearOD} setNearOD={setNearOD}
                                                    ipd={ipd} setIpd={setIpd}
                                                    iopOS={iopOS} setIopOS={setIopOS}
                                                    iopOD={iopOD} setIopOD={setIopOD}
                                                    notes={notes} setNotes={setNotes}
                                                    recallInterval={recallInterval} setRecallInterval={setRecallInterval}
                                                    customRecallDate={customRecallDate} setCustomRecallDate={setCustomRecallDate}
                                                />
                                            ) : (
                                                <BillingFieldsForm 
                                                    lensType={lensType} setLensType={setLensType} 
                                                    lensDetails={lensDetails} setLensDetails={setLensDetails}
                                                    customLensPrice={customLensPrice} setCustomLensPrice={setCustomLensPrice}
                                                    consultationFee={consultationFee} setConsultationFee={setConsultationFee}
                                                    storeItems={storeItems} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId}
                                                    selectedQty={selectedQty} setSelectedQty={setSelectedQty} addToCart={addToCart} cart={cart} removeFromCart={removeFromCart} totalInvoiceAmount={totalInvoiceAmount}
                                                />
                                            )}

                                            <button 
                                                type="submit" 
                                                disabled={loading || !isPhoneFormatValid || !!duplicatePhonePatient} 
                                                style={{ 
                                                    background: (!isPhoneFormatValid || duplicatePhonePatient) ? '#E2E8F0' : '#10B981', 
                                                    color: (!isPhoneFormatValid || duplicatePhonePatient) ? '#94A3B8' : '#FFFFFF', 
                                                    border: 'none', 
                                                    padding: '14px', 
                                                    borderRadius: '16px', 
                                                    fontWeight: 'bold', 
                                                    fontSize: '14px', 
                                                    cursor: (!isPhoneFormatValid || duplicatePhonePatient) ? 'not-allowed' : 'pointer', 
                                                    marginTop: '10px', 
                                                    marginBottom: '100px', // 👈 أضفنا هذه الميزة هنا لإعطاء هامش سفلي
                                                    display: 'flex', 
                                                    alignItems: 'center', 
                                                    justifyContent: 'center', 
                                                    gap: '8px', 
                                                    boxShadow: (!isPhoneFormatValid || duplicatePhonePatient) ? 'none' : '0 4px 14px rgba(16, 185, 129, 0.25)', 
                                                    width: '100%' 
                                                }}
                                            >
                                                <i className="fa-solid fa-cloud-arrow-up"></i>
                                                {loading ? 'جاري الحفظ والتشفير...' : 'اعتماد وحفظ ملف المريض الفوري'}
                                            </button>
                                        </form>
                                    </div>
                                </>,
                                document.body
                            )}
                        </div>
                    )}

                    {selectedPatient && (
                        <button onClick={() => { setSelectedPatient(null); setShowNewVisitForm(false); setEditingVisit(null); setEditingPhone(false); resetVisitForm(); }} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1', padding: '10px 18px', borderRadius: '12px', cursor: 'pointer', fontWeight: '700', fontSize: '13px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}>
                            <i className="fa-solid fa-right-to-bracket"></i> العودة لقائمة البحث
                        </button>
                    )}
                </div>
            </div>

            {editingVisit && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(15, 23, 42, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '15px', backdropFilter: 'blur(5px)' }}>
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '25px', borderRadius: '24px', width: '420px', maxWidth: '100%', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '700', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-pen-to-square" style={{ color: '#0284C7' }}></i> تعديل كشفية زيارة بتاريخ {editingVisit.date}
                        </h3>
                        <form onSubmit={handleSaveEditVisit}>
                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '13px', marginBottom: '6px', color: '#475569', fontWeight: '600' }}>سعر الكشفية المعدل (د.ع):</label>
                                <input type="number" value={editConsultationFee} onChange={(e) => setEditConsultationFee(Number(e.target.value) || 0)} className="custom-input-dark" />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="submit" style={{ flex: 1, background: '#10B981', color: '#FFFFFF', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 2px 8px rgba(16,185,129,0.25)' }}>حفظ التعديل</button>
                                <button type="button" onClick={() => setEditingVisit(null)} style={{ flex: 1, background: '#EF4444', color: 'white', border: 'none', padding: '10px', borderRadius: '12px', cursor: 'pointer', fontWeight: 'bold' }}>إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedPatient ? (
                <div className="patient-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '25px' }}>
                    <div className="modern-card" style={{ padding: '20px', height: 'fit-content', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#0284C7' }}></div>
                        <div style={{ borderBottom: '1px solid #F1F5F9', paddingBottom: '16px', marginBottom: '16px', textAlign: 'center' }}>
                            <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0284C7', width: '56px', height: '56px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', margin: '0 auto 12px auto' }}>
                                <i className="fa-solid fa-hospital-user"></i>
                            </div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#0F172A' }}>{selectedPatient.name}</h3>
                            <span style={{ fontSize: '11px', color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 10px', borderRadius: '20px', display: 'inline-block', marginTop: '8px', fontWeight: '700' }}>
                                <i className="fa-solid fa-retweet"></i> عدد الزيارات: {selectedPatient.visits?.length || 1}
                            </span>
                            <br />
                            <div style={{ fontSize: '11px', color: '#0284C7', background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '4px 10px', borderRadius: '20px', display: 'inline-block', marginTop: '6px', fontWeight: '700' }}>
                                <i className="fa-solid fa-wallet"></i> إجمالي المبالغ: <AnimatedNumber value={selectedPatient.paid || 0} />
                            </div>

                            {selectedPatient.nextRecallDate && (
                                <button 
                                    onClick={() => sendWhatsAppRecall(selectedPatient.name, selectedPatient.phone, selectedPatient.nextRecallDate)}
                                    style={{ width: '100%', marginTop: '12px', padding: '8px 10px', borderRadius: '10px', border: 'none', background: '#25D366', color: 'white', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)' }}
                                >
                                    <i className="fa-brands fa-whatsapp" style={{ fontSize: '14px' }}></i> إرسال تذكير بالموعد ({selectedPatient.nextRecallDate})
                                </button>
                            )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px', color: '#475569' }}>
                            {!editingPhone ? (
                                <div style={{ display: 'flex', alignItems: 'center', justifyBox: 'space-between', background: '#F8FAFC', padding: '8px 10px', borderRadius: '10px', border: '1px solid #E2E8F0', flexWrap: 'wrap', gap: '6px', justifyContent: 'space-between' }}>
                                    <span><strong>الهاتف:</strong> <span style={{ color: '#0284C7', fontWeight: '700' }}>{selectedPatient.phone}</span></span>
                                    <button 
                                        type="button" 
                                        onClick={() => { setEditPhoneValue(selectedPatient.phone || ''); setEditingPhone(true); }} 
                                        style={{ background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1', padding: '3px 6px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}
                                    >
                                        ✏️ تعديل
                                    </button>
                                </div>
                            ) : (
                                <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px' }}>
                                    <label style={{ display: 'block', fontSize: '11px', marginBottom: '4px', color: '#475569', fontWeight: 'bold' }}>تحديث رقم الهاتف:</label>
                                    <input 
                                        type="text" 
                                        value={editPhoneValue} 
                                        onChange={e => setEditPhoneValue(e.target.value)} 
                                        className="custom-input-dark"
                                        style={{ 
                                            marginBottom: '6px',
                                            border: (editPhoneDuplicate || !isEditPhoneFormatValid) ? '1px solid #EF4444' : '1px solid #CBD5E1',
                                            background: (editPhoneDuplicate || !isEditPhoneFormatValid) ? '#FEF2F2' : '#FFFFFF'
                                        }} 
                                    />
                                    {!isEditPhoneFormatValid && (
                                        <span style={{ display: 'block', color: '#DC2626', fontSize: '10px', marginBottom: '6px', fontWeight: '600' }}>⚠️ صيغة رقم غير صالحة.</span>
                                    )}
                                    {isEditPhoneFormatValid && editPhoneDuplicate && (
                                        <span style={{ display: 'block', color: '#DC2626', fontSize: '10px', marginBottom: '6px', fontWeight: '600' }}>⚠️ الرقم مستخدم لمريض آخر: {editPhoneDuplicate.name}</span>
                                    )}
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <button 
                                            type="button" 
                                            onClick={handleUpdatePatientPhone} 
                                            disabled={loading || !isEditPhoneFormatValid || !!editPhoneDuplicate || !editPhoneValue.trim()}
                                            style={{ flex: 1, background: (!isEditPhoneFormatValid || editPhoneDuplicate || !editPhoneValue.trim()) ? '#E2E8F0' : '#10B981', color: (!isEditPhoneFormatValid || editPhoneDuplicate || !editPhoneValue.trim()) ? '#94A3B8' : '#FFFFFF', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
                                        >
                                            💾 حفظ
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={() => setEditingPhone(false)} 
                                            style={{ flex: 1, background: '#E2E8F0', color: '#334155', border: 'none', padding: '6px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px' }}
                                        >
                                            إلغاء
                                        </button>
                                    </div>
                                </div>
                            )}
                            <div style={{ background: '#F8FAFC', padding: '8px 10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}><strong>العمر الحالي:</strong> <span style={{ fontWeight: '700', color: '#0F172A' }}>{selectedPatient.age || 'غير مسجل'} سنة</span></div>
                        </div>
                        <button onClick={() => { setShowNewVisitForm(!showNewVisitForm); resetVisitForm(); }} style={{ width: '100%', marginTop: '16px', padding: '10px', borderRadius: '12px', border: 'none', background: '#0284C7', color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '13px', boxShadow: '0 4px 12px rgba(2, 132, 199, 0.25)' }}>
                            <i className="fa-solid fa-folder-plus"></i> إضافة فحص / زيارة جديدة
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        {showNewVisitForm && (
                            <form onSubmit={handleAddNewVisit} style={{ background: '#FFFFFF', padding: '16px', borderRadius: '20px', border: '2px solid #0284C7', boxShadow: '0 10px 25px rgba(2, 132, 199, 0.1)', backdropFilter: 'blur(30px)' }}>
                                <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0284C7', marginBottom: '16px', borderBottom: '1px solid #F1F5F9', paddingBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="fa-solid fa-user-doctor"></i> إضافة استمارة فحص عيون وتشخيص مالي جديد للمريض
                                </h3>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                                    <button type="button" onClick={() => setActiveTab('clinical')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '11px', background: activeTab === 'clinical' ? '#0284C7' : '#F1F5F9', color: activeTab === 'clinical' ? 'white' : '#475569' }}>🏥 الفحوصات والقياسات الطبية</button>
                                    <button type="button" onClick={() => setActiveTab('billing')} style={{ padding: '8px 12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: '700', fontSize: '11px', background: activeTab === 'billing' ? '#0284C7' : '#F1F5F9', color: activeTab === 'billing' ? 'white' : '#475569' }}>💰 المحاسبة وتجهيز النظارات</button>
                                </div>

                                {activeTab === 'clinical' ? (
                                   <ClinicalFieldsForm
                                        autorefractionOS={autorefractionOS} setAutorefractionOS={setAutorefractionOS}
                                        autorefractionOD={autorefractionOD} setAutorefractionOD={setAutorefractionOD}
                                        kReadingOS={kReadingOS} setKReadingOS={setKReadingOS}
                                        kReadingOD={kReadingOD} setKReadingOD={setKReadingOD}
                                        ucvaOS={ucvaOS} setUcvaOS={setUcvaOS}
                                        ucvaOD={ucvaOD} setUcvaOD={setUcvaOD}
                                        pinHoleOS={pinHoleOS} setPinHoleOS={setPinHoleOS}
                                        pinHoleOD={pinHoleOD} setPinHoleOD={setPinHoleOD}
                                        bcvaOS={bcvaOS} setBcvaOS={setBcvaOS}
                                        bcvaOD={bcvaOD} setBcvaOD={setBcvaOD}
                                        oldGlassesOS={oldGlassesOS} setOldGlassesOS={setOldGlassesOS}
                                        oldGlassesOD={oldGlassesOD} setOldGlassesOD={setOldGlassesOD}
                                        manifestRefractionOS={manifestRefractionOS} setManifestRefractionOS={setManifestRefractionOS}
                                        manifestRefractionOD={manifestRefractionOD} setManifestRefractionOD={setManifestRefractionOD}
                                        cycloplegicOS={cycloplegicOS} setCycloplegicOS={setCycloplegicOS}
                                        cycloplegicOD={cycloplegicOD} setCycloplegicOD={setCycloplegicOD}
                                        nearOS={nearOS} setNearOS={setNearOS}
                                        nearOD={nearOD} setNearOD={setNearOD}
                                        ipd={ipd} setIpd={setIpd}
                                        iopOS={iopOS} setIopOS={setIopOS}
                                        iopOD={iopOD} setIopOD={setIopOD}
                                        notes={notes} setNotes={setNotes}
                                        recallInterval={recallInterval} setRecallInterval={setRecallInterval}
                                        customRecallDate={customRecallDate} setCustomRecallDate={setCustomRecallDate}
                                    />
                                ) : (
                                    <BillingFieldsForm 
                                        lensType={lensType} setLensType={setLensType} 
                                        lensDetails={lensDetails} setLensDetails={setLensDetails}
                                        customLensPrice={customLensPrice} setCustomLensPrice={setCustomLensPrice}
                                        consultationFee={consultationFee} setConsultationFee={setConsultationFee}
                                        storeItems={storeItems} selectedItemId={selectedItemId} setSelectedItemId={setSelectedItemId}
                                        selectedQty={selectedQty} setSelectedQty={setSelectedQty} addToCart={addToCart} cart={cart} removeFromCart={removeFromCart} totalInvoiceAmount={totalInvoiceAmount}
                                    />
                                )}

                                <div style={{ display: 'flex', gap: '8px', marginTop: '20px', flexWrap: 'wrap' }}>
                                    <button type="submit" disabled={loading} style={{ flex: 1, minWidth: '140px', background: '#10B981', color: '#FFFFFF', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px', boxShadow: '0 4px 12px rgba(16,185,129,0.25)' }}>
                                        {loading ? 'جاري الحفظ والمزامنة...' : '💾 اعتماد وحفظ استمارة الزيارة'}
                                    </button>
                                    <button type="button" onClick={() => { setShowNewVisitForm(false); resetVisitForm(); }} style={{ flex: 1, minWidth: '140px', background: '#EF4444', color: 'white', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                                        إلغاء التجديد
                                    </button>
                                </div>
                            </form>
                        )}

                        <div className="modern-card" style={{ padding: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '800', color: '#0F172A', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-box-archive" style={{ color: '#0284C7' }}></i> أرشيف سجل الزيارات التاريخي بالكامل للمريض
                            </h3>
                            {(!selectedPatient.visits || selectedPatient.visits.length === 0) ? (
                                <p style={{ color: '#64748B', fontSize: '12px' }}>لا توجد أي زيارات مسجلة لهذا المريض مسبقاً.</p>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                    {selectedPatient.visits.map((visit, index) => (
                                        <div key={visit.visitId || index} style={{ border: '1px solid #E2E8F0', padding: '14px', borderRadius: '14px', backgroundColor: '#F8FAFC' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: '10px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                                                <div>
                                                    <span style={{ fontWeight: '800', color: '#0284C7', fontSize: '13px' }}><i className="fa-solid fa-calendar-check" style={{ marginLeft: '4px' }}></i>زيارة وتاريخ: {visit.date} • {visit.time}</span>
                                                    <span style={{ fontSize: '12px', color: '#0F172A', marginRight: '10px', fontWeight: '700' }}>المسدد: <AnimatedNumber value={visit.totalPaid || 0} /></span>
                                                </div>
                                                <div className="visit-header-actions" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                    {visit.nextRecallDate && (
                                                        <button 
                                                            onClick={() => sendWhatsAppRecall(selectedPatient.name, selectedPatient.phone, visit.nextRecallDate)}
                                                            style={{ background: '#ECFDF5', color: '#059669', border: '1px solid #A7F3D0', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                        >
                                                            <i className="fa-brands fa-whatsapp"></i> تذكير بالموعد ({visit.nextRecallDate})
                                                        </button>
                                                    )}
                                                    
                                                    <button onClick={() => { setEditingVisit(visit); setEditConsultationFee(visit.consultationFee || 0); }} style={{ background: '#FFFFFF', color: '#334155', border: '1px solid #CBD5E1', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                                                        <i className="fa-solid fa-user-pen"></i> تعديل الكشفية
                                                    </button>
                                                    <button onClick={() => handleDeleteVisit(visit)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold' }}>
                                                        <i className="fa-solid fa-trash-can"></i> حذف الزيارة
                                                    </button>
                                                    <button onClick={() => handlePrintPrescription(selectedPatient, visit)} style={{ background: '#0284C7', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(2,132,199,0.2)' }}>
                                                        <i className="fa-solid fa-print"></i> طباعة الفحص
                                                    </button>
                                                    <button onClick={() => handlePrintInvoice(selectedPatient, visit)} style={{ background: '#10B981', color: '#FFFFFF', border: 'none', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '10px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', boxShadow: '0 2px 4px rgba(16,185,129,0.2)' }}>
                                                        <i className="fa-solid fa-receipt"></i> الوصل المالي
                                                    </button>
                                                </div>
                                            </div>

                                            <button 
                                                type="button"
                                                onClick={() => toggleExamDetails(visit.visitId || index)}
                                                style={{ width:'100%', padding:'6px', background:'#FFFFFF', border:'1px dashed #CBD5E1', borderRadius:'8px', cursor:'pointer', color:'#0F172A', fontSize:'11px', fontWeight:'700', display:'flex', alignItems:'center', justifyContent:'center', gap: '6px', marginBottom: '8px' }}
                                            >
                                                <i className={`fa-solid fa-eye${expandedExamVisits[visit.visitId || index] ? '-slash' : ''}`}></i>
                                                {expandedExamVisits[visit.visitId || index] ? 'إخفاء القياسات والفحوصات السريرية لهذه الزيارة' : 'عرض القياسات والفحوصات الطبية الكاملة لهذه الزيارة'}
                                            </button>

                                            {expandedExamVisits[visit.visitId || index] && (
                                                <div style={{ marginTop: '10px', overflowX: 'auto', background: '#FFFFFF', padding: '10px', borderRadius: '10px', border: '1px solid #E2E8F0' }}>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', color: '#1E293B', textAlign: 'center' }}>
                                                        <thead>
                                                            <tr>
                                                                <th style={{ padding: '6px' }}>نوع الفحص</th>
                                                                <th style={{ padding: '6px', color: '#059669' }}>العين اليسرى (OS)</th>
                                                                <th style={{ padding: '6px', color: '#0284C7' }}>العين اليمنى (OD)</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>Autorefraction</td><td>{formatRefraction(visit.autorefractionOS)}</td><td>{formatRefraction(visit.autorefractionOD)}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>K Reading</td><td>{formatKReading(visit.kReadingOS)}</td><td>{formatKReading(visit.kReadingOD)}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>UCVA</td><td>{visit.ucvaOS || '---'}</td><td>{visit.ucvaOD || '---'}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>Pin Hole</td><td>{visit.pinHoleOS || '---'}</td><td>{visit.pinHoleOD || '---'}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>BCVA</td><td>{formatRefraction(visit.bcvaOS)}</td><td>{formatRefraction(visit.bcvaOD)}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9', background: '#F0F9FF' }}><td style={{ padding:'6px', fontWeight:'bold', color: '#0284C7' }}>Old Glasses</td><td>{formatRefraction(visit.oldGlassesOS)}</td><td>{formatRefraction(visit.oldGlassesOD)}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>Manifest Refraction</td><td>{formatRefraction(visit.manifestRefractionOS)}</td><td>{formatRefraction(visit.manifestRefractionOD)}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>Cycloplegic</td><td>{formatRefraction(visit.cycloplegicOS)}</td><td>{formatRefraction(visit.cycloplegicOD)}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>Near</td><td>{formatRefraction(visit.nearOS)}</td><td>{formatRefraction(visit.nearOD)}</td></tr>
                                                            <tr style={{ borderBottom: '1px solid #F1F5F9' }}><td style={{ padding:'6px', fontWeight:'700' }}>IOP Pressure</td><td>{visit.iopOS || '---'}</td><td>{visit.iopOD || '---'}</td></tr>
                                                            <tr><td style={{ padding:'6px', fontWeight:'700' }}>IPD</td><td colSpan={2}>{visit.ipd || '---'} mm</td></tr>
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}

                                            <div style={{ marginTop: '10px', padding: '10px', background: '#FFFFFF', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '12px' }}>
                                                <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#0F172A' }}>🧾 البنود وتفاصيل التجهيز المحاسبي المحفوظة:</p>
                                                <ul style={{ margin: 0, paddingRight: '16px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                                                    {Number(visit.consultationFee || 0) > 0 && <li style={{ listStyleType: 'disc' }}>كشفية وفحص عيون شامل بقيمة: <strong style={{ color: '#059669' }}>{Number(visit.consultationFee).toLocaleString()} د.ع</strong></li>}
                                                    {visit.lensType && <li style={{ listStyleType: 'disc' }}>عدسة طبية مخصصة للقرنية نوع ({visit.lensType}) {visit.lensDetails ? `[تفاصيل: ${visit.lensDetails}]` : ''} بسعر: <strong style={{ color: '#059669' }}>{Number(visit.customLensPrice || 0).toLocaleString()} د.ع</strong></li>}
                                                    {(visit.cart || []).map((cItem, ci) => (
                                                        <li key={ci} style={{ listStyleType: 'disc' }}>إطار/صنف مباع: ({cItem.itemName}) عدد: {cItem.qty} قطعة بسعر إجمالي: <strong style={{ color: '#059669' }}>{(cItem.price * cItem.qty).toLocaleString()} د.ع</strong></li>
                                                    ))}
                                                </ul>
                                                {visit.notes && (
                                                    <p style={{ margin: '6px 0 0 0', color: '#0284C7', fontStyle: 'italic', fontSize: '11px' }}>💡 <strong>ملاحظة الطبيب:</strong> {visit.notes}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="modern-card" style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
                            <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#0284C7', fontSize: '12px' }}></i>
                            <input 
                                type="text" 
                                placeholder="ابحث عن المريض من خلال كتابة الاسم الثلاثي أو رقم الهاتف الفعال..." 
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="custom-input-dark"
                                style={{ paddingRight: '36px', fontSize: '12px' }}
                            />
                        </div>
                        <span style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', fontSize: '11px', fontWeight: '700', padding: '8px 12px', borderRadius: '10px' }}>
                            🔍 الحصيلة الإجمالية: {filteredPatients.length} مريض مؤرشف
                        </span>
                    </div>

                    {/* Desktop Table View */}
                    <div className="table-responsive-wrapper">
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '14px', minWidth: '750px' }}>
                            <thead>
                                <tr>
                                    <th style={{ padding: '14px 10px' }}>اسم المريض المسجل</th>
                                    <th style={{ padding: '14px 10px' }}>رقم الموبايل</th>
                                    <th style={{ padding: '14px 10px' }}>العمر</th>
                                    <th style={{ padding: '14px 10px' }}>حالة آخر إجراء</th>
                                    <th style={{ padding: '14px 10px' }}>تاريخ آخر زيارة</th>
                                    <th style={{ padding: '14px 10px', textAlign: 'center' }}>التحكم بالملف</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredPatients.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} style={{ padding: '40px 0', textAlign: 'center', color: '#64748B' }}>
                                            ⚠️ لا يوجد أي مريض مطابق لمعايير البحث الحالية في الأرشيف المالي والطبي.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredPatients.map((patient) => (
                                        <tr key={patient.id} style={{ borderBottom: '1px solid #E2E8F0', color: '#1E293B', transition: 'background 0.2s' }}>
                                            <td style={{ padding: '16px 10px', fontWeight: '700', color: '#0F172A' }}>{patient.name}</td>
                                            <td style={{ padding: '16px 10px', color: '#0284C7', fontWeight: '600' }}>{patient.phone}</td>
                                            <td style={{ padding: '16px 10px' }}>{patient.age ? `${patient.age} سنة` : '---'}</td>
                                            <td style={{ padding: '16px 10px' }}>
                                                <span style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', color: '#334155', padding: '4px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: '500' }}>
                                                    {patient.status || 'فحص طبي'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '16px 10px', color: '#64748B' }}>{patient.date || '---'}</td>
                                            <td style={{ padding: '16px 10px', textAlign: 'center' }}>
                                                <button 
                                                    onClick={() => { setSelectedPatient(patient); setShowNewVisitForm(false); setEditingVisit(null); setEditingPhone(false); }}
                                                    style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', padding: '6px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '12px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                >
                                                    <i className="fa-solid fa-folder-open" style={{ color: '#0284C7' }}></i> فتح الأرشيف الطبي
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile Grid View (2 Cards per row, 1 card on tiny devices) */}
                    <div className="patients-mobile-cards">
                        {filteredPatients.length === 0 ? (
                            <div style={{ gridColumn: '1 / -1', padding: '20px 0', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                                ⚠️ لا يوجد أي مريض مطابق لمعايير البحث الحالية في الأرشيف المالي والطبي.
                            </div>
                        ) : (
                            filteredPatients.map((patient) => (
                                <div key={patient.id} className="patient-mobile-card">
                                    <div>
                                        <h4>{patient.name}</h4>
                                        <p><span className="phone-num">{patient.phone}</span></p>
                                        <p>العمر: {patient.age ? `${patient.age} سنة` : '---'}</p>
                                        <p>التاريخ: {patient.date || '---'}</p>
                                        <span className="status-badge">{patient.status || 'فحص طبي'}</span>
                                    </div>
                                    <button 
                                        onClick={() => { setSelectedPatient(patient); setShowNewVisitForm(false); setEditingVisit(null); setEditingPhone(false); }}
                                        style={{ background: '#F0F9FF', color: '#0284C7', border: '1px solid #BAE6FD', borderRadius: '8px', cursor: 'pointer', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                                    >
                                        <i className="fa-solid fa-folder-open" style={{ color: '#0284C7', fontSize: '10px' }}></i> فتح الأرشيف
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// ==================== الحقول الطبية المعتمدة للفحص والتشخيص السريري ====================
function ClinicalFieldsForm({
    autorefractionOS, setAutorefractionOS, autorefractionOD, setAutorefractionOD,
    kReadingOS, setKReadingOS, kReadingOD, setKReadingOD,
    ucvaOS, setUcvaOS, ucvaOD, setUcvaOD,
    pinHoleOS, setPinHoleOS, pinHoleOD, setPinHoleOD,
    bcvaOS, setBcvaOS, bcvaOD, setBcvaOD,
    oldGlassesOS, setOldGlassesOS, oldGlassesOD, setOldGlassesOD,
    manifestRefractionOS, setManifestRefractionOS, manifestRefractionOD, setManifestRefractionOD,
    cycloplegicOS, setCycloplegicOS, cycloplegicOD, setCycloplegicOD,
    nearOS, setNearOS, nearOD, setNearOD,
    ipd, setIpd, iopOS, setIopOS, iopOD, setIopOD,
    notes, setNotes, recallInterval, setRecallInterval, customRecallDate, setCustomRecallDate
}) {
    const renderEyeFields = (label, osState, setOsState, odState, setOdState) => (
        <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px', marginBottom: '8px' }}>
            <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0F172A', marginBottom: '6px' }}>{label}</span>
            <div className="clinical-row" style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <span style={{ color: '#059669', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>OS (اليسرى):</span>
                <input type="text" placeholder="SPH" value={osState.sph} onChange={e => setOsState({ ...osState, sph: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px' }} />
                <input type="text" placeholder="CYL" value={osState.cyl} onChange={e => setOsState({ ...osState, cyl: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px' }} />
                <input type="text" placeholder="Axis" value={osState.axis} onChange={e => setOsState({ ...osState, axis: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px' }} />
                
                <span style={{ color: '#0284C7', fontSize: '11px', fontWeight: '700', flexShrink: 0, marginRight: '6px' }}>OD (اليمنى):</span>
                <input type="text" placeholder="SPH" value={odState.sph} onChange={e => odState ? setOdState({ ...odState, sph: e.target.value }) : null} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px' }} />
                <input type="text" placeholder="CYL" value={odState.cyl} onChange={e => odState ? setOdState({ ...odState, cyl: e.target.value }) : null} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px' }} />
                <input type="text" placeholder="Axis" value={odState.axis} onChange={e => odState ? setOdState({ ...odState, axis: e.target.value }) : null} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px' }} />
            </div>
        </div>
    );

    return (
        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            {renderEyeFields('1. Autorefraction', autorefractionOS, setAutorefractionOS, autorefractionOD, setAutorefractionOD)}

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px', marginBottom: '8px' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0F172A', marginBottom: '6px' }}>2. K Reading</span>
                <div className="clinical-row" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ color: '#059669', fontSize: '11px', fontWeight: '700' }}>OS:</span>
                    <input type="text" placeholder="K1" value={kReadingOS.k1} onChange={e => setKReadingOS({ ...kReadingOS, k1: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                    <input type="text" placeholder="Axis 1" value={kReadingOS.axis1} onChange={e => setKReadingOS({ ...kReadingOS, axis1: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                    <input type="text" placeholder="K2" value={kReadingOS.k2} onChange={e => setKReadingOS({ ...kReadingOS, k2: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                    <input type="text" placeholder="Axis 2" value={kReadingOS.axis2} onChange={e => setKReadingOS({ ...kReadingOS, axis2: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                    
                    <span style={{ color: '#0284C7', fontSize: '11px', fontWeight: '700', marginRight: '6px' }}>OD:</span>
                    <input type="text" placeholder="K1" value={kReadingOD.k1} onChange={e => setKReadingOD({ ...kReadingOD, k1: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                    <input type="text" placeholder="Axis 1" value={kReadingOD.axis1} onChange={e => setKReadingOD({ ...kReadingOD, axis1: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                    <input type="text" placeholder="K2" value={kReadingOD.k2} onChange={e => setKReadingOD({ ...kReadingOD, k2: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                    <input type="text" placeholder="Axis 2" value={kReadingOD.axis2} onChange={e => setKReadingOD({ ...kReadingOD, axis2: e.target.value })} className="custom-input-dark" style={{ padding:'5px 8px', fontSize: '12px', flex: 1 }} />
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0F172A', marginBottom: '6px' }}>3. UCVA</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input type="text" placeholder="OS" value={ucvaOS} onChange={e => setUcvaOS(e.target.value)} className="custom-input-dark" style={{ padding:'5px', fontSize: '12px' }} />
                        <input type="text" placeholder="OD" value={ucvaOD} onChange={e => setUcvaOD(e.target.value)} className="custom-input-dark" style={{ padding:'5px', fontSize: '12px' }} />
                    </div>
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0F172A', marginBottom: '6px' }}>4. Pin Hole</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input type="text" placeholder="OS" value={pinHoleOS} onChange={e => setPinHoleOS(e.target.value)} className="custom-input-dark" style={{ padding:'5px', fontSize: '12px' }} />
                        <input type="text" placeholder="OD" value={pinHoleOD} onChange={e => setPinHoleOD(e.target.value)} className="custom-input-dark" style={{ padding:'5px', fontSize: '12px' }} />
                    </div>
                </div>
            </div>

            {renderEyeFields('5. BCVA', bcvaOS, setBcvaOS, bcvaOD, setBcvaOD)}
            {renderEyeFields('6. Old Glasses', oldGlassesOS, setOldGlassesOS, oldGlassesOD, setOldGlassesOD)}
            {renderEyeFields('7. Manifest Refraction', manifestRefractionOS, setManifestRefractionOS, manifestRefractionOD, setManifestRefractionOD)}
            {renderEyeFields('8. Cycloplegic', cycloplegicOS, setCycloplegicOS, cycloplegicOD, setCycloplegicOD)}
            {renderEyeFields('9. Near', nearOS, setNearOS, nearOD, setNearOD)}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '8px', marginBottom: '10px' }}>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0F172A', marginBottom: '6px' }}>10. IPD (mm)</span>
                    <input type="text" placeholder="e.g. 64" value={ipd} onChange={e => setIpd(e.target.value)} className="custom-input-dark" style={{ padding:'5px', fontSize: '12px' }} />
                </div>
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px' }}>
                    <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0F172A', marginBottom: '6px' }}>11. IOP Pressure (ضغط العين)</span>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <input type="text" placeholder="OS (اليسرى)" value={iopOS} onChange={e => setIopOS(e.target.value)} className="custom-input-dark" style={{ padding:'5px', fontSize: '12px' }} />
                        <input type="text" placeholder="OD (اليمنى)" value={iopOD} onChange={e => setIopOD(e.target.value)} className="custom-input-dark" style={{ padding:'5px', fontSize: '12px' }} />
                    </div>
                </div>
            </div>

            <div style={{ background: '#F0F9FF', border: '1px dashed #BAE6FD', padding: '10px', borderRadius: '12px', marginBottom: '10px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0284C7', marginBottom: '6px' }}>📅 جدولة موعد الفحص الدوري القادم (WhatsApp Recall):</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={recallInterval} onChange={e => setRecallInterval(e.target.value)} className="custom-input-dark" style={{ flex: 1, minWidth: '130px', fontSize: '12px' }}>
                        <option value="none">بدون تذكير تلقائي</option>
                        <option value="3_months">بعد 3 أشهر 📅</option>
                        <option value="6_months">بعد 6 أشهر 📅</option>
                        <option value="custom">تحديد تاريخ مخصص...</option>
                    </select>
                    {recallInterval === 'custom' && (
                        <input type="date" value={customRecallDate} onChange={e => setCustomRecallDate(e.target.value)} className="custom-input-dark" style={{ flex: 1, minWidth: '130px', fontSize: '12px' }} />
                    )}
                </div>
            </div>

            <div>
                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '700' }}>ملاحظات التشخيص الإضافية والتقرير الطبي العام</label>
                <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} className="custom-input-dark" style={{ fontSize: '12px' }} placeholder="اكتب أي أعراض سريرية، أمراض مزمنة أو مواصفات خاصة بالنظارة هنا..." />
            </div>
        </div>
    );
}

// ==================== الحقول المالية وسلة المشتريات وتجهيز النظارات ====================
function BillingFieldsForm({
    lensType, setLensType, lensDetails, setLensDetails, customLensPrice, setCustomLensPrice,
    consultationFee, setConsultationFee, storeItems, selectedItemId, setSelectedItemId,
    selectedQty, setSelectedQty, addToCart, cart, removeFromCart, totalInvoiceAmount
}) {
    return (
        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '14px', border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '10px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '700' }}>سعر كشفية وفحص العيون (د.ع)</label>
                    <input type="number" value={consultationFee} onChange={e => setConsultationFee(Number(e.target.value) || 0)} className="custom-input-dark" style={{ fontSize: '12px' }} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '700' }}>نوع العدسات الطبية المطلوبة</label>
                    <select value={lensType} onChange={e => setLensType(e.target.value)} className="custom-input-dark" style={{ fontSize: '12px' }}>
                        <option value="Single Vision">Single Vision (رؤية مفردة)</option>
                        <option value="Bifocal">Bifocal (ثنائية البؤرة)</option>
                        <option value="Progressive">Progressive (تدريجية مالتي فوكال)</option>
                        <option value="Blue Cut / Anti-Reflective">Blue Cut / الحماية الرقمية</option>
                        <option value="Photocromic / Transitions">Photocromic (الملونة مع الشمس)</option>
                        <option value="Contact Lenses">Contact Lenses (عدسات لاصقة)</option>
                        <option value="None / Frame Only">بدون عدسات (إطار فقط)</option>
                    </select>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px', marginBottom: '14px' }}>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '700' }}>مواصفات وشركة العدسة (Details)</label>
                    <input type="text" placeholder="مثال: شركة Zeiss طبقة حماية بريميوم مضادة للخدش" value={lensDetails} onChange={e => setLensDetails(e.target.value)} className="custom-input-dark" style={{ fontSize: '12px' }} />
                </div>
                <div>
                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '700' }}>سعر العدسات (د.ع)</label>
                    <input type="number" value={customLensPrice} onChange={e => setCustomLensPrice(Number(e.target.value) || 0)} className="custom-input-dark" style={{ fontSize: '12px' }} />
                </div>
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', padding: '10px', borderRadius: '12px', marginBottom: '14px' }}>
                <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#0284C7', marginBottom: '8px' }}>👓 ربط وصرف إطار أو صنف من المخزن الحالي:</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <select value={selectedItemId} onChange={e => setSelectedItemId(e.target.value)} className="custom-input-dark" style={{ flex: 3, minWidth: '160px', fontSize: '12px' }}>
                        <option value="">-- اختر الإطار أو المنتج المطلوب صرفه للمريض --</option>
                        {storeItems.map(item => (
                            <option key={item.id} value={item.id} disabled={Number(item.currentStock || 0) <= 0}>
                                {item.itemName} (المتوفر: {item.currentStock} قطع) - السعر: {Number(item.sellingPrice || 0).toLocaleString()} د.ع
                            </option>
                        ))}
                    </select>
                    <input type="number" min="1" value={selectedQty} onChange={e => setSelectedQty(Number(e.target.value) || 1)} className="custom-input-dark" style={{ flex: 1, minWidth: '60px', textAlign: 'center', fontSize: '12px' }} />
                    <button type="button" onClick={addToCart} style={{ background: '#0284C7', color: 'white', border: 'none', padding: '8px 12px', borderRadius: '10px', fontWeight: 'bold', fontSize: '11px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(2,132,199,0.2)' }}>
                        ➕ إضافة للوصل
                    </button>
                </div>

                {cart.length > 0 && (
                    <div style={{ marginTop: '10px', background: '#F8FAFC', borderRadius: '10px', padding: '8px', border: '1px solid #E2E8F0' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '4px' }}>الأصناف المخزنية المضافة حالياً:</span>
                        {cart.map((cItem, index) => (
                            <div key={index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid #E2E8F0', fontSize: '11px' }}>
                                <span style={{ color: '#0F172A' }}>• {cItem.itemName} (عدد: {cItem.qty})</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: '#059669', fontWeight: 'bold' }}>{(cItem.price * cItem.qty).toLocaleString()} د.ع</span>
                                    <button type="button" onClick={() => removeFromCart(cItem.id)} style={{ background: 'transparent', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '11px' }}>
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '10px 12px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#065F46' }}>💰 المجموع الإجمالي المسدد لوصل المريض الفوري:</span>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#059669' }}>
                    <AnimatedNumber value={totalInvoiceAmount} />
                </span>
            </div>
        </div>
    );
}
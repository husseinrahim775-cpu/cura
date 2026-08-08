'use client';
import { useState, useEffect } from 'react';
import { db } from '@/firebase';
import { collection, getDocs, writeBatch, doc, setDoc, deleteDoc, getDoc } from 'firebase/firestore';

export default function Settings() {
    // --- الحالات الخاصة بكودك الأصلي الحساس ---
    const [exportType, setExportType] = useState('all'); 
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [loadingExport, setLoadingExport] = useState({ patients: false, store: false, finances: false, expenses: false, movements: false });
    
    const [importLoading, setImportLoading] = useState(false);
    const [importTarget, setImportTarget] = useState('patients'); 
    const [financialImportLoading, setFinancialImportLoading] = useState(false);

    const [fullBackupExportLoading, setFullBackupExportLoading] = useState(false);
    const [fullBackupImportLoading, setFullBackupImportLoading] = useState(false);

    // --- الحالات الخاصة بإدارة الصلاحيات المخصصة للموظفين ---
    const [users, setUsers] = useState([]);
    const [newName, setNewName] = useState('');
    const [newUsername, setNewUsername] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newEmail, setNewEmail] = useState(''); 
    const [isAdmin, setIsAdmin] = useState(false);

    // --- معرف العيادة أو المستخدم الحالي الحاكم لمسار 🔐 ---
    const [clinicId, setClinicId] = useState('');
    const [currentUserUsername, setCurrentUserUsername] = useState('');

    // --- 🏥 الحالات المضافة الخاصة بهوية العيادة وإعدادات الطباعة ---
    const [clinicName, setClinicName] = useState('');
    const [clinicPhone1, setClinicPhone1] = useState('');
    const [clinicPhone2, setClinicPhone2] = useState('');
    const [clinicAddress, setClinicAddress] = useState('');
    const [clinicLogo, setClinicLogo] = useState(''); // ستخزن بصيغة Base64
    const [saveSettingsLoading, setSaveSettingsLoading] = useState(false);

    // قائمة الصلاحيات التفصيلية الديناميكية للموظفين
    const [selectedPermissions, setSelectedPermissions] = useState({
        store: false,
        stats: false,
        patients: false,
        whatsapp: false,
        settings: false
    });

    // 🔐 دالة تشفير كلمة المرور (SHA-256 Salted Hashing)
    const hashPasswordSecure = async (password) => {
        const encoder = new TextEncoder();
        const data = encoder.encode(password + "AlRazi_Optical_Secure_2026_Salt"); 
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    // جلب الحسابات، التحقق من دور المسؤول، وجلب إعدادات العيادة الحالية
    useEffect(() => {
        const storedClinicId = localStorage.getItem('clinic_id') || localStorage.getItem('user_id'); 
        const storedUsername = localStorage.getItem('user_username');
        const currentRole = localStorage.getItem('user_role');
        const clinicLogged = localStorage.getItem('clinic_admin_logged');
        
        if (storedClinicId) setClinicId(storedClinicId);
        if (storedUsername) setCurrentUserUsername(storedUsername);

        if (currentRole === 'admin' || clinicLogged === 'true') {
            setIsAdmin(true);
        }

        if (!storedClinicId) return;

        // 🏥 جلب بيانات هوية العيادة المضافة
        const fetchClinicSettings = async () => {
            try {
                const clinicDocRef = doc(db, 'users', storedClinicId);
                const clinicDocSnap = await getDoc(clinicDocRef);
                if (clinicDocSnap.exists()) {
                    const data = clinicDocSnap.data();
                    setClinicName(data.clinicName || '');
                    setClinicPhone1(data.clinicPhone1 || '');
                    setClinicPhone2(data.clinicPhone2 || '');
                    setClinicAddress(data.clinicAddress || '');
                    setClinicLogo(data.clinicLogo || '');
                }
            } catch (error) {
                console.error("🔒 Error fetching clinic identity settings:", error);
            }
        };

        const fetchUsersFromServer = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, 'users', storedClinicId, 'staff'));
                const usersList = querySnapshot.docs.map(docSnap => ({
                    id: docSnap.id,
                    ...docSnap.data()
                }));
                setUsers(usersList);
            } catch (error) {
                console.error("🔒 Security Error fetching users:", error);
            }
        };

        fetchClinicSettings();
        fetchUsersFromServer();
    }, []);

    // 🏥 دالة حفظ هوية العيادة وإعدادات الوصل
    const handleSaveClinicSettings = async (e) => {
        e.preventDefault();
        if (!clinicId) return;
        setSaveSettingsLoading(true);

        try {
            const clinicDocRef = doc(db, 'users', clinicId);
            await setDoc(clinicDocRef, {
                clinicName: clinicName.trim(),
                clinicPhone1: clinicPhone1.trim(),
                clinicPhone2: clinicPhone2.trim(),
                clinicAddress: clinicAddress.trim(),
                clinicLogo: clinicLogo, 
                updatedAt: new Date().toISOString()
            }, { merge: true });

            alert('🏥 تم حفظ وتحديث معلومات هوية العيادة وإعدادات الوصل بنجاح!');
        } catch (error) {
            console.error("Error saving clinic settings:", error);
            alert("❌ فشل حفظ الإعدادات، يرجى التحقق من الاتصال بالإنترنت.");
        } finally {
            setSaveSettingsLoading(false);
        }
    };

    // 🏥 معالجة تحويل اللوغو المرفوع إلى Base64 String
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 1024 * 500) { 
            alert("⚠️ حجم اللوغو كبير جداً! يرجى اختيار صورة أصغر من 500 كيلوبايت لضمان دقة الطباعة وسرعة النظام.");
            e.target.value = null;
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setClinicLogo(reader.result);
        };
        reader.readAsDataURL(file);
    };

    const handlePermissionChange = (permissionKey) => {
        setSelectedPermissions(prev => ({
            ...prev,
            [permissionKey]: !prev[permissionKey]
        }));
    };

    // ➕ إنشاء موظف جديد وحقنه في العيادة الحالية
    const handleAddUser = async (e) => {
        e.preventDefault();
        if (!newName || !newUsername || !newPassword || !newEmail || !clinicId) return;

        const cleanUsername = newUsername.trim().toLowerCase();
        const cleanEmail = newEmail.trim().toLowerCase();

        const isExist = users.some(u => u.username === cleanUsername || u.email === cleanEmail);
        if (isExist) {
            alert('❌ اسم المستخدم أو البريد الإلكتروني هذا مستخدم مسبقاً في عيادتك!');
            return;
        }

        try {
            const securedPassword = await hashPasswordSecure(newPassword);
            const generatedUid = `staff_${Date.now()}`;

            const usernameRef = doc(db, 'usernames', cleanUsername);
            await setDoc(usernameRef, {
                uid: generatedUid,
                email: cleanEmail,
                clinicId: clinicId 
            });

            const determinedRole = selectedPermissions.settings ? 'admin' : 'reception';

            const newUserDoc = { 
                name: newName, 
                username: cleanUsername, 
                email: cleanEmail,
                password: securedPassword, 
                role: determinedRole,
                permissions: { ...selectedPermissions },
                createdAt: new Date().toISOString(),
                createdBy: currentUserUsername || 'admin'
            };

            await setDoc(doc(db, 'users', clinicId, 'staff', generatedUid), newUserDoc);
            setUsers(prev => [...prev, { id: generatedUid, ...newUserDoc }]);

            setNewName('');
            setNewUsername('');
            setNewPassword('');
            setNewEmail('');
            setSelectedPermissions({ store: false, stats: false, patients: false, whatsapp: false, settings: false });
            
            alert('🛡️ تم إنشاء حساب الموظف في مجموعة موظفيك بنجاح!');
        } catch (error) {
            console.error("Security Error writing account to server:", error);
            alert("❌ فشل عملية الإنشاء، يرجى مراجعة الصلاحيات.");
        }
    };

    const handleDeleteUser = async (userId, usernameToDelete, userRole) => {
        const currentUser = currentUserUsername || localStorage.getItem('user_username'); 

        if (userRole === 'admin' || usernameToDelete === 'admin') {
            alert('⚠️ نظام الحماية يمنع حذف الحسابات الإدارية الجذرية!');
            return;
        }

        if (usernameToDelete === currentUser) {
            alert('⚠️ لا يمكنك حذف حسابك الحالي!');
            return;
        }
        
        if (confirm('🔒 هل أنت متأكد من رغبتك في سحب صلاحيات هذا الموظف نهائياً؟')) {
            try {
                await deleteDoc(doc(db, 'users', clinicId, 'staff', userId));
                await deleteDoc(doc(db, 'usernames', usernameToDelete));
                setUsers(prev => prev.filter(u => u.id !== userId));
                alert('🗑️ تم إلغاء الحساب بنجاح.');
            } catch (error) {
                console.error(error);
                alert("❌ حدث خطأ أثناء الحذف.");
            }
        }
    };

    // --- كود المعالجة والتحويل الأصلي المعتمد لعيادتك ---
    const convertToEnglishDigits = (str) => {
        if (!str) return '';
        const PersianArabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
        let result = String(str);
        for (let i = 0; i < 10; i++) {
            result = result.replace(PersianArabicDigits[i], i);
        }
        return result;
    };

    const normalizeDate = (dateField) => {
        if (!dateField) return '';
        if (typeof dateField === 'object' && dateField.seconds !== undefined) {
            try {
                const dateObj = dateField.toDate();
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                const day = String(dateObj.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            } catch (e) {
                console.error("Error converting timestamp", e);
            }
        }
        let clean = String(dateField);
        clean = clean.replace(/[\u200B-\u200D\uFEFF]/g, ''); 
        clean = convertToEnglishDigits(clean).trim();
        if (clean.includes('T')) clean = clean.split('T')[0];
        if (clean.includes(' ')) clean = clean.split(' ')[0];

        if (clean.includes('/')) {
            const parts = clean.split('/');
            if (parts.length === 3) {
                if (parts[2].length === 4) return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                if (parts[0].length === 4) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
        }
        if (clean.includes('-')) {
            const parts = clean.split('-');
            if (parts.length === 3) {
                const year = parts[0].length === 4 ? parts[0] : parts[2];
                const month = parts[1].padStart(2, '0');
                const day = (parts[0].length === 4 ? parts[2] : parts[0]).padStart(2, '0');
                if (year.length === 4) return `${year}-${month}-${day}`;
            }
        }
        return clean;
    };

    const cleanObjectForFirestore = (obj) => {
        if (obj === null || obj === undefined) return null;
        if (obj instanceof Date) return isNaN(obj.getTime()) ? new Date() : obj;
        if (Array.isArray(obj)) return obj.map(item => cleanObjectForFirestore(item)).filter(item => item !== undefined);
        if (typeof obj === 'object') {
            const cleaned = {};
            Object.keys(obj).forEach(key => {
                const value = obj[key];
                if (value !== undefined) cleaned[key] = cleanObjectForFirestore(value);
            });
            return cleaned;
        }
        return obj;
    };

    const exportToCSV = (data, fileName) => {
        if (!data || data.length === 0) {
            alert("⚠️ لم يتم العثور على بيانات تطابق المعايير لهذه العيادة!");
            return;
        }
        const headers = Object.keys(data[0]).join(",");
        const rows = data.map(row => 
            Object.values(row).map(value => {
                let cleanVal = value === null || value === undefined ? '' : String(value);
                cleanVal = cleanVal.replace(/"/g, '""');
                if (cleanVal.includes(',') || cleanVal.includes('\n') || cleanVal.includes('\r')) {
                    cleanVal = `"${cleanVal}"`;
                }
                return cleanVal;
            }).join(",")
        );
        const csvContent = [headers, ...rows].join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `${fileName}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFetchAndExport = async (subCollectionName, fileName) => {
        if (!clinicId) return;
        setLoadingExport(prev => ({ ...prev, [subCollectionName]: true }));
        try {
            const querySnapshot = await getDocs(collection(db, 'users', clinicId, subCollectionName));
            let rawData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (exportType === 'date_range' && startDate && endDate) {
                const start = normalizeDate(startDate);
                const end = normalizeDate(endDate);
                rawData = rawData.filter(item => {
                    const rawDateField = item.createdAt || item.date || '';
                    if (!rawDateField) return false;
                    const itemDate = normalizeDate(rawDateField);
                    return itemDate >= start && itemDate <= end;
                });
            }

            rawData.sort((a, b) => {
                const dateA = normalizeDate(a.createdAt || a.date || '');
                const dateB = normalizeDate(b.createdAt || b.date || '');
                return dateB.localeCompare(dateA);
            });

            const cleanedData = rawData.map(item => {
                if (subCollectionName === 'patients') {
                    return {
                        "رقم_المريض": item.id, "الاسم_الكامل": item.name || '', "رقم_الهاتف": item.phone || '',
                        "تاريخ_التسجيل": normalizeDate(item.date || item.createdAt), "العمر": item.age || '',
                        "الجنس": item.gender || '', "نوع_العدسة": item.lensType || '', "المبلغ_المدفوع": item.paid || 0,
                        "الحالة": item.status || '', "ملاحظات_طبية": item.notes || ''
                    };
                } else if (subCollectionName === 'store') {
                    return {
                        "كود_المادة": item.id || item.sku || '', "اسم_المنتج": item.itemName || '', "البراند": item.brand || '',
                        "التصنيف": item.category || '', "الكمية_المتوفرة": item.currentStock !== undefined ? item.currentStock : (item.quantity || 0),
                        "الحد_الأدنى_للتنبيه": item.minAlertQty || 0, "سعر_البيع": item.sellingPrice || 0, "سعر_الشراء": item.wholesalePrice || 0,
                        "المجهز_المورد": item.supplier || '', "حالة_المنتج": item.itemStatus || '', "التاريخ": normalizeDate(item.date || item.createdAt)
                    };
                } else if (subCollectionName === 'expenses') {
                    return {
                        "رقم_المصروف": item.id, "بيان_المصروف_السبب": item.reason || '', "المبلغ_المصروف": item.amount || 0,
                        "التاريخ": normalizeDate(item.date || item.createdAt)
                    };
                } else if (subCollectionName === 'store_movements') {
                    return {
                        "رقم_الحركة": item.id, "اسم_المادة": item.itemName || '', "نوع_الحركة": item.type || '',
                        "الكمية": item.qty || 0, "السعر": item.price || 0, "ملاحظات": item.note || '', "التاريخ": normalizeDate(item.date || item.createdAt)
                    };
                }
                return item;
            });

            exportToCSV(cleanedData, fileName);
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء تصدير البيانات.");
        } 
        finally {
            setLoadingExport(prev => ({ ...prev, [subCollectionName]: false }));
        }
    };

    const handleImportCSV = (e) => {
        const file = e.target.files[0];
        if (!file || !clinicId) return;

        setImportLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
                if (lines.length <= 1) {
                    alert("⚠️ الملف فارغ!");
                    setImportLoading(false);
                    return;
                }

                const headers = lines[0].replace(/^\ufeff/, "").trim().split(",").map(h => h.replace(/"/g, '').trim());
                let batch = writeBatch(db);
                let successCount = 0;
                let batchCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
                    const currentLine = matches.map(val => val.replace(/^"|"$/g, '').trim());
                    
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = currentLine[index] !== undefined ? currentLine[index] : '';
                    });

                    if (importTarget === 'expenses') {
                        const docId = rowData["رقم_المصروف"] || `expense_${Date.now()}_${i}`;
                        const docRef = doc(db, "users", clinicId, "expenses", docId);
                        const originalDate = normalizeDate(rowData["التاريخ"]) || new Date().toISOString().split('T')[0];
                        
                        batch.set(docRef, {
                            reason: rowData["بيان_المصروف_السبب"] || '',
                            amount: Number(rowData["المبلغ_المصروف"]) || 0,
                            date: originalDate,
                            createdAt: new Date(originalDate),
                            importedBy: currentUserUsername || 'admin'
                        }, { merge: true });
                        successCount++;
                        batchCount++;
                    } else if (importTarget === 'patients') {
                        const docId = rowData["رقم_المريض"] || `patient_${Date.now()}_${i}`;
                        const docRef = doc(db, "users", clinicId, "patients", docId);
                        const originalDate = normalizeDate(rowData["تاريخ_التسجيل"]) || new Date().toISOString().split('T')[0];
                        
                        const rawData = {
                            name: rowData["الاسم_الكامل"] || 'غير معروف', phone: rowData["رقم_الهاتف"] || '',
                            date: originalDate, createdAt: new Date(originalDate), age: rowData["العمر"] || '',
                            gender: rowData["الجنس"] || '', lensType: rowData["نوع_العدسة"] || '',
                            paid: Number(rowData["المبلغ_المدفوع"]) || 0, status: rowData["الحالة"] || '', notes: rowData["ملاحظات_طبية"] || '',
                            importedBy: currentUserUsername || 'admin'
                        };

                        batch.set(docRef, cleanObjectForFirestore(rawData), { merge: true });
                        successCount++;
                        batchCount++;
                    } else if (importTarget === 'store') {
                        const docId = rowData["كود_المادة"] || `item_${Date.now()}_${i}`;
                        const docRef = doc(db, "users", clinicId, "store", docId);
                        const originalItemDate = normalizeDate(rowData["التاريخ"]) || new Date().toISOString().split('T')[0];
                        
                        const rawData = {
                            sku: docId, itemName: rowData["اسم_المنتج"] || 'منتج مستورد', brand: rowData["البراند"] || '',
                            category: rowData["التصنيف"] || '', currentStock: Number(rowData["الكمية_المتوفرة"]) || 0,
                            minAlertQty: Number(rowData["الحد_الأدنى_للتنبيه"]) || 0, sellingPrice: Number(rowData["سعر_البيع"]) || 0,
                            wholesalePrice: Number(rowData["سعر_الشراء"]) || 0, supplier: rowData["المجهز_المورد"] || '',
                            itemStatus: rowData["حالة_المنتج"] || '', date: originalItemDate, createdAt: new Date(originalItemDate),
                            importedBy: currentUserUsername || 'admin'
                        };

                        batch.set(docRef, cleanObjectForFirestore(rawData), { merge: true });
                        successCount++;
                        batchCount++;
                    }

                    if (batchCount >= 400) {
                        await batch.commit();
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                }

                if (batchCount > 0) await batch.commit();

                alert(`✅ نجح استيراد البيانات وتحديث لعيادتك بنجاح!`);
                e.target.value = null;
            } catch (error) {
                console.error(error);
                alert("❌ حدث خطأ أثناء رفع البيانات.");
            } finally {
                setImportLoading(false);
            }
        };
        reader.readAsText(file, "UTF-8");
    };

    const handleExportAllFinances = async () => {
        if (!clinicId) return;
        setLoadingExport(prev => ({ ...prev, finances: true }));
        try {
            const allTransactions = [];
            
            const patientsSnap = await getDocs(collection(db, 'users', clinicId, 'patients'));
            patientsSnap.forEach(docSnap => {
                const data = docSnap.data();
                const pDate = normalizeDate(data.date || data.createdAt);
                if (data.paid && Number(data.paid) > 0) {
                    allTransactions.push({
                        "الرقم_المرجعي": docSnap.id, "نوع_الحركة": "مبيعات وكشفيات المرضى", "القيمة_المالية": Number(data.paid),
                        "البيان_التفصيلي": `كشفية/مبيعات للمريض: ${data.name || 'غير معروف'} (${data.status || 'فحص ومراجع'})`, "التاريخ": pDate
                    });
                }
            });

            const expensesSnap = await getDocs(collection(db, 'users', clinicId, 'expenses'));
            expensesSnap.forEach(docSnap => {
                const data = docSnap.data();
                const expDate = normalizeDate(data.date || data.createdAt);
                allTransactions.push({
                    "الرقم_المرجعي": docSnap.id, "نوع_الحركة": "مصاريف ونفقات عامة", "القيمة_المالية": Number(data.amount || 0),
                    "البيان_التفصيلي": `صرف مالي لـ: ${data.reason || 'نفقات متنوعة'}`, "التاريخ": expDate
                });
            });

            const movementsSnap = await getDocs(collection(db, 'users', clinicId, 'store_movements'));
            movementsSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.type === 'وارد' || data.type === 'مسترجع') {
                    const movDate = normalizeDate(data.date || data.createdAt);
                    const cost = Number(data.wholesalePrice || data.price || 0) * Number(data.qty || 1);
                    allTransactions.push({
                        "الرقم_المرجعي": docSnap.id, "نوع_الحركة": "شراء وتوريد بضائع", "القيمة_المالية": cost,
                        "البيان_التفصيلي": `حركة (${data.type}) كمية (${data.qty}) من المادة: ${data.itemName || ''}`, "التاريخ": movDate
                    });
                }
            });

            let filteredTransactions = allTransactions;
            if (exportType === 'date_range' && startDate && endDate) {
                const start = normalizeDate(startDate);
                const end = normalizeDate(endDate);
                filteredTransactions = allTransactions.filter(item => {
                    const itemDate = normalizeDate(item.التاريخ);
                    return itemDate >= start && itemDate <= end;
                });
            }

            filteredTransactions.sort((a, b) => b.التاريخ.localeCompare(a.التاريخ));
            exportToCSV(filteredTransactions, 'التقرير_المالي_الموحد_والشامل');
        } catch (error) {
            console.error(error);
            alert("حدث خطأ أثناء تصدير الحركة المالية الموحدة.");
        } finally {
            setLoadingExport(prev => ({ ...prev, finances: false }));
        }
    };

    const handleImportAllFinances = (e) => {
        const file = e.target.files[0];
        if (!file || !clinicId) return;

        setFinancialImportLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const text = event.target.result;
                const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
                if (lines.length <= 1) {
                    alert("⚠️ الملف المرفق فارغ أو غير صحيح!");
                    setFinancialImportLoading(false);
                    return;
                }

                const headers = lines[0].replace(/^\ufeff/, "").trim().split(",").map(h => h.replace(/"/g, '').trim());
                let batch = writeBatch(db);
                let restoredCount = 0;
                let batchCount = 0;

                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;

                    const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
                    const currentLine = matches.map(val => val.replace(/^"|"$/g, '').trim());
                    
                    const rowData = {};
                    headers.forEach((header, index) => {
                        rowData[header] = currentLine[index] !== undefined ? currentLine[index] : '';
                    });

                    const refId = rowData["الرقم_المرجعي"] || `restored_fin_${Date.now()}_${i}`;
                    const type = rowData["نوع_الحركة"];
                    const amount = Number(rowData["القيمة_المالية"]) || 0;
                    const details = rowData["البيان_التفصيلي"] || '';
                    const date = normalizeDate(rowData["التاريخ"]) || new Date().toISOString().split('T')[0];

                    if (type === "مبيعات وكشفيات المرضى") {
                        const patientRef = doc(db, "users", clinicId, "patients", refId);
                        const nameMatch = details.match(/المريض:\s*([^\(]+)/);
                        const patientName = nameMatch ? nameMatch[1].trim() : 'مريض مسترجع مالي';
                        const rawData = { name: patientName, paid: amount, date: date, createdAt: new Date(date), status: "مسترجع محاسبي", restoredBy: currentUserUsername || 'admin' };
                        batch.set(patientRef, cleanObjectForFirestore(rawData), { merge: true });
                        restoredCount++; batchCount++;
                    } else if (type === "مصاريف ونفقات عامة") {
                        const expenseRef = doc(db, "users", clinicId, "expenses", refId);
                        const reasonMatch = details.match(/صرف مالي لـ:\s*(.+)/);
                        const reason = reasonMatch ? reasonMatch[1].trim() : 'مصروف عام مسترجع';
                        const rawData = { amount: amount, reason: reason, date: date, createdAt: new Date(date), restoredBy: currentUserUsername || 'admin' };
                        batch.set(expenseRef, cleanObjectForFirestore(rawData), { merge: true });
                        restoredCount++; batchCount++;
                    } else if (type === "شراء وتوريد بضائع") {
                        const movementRef = doc(db, "users", clinicId, "store_movements", refId);
                        const itemMatch = details.match(/المادة:\s*([^-]+)/);
                        const itemName = itemMatch ? itemMatch[1].trim() : 'صنف مستورد';
                        const qtyMatch = details.match(/كمية\s*\((\d+)\)/);
                        const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
                        const rawData = { itemName: itemName, type: "وارد", qty: qty, wholesalePrice: amount / qty, note: details, date: date, createdAt: new Date(date), restoredBy: currentUserUsername || 'admin' };
                        batch.set(movementRef, cleanObjectForFirestore(rawData), { merge: true });
                        restoredCount++; batchCount++;
                    }

                    if (batchCount >= 400) {
                        await batch.commit();
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                }
                if (batchCount > 0) await batch.commit();
                alert(`✅ تم استعادة وتوجيه ${restoredCount} حركة مالية  بنجاح!`);
                e.target.value = null;
            } catch (error) {
                console.error(error);
                alert("❌ حدث خطأ أثناء عملية استرجاع وتفكيك البيانات.");
            } finally {
                setFinancialImportLoading(false);
            }
        };
        reader.readAsText(file, "UTF-8");
    };

    const handleFullBackupExport = async () => {
        if (!clinicId) return;
        setFullBackupExportLoading(true);
        try {
            const patientsSnap = await getDocs(collection(db, 'users', clinicId, 'patients'));
            const storeSnap = await getDocs(collection(db, 'users', clinicId, 'store'));
            const expensesSnap = await getDocs(collection(db, 'users', clinicId, 'expenses'));
            const movementsSnap = await getDocs(collection(db, 'users', clinicId, 'store_movements'));

            const backupData = { 
                clinicId: clinicId, 
                patients: [], 
                store: [], 
                expenses: [], 
                store_movements: [],
                exportedBy: currentUserUsername || 'admin',
                exportedAt: new Date().toISOString()
            };

            patientsSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.createdAt && typeof data.createdAt.toDate === 'function') data.createdAt = data.createdAt.toDate().toISOString();
                backupData.patients.push({ id: docSnap.id, ...data });
            });

            storeSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.createdAt && typeof data.createdAt.toDate === 'function') data.createdAt = data.createdAt.toDate().toISOString();
                backupData.store.push({ id: docSnap.id, ...data });
            });

            expensesSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.createdAt && typeof data.createdAt.toDate === 'function') data.createdAt = data.createdAt.toDate().toISOString();
                backupData.expenses.push({ id: docSnap.id, ...data });
            });

            movementsSnap.forEach(docSnap => {
                const data = docSnap.data();
                if (data.createdAt && typeof data.createdAt.toDate === 'function') data.createdAt = data.createdAt.toDate().toISOString();
                backupData.store_movements.push({ id: docSnap.id, ...data });
            });

            const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(backupData, null, 2))}`;
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute('href', jsonString);
            downloadAnchor.setAttribute('download', `clinic_sub_collections_backup_${new Date().toISOString().split('T')[0]}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            alert("✅ نجح تصدير النسخة الشاملة والمحمية من عيادتك!");
        } catch (error) {
            console.error(error);
            alert("❌ حدث خطأ أثناء تجميع وتصدير النسخة الاحتياطية.");
        } finally {
            setFullBackupExportLoading(false);
        }
    };

    // 🌟 دالة الاستعادة المعدلة لحماية عزل العيادات 🌟
    const handleFullBackupImport = (e) => {
        const file = e.target.files[0];
        if (!file || !clinicId) return;

        setFullBackupImportLoading(true);
        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const backupData = JSON.parse(event.target.result);
                if (!backupData.patients || !backupData.store) {
                    alert("⚠️ الملف المرفق ليس ملف نسخة احتياطية معتمد للهيكلية الفرعية!");
                    setFullBackupImportLoading(false);
                    return;
                }

                const operations = [];
                const restoreOriginalDate = (savedDate, fallbackString) => {
                    if (!savedDate) return fallbackString ? new Date(fallbackString) : new Date();
                    const parsedDate = new Date(savedDate);
                    return isNaN(parsedDate.getTime()) ? (fallbackString ? new Date(fallbackString) : new Date()) : parsedDate;
                };

                // 👥 1. استعادة المرضى بمعرفات جديدة فريدة منعا للتداخل
                if (backupData.patients && backupData.patients.length > 0) {
                    backupData.patients.forEach(item => {
                        const newDocRef = doc(collection(db, "users", clinicId, "patients"));
                        const { id, ...cleanData } = item;
                        cleanData.createdAt = restoreOriginalDate(cleanData.createdAt, cleanData.date);
                        cleanData.restoredAt = new Date().toISOString(); 
                        operations.push({ ref: newDocRef, data: cleanObjectForFirestore(cleanData) });
                    });
                }

                // 📦 2. استعادة المخزن بمعرفات جديدة وتحديث الـ SKU المرجعي للمادة
                if (backupData.store && backupData.store.length > 0) {
                    backupData.store.forEach(item => {
                        const newDocRef = doc(collection(db, "users", clinicId, "store"));
                        const { id, ...cleanData } = item;
                        cleanData.createdAt = restoreOriginalDate(cleanData.createdAt, cleanData.date);
                        cleanData.sku = newDocRef.id; 
                        cleanData.restoredAt = new Date().toISOString();
                        operations.push({ ref: newDocRef, data: cleanObjectForFirestore(cleanData) });
                    });
                }

                // 💵 3. استعادة المصاريف بمعرفات جديدة
                if (backupData.expenses && backupData.expenses.length > 0) {
                    backupData.expenses.forEach(item => {
                        const newDocRef = doc(collection(db, "users", clinicId, "expenses"));
                        const { id, ...cleanData } = item;
                        cleanData.createdAt = restoreOriginalDate(cleanData.createdAt, cleanData.date);
                        cleanData.restoredAt = new Date().toISOString();
                        operations.push({ ref: newDocRef, data: cleanObjectForFirestore(cleanData) });
                    });
                }

                // 🔄 4. استعادة حركات المخزن بمعرفات جديدة
                if (backupData.store_movements && backupData.store_movements.length > 0) {
                    backupData.store_movements.forEach(item => {
                        const newDocRef = doc(collection(db, "users", clinicId, "store_movements"));
                        const { id, ...cleanData } = item;
                        cleanData.createdAt = restoreOriginalDate(cleanData.createdAt, cleanData.date);
                        cleanData.restoredAt = new Date().toISOString();
                        operations.push({ ref: newDocRef, data: cleanObjectForFirestore(cleanData) });
                    });
                }

                let successCount = 0;
                let currentBatch = writeBatch(db);
                let currentBatchSize = 0;

                for (const op of operations) {
                    if (!op.ref || !op.data) continue;
                    currentBatch.set(op.ref, op.data, { merge: true });
                    successCount++; currentBatchSize++;
                    if (currentBatchSize >= 400) {
                        await currentBatch.commit();
                        currentBatch = writeBatch(db);
                        currentBatchSize = 0;
                    }
                }
                if (currentBatchSize > 0) await currentBatch.commit();
                alert(`✅ تم فك وعزل السجلات بنجاح! تم استيراد ${successCount} سجل جديد كلياً لحساب هذه العيادة دون التأثير على الآخرين.`);
                e.target.value = null;
            } catch (error) {
                console.error(error);
                alert("❌ حدث خطأ أثناء قراءة ملف النسخة الاحتياطية وتوزيع الجداول الفرعية.");
            } finally {
                setFullBackupImportLoading(false);
            }
        };
        reader.readAsText(file, "UTF-8");
    };

    if (!isAdmin) {
        return (
            <div style={{ padding: '8vw 3vw', textAlign: 'center', color: '#DC2626', fontFamily: "'Exo 2', 'Cairo', sans-serif", minHeight: '100vh', backgroundColor: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                <h2 style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: '700' }}>عذراً، لا تمتلك الصلاحية الكافية لإدارة أمان النظام الفرعي.</h2>
            </div>
        );
    }

    // --- 🎨 Modern High-Contrast Medical Light Theme Values ---
    const bgColor = '#F8FAFC';
    const textColor = '#334155';
    const titleColor = '#0F172A';
    const cardBg = '#FFFFFF';
    const cardBorder = '#E2E8F0';
    const inputBg = '#FFFFFF';
    const inputBorder = '#CBD5E1';
    const subTextColor = '#64748B';
    const primaryBlue = '#0284C7';
    const accentTeal = '#0D9488';
    const bgGradient = 'radial-gradient(circle at 10% 10%, rgba(14, 165, 233, 0.05) 0%, transparent 50%), radial-gradient(circle at 90% 90%, rgba(13, 148, 136, 0.05) 0%, transparent 50%), #F8FAFC';

    const inputStyle = {
        width: '100%', padding: '12px 14px', borderRadius: '12px', border: `1px solid ${inputBorder}`,
        backgroundColor: inputBg, color: titleColor, fontSize: '13px', outline: 'none', fontWeight: '600',
        boxSizing: 'border-box', transition: 'all 0.2s ease-in-out'
    };

    return (
        <div className="settings-page-wrapper" style={{ 
            padding: '4vw 3vw', backgroundColor: bgColor, 
            backgroundImage: bgGradient,
            backgroundAttachment: 'fixed', fontFamily: "'Exo 2', 'Cairo', sans-serif", direction: 'rtl', 
            minHeight: '100vh', color: textColor, boxSizing: 'border-box', width: '100%', maxWidth: '100vw', overflowX: 'hidden'
        }}>
            
            <style>{`
                .modern-card {
                    background: ${cardBg} !important;
                    border: 1px solid ${cardBorder} !important;
                    border-radius: 20px !important;
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.03), 0 2px 6px rgba(15, 23, 42, 0.02);
                    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .modern-card:hover {
                    border-color: #CBD5E1 !important;
                    box-shadow: 0 14px 30px rgba(14, 165, 233, 0.08);
                }
                .responsive-header {
                    margin-bottom: 35px; background: #FFFFFF;
                    padding: 20px 30px; border-radius: 20px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04); border: 1px solid ${cardBorder};
                    display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;
                }
                .responsive-grid {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 25px; margin-bottom: 35px;
                }
                .cards-sub-grid {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 15px; margin-bottom: 20px;
                }
                .settings-btn {
                    padding: 12px 18px; color: #ffffff; border: none; border-radius: 12px; cursor: pointer; font-weight: 700; font-size: 13px; transition: all 0.2s ease;
                    display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .settings-btn:hover {
                    transform: translateY(-1px); filter: brightness(1.05); box-shadow: 0 6px 16px rgba(2, 132, 199, 0.2);
                }
                .custom-input-file::-webkit-file-upload-button {
                    background: ${primaryBlue}; color: white; border: none; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-weight: 600; margin-left: 10px; transition: background 0.2s;
                }
                .custom-input-file::-webkit-file-upload-button:hover {
                    background: #0284C7;
                }
                input:focus, select:focus {
                    border-color: ${primaryBlue} !important;
                    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15) !important;
                }

                /* 📱 التحسينات الشاملة للهواتف والشاشات الصغيرة */
                @media (max-width: 768px) {
                    .settings-page-wrapper {
                        padding: 12px 10px !important;
                    }
                    .responsive-header {
                        padding: 14px 16px !important;
                        margin-bottom: 16px !important;
                        border-radius: 16px !important;
                        gap: 10px !important;
                    }
                    .modern-card {
                        padding: 14px !important;
                        margin-bottom: 16px !important;
                        border-radius: 16px !important;
                    }
                    .responsive-grid {
                        grid-template-columns: 1fr !important;
                        gap: 16px !important;
                        margin-bottom: 16px !important;
                    }
                    .cards-sub-grid {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 10px !important;
                        margin-bottom: 14px !important;
                    }
                    .settings-card-item {
                        padding: 10px 8px !important;
                        border-radius: 12px !important;
                    }
                    .settings-card-icon {
                        font-size: 18px !important;
                    }
                    .settings-card-title {
                        font-size: 11px !important;
                        margin: 4px 0 !important;
                    }
                    .settings-btn {
                        padding: 8px 10px !important;
                        font-size: 11px !important;
                        border-radius: 10px !important;
                    }
                    input, select, button {
                        font-size: 11px !important;
                    }
                }

                /* 📱 الهواتف الصغيرة جداً (بطاقتان لكل صف تنخفض لبطاقة واحدة) */
                @media (max-width: 380px) {
                    .cards-sub-grid {
                        grid-template-columns: 1fr !important;
                    }
                }
            `}</style>

            {/* الهيدر */}
            <header className="responsive-header">
                <div>
                    <h1 style={{ fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: '700', color: titleColor, margin: 0, wordBreak: 'break-word', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
                        مركز الأمان والنسخ الاحتياطي  
                    </h1>
                    <p style={{ fontSize: '12px', color: subTextColor, margin: '6px 0 0 0', wordBreak: 'break-word' }}>
                        تصدير التقارير واستعادة الجداول المباشرة من الهيكلية العنقودية المحمية لعيادتك.
                    </p>
                    {currentUserUsername && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '8px', fontSize: '11px', background: '#F0F9FF', border: '1px solid #BAE6FD', color: primaryBlue, padding: '4px 10px', borderRadius: '8px', fontWeight: '700' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                            المسؤول المفوّض: @{currentUserUsername}
                        </span>
                    )}
                </div>
            </header>

            {/* 🏥 قسم هوية العيادة وإعدادات الطباعة */}
            <section className="modern-card" style={{ padding: '25px', marginBottom: '25px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '5px', height: '100%', background: primaryBlue }}></div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: titleColor, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
                    إعدادات هوية العيادة والوصل المطبوع
                </h3>
                <p style={{ color: subTextColor, fontSize: '11px', marginBottom: '16px' }}>أدخل البيانات التي ترغب في ظهورها في أعلى (Header) تقارير فحص المرضى والوصولات المالية المطبوعة.</p>

                <form onSubmit={handleSaveClinicSettings} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <div>
                            <label style={{ fontSize: '11px', color: textColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                                اسم العيادة / المركز (يظهر رئيسياً):
                            </label>
                            <input type="text" value={clinicName} onChange={(e) => setClinicName(e.target.value)} placeholder="مثال: عيادة كيورا  " required style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', color: textColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                                رقم الهاتف الأول:
                            </label>
                            <input type="text" value={clinicPhone1} onChange={(e) => setClinicPhone1(e.target.value)} placeholder="مثال: 078xxxxxxxx" required style={inputStyle} />
                        </div>
                        <div>
                            <label style={{ fontSize: '11px', color: textColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                                رقم الهاتف الثاني (اختياري):
                            </label>
                            <input type="text" value={clinicPhone2} onChange={(e) => setClinicPhone2(e.target.value)} placeholder="مثال: 077xxxxxxxx" style={inputStyle} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', justifyContent: 'space-between' }}>
                        <div>
                            <label style={{ fontSize: '11px', color: textColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                العنوان الكامل للعيادة:
                            </label>
                            <input type="text" value={clinicAddress} onChange={(e) => setClinicAddress(e.target.value)} placeholder="مثال: بغداد - المنصور - مجاور ..." required style={inputStyle} />
                        </div>

                        <div>
                            <label style={{ fontSize: '11px', color: textColor, fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                شعار العيادة Logo (يظهر بالجانب):
                            </label>
                            <input type="file" accept="image/*" onChange={handleLogoChange} className="custom-input-file" style={{ width: '100%', padding: '6px', borderRadius: '12px', backgroundColor: '#F1F5F9', color: textColor, border: `1px dashed ${inputBorder}`, cursor: 'pointer', fontSize: '11px', boxSizing: 'border-box' }} />
                        </div>

                        <button type="submit" disabled={saveSettingsLoading} className="settings-btn" style={{ backgroundColor: accentTeal, width: '100%', borderRadius: '12px', fontWeight: '700', marginTop: 'auto', minHeight: '40px' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
                            {saveSettingsLoading ? 'جاري الحفظ والتزامن...' : 'حفظ وتثبيت هوية العيادة'}
                        </button>
                    </div>

                    {/* معاينة اللوغو */}
                    <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '16px', border: `1px solid ${inputBorder}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ fontSize: '11px', color: subTextColor, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                            Logo العيادة :
                        </span>
                        {clinicLogo ? (
                            <img src={clinicLogo} alt="Clinic Logo" style={{ maxWidth: '90px', maxHeight: '90px', borderRadius: '12px', objectFit: 'contain', border: '2px solid #CBD5E1', padding: '4px', backgroundColor: '#FFF' }} />
                        ) : (
                            <div style={{ width: '80px', height: '80px', borderRadius: '12px', border: `2px dashed ${inputBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: subTextColor, fontSize: '10px', flexDirection: 'column', gap: '4px', backgroundColor: '#FFF' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>
                                لا يوجد شعار
                            </div>
                        )}
                    </div>
                </form>
            </section>

            {/* 💎 قسم النسخ الاحتياطي الكامل */}
            <section className="modern-card" style={{ padding: '25px', marginBottom: '25px', position: 'relative' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: titleColor, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                    النسخ الاحتياطي السحابي الكامل  
                </h3>
                <p style={{ color: subTextColor, fontSize: '11px', marginBottom: '16px' }}>سحب وضخ كافة البيانات من الجداول المبطنة (المرضى، جرد المخزن، الحركات المحاسبية، المصاريف) بملف واحد متناسق بنيوياً.</p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
                    <div className="settings-card-item" style={{ background: '#F8FAFC', padding: '16px', borderRadius: '16px', border: `1px solid ${inputBorder}`, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                            <span className="settings-card-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                            </span>
                            <h4 className="settings-card-title" style={{ margin: '6px 0', fontSize: '13px', color: titleColor, fontWeight: '700' }}>تصدير الهيكلية كاملة</h4>
                        </div>
                        <button disabled={fullBackupExportLoading} onClick={fullBackupExportLoading ? null : handleFullBackupExport} className="settings-btn" style={{ backgroundColor: primaryBlue, width: '100%', marginTop: '10px', borderRadius: '12px', fontWeight: '700' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                            {fullBackupExportLoading ? 'جاري القراءة المباشرة...' : 'تحميل الملف الكامل (JSON)'}
                        </button>
                    </div>

                    <div className="settings-card-item" style={{ background: '#F8FAFC', padding: '16px', borderRadius: '16px', border: `1px solid ${inputBorder}`, textAlign: 'center' }}>
                        <span className="settings-card-icon" style={{ display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={accentTeal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        </span>
                        <h4 className="settings-card-title" style={{ margin: '6px 0', fontSize: '13px', color: titleColor, fontWeight: '700' }}>استعادة وتغذية المجموعات الفرعية</h4>
                        <input type="file" accept=".json" className="custom-input-file" disabled={fullBackupImportLoading} onChange={handleFullBackupImport} style={{ width: '100%', padding: '6px', borderRadius: '12px', backgroundColor: '#FFFFFF', color: textColor, border: `1px dashed ${inputBorder}`, cursor: 'pointer', fontSize: '11px', marginTop: '10px', boxSizing: 'border-box' }} />
                        {fullBackupImportLoading && <p style={{ fontSize: '10px', color: accentTeal, marginTop: '6px', fontWeight: '700' }}>جاري الفك والضخ المباشر بالسيرفر...</p>}
                    </div>
                </div>
            </section>

            {/* نطاق التاريخ */}
            <div className="modern-card" style={{ padding: '16px', marginBottom: '25px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                <h4 style={{ margin: 0, color: titleColor, fontSize: '13px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    فلترة النطاق الزمني للتصدير:
                </h4>
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: textColor, fontWeight: '600' }}>
                        <input type="radio" name="exportType" checked={exportType === 'all'} onChange={() => setExportType('all')} style={{ accentColor: primaryBlue }}/>
                        كل البيانات التاريخية
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px', color: textColor, fontWeight: '600' }}>
                        <input type="radio" name="exportType" checked={exportType === 'date_range'} onChange={() => setExportType('date_range')} style={{ accentColor: primaryBlue }}/>
                        فترة محددة
                    </label>
                </div>

                {exportType === 'date_range' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '380px' }}>
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={{ ...inputStyle, flex: '1 1 110px', padding: '6px 8px' }} />
                        <span style={{ fontSize: '11px', color: subTextColor, fontWeight: '600' }}>إلى</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={{ ...inputStyle, flex: '1 1 110px', padding: '6px 8px' }} />
                    </div>
                )}
            </div>

            {/* الأقسام المستقلة CSV */}
            <section className="modern-card" style={{ padding: '25px', marginBottom: '25px' }}>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: titleColor, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                    أولاً: إدارة الأقسام المستقلة من المجموعات الفرعية (CSV)
                </h3>
                
                <div className="cards-sub-grid">
                    {[
                        { title: 'جرد المخزن الفرعي', key: 'store', file: 'جرد_المخزن', color: '#0284C7', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0284C7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> },
                        { title: 'سجل المرضى والمراجعين', key: 'patients', file: 'سجل_المرضى', color: '#0D9488', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg> },
                        { title: 'المصاريف والنفقات', key: 'expenses', file: 'تقرير_المصاريف', color: '#E11D48', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg> },
                        { title: 'حركات المخزن التتبعية', key: 'store_movements', file: 'حركات_المخزن', color: '#6366F1', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> }
                    ].map((item, idx) => (
                        <div key={idx} className="settings-card-item" style={{ background: '#F8FAFC', padding: '12px', borderRadius: '16px', border: `1px solid ${inputBorder}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <span className="settings-card-icon" style={{ marginBottom: '4px' }}>{item.icon}</span>
                                <h4 className="settings-card-title" style={{ margin: '4px 0', fontSize: '12px', color: titleColor, fontWeight: '700' }}>{item.title}</h4>
                            </div>
                            <button disabled={loadingExport[item.key]} onClick={() => handleFetchAndExport(item.key, item.file)} className="settings-btn" style={{ backgroundColor: item.color, width: '100%', padding: '6px', fontSize: '11px', marginTop: '8px', borderRadius: '8px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                {loadingExport[item.key] ? 'جاري...' : `تصدير الـ CSV`}
                            </button>
                        </div>
                    ))}
                </div>

                <div style={{ borderTop: `1px solid ${inputBorder}`, paddingTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
                    <h4 style={{ margin: 0, fontSize: '12px', color: accentTeal, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={accentTeal} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        استيراد وضخ مباشر في :
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', width: '100%', maxWidth: '650px' }}>
                        <select value={importTarget} onChange={(e) => setImportTarget(e.target.value)} style={{ ...inputStyle, flex: '1 1 180px', padding: '6px 8px' }}>
                            <option value="patients" style={{ backgroundColor: '#FFFFFF', color: titleColor }}>سجل المرضى والمراجعين</option>  
                            <option value="store" style={{ backgroundColor: '#FFFFFF', color: titleColor }}>المخزن والمواد</option>
                        </select>
                        <input type="file" accept=".csv" className="custom-input-file" disabled={importLoading} onChange={handleImportCSV} style={{ padding: '4px', fontSize: '11px', color: textColor, flex: '1 1 180px' }} />
                    </div>
                </div>
            </section>

            {/* التقرير المالي الموحد */}
            <section className="modern-card" style={{ padding: '25px', border: '1px solid #CCFBF1 !important', marginBottom: '25px', position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, right: 0, width: '5px', height: '100%', background: accentTeal }}></div>
                <h3 style={{ margin: '0 0 6px 0', fontSize: '15px', color: titleColor, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={accentTeal} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
                    ثانياً: دمج التدفقات المالية العنقودية في ملف تدوين موحد (CSV)
                </h3>
                <p style={{ color: subTextColor, fontSize: '11px', marginBottom: '16px' }}>يقوم بمسح كافة المجموعات الفرعية للعيادة تزامناً وتصدير ملف مالي مدمج للحسابات والأرباح والمصاريف.</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <button disabled={loadingExport.finances} onClick={handleExportAllFinances} className="settings-btn" style={{ backgroundColor: accentTeal, flex: '1 1 auto', fontWeight: '700', borderRadius: '12px' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        {loadingExport.finances ? 'جاري الدمج والمسح المحاسبي الفرعي...' : 'تصدير الحركة المحاسبية الموحدة (CSV)'}
                    </button>

                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: 'max-content' }}>
                        <span style={{ fontSize: '11px', color: subTextColor, display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                            فك وتوزيع الحسابات المستوردة :
                        </span>
                        <input type="file" accept=".csv" className="custom-input-file" disabled={financialImportLoading} onChange={handleImportAllFinances} style={{ padding: '4px', fontSize: '11px', color: textColor }} />
                    </div>
                </div>
            </section>

            {/* الموظفين والصلاحيات */}
            <div className="responsive-grid">
                <section className="modern-card" style={{ padding: '25px', position: 'relative', overflow: 'hidden' }}>
                    <div style={{ position: 'absolute', top: 0, right: 0, width: '5px', height: '100%', background: primaryBlue }}></div>
                    <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', color: titleColor, fontWeight: '700', borderBottom: `1px solid ${inputBorder}`, paddingBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={primaryBlue} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                        إدراج موظف جديد لعيادتك
                    </h3>
                    <form onSubmit={handleAddUser} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="الاسم الكامل للموظف" required style={inputStyle} />
                        <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="البريد الإلكتروني" required style={inputStyle} />
                        <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="اسم المستخدم بالإنجليزية" required style={{ ...inputStyle, textAlign: 'left' }} />
                        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="رمز المرور المشفر" required style={inputStyle} />

                        <div style={{ background: '#F8FAFC', padding: '12px', borderRadius: '14px', border: `1px solid ${inputBorder}` }}>
                            <label style={{ fontSize: '11px', fontWeight: '700', color: titleColor, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                صلاحيات الوصول للمجموعات والأقسام:
                            </label>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {[
                                    { key: 'store', label: 'جرد المخزن والمواد', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> },
                                    { key: 'stats', label: 'لوحة الإحصائيات والتقارير الفرعية', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> },
                                    { key: 'patients', label: 'سجل المراجعين', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg> },
                                    { key: 'whatsapp', label: 'نظام مراسلات الواتساب التلقائي', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> },
                                    { key: 'settings', label: 'لوحة التحكم والأمان المتقدمة', icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> }
                                ].map((perm) => (
                                    <label key={perm.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: textColor, fontWeight: '600', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={selectedPermissions[perm.key]} onChange={() => handlePermissionChange(perm.key)} style={{ width: '14px', height: '14px', accentColor: primaryBlue }} />
                                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>{perm.icon} {perm.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <button type="submit" className="settings-btn" style={{ backgroundColor: primaryBlue, width: '100%', borderRadius: '12px', fontWeight: '700' }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                            ربط وحفظ الحساب بالمجموعة الفرعية
                        </button>
                    </form>
                </section>

     <section className="modern-card" style={{ padding: '25px', position: 'relative', marginBottom: '80px', overflow: 'hidden' }}>
    <div style={{ position: 'absolute', top: 0, right: 0, width: '5px', height: '100%', background: accentTeal }}></div>
    
    <h3 style={{ 
        marginTop: 0,
        marginRight: 0,
        marginBottom: '12px',
        marginLeft: 0,
        fontSize: '14px', 
        color: titleColor, 
        fontWeight: '700', 
        borderBottom: `1px solid ${inputBorder}`, 
        paddingBottom: '8px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px' 
    }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={accentTeal} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
        طاقم موظفي العيادة المستعلم عنهم
    </h3>
                    
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right', fontSize: '12px' }}>
                            <thead>
                                <tr style={{ color: subTextColor, borderBottom: `2px solid ${inputBorder}`, backgroundColor: '#F8FAFC' }}>
                                    <th style={{ padding: '10px 8px', fontWeight: '700' }}>الموظف / اليوزر</th>
                                    <th style={{ padding: '10px 8px', fontWeight: '700' }}>الصلاحيات الفعالة</th>
                                    <th style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '700' }}>إجراء</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((user, idx) => (
                                    <tr key={idx} style={{ borderBottom: `1px solid ${inputBorder}`, color: textColor }}>
                                        <td style={{ padding: '12px 8px', fontWeight: '700', color: titleColor }}>
                                            {user.name} <br/>
                                            <span style={{ fontSize: '10px', color: primaryBlue }}>@{user.username}</span>
                                        </td>
                                        <td style={{ padding: '12px 8px', fontSize: '10px' }}>
                                            {user.permissions ? (
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                                    {user.permissions.store && <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: titleColor, padding: '2px 6px', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path></svg> مخزن</span>}
                                                    {user.permissions.stats && <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: titleColor, padding: '2px 6px', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> تقارير</span>}
                                                    {user.permissions.patients && <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: titleColor, padding: '2px 6px', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg> مرضى</span>}
                                                    {user.permissions.whatsapp && <span style={{ background: '#F1F5F9', border: '1px solid #CBD5E1', color: titleColor, padding: '2px 6px', borderRadius: '6px', fontWeight: '600', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg> واتساب</span>}
                                                    {user.permissions.settings && <span style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '2px 6px', borderRadius: '6px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '3px' }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle></svg> تحكم</span>}
                                                </div>
                                            ) : (
                                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: subTextColor }}><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={subTextColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line></svg> دخول عام</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                            {user.role === 'admin' || user.username === 'admin' ? (
                                                <span style={{ color: accentTeal, fontWeight: '700', fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#CCFBF1', padding: '3px 8px', borderRadius: '6px' }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={accentTeal} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
                                                    مسؤول جذر
                                                </span>
                                            ) : (
                                                <button onClick={() => handleDeleteUser(user.id, user.username, user.role)} style={{ border: 'none', background: '#FEF2F2', padding: '4px 8px', borderRadius: '6px', color: '#DC2626', cursor: 'pointer', fontSize: '11px', fontWeight: '700', display: 'inline-flex', alignItems: 'center', gap: '4px', transition: 'background 0.2s' }}>
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                                    سحب الحساب
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>
        </div>
    );
}
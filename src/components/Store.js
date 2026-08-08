'use client';
import { useState, useEffect, useRef } from 'react';
import { db, auth } from '@/firebase';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, writeBatch, getDoc, setDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function AnimatedNumber({ value, duration = 800 }) {
    const [displayValue, setDisplayValue] = useState(0);
    const valueRef = useRef(0);

    useEffect(() => {
        const start = valueRef.current;
        const end = Number(value) || 0;
        if (start === end) {
            setDisplayValue(end);
            return;
        }
        
        let startTime = null;
        const animate = (timestamp) => {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 1);
            const current = Math.floor(progress * (end - start) + start);
            setDisplayValue(current);
            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                valueRef.current = end;
                setDisplayValue(end);
            }
        };
        requestAnimationFrame(animate);
    }, [value, duration]);

    return <span>{displayValue.toLocaleString()} د.ع</span>;
}

export default function Store() {
    const [userId, setUserId] = useState(null);
    const [isAuthLoading, setIsAuthLoading] = useState(true);

    // --- 🏥 حالات هوية العيادة المربوطة بالإعدادات ---
    const [clinicName, setClinicName] = useState('CURA.IQ');
    const [clinicPhone1, setClinicPhone1] = useState('');
    const [clinicPhone2, setClinicPhone2] = useState('');
    const [clinicAddress, setClinicAddress] = useState('بغداد - المنصور');
    const [clinicLogo, setClinicLogo] = useState('');

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [showMovements, setShowMovements] = useState(false); 
    
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [selectedItems, setSelectedItems] = useState([]);

    const [isSaleModalOpen, setIsSaleModalOpen] = useState(false);
    const [selectedSaleItemId, setSelectedSaleItemId] = useState('');
    const [saleQty, setSaleQty] = useState(1);
    const [buyerName, setBuyerName] = useState('');
    const [cart, setCart] = useState([]); 
    
    const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
    const [expenseReason, setExpenseReason] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');

    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [categoryToDeleteSelect, setCategoryToDeleteSelect] = useState('');

    const [invoiceData, setInvoiceData] = useState(null); 
    const [purchaseInvoiceData, setPurchaseInvoiceData] = useState(null); 
    const [isPrintingInventory, setIsPrintingInventory] = useState(false); 

    const [editingId, setEditingId] = useState(null); 
    const [itemStatus, setItemStatus] = useState('جديد'); 
    const [itemName, setItemName] = useState('');
    
    const [categories, setCategories] = useState(['نظارات', 'عدسات', 'قطرات', 'أجهزة']);
    const [newCategoryInput, setNewCategoryInput] = useState('');
    const [category, setCategory] = useState('نظارات');
    
    const [sku, setSku] = useState('');
    const [brand, setBrand] = useState('');
    const [supplier, setSupplier] = useState(''); 
    const [currentStock, setCurrentStock] = useState(0);
    const [minAlertQty, setMinAlertQty] = useState(5);
    const [wholesalePrice, setWholesalePrice] = useState(0);
    const [sellingPrice, setSellingPrice] = useState(0);

    const [itemsList, setItemsList] = useState([]);
    const [movementsList, setMovementsList] = useState([]);
    const [expensesList, setExpensesList] = useState([]); 
    const [activeFilter, setActiveFilter] = useState('الكل');
    const [searchQuery, setSearchQuery] = useState(''); 

    // 🔒 حالات القفل والرمز السري المربوط بقاعدة البيانات Firestore
    const [isPinModalOpen, setIsPinModalOpen] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinAction, setPinAction] = useState(null); 
    const [savedPin, setSavedPin] = useState('');
    const [isSettingPinMode, setIsSettingPinMode] = useState(false);

    // ✏️ حالات تعديل الحركة يدوياً
    const [isEditMovementModalOpen, setIsEditMovementModalOpen] = useState(false);
    const [editingMovement, setEditingMovement] = useState(null);

    const getMovementBadge = (type) => {
        if (type === 'صادر') return <span className="badge badge-danger"><span className="dot dot-red"></span> صادر</span>;
        if (type === 'وارد') return <span className="badge badge-success"><span className="dot dot-green"></span> وارد</span>;
        if (type === 'مسترجع') return <span className="badge badge-neutral"><span className="dot dot-white-pulse"></span> مسترجع</span>;
        return <span className="badge badge-neutral">{type}</span>;
    };

    // --- حماية الجلسة وجلب إعدادات العيادة مباشرة مثل سجل المرضى ---
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUserId(user.uid);
                
                // جلب بيانات الإعدادات الخاصة بالعيادة مباشرة من وثيقة المستخدم
                try {
                    const userDocRef = doc(db, 'users', user.uid); 
                    const userDocSnap = await getDoc(userDocRef);

                    if (userDocSnap.exists()) {
                        const data = userDocSnap.data();
                        setClinicName(data.clinicName || 'CURA.IQ');
                        setClinicAddress(data.clinicAddress || 'بغداد - المنصور');
                        setClinicPhone1(data.clinicPhone1 || '');
                        setClinicPhone2(data.clinicPhone2 || '');
                        setClinicLogo(data.clinicLogo || '');
                    }
                } catch (error) {
                    console.error("Error fetching clinic settings from user doc:", error);
                }
            } else {
                setUserId(null);
                setItemsList([]);
                setMovementsList([]);
                setExpensesList([]);
                setSavedPin('');
            }
            setIsAuthLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const fetchData = async () => {
        if (!userId) return; 
        try {
            const settingsDocRef = doc(db, 'users', userId, 'settings', 'clinic_settings');
            const settingsDocSnap = await getDoc(settingsDocRef);
            
            if (settingsDocSnap.exists()) {
                const data = settingsDocSnap.data();
                if (data.clinicName) setClinicName(data.clinicName);
                if (data.clinicPhone1) setClinicPhone1(data.clinicPhone1);
                if (data.clinicPhone2) setClinicPhone2(data.clinicPhone2);
                if (data.clinicAddress) setClinicAddress(data.clinicAddress);
                
                if (data.securePin) {
                    setSavedPin(data.securePin);
                } else {
                    setSavedPin('');
                }
            } else {
                const oldUserRef = doc(db, 'users', userId);
                const oldUserSnap = await getDoc(oldUserRef);
                if (oldUserSnap.exists() && oldUserSnap.data().securePin) {
                    setSavedPin(oldUserSnap.data().securePin);
                }
            }

            const qItems = query(collection(db, 'users', userId, 'store'), orderBy('createdAt', 'desc'));
            const querySnapshotItems = await getDocs(qItems);
            const items = [];
            querySnapshotItems.forEach((document) => {
                items.push({ id: document.id, ...document.data() });
            });
            setItemsList(items);

            const qMovements = query(collection(db, 'users', userId, 'store_movements'), orderBy('createdAt', 'desc'));
            const querySnapshotMovements = await getDocs(qMovements);
            const movements = [];
            querySnapshotMovements.forEach((document) => {
                movements.push({ id: document.id, ...document.data() });
            });
            setMovementsList(movements);

            const qExpenses = query(collection(db, 'users', userId, 'expenses'), orderBy('createdAt', 'desc'));
            const querySnapshotExpenses = await getDocs(qExpenses);
            const expenses = [];
            querySnapshotExpenses.forEach((document) => {
                expenses.push({ id: document.id, ...document.data() });
            });
            setExpensesList(expenses);

        } catch (error) {
            console.error("Error fetching data:", error);
        }
    };

    useEffect(() => {
        if (userId) {
            fetchData();
        }
        const savedCats = localStorage.getItem('store_categories');
        if (savedCats) {
            const parsed = JSON.parse(savedCats);
            setCategories(parsed);
            if (parsed.length > 0) setCategoryToDeleteSelect(parsed[0]);
        } else {
            setCategoryToDeleteSelect('نظارات');
        }
    }, [userId]);

    const handlePinSubmit = async (e) => {
        e.preventDefault();
        if (!userId) return;

        const settingsRef = doc(db, 'users', userId, 'settings', 'clinic_settings');

        if (isSettingPinMode) {
            if (pinInput.length < 4) return alert('الرمز يجب أن لا يقل عن 4 أرقام');
            
            try {
                await setDoc(settingsRef, { securePin: pinInput }, { merge: true });
                
                setSavedPin(pinInput);
                setIsSettingPinMode(false);
                alert('تم تعيين رمز الأمان بنجاح في الإعدادات المشتركة! يمكنك الآن إتمام العملية.');
                executeProtectedAction(pinAction, pinInput);
            } catch (error) {
                console.error("Error saving secure PIN to settings:", error);
                alert('حدث خطأ أثناء حفظ رمز الأمان في الإعدادات.');
            }
        } else {
            if (pinInput === savedPin) {
                executeProtectedAction(pinAction, savedPin);
            } else {
                alert('رمز الأمان غير صحيح! لا يمكن تنفيذ العملية.');
            }
        }
        setPinInput('');
    };

    const triggerProtectedAction = (action) => {
        setPinAction(action);
        if (!savedPin) {
            setIsSettingPinMode(true);
            setIsPinModalOpen(true);
        } else {
            setIsSettingPinMode(false);
            setIsPinModalOpen(true);
        }
    };

    const executeProtectedAction = async (action, validatedPin) => {
        setIsPinModalOpen(false);
        if (action.type === 'delete_movement') {
            await confirmDeleteMovement(action.id);
        } else if (action.type === 'edit_movement') {
            setEditingMovement(action.data);
            setIsEditMovementModalOpen(true);
        }
    };

    const confirmDeleteMovement = async (movId) => {
        if (!userId) return;
        const targetMov = movementsList.find(m => m.id === movId);
        if (!targetMov) return alert('الحركة غير موجودة');

        if (window.confirm(`هل أنت متأكد من حذف حركة (${targetMov.type}) لـ ${targetMov.itemName}؟ سيتم عكس تأثيرها الحسابي على المخزن وتحديث لوحة التحكم فوراً.`)) {
            try {
                const batch = writeBatch(db);
                const matchedItem = itemsList.find(item => item.itemName === targetMov.itemName);
                
                if (matchedItem) {
                    let newStock = Number(matchedItem.currentStock);
                    
                    if (targetMov.type === 'وارد' || targetMov.type === 'مسترجع') {
                        newStock = Math.max(0, newStock - Number(targetMov.qty));
                    } else if (targetMov.type === 'صادر') {
                        newStock = newStock + Number(targetMov.qty);
                    }
                    
                    const itemRef = doc(db, 'users', userId, 'store', matchedItem.id);
                    batch.update(itemRef, { currentStock: newStock });
                }

                const movRef = doc(db, 'users', userId, 'store_movements', movId);
                batch.delete(movRef);

                await batch.commit();
                fetchData();
                alert('تم حذف الحركة بنجاح، وتعديل كميات المخزن، وتحديث لوحة التحكم ديناميكياً!');
            } catch (error) {
                console.error("Error deleting movement dynamically:", error);
                alert('حدث خطأ أثناء معالجة وحذف الحركة الحسابية.');
            }
        }
    };

    const handleSaveEditedMovement = async (e) => {
        e.preventDefault();
        if (!userId || !editingMovement) return;

        const oldMov = movementsList.find(m => m.id === editingMovement.id);
        if (!oldMov) return alert('خطأ في تحديد الحركة الأصلية');

        try {
            const batch = writeBatch(db);
            const matchedItem = itemsList.find(item => item.itemName === editingMovement.itemName);

            if (matchedItem) {
                const oldQty = Number(oldMov.qty);
                const newQty = Number(editingMovement.qty);
                const qtyDiff = newQty - oldQty; 
                
                let newStock = Number(matchedItem.currentStock);

                if (oldMov.type === 'وارد' || oldMov.type === 'مسترجع') {
                    newStock = Math.max(0, newStock + qtyDiff);
                } else if (oldMov.type === 'صادر') {
                    newStock = Math.max(0, newStock - qtyDiff);
                }

                const itemRef = doc(db, 'users', userId, 'store', matchedItem.id);
                batch.update(itemRef, { currentStock: newStock });
            }

            const movRef = doc(db, 'users', userId, 'store_movements', editingMovement.id);
            batch.update(movRef, {
                qty: Number(editingMovement.qty),
                price: Number(editingMovement.price),
                note: editingMovement.note
            });

            await batch.commit();
            setIsEditMovementModalOpen(false);
            setEditingMovement(null);
            fetchData();
            alert('تم تعديل الحركة وحساب الفروقات وتعديل المخزن الرئيسي بنجاح!');
        } catch (error) {
            console.error("Error editing movement dynamically:", error);
            alert('فشل تعديل الحركة ومعالجة الحسابات.');
        }
    };

    const handleAddCategory = () => {
        if (!newCategoryInput.trim()) return alert('الرجاء إدخال اسم الفئة');
        if (categories.includes(newCategoryInput.trim())) return alert('هذه الفئة موجودة بالفعل');
        
        const updatedCats = [...categories, newCategoryInput.trim()];
        setCategories(updatedCats);
        localStorage.setItem('store_categories', JSON.stringify(updatedCats));
        setCategory(newCategoryInput.trim()); 
        setCategoryToDeleteSelect(newCategoryInput.trim());
        setNewCategoryInput('');
        alert('تم إضافة الفئة الجديدة بنجاح');
    };

    const handleDeleteCategoryFromModal = () => {
        if (!categoryToDeleteSelect) return alert('الرجاء اختيار فئة لحذفها');
        if (categories.length <= 1) return alert('يجب أن يتبقى فئة واحدة على الأقل في النظام');
        
        if (window.confirm(`هل أنت متأكد من حذف فئة "${categoryToDeleteSelect}"؟`)) {
            const updatedCats = categories.filter(c => c !== categoryToDeleteSelect);
            setCategories(updatedCats);
            localStorage.setItem('store_categories', JSON.stringify(updatedCats));
            
            if (category === categoryToDeleteSelect) {
                setCategory(updatedCats[0] || '');
            }
            if (activeFilter === categoryToDeleteSelect) {
                setActiveFilter('الكل');
            }
            setCategoryToDeleteSelect(updatedCats[0] || '');
            alert('تم حذف الفئة بنجاح');
        }
    };

    const handleAddToCart = () => {
        if (!selectedSaleItemId) return alert('الرجاء اختيار منتج أولاً');
        if (saleQty <= 0) return alert('الكمية يجب أن تكون 1 أو أكثر');

        const targetItem = itemsList.find(item => item.id === selectedSaleItemId);
        if (!targetItem) return;

        const existingCartItem = cart.find(c => c.id === selectedSaleItemId);
        const currentCartQty = existingCartItem ? existingCartItem.qty : 0;
        const totalNeeded = Number(currentCartQty) + Number(saleQty);

        if (totalNeeded > Number(targetItem.currentStock)) {
            return alert(`المتاح في المخزن هو ${targetItem.currentStock} فقط. لا يمكنك إضافة المزيد.`);
        }

        if (existingCartItem) {
            setCart(cart.map(c => c.id === selectedSaleItemId ? { ...c, qty: totalNeeded } : c));
        } else {
            setCart([...cart, {
                id: targetItem.id,
                itemName: targetItem.itemName,
                sku: targetItem.sku,
                brand: targetItem.brand,
                sellingPrice: Number(targetItem.sellingPrice),
                qty: Number(saleQty)
            }]);
        }
        setSelectedSaleItemId('');
        setSaleQty(1);
    };

    const handleRemoveFromCart = (itemId) => {
        setCart(cart.filter(c => c.id !== itemId));
    };

    const cartTotalAmount = cart.reduce((acc, cItem) => acc + (cItem.sellingPrice * cItem.qty), 0);
    const totalItemsCount = itemsList.length;
    const lowStockCount = itemsList.filter(item => Number(item.currentStock) <= Number(item.minAlertQty)).length;
    const totalWholesaleValue = itemsList.reduce((acc, item) => acc + (Number(item.wholesalePrice) * Number(item.currentStock)), 0);
    const totalSellingValue = itemsList.reduce((acc, item) => acc + (Number(item.sellingPrice) * Number(item.currentStock)), 0);

    const filteredItems = itemsList.filter(item => {
        const matchesCategory = activeFilter === 'الكل' || item.category === activeFilter;
        const matchesSearch = item.itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                             (item.brand && item.brand.toLowerCase().includes(searchQuery.toLowerCase())) ||
                             (item.supplier && item.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
        return matchesCategory && matchesSearch;
    });

    const resetForm = () => {
        setEditingId(null);
        setItemStatus('جديد');
        setItemName('');
        setSku('');
        setBrand('');
        setSupplier(''); 
        setCurrentStock(0);
        setMinAlertQty(5);
        setWholesalePrice(0);
        setSellingPrice(0);
        if (categories.length > 0) setCategory(categories[0]);
    };

    const handleSaveItem = async (e) => {
        e.preventDefault();
        if (!userId) return alert('خطأ: لم يتم التعرف على هوية المستخدم، يرجى إعادة تسجيل الدخول'); 
        if (!itemName || !sku) return alert('الرجاء ملء اسم الصنف ورمز SKU');

        const currentSupplier = supplier.trim() || 'غير محدد';
        const standardDate = new Date().toLocaleDateString('en-US');

        const itemData = {
            itemStatus,
            itemName,
            category,
            sku,
            brand,
            supplier: currentSupplier, 
            currentStock: Number(currentStock),
            minAlertQty: Number(minAlertQty),
            wholesalePrice: Number(wholesalePrice),
            sellingPrice: Number(sellingPrice),
        };

        try {
            if (editingId) {
                await updateDoc(doc(db, 'users', userId, 'store', editingId), itemData);
                await addDoc(collection(db, 'users', userId, 'store_movements'), {
                    itemName: itemName,
                    type: 'تعديل صنف',
                    qty: Number(currentStock),
                    price: Number(wholesalePrice),
                    date: standardDate,
                    note: `تحديث البيانات`,
                    createdAt: serverTimestamp()
                });
            } else {
                await addDoc(collection(db, 'users', userId, 'store'), { ...itemData, createdAt: serverTimestamp() });
                const movementPrice = itemStatus === 'قديم' ? 0 : Number(wholesalePrice);
                
                await addDoc(collection(db, 'users', userId, 'store_movements'), {
                    itemName: itemName,
                    type: 'وارد',
                    qty: Number(currentStock),
                    wholesalePrice: Number(wholesalePrice),
                    price: movementPrice,
                    isInventoryCheck: itemStatus === 'قديم',
                    date: standardDate,
                    note: itemStatus === 'قديم' ? `🟡 جرد مخزون سابق في العيادة` : `من المجهز: ${currentSupplier}`,
                    createdAt: serverTimestamp()
                });
            }

            setPurchaseInvoiceData({
                itemName,
                brand,
                sku,
                qty: currentStock,
                price: wholesalePrice,
                supplier: currentSupplier,
                status: itemStatus === 'جديد' ? 'شراء جديد' : 'مخزون سابق في العيادة',
                date: standardDate,
                time: new Date().toLocaleTimeString('ar-EG')
            });

            setIsAddModalOpen(false);
            resetForm();
            fetchData(); 
            alert('تم حفظ المنتج وتوريده للمخزن بنجاح!');

        } catch (error) {
            console.error("Firebase Error:", error);
            alert("فشل الحفظ, تحقق من صلاحيات الحساب!");
        }
    };

    const handleBatchSaleSubmit = async (e) => {
        e.preventDefault();
        if (!userId) return alert('خطأ في الهوية');
        if (cart.length === 0) return alert('سلة المبيعات فارغة!');

        const finalBuyer = buyerName.trim() || 'زبون نقدي';
        const standardDate = new Date().toLocaleDateString('en-US');

        try {
            const batch = writeBatch(db);

            for (const cartItem of cart) {
                const targetItem = itemsList.find(item => item.id === cartItem.id);
                if (!targetItem) continue;

                const updatedStock = Number(targetItem.currentStock) - Number(cartItem.qty);
                batch.update(doc(db, 'users', userId, 'store', targetItem.id), { currentStock: updatedStock });
                
                const movementRef = doc(collection(db, 'users', userId, 'store_movements'));
                batch.set(movementRef, {
                    itemName: targetItem.itemName,
                    type: 'صادر',
                    qty: Number(cartItem.qty),
                    price: Number(targetItem.sellingPrice),
                    date: standardDate,
                    note: `إلى الزبون: ${finalBuyer}`,
                    createdAt: serverTimestamp()
                });
            }

            await batch.commit();

            setInvoiceData({
                items: cart,
                buyer: finalBuyer,
                totalAmount: cartTotalAmount,
                date: standardDate,
                time: new Date().toLocaleTimeString('ar-EG')
            });

            setIsSaleModalOpen(false);
            setCart([]);
            setBuyerName('');
            fetchData();
            alert('تم حفظ فاتورة البيع المباشر بنجاح وتحديث الداشبورد!');

        } catch (error) {
            console.error("Firebase Error:", error);
            alert("حدث خطأ أثناء حفظ الفاتورة.");
        }
    };

    const handleSaveExpense = async (e) => {
        e.preventDefault();
        if (!userId) return alert('خطأ في الهوية');
        if (!expenseReason || !expenseAmount) return alert('الرجاء إدخل تفاصيل الصرف');

        const standardDate = new Date().toLocaleDateString('en-US');

        try {
            await addDoc(collection(db, 'users', userId, 'expenses'), {
                reason: expenseReason,
                amount: Number(expenseAmount),
                date: standardDate,
                createdAt: serverTimestamp()
            });

            setIsExpenseModalOpen(false);
            setExpenseReason('');
            setExpenseAmount('');
            fetchData(); 
            alert('تم تسجيل المصروف بنجاح وسيظهر في إحصائيات الداشبورد فوراُ!');
        } catch (error) {
            console.error("Firebase Error:", error);
            alert("فشل تسجيل المصروف.");
        }
    };

    const handlePrintInventory = () => {
        setIsPrintingInventory(true);
        setTimeout(() => {
            window.print();
            setIsPrintingInventory(false);
        }, 500);
    };

    const openEditModal = (item) => {
        setEditingId(item.id);
        setItemStatus(item.itemStatus || 'جديد');
        setItemName(item.itemName);
        setCategory(item.category);
        setSku(item.sku);
        setBrand(item.brand);
        setSupplier(item.supplier || ''); 
        setCurrentStock(item.currentStock);
        setMinAlertQty(item.minAlertQty);
        setWholesalePrice(item.wholesalePrice);
        setSellingPrice(item.sellingPrice);
        setIsAddModalOpen(true);
    };

    const handleDeleteItem = async (id, name) => {
        if (!userId) return;
        if (window.confirm(`هل تريد مسح الصنف ${name}؟ تفاصيل الحركات ستبقى محفوظة ويمكنك تعديلها بالرمز السري.`)) {
            try {
                await deleteDoc(doc(db, 'users', userId, 'store', id));
                fetchData(); 
                alert('تم حذف الصنف بنجاح من قائمة الجرد المباشرة!');
            } catch (error) {
                console.error("خطأ أثناء الحذف:", error);
                alert('حدث خطأ أثناء محاولة الحذف، تحقق من الصلاحيات.');
            }
        }
    };

    const handleSelectItem = (id) => {
        if (selectedItems.includes(id)) {
            setSelectedItems(selectedItems.filter(item => item !== id));
        } else {
            setSelectedItems([...selectedItems, id]);
        }
    };

    const handleBatchDelete = async () => {
        if (!userId) return;
        if (window.confirm('هل أنت متأكد من مسح العناصر المحددة؟')) {
            try {
                const batch = writeBatch(db);
                selectedItems.forEach((itemId) => {
                    batch.delete(doc(db, 'users', userId, 'store', itemId));
                });
                await batch.commit();
                setSelectedItems([]);
                setIsDeleteMode(false);
                fetchData();
            } catch (error) {
                console.error(error);
            }
        }
    };

    const handleDeleteExpense = async (id) => {
        if (!userId) return;
        if (window.confirm('هل تريد حذف هذا المصروف?')) {
            try {
                await deleteDoc(doc(db, 'users', userId, 'expenses', id));
                fetchData();
            } catch (error) {
                console.error(error);
            }
        }
    };

    if (isAuthLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#F8FAFC', color: '#0284C7', direction: 'rtl', fontFamily: 'Cairo' }}>
                <h3>⏳ جاري فحص حساب المستخدم وتأمين اتصال المخزن الشامل...</h3>
            </div>
        );
    }

    return (
        <div style={{ 
            padding: '4vw 3vw', 
            backgroundColor: '#F8FAFC', 
            backgroundImage: 'radial-gradient(circle at 15% 15%, rgba(14, 165, 233, 0.08) 0%, transparent 40%), radial-gradient(circle at 85% 75%, rgba(2, 132, 199, 0.05) 0%, transparent 50%), linear-gradient(180deg, #FFFFFF 0%, #F1F5F9 100%)',
            backgroundAttachment: 'fixed',
            fontFamily: "'Exo 2', 'Cairo', sans-serif", 
            direction: 'rtl', 
            minHeight: '100vh', 
            color: '#0F172A', 
            boxSizing: 'border-box', 
            width: '100%', 
            maxWidth: '100%',
            overflowY: 'auto',
            overflowX: 'clip'
        }}>
            
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
            <style>{`
                .modern-card {
                    background: #FFFFFF !important;
                    backdrop-filter: blur(20px);
                    -webkit-backdrop-filter: blur(20px);
                    border: 1px solid #E2E8F0 !important;
                    border-radius: 20px !important;
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
                    border-radius: 20px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
                    border: 1px solid #E2E8F0;
                }
                .responsive-grid-cards {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
                    gap: 25px;
                    margin-bottom: 35px;
                }
                .responsive-row-split {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 25px;
                    margin-bottom: 35px;
                }
                .table-scroll-container {
                    width: 100%;
                    overflow-x: auto;
                    -webkit-overflow-scrolling: touch;
                }
                .main-table-dark {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: right;
                    font-size: 14px;
                }
                .main-table-dark th {
                    padding: 14px 12px;
                    font-weight: 700;
                    color: #475569;
                    background-color: #F8FAFC;
                    border-bottom: 2px solid #E2E8F0;
                }
                .main-table-dark td {
                    padding: 14px 12px;
                    border-bottom: 1px solid #F1F5F9;
                    color: #1E293B;
                    vertical-align: middle;
                }
                .btn-neon {
                    padding: 10px 20px;
                    border-radius: 12px;
                    font-size: 13px;
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.25s ease;
                    border: 1px solid transparent;
                }
                .btn-neon-primary {
                    background: #0284C7;
                    color: #FFFFFF;
                    border-color: #0284C7;
                    box-shadow: 0 4px 12px rgba(2, 132, 199, 0.25);
                }
                .btn-neon-primary:hover {
                    background: #0369A1;
                    border-color: #0369A1;
                    box-shadow: 0 6px 16px rgba(2, 132, 199, 0.35);
                }
                .btn-neon-success {
                    background: #10B981;
                    color: #FFFFFF;
                    border-color: #10B981;
                    box-shadow: 0 4px 12px rgba(16, 185, 129, 0.2);
                }
                .btn-neon-success:hover {
                    background: #059669;
                    border-color: #059669;
                }
                .btn-neon-danger {
                    background: #EF4444;
                    color: #FFFFFF;
                    border-color: #EF4444;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);
                }
                .btn-neon-danger:hover {
                    background: #DC2626;
                    border-color: #DC2626;
                }
                .form-input-dark {
                    width: 100%;
                    padding: 11px 16px;
                    border-radius: 10px;
                    border: 1px solid #CBD5E1;
                    color: #0F172A;
                    font-size: 13px;
                    font-weight: 600;
                    background-color: #FFFFFF;
                    outline: none;
                    box-sizing: border-box;
                    transition: all 0.2s ease;
                }
                .form-input-dark:focus {
                    border-color: #0284C7;
                    box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
                }
                .modal-overlay-dark {
                    position: fixed;
                    top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(8px);
                    display: flex; align-items: center; justify-content: center;
                    z-index: 999;
                }
                .modal-content-dark {
                    background: #FFFFFF;
                    border-radius: 20px;
                    padding: 30px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.15);
                    box-sizing: border-box;
                    border: 1px solid #E2E8F0;
                }

                .badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 700;
                }
                .badge-success { background: #ECFDF5; color: #059669; border: 1px solid #A7F3D0; }
                .badge-danger { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
                .badge-neutral { background: #F1F5F9; color: #475569; border: 1px solid #E2E8F0; }
                
                .dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
                .dot-green { background-color: #10B981; }
                .dot-red { background-color: #EF4444; }
                
                .dot-white-pulse {
                    width: 7px;
                    height: 7px;
                    background-color: #0284C7;
                    border-radius: 50%;
                    display: inline-block;
                    box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.4);
                    animation: pulse-blue 2s infinite;
                }

                @keyframes pulse-blue {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(2, 132, 199, 0.4); }
                    70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(2, 132, 199, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(2, 132, 199, 0); }
                }

                @media (max-width: 991px) {
                    .responsive-header { flex-direction: column; align-items: flex-start; gap: 20px; padding: 20px; }
                    .main-header-actions { width: 100%; flex-wrap: wrap; gap: 10px; }
                    .responsive-row-split { grid-template-columns: 1fr; }
                }

                /* Mobile Optimizations */
                @media (max-width: 768px) {
                    .responsive-header {
                        padding: 14px 16px !important;
                        border-radius: 16px !important;
                        margin-bottom: 20px !important;
                    }
                    .main-header-actions {
                        display: grid !important;
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 8px !important;
                        width: 100% !important;
                    }
                    .main-header-actions .btn-neon {
                        width: 100% !important;
                        justify-content: center !important;
                        padding: 8px 10px !important;
                        font-size: 11px !important;
                        border-radius: 10px !important;
                    }
                    .responsive-grid-cards {
                        grid-template-columns: repeat(2, 1fr) !important;
                        gap: 10px !important;
                        margin-bottom: 20px !important;
                    }
                    .responsive-grid-cards .modern-card {
                        padding: 12px 10px !important;
                        border-radius: 14px !important;
                    }
                    .responsive-grid-cards .modern-card h2 {
                        font-size: 16px !important;
                        margin: 4px 0 !important;
                    }
                    .responsive-grid-cards .modern-card p {
                        font-size: 10px !important;
                    }
                    .responsive-grid-cards .modern-card span {
                        font-size: 9px !important;
                    }
                    .responsive-grid-cards .modern-card i {
                        font-size: 14px !important;
                    }
                    .responsive-grid-cards .modern-card > div > div:last-child {
                        padding: 6px !important;
                        border-radius: 10px !important;
                    }
                    .modal-overlay-dark {
                        padding: 12px !important;
                    }
                    .modal-content-dark {
                        width: 100% !important;
                        max-width: 100% !important;
                        padding: 16px !important;
                        border-radius: 16px !important;
                    }
                    .filter-bar-container {
                        flex-direction: column !important;
                        align-items: stretch !important;
                    }
                    .filter-bar-container > div:first-child {
                        width: 100% !important;
                    }
                    .main-inventory-table {
                        padding: 10px !important;
                    }
                    .main-table-dark th, .main-table-dark td {
                        padding: 8px 6px !important;
                        font-size: 12px !important;
                    }
                }

                @media (max-width: 380px) {
                    .responsive-grid-cards {
                        grid-template-columns: 1fr !important;
                    }
                }

                @media print {
                    body, html { 
                        background-color: #ffffff !important; 
                        color: #000000 !important; 
                        direction: rtl !important; 
                    }
                    body * { visibility: hidden !important; }
                    .no-print { display: none !important; visibility: hidden !important; }
                    
                    .print-inventory-active .print-inventory-header {
                        display: block !important;
                        visibility: visible !important;
                    }

                    .print-inventory-active .print-inventory-footer {
                        display: flex !important;
                        visibility: visible !important;
                    }

                    .print-inventory-active .main-inventory-table, 
                    .print-inventory-active .main-inventory-table * { 
                        visibility: visible !important; 
                    }

                    .print-inventory-active .main-inventory-table {
                        position: absolute !important;
                        left: 0 !important;
                        top: 150px !important;
                        width: 100% !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        border: none !important;
                        box-shadow: none !important;
                        padding: 0 !important;
                        margin: 0 !important;
                    }

                    .print-inventory-active .table-scroll-container {
                        overflow: visible !important;
                        width: 100% !important;
                    }

                    .print-inventory-active .main-table-dark {
                        width: 100% !important;
                        min-width: 100% !important;
                        border-collapse: collapse !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                    }

                    .print-inventory-active .main-table-dark th, 
                    .print-inventory-active .main-table-dark td {
                        border: 1px solid #000000 !important;
                        padding: 8px 6px !important;
                        color: #000000 !important;
                        text-align: center !important;
                        background: #ffffff !important;
                        font-size: 12px !important;
                    }

                    .print-invoice-active .print-invoice-wrapper, 
                    .print-invoice-active .print-invoice-wrapper * {
                        visibility: visible !important;
                    }
                    
                    .print-invoice-active .print-invoice-wrapper { 
                        position: absolute !important; 
                        left: 0 !important; 
                        top: 0 !important; 
                        width: 100% !important; 
                        direction: rtl !important; 
                        color: #000000 !important; 
                    }
                    
                    .print-invoice-active .print-invoice-wrapper table { 
                        width: 100% !important; 
                        border-collapse: collapse !important; 
                        background-color: #ffffff !important;
                    }
                    
                    .print-invoice-active .print-invoice-wrapper th, 
                    .print-invoice-active .print-invoice-wrapper td { 
                        border: 1px solid #000000 !important; 
                        padding: 8px 6px !important; 
                        text-align: center !important; 
                        color: #000000 !important; 
                    }
                }
                @media screen { 
                    .print-invoice-wrapper { display: none !important; } 
                    .print-inventory-header { display: none !important; }
                    .print-inventory-footer { display: none !important; }
                }
            `}</style>

            {typeof window !== 'undefined' && (
                <style>{`
                    body {
                        ${(invoiceData || purchaseInvoiceData) && !isPrintingInventory ? `content-visibility: auto;` : ''}
                    }
                `}</style>
            )}

            <div className={isPrintingInventory ? "print-inventory-active" : (invoiceData || purchaseInvoiceData ? "print-invoice-active" : "")}>
                
                {/* 📄 هيدر الطباعة المخصص لجرد المخزن */}
                <div className="print-inventory-header" style={{ position: 'absolute', top: 0, left: 0, width: '100%', color: '#000', direction: 'rtl', padding: '10px 0' }}>
                    <div style={{ textAlign: 'center', borderBottom: '2px solid #000', paddingBottom: '12px', marginBottom: '15px' }}>
                        <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '900' }}>{clinicName}</h1>
                        <p style={{ margin: '2px 0 8px 0', fontSize: '13px', fontWeight: '700' }}>
                            الهاتف: {clinicPhone1} {clinicPhone2 ? ` | ${clinicPhone2}` : ''} {clinicAddress ? ` | العنوان: ${clinicAddress}` : ''}
                        </p>
                        <div style={{ display: 'inline-block', border: '2px solid #000', padding: '4px 20px', borderRadius: '15px', fontSize: '14px', fontWeight: '900', marginTop: '4px' }}>
                            وثيقة جرد المخزن الشاملة
                        </div>
                        <p style={{ margin: '8px 0 0 0', fontSize: '12px', fontWeight: '700' }}>
                            تاريخ ووقت الطباعة: {new Date().toLocaleDateString('ar-EG')} - {new Date().toLocaleTimeString('ar-EG')} | إجمالي عدد الأصناف: {filteredItems.length}
                        </p>
                    </div>
                </div>

                {/* وصولات الطباعة الديناميكية المربوطة بالإعدادات */}
                {invoiceData && !isPrintingInventory && (
                    <div className="print-invoice-wrapper">
                        <div style={{ border: '3px solid #000000', borderRadius: '24px', padding: '30px', maxWidth: '800px', margin: '40px auto', backgroundColor: '#ffffff', color: '#000000', minHeight: '500px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                                <h1 style={{ margin: '0 0 5px 0', fontSize: '32px', fontWeight: '900' }}>{clinicName}</h1>
                                <p style={{ margin: '2px 0 10px 0', fontSize: '13px', fontWeight: '700' }}>
                                    الهواتف: {clinicPhone1} {clinicPhone2 ? ` | ${clinicPhone2}` : ''} 
                                    {clinicAddress ? ` | العنوان: ${clinicAddress}` : ''}
                                </p>
                                <div style={{ margin: '10px auto' }}>
                                    <span style={{ border: '2px solid #000000', padding: '6px 25px', borderRadius: '20px', fontSize: '14px', fontWeight: '900' }}>وصل مبيعات مخزنية مباشر</span>
                                </div>
                                <p style={{ margin: '12px 0 0 0', fontSize: '12px', fontWeight: '700' }}>التاريخ: {invoiceData.date} | الوقت: {invoiceData.time}</p>
                            </div>
                            <div style={{ borderBottom: '3px dashed #000000', margin: '15px 0' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', border: '1.5px solid #000000', borderRadius: '10px', padding: '12px 20px', marginBottom: '20px', fontSize: '14px', fontWeight: '800' }}>
                                <span>اسم الزبون: {invoiceData.buyer}</span>
                                <span>طريقة الدفع: نقدي (كاش)</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                                <thead>
                                    <tr style={{ fontWeight: '900' }}>
                                        <th>المادة / الصنف</th>
                                        <th>الرمز SKU</th>
                                        <th>الكمية</th>
                                        <th>السعر المفرد</th>
                                        <th>الإجمالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoiceData.items && invoiceData.items.map((item, index) => (
                                        <tr key={index} style={{ fontWeight: '800' }}>
                                            <td style={{ padding: '12px 8px', textAlign: 'right' }}>{item.itemName} {item.brand ? `(${item.brand})` : ''}</td>
                                            <td>{item.sku}</td>
                                            <td style={{ fontWeight: '900' }}>{item.qty}</td>
                                            <td>{Number(item.sellingPrice).toLocaleString()} د.ع</td>
                                            <td style={{ fontWeight: '900' }}>{(Number(item.sellingPrice) * Number(item.qty)).toLocaleString()} د.ع</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div style={{ marginTop: '25px', fontSize: '18px', fontWeight: '900', textAlign: 'right' }}>
                                المجموع الكلي الصافي: <span>{Number(invoiceData.totalAmount).toLocaleString()} د.ع</span>
                            </div>
                        </div>
                    </div>
                )}

                {purchaseInvoiceData && !isPrintingInventory && (
                    <div className="print-invoice-wrapper">
                        <div style={{ border: '3px solid #000000', borderRadius: '24px', padding: '30px', maxWidth: '800px', margin: '40px auto', backgroundColor: '#ffffff', color: '#000000', minHeight: '500px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '5px' }}>
                                <h1 style={{ margin: '0 0 5px 0', fontSize: '32px', fontWeight: '900' }}>{clinicName}</h1>
                                <div style={{ margin: '10px auto' }}>
                                    <span style={{ border: '2px solid #000000', padding: '6px 25px', borderRadius: '20px', fontSize: '14px', fontWeight: '900' }}>وصل إدخل مخزني ومشتريات</span>
                                </div>
                                <p style={{ margin: '12px 0 0 0', fontSize: '12px', fontWeight: '700' }}>التاريخ: {purchaseInvoiceData.date} | الوقت: {purchaseInvoiceData.time}</p>
                            </div>
                            <div style={{ borderBottom: '3px dashed #000000', margin: '15px 0' }}></div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', border: '1.5px solid #000000', borderRadius: '10px', padding: '12px 20px', marginBottom: '20px', fontSize: '14px', fontWeight: '800' }}>
                                <span>جهة التوريد / المجهّز: {purchaseInvoiceData.supplier}</span>
                                <span>حالة الإدخال: {purchaseInvoiceData.status}</span>
                            </div>
                            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
                                <thead>
                                    <tr style={{ fontWeight: '900' }}>
                                        <th>المادة / الصنف</th>
                                        <th>الرمز SKU</th>
                                        <th>الكمية الموردة</th>
                                        <th>سعر الجملة مفرد</th>
                                        <th>الإجمالي الإدخالي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr style={{ fontWeight: '800' }}>
                                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>{purchaseInvoiceData.itemName} {purchaseInvoiceData.brand ? `(${purchaseInvoiceData.brand})` : ''}</td>
                                        <td>{purchaseInvoiceData.sku}</td>
                                        <td style={{ fontWeight: '900' }}>{purchaseInvoiceData.qty}</td>
                                        <td>{Number(purchaseInvoiceData.price).toLocaleString()} د.ع</td>
                                        <td style={{ fontWeight: '900' }}>{(Number(purchaseInvoiceData.price) * Number(purchaseInvoiceData.qty)).toLocaleString()} د.ع</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* إشعارات توليد الحركات */}
                {invoiceData && (
                    <div className="no-print" style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '14px 20px', borderRadius: '16px', marginBottom: '25px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div>
                            <span style={{ fontWeight: '600', color: '#047857', fontSize: '13px' }}>📄 تم توليد فاتورة مبيعات جديدة لـ ({invoiceData.buyer}) بمبلغ {Number(invoiceData.totalAmount).toLocaleString()} د.ع</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => window.print()} className="btn-neon btn-neon-success" style={{ padding: '8px 16px', fontSize: '12px' }}>
                                <i className="fa-solid fa-print"></i> طباعة الوصل
                            </button>
                            <button onClick={() => setInvoiceData(null)} className="btn-neon btn-neon-primary" style={{ padding: '8px 14px', fontSize: '12px', color: '#fff' }}>إغلاق</button>
                        </div>
                    </div>
                )}

                {purchaseInvoiceData && (
                    <div className="no-print" style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', padding: '14px 20px', borderRadius: '16px', marginBottom: '25px', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
                        <div>
                            <span style={{ fontWeight: '600', color: '#0369A1', fontSize: '13px' }}>📥 تم إدخل منتج جديد ({purchaseInvoiceData.itemName}) بنجاح للمخزن. هل ترغب بطباعة وصل التوريد؟</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button onClick={() => window.print()} className="btn-neon btn-neon-primary" style={{ padding: '8px 16px', fontSize: '12px' }}>
                                <i className="fa-solid fa-print"></i> طباعة وصل الإدخال
                            </button>
                            <button onClick={() => setPurchaseInvoiceData(null)} className="btn-neon" style={{ padding: '8px 14px', fontSize: '12px', background: '#E2E8F0', color: '#334155' }}>إغلاق</button>
                        </div>
                    </div>
                )}

                {/* الهيدر الرئيسي */}
                <div className="responsive-header no-print" style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    marginBottom: '20px'
                }}>
                    {/* النصوص والترويسة */}
                    <div>
                        <h1 style={{ fontSize: 'clamp(22px, 2.5vw, 26px)', fontWeight: '700', color: '#0F172A', margin: 0, letterSpacing: '0.5px' }}>
                            📦 إدارة وحركات المخزن
                        </h1>
                        <p style={{ fontSize: '13px', color: '#64748B', margin: '6px 0 0 0', fontWeight: '500' }}>
                            جرد المستودعات، البيع المباشر، ومتابعة الصادر والوارد الفوري للعيادة
                        </p>
                    </div>

                    {/* حاوية الأزرار المنسقة أفقتياً للحاسوب ومتجاوبة للهاتف */}
                    <div className="main-header-actions" style={{
                        display: 'flex',
                        flexDirection: 'row',       /* عرض أفقياً على الحاسوب */
                        flexWrap: 'wrap',           /* التكيف والانتقال للسطر التالي للجوال */
                        gap: '10px',                /* مسافات متناسقة بين الأزرار */
                        alignItems: 'center',
                        justifyContent: 'flex-start'
                    }}>
                        <button onClick={() => setIsCategoryModalOpen(true)} className="btn-neon" style={{ background: '#F1F5F9', color: '#334155', borderColor: '#CBD5E1' }}>
                            <i className="fa-solid fa-folder-open" style={{ color: '#0284C7', marginLeft: '6px' }}></i> الفئات
                        </button>

                        <button onClick={() => setIsExpenseModalOpen(true)} className="btn-neon btn-neon-danger">
                            <i className="fa-solid fa-money-bill-wave" style={{ marginLeft: '6px' }}></i> تسجيل مصروف
                        </button>

                        <button onClick={() => { setCart([]); setBuyerName(''); setSelectedSaleItemId(''); setSaleQty(1); setIsSaleModalOpen(true); }} className="btn-neon btn-neon-success">
                            <i className="fa-solid fa-cart-plus" style={{ marginLeft: '6px' }}></i> بيع مباشر
                        </button>

                        <button onClick={() => setShowMovements(!showMovements)} className="btn-neon" style={{ background: showMovements ? '#0284C7' : '#F1F5F9', color: showMovements ? '#FFFFFF' : '#334155', borderColor: showMovements ? '#0284C7' : '#CBD5E1' }}>
                            <i className="fa-solid fa-clock-rotate-left" style={{ marginLeft: '6px' }}></i> السجلات {showMovements ? '👇' : ''}
                        </button>
                        
                        {isDeleteMode && selectedItems.length > 0 && (
                            <button onClick={handleBatchDelete} className="btn-neon" style={{ background: '#DC2626', color: 'white' }}>
                                حذف المحدد ({selectedItems.length})
                            </button>
                        )}

                        <button onClick={() => { isDeleteMode ? setSelectedItems([]) : null; setIsDeleteMode(!isDeleteMode); }} className="btn-neon" style={{ background: isDeleteMode ? '#E2E8F0' : '#FEF2F2', color: isDeleteMode ? '#0F172A' : '#DC2626', borderColor: isDeleteMode ? 'transparent' : '#FECACA' }}>
                            {isDeleteMode ? 'إلغاء التحديد' : '🗑️ حذف جمعي'}
                        </button>

                        <button onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="btn-neon btn-neon-primary">
                            <i className="fa-solid fa-plus" style={{ color: '#FFFFFF', marginLeft: '6px' }}></i> إضافة منتج
                        </button>
                    </div>
                </div>

                {/* الكروت الإحصائية */}
                <div className="responsive-grid-cards no-print">
                    <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#6366F1' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>الأصناف والمنتجات الكلية</p>
                                <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#0F172A', margin: '12px 0' }}>{totalItemsCount}</h2>
                                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>📦 خطوط المواد بالكامل</span>
                            </div>
                            <div style={{ background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '12px', borderRadius: '14px' }}>
                                <i className="fa-solid fa-boxes-stacked" style={{ color: '#6366F1', fontSize: '20px' }}></i>
                            </div>
                        </div>
                    </div>

                    <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#EF4444' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>أصناف تحت حد التنبيه</p>
                                <h2 style={{ fontSize: '28px', fontWeight: '800', color: '#DC2626', margin: '12px 0' }}>{lowStockCount}</h2>
                                <span style={{ fontSize: '11px', color: '#DC2626', fontWeight: '600' }}>⚠️ حرِج / يتطلب توريد فوري</span>
                            </div>
                            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', padding: '12px', borderRadius: '14px' }}>
                                <i className="fa-solid fa-triangle-exclamation" style={{ color: '#EF4444', fontSize: '20px' }}></i>
                            </div>
                        </div>
                    </div>

                    <div className="modern-card" style={{ padding: '24px', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: '#10B981' }}></div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                            <div>
                                <p style={{ fontSize: '13px', color: '#64748B', margin: 0, fontWeight: '600' }}>قيمة رأس المال الحالي</p>
                                <h2 style={{ fontSize: '24px', fontWeight: '800', color: '#059669', margin: '12px 0' }}>
                                    <AnimatedNumber value={totalWholesaleValue} />
                                </h2>
                                <span style={{ fontSize: '11px', color: '#64748B', fontWeight: '500' }}>🟢 تقييم حي بسعر الجملة</span>
                            </div>
                            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '12px', borderRadius: '14px' }}>
                                <i className="fa-solid fa-vault" style={{ color: '#10B981', fontSize: '20px' }}></i>
                            </div>
                        </div>
                    </div>
                </div>

                {/* عرض السجلات والمصاريف */}
                {showMovements && (
                    <div className="table-scroll-container">
                        <div className="modern-card" style={{ padding: '25px', marginBottom: '25px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '20px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-arrow-right-arrow-left" style={{ color: '#0284C7' }}></i> سجل حركات المخزن المحمي 🔒 (تعديل وحذف)
                            </h3>
                            <div className="table-scroll-container">
                                <table className="main-table-dark" style={{ minWidth: '550px' }}>
                                    <thead>
                                        <tr>
                                            <th>الصنف</th>
                                            <th>النوع</th>
                                            <th>الكمية</th>
                                            <th>التكلفة/السعر</th>
                                            <th>التفاصيل</th>
                                            <th>التاريخ</th>
                                            <th style={{ textAlign: 'center' }}>التحكم</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {movementsList.map((mov) => (
                                            <tr key={mov.id}>
                                                <td style={{ fontWeight: '600', color: '#0F172A' }}>{mov.itemName}</td>
                                                <td>
                                                    {getMovementBadge(mov.type)}
                                                </td>
                                                <td style={{ fontWeight: '700' }}>{mov.qty}</td>
                                                <td style={{ fontWeight: '600', color: '#059669' }}>{Number(mov.price || 0).toLocaleString()} ع</td>
                                                <td style={{ color: '#64748B', fontSize: '12px' }}>{mov.note || '-'}</td>
                                                <td style={{ color: '#64748B', fontSize: '12px' }}>{mov.date}</td>
                                                <td style={{ textAlign: 'center', display: 'flex', gap: '6px', justifyContent: 'center' }}>
                                                    <button onClick={() => triggerProtectedAction({ type: 'edit_movement', id: mov.id, data: mov })} style={{ color: '#0284C7', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }} title="تعديل الحركة">
                                                        <i className="fa-solid fa-pen"></i>
                                                    </button>
                                                    <button onClick={() => triggerProtectedAction({ type: 'delete_movement', id: mov.id })} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }} title="حذف وعكس الحساب">
                                                        <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="modern-card" style={{ padding: '25px', marginBottom: '25px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: '700', marginBottom: '20px', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-file-invoice-dollar" style={{ color: '#DC2626' }}></i> المصاريف التشغيلية للعيادة
                            </h3>
                            <div className="table-scroll-container">
                                <table className="main-table-dark" style={{ minWidth: '320px' }}>
                                    <thead>
                                        <tr>
                                            <th>بيان الصرف / التفاصيل</th>
                                            <th>المبلغ</th>
                                            <th>التاريخ</th>
                                            <th style={{ textAlign: 'center' }}>حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {expensesList.map((exp) => (
                                            <tr key={exp.id}>
                                                <td style={{ fontWeight: '600', color: '#0F172A' }}>{exp.reason}</td>
                                                <td style={{ fontWeight: '700', color: '#DC2626' }}>{Number(exp.amount).toLocaleString()} ع</td>
                                                <td style={{ color: '#64748B', fontSize: '12px' }}>{exp.date}</td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button onClick={() => handleDeleteExpense(exp.id)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>
                                                        <i className="fa-solid fa-trash-can"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* الفلترة والبحث */}
                <div className="modern-card filter-bar-container no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', padding: '16px 20px', flexWrap: 'wrap', gap: '15px' }}>
                    <div style={{ position: 'relative', width: '280px', maxWidth: '100%' }}>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="ابحث بالاسم، رمز SKU أو المورد..." className="form-input-dark" style={{ paddingRight: '36px' }} />
                        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '13px' }}></i>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'nowrap', overflowX: 'auto', paddingBottom: '4px', maxWidth: '100%' }}>
                        <button onClick={() => setActiveFilter('الكل')} style={{ background: activeFilter === 'الكل' ? '#0284C7' : '#F1F5F9', color: activeFilter === 'الكل' ? '#FFFFFF' : '#334155', border: '1px solid', borderColor: activeFilter === 'الكل' ? '#0284C7' : '#E2E8F0', padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>الكل</button>
                        {categories.map((tab) => (
                            <button key={tab} onClick={() => setActiveFilter(tab)} style={{ background: activeFilter === tab ? '#0284C7' : '#F1F5F9', color: activeFilter === tab ? '#FFFFFF' : '#334155', border: '1px solid', borderColor: activeFilter === tab ? '#0284C7' : '#E2E8F0', padding: '6px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                                {tab}
                            </button>
                        ))}
                    </div>
                </div>

                {/* جدول الجرد الرئيسي */}
                <div className="main-inventory-table modern-card" style={{ padding: '15px' }}>
                    <div className="table-scroll-container">
                        <table className="main-table-dark" style={{ minWidth: '850px' }}>
                            <thead>
                                <tr>
                                    <th style={{ width: '40px', textAlign: 'center' }}>#</th>
                                    {isDeleteMode && <th className="no-print" style={{ width: '50px', textAlign: 'center' }}>تحديد</th>}
                                    <th>الصنف والمورد</th>
                                    <th>الرمز (SKU)</th>
                                    <th>الفئة</th>
                                    <th>المخزون الحالي</th>
                                    <th>سعر الجملة</th>
                                    <th>سعر البيع المباشر</th>
                                    <th className="no-print">حالة الأمان</th>
                                    <th className="no-print" style={{ textAlign: 'center' }}>خيارات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredItems.map((item, index) => {
                                    const isCritical = Number(item.currentStock) <= Number(item.minAlertQty);
                                    return (
                                        <tr key={item.id} style={{ backgroundColor: isCritical ? '#FEF2F2' : 'transparent' }}>
                                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>{index + 1}</td>
                                            {isDeleteMode && (
                                                <td className="no-print" style={{ textAlign: 'center' }}>
                                                    <input type="checkbox" checked={selectedItems.includes(item.id)} onChange={() => handleSelectItem(item.id)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                                                </td>
                                            )}
                                            <td style={{ fontWeight: '600' }}>
                                                {item.itemName} {item.brand ? `(${item.brand})` : ''}
                                                <br/>
                                                <span style={{ fontSize: '11px', fontWeight: '500', color: '#64748B' }}>
                                                    المجهّز: {item.supplier || 'غير محدد'}
                                                </span>
                                            </td>
                                            <td style={{ fontWeight: '600', fontFamily: 'monospace', fontSize: '14px', color: '#0284C7' }}>{item.sku}</td>
                                            <td><span style={{ background: '#F1F5F9', color: '#334155', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: '1px solid #E2E8F0', fontWeight: '600' }}>{item.category}</span></td>
                                            <td style={{ fontWeight: '700', fontSize: '15px' }}>{item.currentStock}</td>
                                            <td style={{ fontWeight: '500' }}>{Number(item.wholesalePrice).toLocaleString()} د.ع</td>
                                            <td style={{ fontWeight: '700', color: '#0F172A' }}>{Number(item.sellingPrice).toLocaleString()} د.ع</td>
                                            <td className="no-print">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: '600', color: isCritical ? '#DC2626' : '#059669' }}>
                                                    <span style={{ height: '8px', width: '8px', borderRadius: '50%', backgroundColor: isCritical ? '#EF4444' : '#10B981', display: 'inline-block' }}></span>
                                                    {isCritical ? 'مخزون حرج' : 'آمن ومستقر'}
                                                </div>
                                            </td>
                                            <td className="no-print" style={{ textAlign: 'center' }}>
                                                <button onClick={() => openEditModal(item)} style={{ background: '#F1F5F9', color: '#0F172A', border: '1px solid #CBD5E1', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', marginLeft: '6px', fontSize: '12px' }}>
                                                    <i className="fa-solid fa-pen-to-square" style={{ color: '#0284C7' }}></i>
                                                </button>
                                                <button onClick={() => handleDeleteItem(item.id, item.itemName)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px' }}>
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* 📊 ملخص وإجماليات الجرد الخاص بالطباعة */}
                <div className="print-inventory-footer" style={{ border: '2px solid #000', borderRadius: '10px', padding: '12px 20px', marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: '800', color: '#000' }}>
                    <div>عدد المواد والجرد: <span style={{ fontWeight: '900' }}>{filteredItems.length} صنف</span></div>
                    <div>القيمة الكلية (بسعر الجملة): <span style={{ fontWeight: '900' }}>{totalWholesaleValue.toLocaleString()} د.ع</span></div>
                    <div>القيمة الكلية (بسعر المفرد): <span style={{ fontWeight: '900' }}>{totalSellingValue.toLocaleString()} د.ع</span></div>
                </div>

                <div className="no-print" style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '25px', marginBottom: '60px', paddingBottom: '20px' }}>
                    <button onClick={handlePrintInventory} className="btn-neon btn-neon-primary" style={{ padding: '12px 24px' }}>
                        <i className="fa-solid fa-print"></i> طباعة وثيقة جرد المخزن الشاملة
                    </button>
                </div>
            </div>

            {/* 🔒 نافذة طلب الرمز السري المنبثقة المشتركة مع الإعدادات */}
            {isPinModalOpen && (
                <div className="modal-overlay-dark">
                    <div className="modal-content-dark" style={{ width: '360px', textAlign: 'center' }}>
                        <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0284C7' }}>
                            <i className="fa-solid fa-lock"></i> {isSettingPinMode ? 'إعداد رمز أمان الحركات لأول مرة' : 'منطقة محمية: يرجى إدخال رمز الأمان'}
                        </h3>
                        <p style={{ fontSize: '12px', color: '#64748B', marginBottom: '20px' }}>
                            {isSettingPinMode ? 'قم بتعيين رمز سري موحد لحماية سجلات الصادر والوارد وتعديلها من الإعدادات' : 'هذا الإجراء يتطلب التحقق من رمز أمان العيادة المعتمد'}
                        </p>
                        <form onSubmit={handlePinSubmit}>
                            <input type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder={isSettingPinMode ? "أدخل الرمز السري الجديد..." : "••••"} maxLength={8} className="form-input-dark" style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '6px', marginBottom: '20px' }} required autoFocus />
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="submit" className="btn-neon btn-neon-primary" style={{ flex: 1, justifyContent: 'center' }}>تأكيد</button>
                                <button type="button" onClick={() => { setIsPinModalOpen(false); setPinInput(''); }} className="btn-neon" style={{ flex: 1, justifyContent: 'center', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' }}>إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ✏️ نافذة تعديل الحركة يدوياً */}
            {isEditMovementModalOpen && editingMovement && (
                <div className="modal-overlay-dark">
                    <div className="modal-content-dark" style={{ width: '420px' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#0F172A' }}>✏️ تعديل يدوي لبيانات الحركة</h3>
                        <form onSubmit={handleSaveEditedMovement} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748B' }}>اسم الصنف الموثق</label>
                                <input type="text" value={editingMovement.itemName} className="form-input-dark" style={{ opacity: 0.6 }} disabled />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748B' }}>الكمية الموثقة بالحركة</label>
                                    <input type="number" value={editingMovement.qty} onChange={e => setEditingMovement({ ...editingMovement, qty: e.target.value })} className="form-input-dark" required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748B' }}>السعر / التكلفة المحتسبة</label>
                                    <input type="number" value={editingMovement.price} onChange={e => setEditingMovement({ ...editingMovement, price: e.target.value })} className="form-input-dark" required />
                                </div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#64748B' }}>ملاحظات الحركة والبيان</label>
                                <input type="text" value={editingMovement.note || ''} onChange={e => setEditingMovement({ ...editingMovement, note: e.target.value })} className="form-input-dark" />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button type="submit" className="btn-neon btn-neon-primary" style={{ flex: 2, justifyContent: 'center' }}>تحديث وتثبيت القيم مالياً</button>
                                <button type="button" onClick={() => { setIsEditMovementModalOpen(false); setEditingMovement(null); }} className="btn-neon" style={{ flex: 1, justifyContent: 'center', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' }}>تراجع</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* بقية النوافذ المنبثقة */}
            {isCategoryModalOpen && (
                <div className="modal-overlay-dark">
                    <div className="modal-content-dark" style={{ width: '400px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0F172A' }}>📁 فئات المنتجات والمستودع</h3>
                            <button type="button" onClick={() => setIsCategoryModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#64748B' }}>&times;</button>
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '14px', marginBottom: '16px', border: '1px dashed #CBD5E1' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#475569', fontWeight: '500' }}>➕ إضافة فئة صنف جديدة:</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input type="text" value={newCategoryInput} onChange={e => setNewCategoryInput(e.target.value)} placeholder="مثال: عدسات لاصقة..." className="form-input-dark" />
                                <button type="button" onClick={handleAddCategory} className="btn-neon btn-neon-primary" style={{ padding: '0 16px' }}>إضافة</button>
                            </div>
                        </div>
                        <div style={{ background: '#FEF2F2', padding: '16px', borderRadius: '14px', border: '1px solid #FECACA' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#DC2626', fontWeight: '500' }}>🗑️ مسح فئة من النظام:</label>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <select value={categoryToDeleteSelect} onChange={e => setCategoryToDeleteSelect(e.target.value)} className="form-input-dark" style={{ flex: 1, color: '#0F172A' }}>
                                    {categories.map(cat => (
                                        <option key={cat} value={cat} style={{ background: '#FFFFFF' }}>{cat}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={handleDeleteCategoryFromModal} style={{ background: '#DC2626', color: 'white', border: 'none', padding: '0 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}>حذف</button>
                            </div>
                        </div>
                        <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="btn-neon" style={{ width: '100%', marginTop: '15px', justifyContent: 'center', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' }}>إغلاق النافذة</button>
                    </div>
                </div>
            )}

            {isExpenseModalOpen && (
                <div className="modal-overlay-dark">
                    <div className="modal-content-dark" style={{ width: '380px' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600', color: '#DC2626', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-wallet"></i> تسجيل مصروف تشغيلي جديد
                        </h3>
                        <form onSubmit={handleSaveExpense} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#475569', fontWeight: '500' }}>بيان الصرف / تفاصيل السبب *</label>
                                <input type="text" value={expenseReason} onChange={e => setExpenseReason(e.target.value)} placeholder="رواتب، فواتير ماء..." className="form-input-dark" required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#475569', fontWeight: '500' }}>المبلغ المخصوم (د.ع) *</label>
                                <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="أدخل قيمة المبلغ..." className="form-input-dark" required />
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                                <button type="submit" className="btn-neon" style={{ flex: 1, background: '#DC2626', color: 'white', justifyContent: 'center' }}>حفظ وقيد المصروف</button>
                                <button type="button" onClick={() => setIsExpenseModalOpen(false)} className="btn-neon" style={{ flex: 1, justifyContent: 'center', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' }}>إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isSaleModalOpen && (
                <div className="modal-overlay-dark">
                    <div className="modal-content-dark" style={{ width: '560px', maxHeight: '85vh', overflowY: 'auto' }}>
                        <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', fontWeight: '600', color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <i className="fa-solid fa-basket-shopping" style={{ color: '#10B981' }}></i> سلة فواتير البيع المباشر
                        </h3>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#475569', fontWeight: '500' }}>اسم الزبون / المريض</label>
                            <input type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)} placeholder="اسم المريض (اختياري)..." className="form-input-dark" />
                        </div>
                        <div style={{ background: '#F8FAFC', padding: '16px', borderRadius: '14px', marginBottom: '20px', border: '1px solid #E2E8F0' }}>
                            <label style={{ display: 'block', fontSize: '12px', marginBottom: '6px', color: '#475569', fontWeight: '500' }}>اختر المنتج للمبيعات:</label>
                            <select value={selectedSaleItemId} onChange={e => setSelectedSaleItemId(e.target.value)} className="form-input-dark" style={{ marginBottom: '12px', color: '#0F172A' }}>
                                <option value="" style={{ background: '#FFFFFF' }}>-- اختر صنفاً من المخزن --</option>
                                {itemsList.map(item => (
                                    <option key={item.id} value={item.id} disabled={item.currentStock <= 0} style={{ background: '#FFFFFF' }}>
                                        {item.itemName} [المتاح: {item.currentStock}] - السعر: {Number(item.sellingPrice).toLocaleString()} ع
                                    </option>
                                ))}
                            </select>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input type="number" min="1" value={saleQty} onChange={e => setSaleQty(e.target.value)} className="form-input-dark" style={{ width: '100px' }} />
                                <button type="button" onClick={handleAddToCart} className="btn-neon btn-neon-success">
                                    ➕ إدراج للسلة المؤقتة
                                </button>
                            </div>
                        </div>
                        <div style={{ marginBottom: '20px' }}>
                            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#0F172A', fontWeight: '600' }}>📦 عناصر الفاتورة الحالية:</h4>
                            {cart.length === 0 ? (
                                <p style={{ fontSize: '12px', color: '#64748B', textAlign: 'center', padding: '20px', border: '1px dashed #CBD5E1', borderRadius: '12px', margin: 0 }}>السلة لا تحتوي على مواد حالياً</p>
                            ) : (
                                <div style={{ border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                                    <div className="table-scroll-container">
                                        <table className="main-table-dark" style={{ fontSize: '12px' }}>
                                            <thead>
                                                <tr style={{ background: '#F8FAFC' }}>
                                                    <th>المادة</th>
                                                    <th>الكمية</th>
                                                    <th>إجمالي</th>
                                                    <th style={{ textAlign: 'center' }}>حذف</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {cart.map((cItem, index) => (
                                                    <tr key={index}>
                                                        <td style={{ fontWeight: '600' }}>{cItem.itemName}</td>
                                                        <td style={{ fontWeight: '700' }}>{cItem.qty}</td>
                                                        <td style={{ fontWeight: '600', color: '#059669' }}>{(cItem.sellingPrice * cItem.qty).toLocaleString()} ع</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button type="button" onClick={() => handleRemoveFromCart(cItem.id)} style={{ color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}>حذف</button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div style={{ padding: '12px 14px', background: '#ECFDF5', textAlign: 'left', fontWeight: '700', color: '#059669', fontSize: '14px', borderTop: '1px solid #A7F3D0' }}>
                                        صافي الإجمالي للفاتورة: {cartTotalAmount.toLocaleString()} د.ع
                                    </div>
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleBatchSaleSubmit}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="submit" disabled={cart.length === 0} className="btn-neon btn-neon-success" style={{ flex: 2, background: cart.length === 0 ? '#E2E8F0' : undefined, color: cart.length === 0 ? '#94A3B8' : undefined, justifyContent: 'center' }}>
                                    💾 اعتماد وحفظ الفاتورة الفورية
                                </button>
                                <button type="button" onClick={() => { setIsSaleModalOpen(false); setCart([]); }} className="btn-neon" style={{ flex: 1, justifyContent: 'center', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' }}>تراجع وإغلاق</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isAddModalOpen && (
                <div className="modal-overlay-dark">
                    <div className="modal-content-dark" style={{ width: '520px', maxHeight: '90vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: '#0F172A' }}>{editingId ? '✏️ تعديل بيانات صنف مخزني' : '📦 توريد وإدخل منتج جديد'}</h3>
                            <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '24px', color: '#64748B' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveItem} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" onClick={() => setItemStatus('جديد')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: itemStatus === 'جديد' ? '2px solid #0284C7' : '1px solid #CBD5E1', background: itemStatus === 'جديد' ? '#F0F9FF' : '#FFFFFF', color: itemStatus === 'جديد' ? '#0284C7' : '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>🟢 شراء وتوريد جديد</button>
                                <button type="button" onClick={() => setItemStatus('قديم')} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: itemStatus === 'قديم' ? '2px solid #0284C7' : '1px solid #CBD5E1', background: itemStatus === 'قديم' ? '#F0F9FF' : '#FFFFFF', color: itemStatus === 'قديم' ? '#0284C7' : '#475569', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>🟡 جرد مخزون سابق بالعيادة</button>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>اسم الصنف التجاري والكامل *</label>
                                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} className="form-input-dark" required />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>الفئة التابع لها *</label>
                                    <select value={category} onChange={e => setCategory(e.target.value)} className="form-input-dark" style={{ color: '#0F172A' }}>
                                        {categories.map(cat => (
                                            <option key={cat} value={cat} style={{ background: '#FFFFFF' }}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>الرمز التسلسلي (SKU) *</label>
                                    <input type="text" value={sku} onChange={e => setSku(e.target.value)} className="form-input-dark" required />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>الماركة / براند الصنف</label>
                                    <input type="text" value={brand} onChange={e => setBrand(e.target.value)} placeholder="Ray-Ban" className="form-input-dark" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>اسم المجهز / المورد *</label>
                                    <input type="text" value={supplier} onChange={e => setSupplier(e.target.value)} className="form-input-dark" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>الكمية الحالية المتوفرة *</label>
                                    <input type="number" value={currentStock} onChange={e => setCurrentStock(e.target.value)} className="form-input-dark" required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>حد التنبيه والنواقص الأقل *</label>
                                    <input type="number" value={minAlertQty} onChange={e => setMinAlertQty(e.target.value)} className="form-input-dark" required />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>سعر الشراء مفرد بالجملة *</label>
                                    <input type="number" value={wholesalePrice} onChange={e => setWholesalePrice(e.target.value)} className="form-input-dark" required />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '12px', marginBottom: '4px', color: '#475569', fontWeight: '500' }}>سعر البيع المباشر للزبون *</label>
                                    <input type="number" value={sellingPrice} onChange={e => setSellingPrice(e.target.value)} className="form-input-dark" required />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                                <button type="submit" className="btn-neon btn-neon-primary" style={{ flex: 2, justifyContent: 'center' }}>
                                    <i className="fa-solid fa-floppy-disk"></i> {editingId ? 'تحديث وحفظ التعديلات' : 'اعتماد وتوريد المنتج للمخزن'}
                                </button>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} className="btn-neon" style={{ flex: 1, justifyContent: 'center', background: '#F1F5F9', color: '#334155', border: '1px solid #CBD5E1' }}>تراجع</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
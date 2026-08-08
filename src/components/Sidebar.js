'use client';
import { useEffect, useState } from 'react';
import Image from 'next/image'; 

// 🌟 استيراد ميزات الفايربيس من الملف الموحد بالمسار الصحيح
import { auth } from '@/firebase';
import { signOut } from 'firebase/auth';

// 🌟 استيراد الصور كـ Modules برمجية لتخطي قيود الحجم الضخم تلقائياً
import logoImg from '../../public/logo.png';
import curaTextImg from '../../public/cura-text.png';

export default function Sidebar({ activeTab, setActiveTab, userRole, username }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [draggedItemId, setDraggedItemId] = useState(null);
    const [hoveredId, setHoveredId] = useState(null);
    
    // 📱 حالة لتحديد ما إذا كانت الشاشة هاتف أو تابلت (أقل من 768 بكسل)
    const [isMobile, setIsMobile] = useState(false);

    // 🌟 مزامنة الـ userRole الحقيقي القادم من السيرفر الآمن
    const [currentUserRole, setCurrentUserRole] = useState(userRole || 'reception');

    // حالة تخزين الصلاحيات المخصصة للمطلب الحالي
    const [userPermissions, setUserPermissions] = useState(null);

    // 🍊 أيقونات الـ Stroke الرفيع المتوافق مع الهوية الفاخرة لـ CURA
    const defaultMenuOrder = [
        { 
            id: 'dashboard', 
            name: 'لوحة الإحصائيات', 
            permissionKey: 'stats', 
            legacyRoles: ['admin', 'doctor'],
            icon: (active) => (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0284C7" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, filter: active ? 'drop-shadow(0 2px 4px rgba(2, 132, 199, 0.25))' : 'none', transition: 'all 0.3s ease' }}><rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/></svg>
            )
        },
        { 
            id: 'patients', 
            name: 'سجل المرضى', 
            permissionKey: 'patients', 
            legacyRoles: ['admin', 'doctor', 'reception'],
            icon: (active) => (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0284C7" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, filter: active ? 'drop-shadow(0 2px 4px rgba(2, 132, 199, 0.25))' : 'none', transition: 'all 0.3s ease' }}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            )
        }, 
        { 
            id: 'store', 
            name: 'إدارة المخزن', 
            permissionKey: 'store', 
            legacyRoles: ['admin'],
            icon: (active) => (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0284C7" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, filter: active ? 'drop-shadow(0 2px 4px rgba(2, 132, 199, 0.25))' : 'none', transition: 'all 0.3s ease' }}><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            )
        }, 
        { 
            id: 'whatsapp', 
            name: 'التذكيرات (واتساب)', 
            permissionKey: 'whatsapp', 
            legacyRoles: ['admin', 'reception'],
            icon: (active) => (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0284C7" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, filter: active ? 'drop-shadow(0 2px 4px rgba(2, 132, 199, 0.25))' : 'none', transition: 'all 0.3s ease' }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            )
        },
        { 
            id: 'settings', 
            name: 'إعدادات والأمان', 
            permissionKey: 'settings', 
            legacyRoles: ['admin'],
            icon: (active) => (
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={active ? "#0284C7" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, filter: active ? 'drop-shadow(0 2px 4px rgba(2, 132, 199, 0.25))' : 'none', transition: 'all 0.3s ease' }}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            )
        }, 
    ];

    const [menuItems, setMenuItems] = useState(() => {
        if (typeof window !== 'undefined') {
            const savedOrder = localStorage.getItem('sidebar_menu_order');
            if (savedOrder) {
                try {
                    const parsedOrder = JSON.parse(savedOrder);
                    if (parsedOrder.length === defaultMenuOrder.length) {
                        return parsedOrder.map(savedItem => ({
                            ...savedItem,
                            icon: defaultMenuOrder.find(d => d.id === savedItem.id).icon
                        }));
                    }
                } catch (e) {
                    console.error("خطأ في قراءة ترتيب القائمة المحفوظ:", e);
                }
            }
        }
        return defaultMenuOrder;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const handleResize = () => {
                const mobileMode = window.innerWidth <= 768;
                setIsMobile(mobileMode);
                if (mobileMode) setIsCollapsed(true);
            };
            handleResize();
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);

    useEffect(() => {
        if (userRole) {
            setCurrentUserRole(userRole);
        }
    }, [userRole]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const currentUsername = username || localStorage.getItem('current_logged_user') || currentUserRole;
            const allUsers = JSON.parse(localStorage.getItem('clinic_users') || '[]');
            const currentUser = allUsers.find(u => u.username === currentUsername);

            if (currentUser && currentUser.permissions) {
                setUserPermissions(currentUser.permissions);
            } else if (currentUserRole === 'admin') {
                setUserPermissions({ store: true, stats: true, patients: true, whatsapp: true, settings: true });
            } else {
                setUserPermissions(null); 
            }
        }
    }, [currentUserRole, username]);

    const allowedMenuItems = menuItems.filter(item => {
        if (currentUserRole === 'admin') return true; 
        if (userPermissions && Object.keys(userPermissions).length > 0) {
            return userPermissions[item.permissionKey] === true;
        }
        return item.legacyRoles.includes(currentUserRole);
    });

    useEffect(() => {
        const isTabAllowed = allowedMenuItems.some(item => item.id === activeTab);
        if (!isTabAllowed && allowedMenuItems.length > 0) {
            setActiveTab(allowedMenuItems[0].id);
        }
    }, [activeTab, currentUserRole, allowedMenuItems, setActiveTab]);

    const handleDragStart = (e, itemId) => {
        if (isMobile) return;
        setDraggedItemId(itemId);
        e.dataTransfer.effectAllowed = 'move';
        e.target.style.opacity = '0.4';
    };

    const handleDragEnd = (e) => {
        e.target.style.opacity = '1';
        setDraggedItemId(null);
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (isMobile) return;
        const draggedOverItem = allowedMenuItems[index];
        if (!draggedOverItem || draggedItemId === draggedOverItem.id) return;

        const updatedMenuItems = [...menuItems];
        const draggedIndex = updatedMenuItems.findIndex(item => item.id === draggedItemId);
        const targetIndex = updatedMenuItems.findIndex(item => item.id === draggedOverItem.id);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [reorderedItem] = updatedMenuItems.splice(draggedIndex, 1);
            updatedMenuItems.splice(targetIndex, 0, reorderedItem);
            const cleanOrder = updatedMenuItems.map(({id, name, permissionKey, legacyRoles}) => ({id, name, permissionKey, legacyRoles}));
            setMenuItems(updatedMenuItems);
            localStorage.setItem('sidebar_menu_order', JSON.stringify(cleanOrder));
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            localStorage.clear();
            document.cookie = "clinic_admin_logged=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
            window.location.reload(); 
        } catch (error) {
            console.error("حدث خطأ أثناء تسجيل الخروج الحقيقي:", error);
        }
    };

    // 🏥 تصميم طبي عصري باللون الأبيض والرمادي الناعم والطبقات الأنيقة
    const getSidebarStyles = () => {
        if (isMobile) {
            return {
                width: '100%',
                minWidth: '100%',
                maxWidth: '100%',
                height: '72px',
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                top: 'auto',
                flexDirection: 'row',
                padding: '0 16px',
                justifyContent: 'space-around',
                alignItems: 'center',
                background: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(20px) saturate(180%)',
                WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                boxShadow: '0 -10px 30px rgba(15, 23, 42, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
                borderTop: '1px solid #E2E8F0'
            };
        }
        return {
            width: isCollapsed ? '88px' : '270px', 
            minWidth: isCollapsed ? '88px' : '270px', 
            maxWidth: isCollapsed ? '88px' : '270px',
            height: '100vh',
            position: 'relative',
            flexDirection: 'column',
            padding: isCollapsed ? '28px 12px' : '28px 20px', 
            justifyContent: 'flex-start',
            alignItems: 'stretch',
            // 🏥 خلفية بيضاء طبية متدرجة بخفة واحترافية
            background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            boxShadow: '10px 0 30px rgba(15, 23, 42, 0.04), inset -1px 0 0 #E2E8F0',
            borderRight: '1px solid #E2E8F0',
            borderLeft: 'none',
            borderTop: 'none'
        };
    };

    return (
        <div style={{
            ...getSidebarStyles(),
            flexShrink: 0,
            color: '#0F172A',
            display: 'flex',
            fontFamily: "'Cairo', 'Exo 2', sans-serif",
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)', 
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            zIndex: 10000,
            boxSizing: 'border-box'
        }}>
            {/* 🌟 توهج أزرق طبي ناعم خلف الشعار */}
            {!isMobile && (
                <div style={{
                    position: 'absolute',
                    top: '-60px',
                    right: '-60px',
                    width: '180px',
                    height: '180px',
                    background: 'radial-gradient(circle, rgba(2, 132, 199, 0.1) 0%, transparent 70%)',
                    pointerEvents: 'none',
                    filter: 'blur(35px)',
                    zIndex: 0
                }} />
            )}

            {/* 🌟 الهوية واللوجو */}
            {!isMobile && (
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    paddingBottom: '16px',
                    marginBottom: '20px', 
                    borderBottom: '1px solid #E2E8F0', 
                    transition: 'all 0.3s',
                    width: '100%',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div className="logo-container" style={{ 
                        width: isCollapsed ? '48px' : '72px', 
                        height: isCollapsed ? '48px' : '72px',
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        flexShrink: 0,
                        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                        filter: 'drop-shadow(0 4px 12px rgba(2, 132, 199, 0.15))',
                        marginBottom: '0px'
                    }}>
                        <Image 
                            src={logoImg} 
                            alt="CURA Logo Icon" 
                            placeholder="blur"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        />
                    </div>
                    
                    {!isCollapsed && (
                        <div style={{ overflow: 'hidden', animation: 'sidebarFadeIn 0.4s ease', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', width: '100%' }}>
                            
                            <div style={{ 
                                width: '130px', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                marginTop: '-32px',    
                                marginBottom: '-28px', 
                                position: 'relative'
                            }}>
                                <Image 
                                    src={curaTextImg}
                                    alt="CURA TEXT" 
                                    placeholder="blur"
                                    style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
                                />
                            </div>

                            <p style={{ 
                                fontSize: '9px', 
                                color: '#64748B', 
                                margin: '0 0 12px 0', 
                                fontWeight: '700', 
                                letterSpacing: '2px',
                                textTransform: 'uppercase'
                            }}>SMART CLINIC SYSTEM</p>
                            
                            <span style={{ 
                                fontSize: '11px', 
                                padding: '5px 14px', 
                                backgroundColor: currentUserRole === 'admin' ? 'rgba(239, 68, 68, 0.08)' : currentUserRole === 'doctor' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(2, 132, 199, 0.08)', 
                                color: currentUserRole === 'admin' ? '#DC2626' : currentUserRole === 'doctor' ? '#059669' : '#0284C7', 
                                borderRadius: '30px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                fontWeight: '700',
                                width: 'fit-content',
                                border: currentUserRole === 'admin' ? '1px solid rgba(239, 68, 68, 0.2)' : currentUserRole === 'doctor' ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(2, 132, 199, 0.2)',
                                boxShadow: currentUserRole === 'admin' ? '0 2px 8px rgba(239, 68, 68, 0.08)' : currentUserRole === 'doctor' ? '0 2px 8px rgba(16, 185, 129, 0.08)' : '0 2px 8px rgba(2, 132, 199, 0.08)',
                                backdropFilter: 'blur(10px)'
                            }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor', display: 'inline-block', boxShadow: '0 0 6px currentColor' }}></span>
                                {currentUserRole === 'admin' ? 'مدير النظام' : currentUserRole === 'doctor' ? 'الطبيب' : 'الاستقبال'}
                            </span>
                        </div>
                    )}
                </div>
            )}

            {!isCollapsed && username && !isMobile && (
                <div style={{ 
                    padding: '12px 16px', 
                    marginBottom: '20px',
                    animation: 'sidebarFadeIn 0.5s ease',
                    direction: 'rtl',
                    background: '#FFFFFF',
                    borderRadius: '16px',
                    border: '1px solid #E2E8F0',
                    boxShadow: '0 4px 15px rgba(15, 23, 42, 0.03)',
                    backdropFilter: 'blur(15px)'
                }}>
                    <span style={{ color: '#64748B', fontSize: '11px', display: 'block', fontWeight: '600', marginBottom: '2px' }}>المستخدم النشط</span>
                    <span style={{ color: '#0284C7', fontSize: '13px', fontWeight: '700', letterSpacing: '0.3px' }}>@{username}</span>
                </div>
            )}

            {/* عناصر القائمة */}
            <div style={{ 
                display: 'flex', 
                flexDirection: isMobile ? 'row' : 'column', 
                gap: '8px', 
                flexGrow: 1, 
                justifyContent: isMobile ? 'space-around' : 'flex-start',
                width: '100%',
                overflowY: isMobile ? 'hidden' : 'auto', 
                overflowX: isMobile ? 'auto' : 'hidden', 
                padding: '4px 0',
                WebkitOverflowScrolling: 'touch',
                position: 'relative',
                zIndex: 1
            }}>
                {allowedMenuItems.map((item, index) => {
                    const isActive = activeTab === item.id;
                    const isHovered = hoveredId === item.id;
                    
                    return (
                        <div
                            key={item.id}
                            draggable={!isMobile} 
                            onDragStart={(e) => handleDragStart(e, item.id)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onMouseEnter={() => !isMobile && setHoveredId(item.id)}
                            onMouseLeave={() => !isMobile && setHoveredId(null)}
                            style={{ 
                                transform: isHovered && !isActive && !isMobile && !isCollapsed ? 'translateX(-4px)' : 'translateX(0)',
                                transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                flex: isMobile ? 1 : 'none',
                                maxWidth: isMobile ? '72px' : 'none',
                                width: '100%'
                            }}
                        >
                            <button
                                onClick={() => setActiveTab(item.id)}
                                title={item.name} 
                                style={{
                                    display: 'flex',
                                    flexDirection: isMobile ? 'column' : 'row',
                                    alignItems: 'center',
                                    justifyContent: isCollapsed && !isMobile ? 'center' : 'flex-start',
                                    gap: isCollapsed ? '0' : '14px',
                                    width: '100%',
                                    padding: isCollapsed && !isMobile ? '14px 0' : '13px 16px', 
                                    border: 'none',
                                    borderRadius: '16px',
                                    background: isActive 
                                        ? 'linear-gradient(135deg, rgba(2, 132, 199, 0.12) 0%, rgba(2, 132, 199, 0.04) 100%)' 
                                        : isHovered 
                                            ? '#F1F5F9' 
                                            : 'transparent',
                                    border: isActive 
                                        ? '1px solid rgba(2, 132, 199, 0.25)' 
                                        : isHovered 
                                            ? '1px solid #E2E8F0' 
                                            : '1px solid transparent',
                                    color: isActive ? '#0284C7' : isHovered ? '#0F172A' : '#475569',
                                    fontSize: '14px', 
                                    fontWeight: isActive ? '700' : '500',
                                    cursor: 'pointer',
                                    boxShadow: isActive 
                                        ? '0 6px 20px rgba(2, 132, 199, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8)' 
                                        : 'none',
                                    backdropFilter: isActive ? 'blur(10px)' : 'none',
                                    transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                                    position: 'relative'
                                }}
                            >
                                {isActive && !isCollapsed && !isMobile && (
                                    <div style={{ 
                                        position: 'absolute', 
                                        right: '0', 
                                        top: '20%', 
                                        bottom: '20%', 
                                        width: '4px', 
                                        backgroundColor: '#0284C7', 
                                        borderRadius: '4px 0 0 4px', 
                                        boxShadow: '0 0 10px rgba(2, 132, 199, 0.5)' 
                                    }} />
                                )}
                                
                                {item.icon(isActive)}
                                
                                {!isCollapsed && (
                                    <span style={{ 
                                        marginRight: '2px', 
                                        letterSpacing: '0.2px'
                                    }}>
                                        {item.name}
                                    </span>
                                )}
                            </button>
                        </div>
                    );
                })}

                {isMobile && (
                    <div style={{ flex: 1, maxWidth: '72px' }}>
                        <button
                            onClick={handleLogout}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                width: '100%',
                                padding: '8px 0',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#EF4444',
                                cursor: 'pointer'
                            }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            <span style={{ fontSize: '10px', fontWeight: '600' }}>خروج</span>
                        </button>
                    </div>
                )}
            </div>

            {/* الأزرار السفلية */}
            {!isMobile && (
                <div style={{ 
                    marginTop: 'auto', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    gap: '8px', 
                    borderTop: '1px solid #E2E8F0', 
                    paddingTop: '16px', 
                    width: '100%',
                    position: 'relative',
                    zIndex: 1
                }}>
                    <div 
                        onClick={handleLogout} 
                        onMouseEnter={() => setHoveredId('logout')}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{ 
                            padding: isCollapsed ? '13px 0' : '13px 16px',
                            color: '#DC2626', 
                            fontSize: '14px', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            gap: isCollapsed ? '0' : '14px',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            userSelect: 'none',
                            borderRadius: '16px',
                            backgroundColor: hoveredId === 'logout' ? 'rgba(239, 68, 68, 0.08)' : 'transparent',
                            border: hoveredId === 'logout' ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid transparent',
                            boxShadow: hoveredId === 'logout' ? '0 4px 12px rgba(239, 68, 68, 0.08)' : 'none',
                            width: '100%'
                        }}
                        title="تسجيل الخروج"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, filter: hoveredId === 'logout' ? 'drop-shadow(0 2px 4px rgba(220, 38, 38, 0.25))' : 'none' }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        {!isCollapsed && <span style={{ fontWeight: '600' }}>تسجيل الخروج</span>}
                    </div>

                    <div 
                        onClick={() => setIsCollapsed(!isCollapsed)} 
                        onMouseEnter={() => setHoveredId('collapse')}
                        onMouseLeave={() => setHoveredId(null)}
                        style={{ 
                            padding: isCollapsed ? '13px 0' : '13px 16px',
                            fontSize: '14px', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: isCollapsed ? 'center' : 'flex-start',
                            gap: isCollapsed ? '0' : '14px',
                            transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                            userSelect: 'none',
                            borderRadius: '16px',
                            backgroundColor: hoveredId === 'collapse' ? '#F1F5F9' : 'transparent',
                            color: hoveredId === 'collapse' ? '#0F172A' : '#475569',
                            border: hoveredId === 'collapse' ? '1px solid #E2E8F0' : '1px solid transparent',
                            width: '100%'
                        }}
                        title={isCollapsed ? "توسيع القائمة" : "طي القائمة"}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={hoveredId === 'collapse' ? "#0284C7" : "#64748B"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, filter: hoveredId === 'collapse' ? 'drop-shadow(0 2px 4px rgba(2, 132, 199, 0.25))' : 'none', transition: 'all 0.3s ease' }}><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
                        {!isCollapsed && <span style={{ fontWeight: '600' }}>طي القائمة</span>}
                    </div>
                </div>
            )}

            <style jsx global>{`
                @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800&family=Exo+2:wght@400;500;600;700&display=swap');
                .logo-container {
                    animation: sidebarFloat 4s ease-in-out infinite;
                }
                @keyframes sidebarFloat {
                    0% { transform: translateY(0px); }
                    50% { transform: translateY(-3px); }
                    100% { transform: translateY(0px); }
                }
                @keyframes sidebarFadeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
}
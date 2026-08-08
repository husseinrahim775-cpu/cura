const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false, // 🔒 مغلق لزيادة أمان التطبيق عند تصفح الموقع الأونلاين
      contextIsolation: true  // 🛡️ تفعيل عزل العمليات لحماية بيانات العيادة
    },
  });

  win.setMenu(null); // إخفاء القائمة العلوية ليظهر كبرنامج رسمي متكامل

  // 🕵️ التنكر كمتصفح كروم حديث لتجاوز أي قيود صلاحيات من قِبل Firebase أو النطاقات
  win.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // الفحص الآمن لبيئة العمل (تطوير أم إنتاج)
  const isDev = !app.isPackaged;

  if (isDev) {
    // ⚙️ في بيئة التطوير بالـ VS Code: يقرأ اللوكل هوست كالمعتاد
    win.webContents.session.clearCache().then(() => {
      win.loadURL('http://localhost:3000'); 
      win.webContents.openDevTools(); // فتح أدوات المطورين تلقائياً أثناء العمل
    });
} else {
    // 🚀 الرابط الرسمي والجديد للنظام أونلاين
    win.loadURL('https://cura-iq.netlify.app');
  }
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
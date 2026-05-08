# 🏨 دار الضيافة بالمنصورة
## Dar Al Diyafa Mansoura - Hotel Management System

<div align="center">
  <img src="assets/icon-192.png" alt="Logo" width="120"/>
  
  ![PWA](https://img.shields.io/badge/PWA-Ready-blue)
  ![Firebase](https://img.shields.io/badge/Firebase-Realtime-orange)
  ![Arabic](https://img.shields.io/badge/Arabic-RTL-green)
  ![License](https://img.shields.io/badge/License-MIT-yellow)
</div>

---

نظام إدارة فندقي متكامل وعصري بتقنية PWA مع دعم العمل بدون إنترنت.

## ✨ المميزات

- 🏠 **إدارة الغرف** - إضافة، تعديل، حذف، تغيير الحالة
- 💎 **غرف VIP** - تأثيرات ذهبية مضيئة خاصة
- 👥 **إدارة الضيوف** - بيانات كاملة وسجل إقامة
- 📊 **لوحة مالية** - إيرادات يومية/شهرية/سنوية
- 🔍 **بحث متقدم** - بالاسم أو الرقم أو الهاتف
- 🧾 **فواتير** - طباعة وتصدير PDF وواتساب
- 📋 **سجل النشاط** - تتبع كل العمليات
- 👨‍💼 **إدارة الموظفين** - صلاحيات متعددة
- 📴 **وضع بدون إنترنت** - يعمل بالكامل Offline
- 📱 **PWA** - قابل للتثبيت على Android و iPhone

## 🚀 رفع على GitHub Pages

### الطريقة الأولى: عبر الموقع مباشرة

1. افتح [github.com](https://github.com) وسجّل دخول
2. اضغط **"New repository"** (المستودع الجديد)
3. اسمّه: `dar-aldiyafa` ← اختار Public
4. اضغط **"Create repository"**
5. اضغط **"uploading an existing file"**
6. اسحب وارفع كل الملفات التالية:
   ```
   index.html
   style.css
   firebase.js
   service-worker.js
   manifest.json
   assets/ (الفولدر كله)
   ```
7. اضغط **"Commit changes"**
8. روح **Settings → Pages**
9. في **Source** اختار: `Deploy from a branch`
10. في **Branch** اختار: `main` ثم `/ (root)`
11. اضغط **Save**
12. انتظر دقيقتين ← رابطك هيبقى:  
    `https://اسم-المستخدم.github.io/dar-aldiyafa`

### الطريقة الثانية: عبر Git (للمتقدمين)

```bash
git init
git add .
git commit -m "🏨 Initial commit - Dar Al Diyafa Hotel System"
git remote add origin https://github.com/USERNAME/dar-aldiyafa.git
git push -u origin main
```

## 📁 هيكل المشروع

```
dar-aldiyafa/
├── index.html          ← الصفحة الرئيسية
├── style.css           ← التصميم والأنيميشن
├── firebase.js         ← كود التطبيق + Firebase
├── service-worker.js   ← الـ PWA والـ Offline
├── manifest.json       ← إعدادات التطبيق
├── README.md           ← هذا الملف
└── assets/
    ├── icon-72.png
    ├── icon-96.png
    ├── icon-128.png
    ├── icon-144.png
    ├── icon-152.png
    ├── icon-192.png
    ├── icon-384.png
    └── icon-512.png
```

## 🔑 بيانات الدخول الافتراضية

| المستخدم | كلمة المرور | الصلاحيات |
|----------|-------------|-----------|
| admin | 521988 | Super Admin |

## 🔧 Firebase

التطبيق متصل بـ Firebase Realtime Database تلقائياً.

لا تحتاج أي إعداد إضافي.

## 📱 تثبيت كتطبيق

- **Android**: افتح الموقع في Chrome ← اضغط "إضافة للشاشة الرئيسية"
- **iPhone**: افتح في Safari ← اضغط Share ← "Add to Home Screen"

---

**💻 Programming & Developed With ❤️ By Engineer Mohamed Hammad**

[![Facebook](https://img.shields.io/badge/Facebook-Connect-1877F2?logo=facebook)](https://www.facebook.com/en.mohamed.nasr)

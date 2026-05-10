/**
 * دار الضيافة بالمنصورة
 * Dar Al Diyafa Mansoura - Hotel Management System
 * Main Application JavaScript (firebase.js)
 * Production Ready | PWA | Offline Support
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  update,
  remove,
  onValue,
  off,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
const firebaseConfig = {
  apiKey: "AIzaSyAgdFieJT9c0B9UOcLs5OAjvJULDzWEqtQ",
  authDomain: "dar-mans.firebaseapp.com",
  databaseURL: "https://dar-mans-default-rtdb.firebaseio.com",
  projectId: "dar-mans",
  storageBucket: "dar-mans.firebasestorage.app",
  messagingSenderId: "109230205768",
  appId: "1:109230205768:web:2d970507dd42a703b1617d",
  measurementId: "G-4GWV61M27Z"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// ============================================================
// APP STATE
// ============================================================
const AppState = {
  currentUser: null,
  rooms: {},
  guests: {},
  reservations: {},
  employees: {},
  activityLogs: [],
  currentFilter: 'all',
  offlineQueue: JSON.parse(localStorage.getItem('offlineQueue') || '[]'),
  isOnline: navigator.onLine,
  theme: localStorage.getItem('theme') || 'light', // default is always light
  currentEditRoom: null,
  finPeriod: 'day'
};

// ============================================================
// MASTER ADMIN + DEFAULT DATA
// ============================================================
const MASTER_ADMIN = {
  id: 'master',
  name: 'المدير العام',
  username: 'admin',
  password: '521988',
  role: 'superadmin',
  permissions: { rooms: true, guests: true, financial: true, employees: true }
};

// ============================================================
// DOM READY
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  initParticles();
  initClock();
  // Always start with light mode - force it regardless of saved preference
  AppState.theme = 'light';
  localStorage.setItem('theme', 'light');
  applyTheme('light');
  setupOnlineStatus();
  setupSidebarBackdrop();

  // Set today's date defaults
  const today = new Date().toISOString().split('T')[0];
  const finFrom = document.getElementById('fin-from');
  const finTo = document.getElementById('fin-to');
  if (finFrom) { finFrom.value = today; finTo.value = today; }

  // Check session
  const session = localStorage.getItem('hotelSession');
  if (session) {
    const user = JSON.parse(session);
    AppState.currentUser = user;
    loginSuccess(user);
  }

  // Process any queued offline operations
  if (AppState.isOnline) {
    await processOfflineQueue();
  }

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('service-worker.js');
    } catch(e) {
      console.log('SW registration skipped:', e.message);
    }
  }
});

// ============================================================
// PARTICLES BACKGROUND
// ============================================================
function initParticles() {
  const bg = document.getElementById('particles-bg');
  if (!bg) return;
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      width: ${Math.random() * 3 + 1}px;
      height: ${Math.random() * 3 + 1}px;
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
      opacity: ${Math.random() * 0.5 + 0.2};
    `;
    bg.appendChild(p);
  }
}

// ============================================================
// CLOCK
// ============================================================
function initClock() {
  const tick = () => {
    const now = new Date();
    const clock = document.getElementById('live-clock');
    const dateEl = document.getElementById('live-date');
    if (clock) {
      clock.textContent = now.toLocaleTimeString('ar-EG');
    }
    if (dateEl) {
      dateEl.textContent = now.toLocaleDateString('ar-EG', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      });
    }
  };
  tick();
  setInterval(tick, 1000);
}

// ============================================================
// ONLINE STATUS
// ============================================================
function setupOnlineStatus() {
  const updateStatus = () => {
    AppState.isOnline = navigator.onLine;
    const el = document.getElementById('online-status');
    if (!el) return;
    const dot = el.querySelector('.status-dot');
    const txt = el.querySelector('span:last-child');
    if (navigator.onLine) {
      dot.className = 'status-dot online';
      txt.textContent = 'متصل';
      processOfflineQueue();
    } else {
      dot.className = 'status-dot';
      txt.textContent = 'غير متصل';
    }
  };
  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);
  updateStatus();
}

// ============================================================
// OFFLINE QUEUE
// ============================================================
async function processOfflineQueue() {
  if (!AppState.offlineQueue.length) return;
  showToast('جاري مزامنة البيانات المحفوظة...', 'info');
  const queue = [...AppState.offlineQueue];
  AppState.offlineQueue = [];
  localStorage.setItem('offlineQueue', '[]');
  for (const op of queue) {
    try {
      if (op.type === 'set') await set(ref(db, op.path), op.data);
      if (op.type === 'update') await update(ref(db, op.path), op.data);
      if (op.type === 'remove') await remove(ref(db, op.path));
    } catch(e) {
      AppState.offlineQueue.push(op);
    }
  }
  if (AppState.offlineQueue.length) {
    localStorage.setItem('offlineQueue', JSON.stringify(AppState.offlineQueue));
  } else {
    showToast('تم مزامنة جميع البيانات ✅', 'success');
  }
}

function queueOperation(type, path, data = null) {
  AppState.offlineQueue.push({ type, path, data, timestamp: Date.now() });
  localStorage.setItem('offlineQueue', JSON.stringify(AppState.offlineQueue));
}

// ============================================================
// SAFE DB OPERATIONS (with offline fallback)
// ============================================================
async function dbSet(path, data) {
  if (AppState.isOnline) {
    try { await set(ref(db, path), data); return true; }
    catch(e) { console.error('DB set error:', e); }
  }
  queueOperation('set', path, data);
  return false;
}

async function dbUpdate(path, data) {
  if (AppState.isOnline) {
    try { await update(ref(db, path), data); return true; }
    catch(e) { console.error('DB update error:', e); }
  }
  queueOperation('update', path, data);
  return false;
}

async function dbRemove(path) {
  if (AppState.isOnline) {
    try { await remove(ref(db, path)); return true; }
    catch(e) { console.error('DB remove error:', e); }
  }
  queueOperation('remove', path);
  return false;
}

async function dbPush(path, data) {
  if (AppState.isOnline) {
    try {
      const r = push(ref(db, path));
      await set(r, data);
      return r.key;
    } catch(e) { console.error('DB push error:', e); }
  }
  const tempKey = 'temp_' + Date.now();
  queueOperation('set', `${path}/${tempKey}`, data);
  return tempKey;
}

// ============================================================
// AUTH - LOGIN
// ============================================================
window.doLogin = async function() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.classList.add('hidden');

  if (!username || !password) {
    errEl.textContent = 'يرجى إدخال اسم المستخدم وكلمة المرور';
    errEl.classList.remove('hidden');
    return;
  }

  // Check master admin
  if (username === MASTER_ADMIN.username && password === MASTER_ADMIN.password) {
    loginSuccess(MASTER_ADMIN);
    return;
  }

  // Check employees from Firebase
  try {
    const snap = await get(ref(db, 'employees'));
    if (snap.exists()) {
      const employees = snap.val();
      for (const [id, emp] of Object.entries(employees)) {
        if (emp.username === username && emp.password === password) {
          loginSuccess({ ...emp, id });
          return;
        }
      }
    }
  } catch(e) {
    // Check local employees (offline)
    const localEmps = JSON.parse(localStorage.getItem('localEmployees') || '{}');
    for (const [id, emp] of Object.entries(localEmps)) {
      if (emp.username === username && emp.password === password) {
        loginSuccess({ ...emp, id });
        return;
      }
    }
  }

  errEl.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
  errEl.classList.remove('hidden');
};

function loginSuccess(user) {
  AppState.currentUser = user;
  localStorage.setItem('hotelSession', JSON.stringify(user));

  document.getElementById('current-user-name').textContent = user.name;
  document.getElementById('sidebar-user-name').textContent = user.name;
  document.getElementById('sidebar-user-role').textContent =
    user.role === 'superadmin' ? 'مدير النظام' :
    user.role === 'admin' ? 'مدير' :
    user.role === 'manager' ? 'مدير قسم' : 'موظف استقبال';

  // Apply section permissions
  enforcePermissions(user);

  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');

  logActivity('login', `تسجيل دخول: ${user.name}`, '🔑');
  initDataListeners();
  updateFinancials();
  requestNotificationPermission();
  setTimeout(startCheckoutNotifications, 3000);
}

function enforcePermissions(user) {
  const isSuperAdmin = user.role === 'superadmin';
  const isAdmin = user.role === 'admin';
  const isPrivileged = isSuperAdmin || isAdmin;
  const p = isPrivileged
    ? { dashboard: true, rooms: true, reservations: true, search: true, financial: true, employees: true, activity: true }
    : (user.permissions || {});

  // Store globally for showSection checks
  AppState.canViewRooms        = isPrivileged || p.rooms        !== false;
  AppState.canViewReservations = isPrivileged || p.reservations !== false;
  AppState.canViewSearch       = isPrivileged || p.search       !== false;
  AppState.canViewFinancial    = isPrivileged || !!p.financial;
  AppState.canViewEmployees    = isPrivileged || !!p.employees;
  AppState.canViewActivity     = isPrivileged || p.activity     !== false;
  AppState.canViewGuests       = isPrivileged || p.rooms        !== false;

  // Show/hide nav items
  function setNav(id, show) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  }

  setNav('nav-rooms',      AppState.canViewRooms);
  setNav('nav-financial',  AppState.canViewFinancial);
  setNav('nav-employees',  AppState.canViewEmployees);

  // All sidebar + bottom nav items controlled by permission
  document.querySelectorAll('.nav-item, .bottom-nav-item').forEach(el => {
    const onclick = el.getAttribute('onclick') || '';
    if (onclick.includes("'reservations'")) el.style.display = AppState.canViewReservations ? '' : 'none';
    if (onclick.includes("'search'"))       el.style.display = AppState.canViewSearch       ? '' : 'none';
    if (onclick.includes("'activity'"))     el.style.display = AppState.canViewActivity      ? '' : 'none';
    if (onclick.includes("'financial'"))    el.style.display = AppState.canViewFinancial     ? '' : 'none';
    if (onclick.includes("'employees'"))    el.style.display = AppState.canViewEmployees     ? '' : 'none';
    if (onclick.includes("'rooms'"))        el.style.display = AppState.canViewRooms         ? '' : 'none';
  });

  setNav('bottom-nav-financial', AppState.canViewFinancial);
}

window.doLogout = function() {
  if (!confirm('هل تريد تسجيل الخروج؟')) return;
  logActivity('logout', `تسجيل خروج: ${AppState.currentUser?.name}`, '🚪');
  AppState.currentUser = null;
  localStorage.removeItem('hotelSession');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('main-app').classList.add('hidden');
};

// ============================================================
// FIREBASE REALTIME LISTENERS
// ============================================================
function initDataListeners() {
  // Rooms
  onValue(ref(db, 'rooms'), snap => {
    AppState.rooms = snap.exists() ? snap.val() : {};
    renderRooms();
    updateStats();
    updateRoomsTable();
    populateRoomDropdown();
  });

  // Guests
  onValue(ref(db, 'guests'), snap => {
    AppState.guests = snap.exists() ? snap.val() : {};
    renderRooms(); // refresh cards with guest data
  });

  // Reservations
  onValue(ref(db, 'reservations'), snap => {
    AppState.reservations = snap.exists() ? snap.val() : {};
    renderReservations();
  });

  // Employees
  onValue(ref(db, 'employees'), snap => {
    AppState.employees = snap.exists() ? snap.val() : {};
    // Cache locally for offline login
    localStorage.setItem('localEmployees', JSON.stringify(AppState.employees));
    renderEmployees();
  });

  // Activity logs
  onValue(ref(db, 'activityLogs'), snap => {
    if (snap.exists()) {
      const logs = snap.val();
      AppState.activityLogs = Object.entries(logs)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, 100);
      renderActivityLog();
    }
  });
}

// ============================================================
// NAVIGATION
// ============================================================
window.showSection = function(name) {
  // Permission checks
  const sectionPerms = {
    rooms:        AppState.canViewRooms,
    reservations: AppState.canViewReservations,
    search:       AppState.canViewSearch,
    financial:    AppState.canViewFinancial,
    employees:    AppState.canViewEmployees,
    activity:     AppState.canViewActivity,
    'guests-list': AppState.canViewGuests,
  };

  if (name in sectionPerms && !sectionPerms[name]) {
    showToast('ليس لديك صلاحية للوصول إلى هذا القسم', 'error');
    return;
  }
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.add('active');

  if (name === 'financial') updateFinancials();
  if (name === 'guests-list') renderGuestsList();

  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.querySelector('.sidebar-backdrop')?.classList.remove('active');
  }
};

window.toggleSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.querySelector('.sidebar-backdrop');
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
    backdrop?.classList.toggle('active');
  } else {
    sidebar.classList.toggle('collapsed');
    document.querySelector('.content-area').classList.toggle('full-width');
    document.querySelector('.app-footer').classList.toggle('full-width');
  }
};

function setupSidebarBackdrop() {
  const backdrop = document.createElement('div');
  backdrop.className = 'sidebar-backdrop';
  backdrop.onclick = () => {
    document.getElementById('sidebar').classList.remove('open');
    backdrop.classList.remove('active');
  };
  document.body.appendChild(backdrop);
}

// ============================================================
// THEME
// ============================================================
window.toggleTheme = function() {
  AppState.theme = AppState.theme === 'dark' ? 'light' : 'dark';
  applyTheme(AppState.theme);
  localStorage.setItem('theme', AppState.theme);
};

function applyTheme(theme) {
  document.body.className = theme === 'light' ? 'light-mode' : 'dark-mode';
  const btn = document.querySelector('.theme-toggle');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
}

// ============================================================
// CHECKOUT NOTIFICATIONS SYSTEM
// ============================================================
let notificationCheckInterval = null;

function startCheckoutNotifications() {
  checkForCheckoutNotifications();
  if (notificationCheckInterval) clearInterval(notificationCheckInterval);
  notificationCheckInterval = setInterval(checkForCheckoutNotifications, 60 * 1000); // check every minute
}

function checkForCheckoutNotifications() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  Object.entries(AppState.guests).forEach(([roomId, guest]) => {
    if (!guest || !guest.checkoutDate) return;
    const room = AppState.rooms[roomId];
    if (!room || room.status !== 'occupied') return;

    const checkoutDate = guest.checkoutDate;
    const checkoutTime = guest.checkoutTime || '12:00';

    // Parse checkout datetime
    const checkoutDT = new Date(`${checkoutDate}T${checkoutTime}:00`);
    const diffMs = checkoutDT - now;
    const diffMins = Math.round(diffMs / 60000);

    // Already notified key
    const notifKey = `notified_${roomId}_${checkoutDate}`;
    const alreadyNotified = sessionStorage.getItem(notifKey);

    // Trigger notification: overdue (past checkout) or within 30 min
    if (!alreadyNotified && (diffMins <= 0 || (diffMins > 0 && diffMins <= 30))) {
      sessionStorage.setItem(notifKey, '1');
      showCheckoutNotification(roomId, room, guest, diffMins);
    }
  });
}

function showCheckoutNotification(roomId, room, guest, diffMins) {
  // Remove any existing checkout notification for this room
  const existingId = `checkout-notif-${roomId}`;
  const existing = document.getElementById(existingId);
  if (existing) existing.remove();

  const isOverdue = diffMins <= 0;
  const timeText = isOverdue
    ? `تجاوز وقت المغادرة بـ ${Math.abs(diffMins)} دقيقة`
    : `متبقي ${diffMins} دقيقة على موعد المغادرة`;

  const notif = document.createElement('div');
  notif.id = existingId;
  notif.className = `checkout-notification ${isOverdue ? 'overdue' : 'warning'}`;
  notif.innerHTML = `
    <div class="checkout-notif-header">
      <span class="checkout-notif-icon">${isOverdue ? '🚨' : '⏰'}</span>
      <div class="checkout-notif-title">
        <strong>${isOverdue ? 'انتهى وقت الإقامة!' : 'تنبيه: موعد المغادرة قريب'}</strong>
        <div class="checkout-notif-subtitle">الغرفة ${room.number} ${room.type === 'vip' ? '👑' : ''} | ${guest.name || 'نزيل'}</div>
      </div>
      <button class="checkout-notif-close" onclick="dismissCheckoutNotif('${existingId}')">✕</button>
    </div>
    <div class="checkout-notif-time">${timeText}</div>
    <div class="checkout-notif-days">
      عدد الأيام المحجوزة: ${guest.days || 0} يوم &nbsp;|&nbsp; تاريخ المغادرة: ${guest.checkoutDate} ${guest.checkoutTime || '12:00'}
    </div>
    <div class="checkout-notif-actions">
      ${guest.phone ? `
        <button class="btn-call-notif" onclick="callGuestFromNotif('${guest.phone}')">
          📞 اتصال بالنزيل
        </button>
        <button class="btn-whatsapp-notif" onclick="whatsappGuestFromNotif('${guest.phone}')">
          💬 واتساب
        </button>
      ` : ''}
      <button class="btn-extend-notif" onclick="extendStayFromNotif('${roomId}', '${existingId}')">
        🗓️ تمديد الإقامة
      </button>
      <button class="btn-checkout-notif" onclick="quickCheckoutFromNotif('${roomId}', '${existingId}')">
        🚪 تم تسجيل الخروج
      </button>
    </div>
  `;

  document.body.appendChild(notif);

  // Auto-dismiss after 2 minutes if not overdue
  if (!isOverdue) {
    setTimeout(() => {
      const el = document.getElementById(existingId);
      if (el) el.remove();
    }, 120000);
  }

  // Browser notification if permitted
  if (Notification.permission === 'granted') {
    new Notification(`🚨 دار الضيافة - الغرفة ${room.number}`, {
      body: `${guest.name || 'النزيل'} - ${timeText}`,
      icon: 'assets/icon-192.png'
    });
  }
}

window.dismissCheckoutNotif = function(notifId) {
  const el = document.getElementById(notifId);
  if (el) el.classList.add('dismissing');
  setTimeout(() => { if (el) el.remove(); }, 300);
};

window.callGuestFromNotif = function(phone) {
  window.open(`tel:${phone}`);
};

window.whatsappGuestFromNotif = function(phone) {
  const fullPhone = '20' + phone.replace(/^0/, '');
  window.open(`https://wa.me/${fullPhone}`, '_blank');
};

window.quickCheckoutFromNotif = async function(roomId, notifId) {
  const room = AppState.rooms[roomId];
  const guest = AppState.guests[roomId];
  if (!room || !guest) return;

  if (!confirm(`تأكيد تسجيل خروج ${guest.name || 'النزيل'} من الغرفة ${room.number}؟`)) return;

  // Archive guest permanently to checkoutHistory (لا يُحذف أبداً)
  if (guest) {
    await dbPush('checkoutHistory', {
      ...guest,
      checkoutActual: Date.now(),
      checkoutActualDate: new Date().toISOString().split('T')[0],
      roomNumber: room?.number,
      roomId
    });
  }

  // حذف بيانات المقيم الحالية وتحرير الغرفة فوراً
  await dbRemove(`guests/${roomId}`);
  await dbUpdate(`rooms/${roomId}`, { status: 'available', keyWithReception: true });

  logActivity('checkout', `خروج سريع من الغرفة ${room.number}: ${guest.name}`, '🚪');
  showToast(`✅ تم تسجيل خروج ${guest.name || ''} والغرفة ${room.number} متاحة الآن`, 'success');

  const el = document.getElementById(notifId);
  if (el) el.remove();
};

// ============================================================
// EXTEND STAY FROM NOTIFICATION
// ============================================================
window.extendStayFromNotif = function(roomId, notifId) {
  const room = AppState.rooms[roomId];
  const guest = AppState.guests[roomId];
  if (!room || !guest) return;

  // Remove any old extend modal
  const oldOverlay = document.getElementById('extend-modal-overlay');
  if (oldOverlay) oldOverlay.remove();

  const overlay = document.createElement('div');
  overlay.id = 'extend-modal-overlay';
  overlay.className = 'extend-modal-overlay';
  overlay.innerHTML = `
    <div class="extend-modal-box">
      <h3>🗓️ تمديد إقامة ${guest.name || 'النزيل'}</h3>
      <label>تاريخ المغادرة الحالي</label>
      <input type="text" value="${guest.checkoutDate || '-'} الساعة ${guest.checkoutTime || '12:00'}" readonly style="opacity:0.6;cursor:default;">
      <label>عدد أيام التمديد الإضافية</label>
      <input type="number" id="extend-days-input" min="1" max="365" value="1" placeholder="أدخل عدد الأيام">
      <div class="extend-modal-actions">
        <button class="btn-extend-cancel" onclick="document.getElementById('extend-modal-overlay').remove()">إلغاء</button>
        <button class="btn-extend-confirm" onclick="confirmExtendStay('${roomId}', '${notifId}')">✅ تأكيد التمديد</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Close on overlay click (outside box)
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  setTimeout(() => {
    const inp = document.getElementById('extend-days-input');
    if (inp) inp.focus();
  }, 100);
};

window.confirmExtendStay = async function(roomId, notifId) {
  const guest = AppState.guests[roomId];
  const room = AppState.rooms[roomId];
  if (!guest) return;

  const extraDays = parseInt(document.getElementById('extend-days-input')?.value) || 0;
  if (extraDays < 1) {
    alert('يرجى إدخال عدد أيام صحيح (1 على الأقل)');
    return;
  }

  // Calculate new checkout date
  const oldCheckout = new Date(guest.checkoutDate);
  oldCheckout.setDate(oldCheckout.getDate() + extraDays);
  const newCheckoutDate = oldCheckout.toISOString().split('T')[0];

  // Update totals
  const newDays = (guest.days || 0) + extraDays;
  const newTotal = newDays * (parseFloat(guest.pricePerNight) || 0);
  const newRemaining = newTotal - (parseFloat(guest.paid) || 0);

  const updatedGuest = {
    ...guest,
    checkoutDate: newCheckoutDate,
    days: newDays,
    total: newTotal,
    remaining: newRemaining,
    updatedAt: Date.now(),
    updatedBy: AppState.currentUser?.name || 'غير معروف'
  };

  await dbSet(`guests/${roomId}`, updatedGuest);

  logActivity('extend', `تمديد إقامة ${guest.name} في الغرفة ${room?.number} بـ ${extraDays} يوم حتى ${newCheckoutDate}`, '🗓️');
  
  // Remove extend modal and notification
  const overlay = document.getElementById('extend-modal-overlay');
  if (overlay) overlay.remove();
  const notifEl = document.getElementById(notifId);
  if (notifEl) notifEl.remove();

  // Clear notified flag so it can trigger again when needed
  const notifKey = `notified_${roomId}_${guest.checkoutDate}`;
  localStorage.removeItem(notifKey);

  showToast(`✅ تم تمديد إقامة ${guest.name} حتى ${newCheckoutDate} (${newDays} يوم إجمالاً)`, 'success');
};

// Request notification permission on login
function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

// ============================================================
// SMART ROOM FILTER (Dashboard + Rooms section)
// ============================================================
window.filterFloor = function(floor, btn) {
  AppState.currentFilter = floor;
  document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRooms();
};

// Smart filter state
AppState.smartFilter = { status: 'all', type: 'all', floor: 'all' };

window.applyDropdownFilter = function() {
  AppState.smartFilter.status = document.getElementById('filter-status')?.value || 'all';
  AppState.smartFilter.type   = document.getElementById('filter-type')?.value  || 'all';
  AppState.smartFilter.floor  = document.getElementById('filter-floor')?.value  || 'all';
  renderRoomsTable();
};

window.resetDropdownFilter = function() {
  AppState.smartFilter = { status: 'all', type: 'all', floor: 'all' };
  const fs = document.getElementById('filter-status');
  const ft = document.getElementById('filter-type');
  const ff = document.getElementById('filter-floor');
  if (fs) fs.value = 'all';
  if (ft) ft.value = 'all';
  if (ff) ff.value = 'all';
  renderRoomsTable();
};

// Keep old applySmartFilter as alias (not used anymore)
window.applySmartFilter = function() {};
window.resetSmartFilter = window.resetDropdownFilter;

// ============================================================
// RENDER ROOMS
// ============================================================
function renderRooms() {
  const grid = document.getElementById('rooms-grid');
  if (!grid) return;

  const rooms = Object.entries(AppState.rooms);
  if (!rooms.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏨</div>
        <p>لا توجد غرف بعد. أضف غرفة جديدة من الشريط الجانبي.</p>
      </div>`;
    return;
  }

  // Filter by floor
  const filtered = rooms.filter(([id, room]) => {
    if (AppState.currentFilter === 'all') return true;
    return String(room.floor) === String(AppState.currentFilter);
  });

  // Sort by floor then room number
  filtered.sort(([,a], [,b]) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    return String(a.number).localeCompare(String(b.number), 'ar', { numeric: true });
  });

  grid.innerHTML = filtered.map(([id, room]) => {
    const guest = AppState.guests[id];
    const statusLabels = {
      available: 'شاغرة', occupied: 'مشغولة',
      reserved: 'محجوزة', cleaning: 'تنظيف', maintenance: 'صيانة'
    };
    const statusEmojis = {
      available: '✅', occupied: '🔴', reserved: '🟠', cleaning: '🔵', maintenance: '⚙️'
    };

    const remainingDays = guest?.checkoutDate ?
      calcRemainingDays(guest.checkoutDate) : '';

    const keyIcon = (room.status === 'available' || !room.status)
      ? `<span class="key-icon" title="المفتاح مع الدار">🗝️</span>`
      : (room.keyWithReception ? `<span class="key-icon" title="المفتاح مع الاستقبال">🗝️</span>` : '');

    const vipClass = room.type === 'vip' ? 'vip' : '';
    const vipBadge = room.type === 'vip' ?
      `<span class="vip-badge">👑 VIP</span>` : '';

    return `
    <div class="room-card ${room.status || 'available'} ${vipClass}"
         onclick="openRoomModal('${id}')"
         style="animation-delay: ${Math.random()*0.3}s">
      <div class="room-card-header">
        <div>
          <div class="room-number">${room.number}</div>
          <div class="room-type-badge">الدور ${room.floor}</div>
        </div>
        <div>${vipBadge}</div>
      </div>
      <div class="status-indicator">
        <div class="status-dot-card"></div>
        <span class="status-text">${statusLabels[room.status] || 'شاغرة'} ${statusEmojis[room.status] || ''}</span>
      </div>
      ${guest?.name ? `<div class="guest-name-card">👤 ${guest.name}</div>` : ''}
      <div class="room-card-footer">
        ${remainingDays !== '' ? `<span class="remaining-days-badge">${remainingDays} يوم</span>` : '<span></span>'}
        ${keyIcon}
      </div>
    </div>`;
  }).join('');
}

function calcRemainingDays(checkoutDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkout = new Date(checkoutDateStr);
  checkout.setHours(0, 0, 0, 0);
  const diff = Math.round((checkout - today) / (1000 * 60 * 60 * 24));
  return Math.max(0, diff);
}

// ============================================================
// STATS
// ============================================================
function updateStats() {
  const rooms = Object.values(AppState.rooms);
  const counts = { available: 0, occupied: 0, reserved: 0, cleaning: 0, maintenance: 0, vip: 0 };

  rooms.forEach(r => {
    counts[r.status || 'available'] = (counts[r.status || 'available'] || 0) + 1;
    if (r.type === 'vip') counts.vip++;
  });

  setText('stat-available', counts.available);
  setText('stat-occupied', counts.occupied);
  setText('stat-reserved', counts.reserved);
  setText('stat-vip', counts.vip);
  setText('stat-total', rooms.length);

  // Today's revenue
  const today = new Date().toISOString().split('T')[0];
  let todayRev = 0;
  Object.values(AppState.guests).forEach(g => {
    if (g.checkinDate === today && g.paid) {
      todayRev += parseFloat(g.paid) || 0;
    }
  });
  setText('stat-revenue', todayRev.toLocaleString('ar-EG'));
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ============================================================
// ROOMS TABLE
// ============================================================
function updateRoomsTable() {
  renderRoomsTable();
}

function renderRoomsTable() {
  const tbody = document.getElementById('rooms-table-body');
  if (!tbody) return;

  const sf = AppState.smartFilter || { status: 'all', type: 'all', floor: 'all' };
  let rooms = Object.entries(AppState.rooms);
  if (!rooms.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد غرف</td></tr>`;
    return;
  }

  // Apply smart filters
  if (sf.status !== 'all') {
    rooms = rooms.filter(([,r]) => (r.status || 'available') === sf.status);
  }
  if (sf.type !== 'all') {
    rooms = rooms.filter(([,r]) => sf.type === 'vip' ? r.type === 'vip' : r.type !== 'vip');
  }
  if (sf.floor !== 'all') {
    rooms = rooms.filter(([,r]) => String(r.floor) === String(sf.floor));
  }

  rooms.sort(([,a],[,b]) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    return String(a.number).localeCompare(String(b.number), 'ar', {numeric:true});
  });

  const countEl = document.getElementById('rooms-filter-count');

  if (!rooms.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد غرف تطابق الفلتر المحدد</td></tr>`;
    if (countEl) countEl.textContent = '0 غرفة';
    return;
  }

  if (countEl) countEl.textContent = `${rooms.length} غرفة`;

  const statusMap = {
    available: ['badge-available','شاغرة ✅'], occupied: ['badge-occupied','مشغولة 🔴'],
    reserved: ['badge-reserved','محجوزة 🟠'], cleaning: ['badge-cleaning','تنظيف 🔵'],
    maintenance: ['badge-maintenance','صيانة ⚙️']
  };

  tbody.innerHTML = rooms.map(([id, room]) => {
    const guest = AppState.guests[id];
    const [badgeClass, label] = statusMap[room.status] || ['badge-available','شاغرة'];
    const tableKeyIcon = (room.status === 'available' || !room.status)
      ? `<span class="key-icon" style="font-size:14px;" title="المفتاح مع الدار">🗝️</span>` : '';

    return `
    <tr>
      <td><strong>${room.number}</strong></td>
      <td>${room.type === 'vip' ? '<span class="badge badge-vip">👑 VIP</span>' : 'عادية'}</td>
      <td>الدور ${room.floor}</td>
      <td><span class="badge ${badgeClass}">${label}</span> ${tableKeyIcon}</td>
      <td>${guest?.name || '-'}</td>
      <td>
        <div style="display:flex;gap:8px">
          <button class="btn-secondary btn-sm" onclick="openRoomModal('${id}')">✏️ تفاصيل</button>
          <button class="btn-secondary btn-sm" onclick="showEditRoomModal('${id}')">⚙️ تعديل</button>
          <button class="btn-danger btn-sm" onclick="deleteRoom('${id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ============================================================
// OPEN ROOM MODAL (Guest Form)
// ============================================================
window.openRoomModal = function(roomId) {
  const room = AppState.rooms[roomId];
  if (!room) return;
  const guest = AppState.guests[roomId];

  document.getElementById('modal-room-id').value = roomId;
  document.getElementById('modal-room-title').textContent =
    `الغرفة ${room.number} ${room.type === 'vip' ? '👑' : ''} - الدور ${room.floor}`;

  // Status
  const statusSel = document.getElementById('modal-status');
  if (statusSel) statusSel.value = room.status || 'available';

  // Key
  const keyCb = document.getElementById('modal-key-reception');
  if (keyCb) {
    // If room is available, default key to be with reception (with the house)
    if (room.status === 'available' || !room.status) {
      keyCb.checked = room.keyWithReception !== undefined ? room.keyWithReception : true;
    } else {
      keyCb.checked = room.keyWithReception || false;
    }
  }

  // Guest data
  const fields = {
    'g-name': guest?.name || '',
    'g-profession': guest?.profession || '',
    'g-phone': guest?.phone || '',
    'g-whatsapp': guest?.whatsapp || '',
    'g-national-id': guest?.nationalId || '',
    'g-notes': guest?.notes || '',
    'g-checkin-date': guest?.checkinDate || '',
    'g-checkin-time': guest?.checkinTime || '',
    'g-checkout-date': guest?.checkoutDate || '',
    'g-checkout-time': guest?.checkoutTime || '12:00',
    'g-days': guest?.days || '',
    'g-price-per-night': guest?.pricePerNight || '',
    'g-total': guest?.total || '',
    'g-paid': guest?.paid || '',
    'g-remaining': guest?.remaining || '',
    'g-remaining-days': guest?.checkoutDate ? calcRemainingDays(guest.checkoutDate) : ''
  };

  Object.entries(fields).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });

  // Load companions
  companions = Array.isArray(guest?.companions) ? guest.companions.map((c, i) => ({ id: Date.now() + i, name: c.name || '', nationalId: c.nationalId || '' })) : [];
  renderCompanions();

  // Show checkout button if occupied
  const btnCheckout = document.getElementById('btn-checkout');
  if (btnCheckout) {
    btnCheckout.style.display = room.status === 'occupied' ? 'inline-flex' : 'none';
  }

  openModal('guest-modal');
};

// ============================================================
// SAVE GUEST DATA
// ============================================================
window.saveGuestData = async function() {
  const roomId = document.getElementById('modal-room-id').value;
  if (!roomId) return;

  const days = parseInt(document.getElementById('g-days').value) || 0;
  const pricePerNight = parseFloat(document.getElementById('g-price-per-night').value) || 0;
  const total = days * pricePerNight;
  const paid = parseFloat(document.getElementById('g-paid').value) || 0;
  const remaining = total - paid;

  const guestData = {
    name: document.getElementById('g-name').value.trim(),
    profession: document.getElementById('g-profession').value.trim(),
    phone: document.getElementById('g-phone').value.trim(),
    whatsapp: document.getElementById('g-whatsapp').value.trim(),
    nationalId: document.getElementById('g-national-id').value.trim(),
    companions: companions.filter(c => c.name || c.nationalId).map(c => ({ name: c.name.trim(), nationalId: c.nationalId.trim() })),
    notes: document.getElementById('g-notes').value.trim(),
    checkinDate: document.getElementById('g-checkin-date').value,
    checkinTime: document.getElementById('g-checkin-time').value,
    checkoutDate: document.getElementById('g-checkout-date').value,
    checkoutTime: document.getElementById('g-checkout-time').value || '12:00',
    days,
    pricePerNight,
    total,
    paid,
    remaining,
    updatedAt: Date.now(),
    updatedBy: AppState.currentUser?.name || 'غير معروف',
    roomId
  };

  // Save to historical guests (by phone)
  if (guestData.phone) {
    const histKey = 'guest_history_' + guestData.phone.replace(/\D/g, '');
    const histSnap = await get(ref(db, `guestHistory/${histKey}`)).catch(() => null);
    const hist = histSnap?.exists() ? histSnap.val() : { visits: [], name: guestData.name };
    if (!hist.visits) hist.visits = [];

    // Add this stay if not already there
    const stayExists = hist.visits.find(v => v.checkinDate === guestData.checkinDate && v.roomId === roomId);
    if (!stayExists) {
      hist.visits.push({
        checkinDate: guestData.checkinDate,
        checkoutDate: guestData.checkoutDate,
        roomNumber: AppState.rooms[roomId]?.number,
        roomId,
        total: guestData.total,
        paid: guestData.paid
      });
      hist.name = guestData.name;
      hist.phone = guestData.phone;
      hist.totalVisits = hist.visits.length;
      await dbSet(`guestHistory/${histKey}`, hist);
    }
  }

  // Room status & key - تتحول الغرفة تلقائياً إلى مشغولة عند إدخال بيانات مقيم
  let newStatus = document.getElementById('modal-status').value;
  const keyWithReception = document.getElementById('modal-key-reception').checked;

  // إذا كان هناك اسم مقيم، تتحول الغرفة فوراً إلى مشغولة
  if (guestData.name) {
    newStatus = 'occupied';
    if (document.getElementById('modal-status')) {
      document.getElementById('modal-status').value = 'occupied';
    }
  }

  await dbSet(`guests/${roomId}`, guestData);
  await dbUpdate(`rooms/${roomId}`, { status: newStatus, keyWithReception });

  logActivity('guest_update',
    `تحديث بيانات الغرفة ${AppState.rooms[roomId]?.number}: ${guestData.name || 'لا اسم'}`,
    '✏️');

  showToast('تم حفظ البيانات بنجاح ✅', 'success');
  closeModal('guest-modal');
};

// ============================================================
// CHECKOUT
// ============================================================
window.checkoutGuest = async function() {
  const roomId = document.getElementById('modal-room-id').value;
  if (!roomId) return;
  if (!confirm('هل تريد تسجيل خروج النزيل؟')) return;

  const room = AppState.rooms[roomId];
  const guest = AppState.guests[roomId];

  // Save checkout to history (permanent record)
  if (guest?.phone) {
    const histKey = 'guest_history_' + guest.phone.replace(/\D/g, '');
    const histSnap = await get(ref(db, `guestHistory/${histKey}`)).catch(() => null);
    if (histSnap?.exists()) {
      const hist = histSnap.val();
      if (hist.visits) {
        const visit = hist.visits.find(v => v.checkinDate === guest.checkinDate && v.roomId === roomId);
        if (visit) {
          visit.checkedOut = true;
          visit.actualCheckout = new Date().toISOString().split('T')[0];
        }
      }
      await dbSet(`guestHistory/${histKey}`, hist);
    }
  }

  // Archive guest permanently to checkoutHistory (لا يُحذف أبداً)
  if (guest) {
    await dbPush('checkoutHistory', {
      ...guest,
      checkoutActual: Date.now(),
      checkoutActualDate: new Date().toISOString().split('T')[0],
      roomNumber: room?.number,
      roomId
    });
  }

  // حذف بيانات المقيم الحالية من الغرفة فقط وتغيير الحالة إلى شاغرة
  // البيانات محفوظة في checkoutHistory ولا تُحذف أبداً
  await dbRemove(`guests/${roomId}`);
  await dbUpdate(`rooms/${roomId}`, { status: 'available', keyWithReception: true });

  logActivity('checkout', `خروج من الغرفة ${room?.number}: ${guest?.name}`, '🚪');
  showToast(`✅ تم تسجيل خروج ${guest?.name || ''} — الغرفة متاحة الآن`, 'success');
  closeModal('guest-modal');
};

// ============================================================
// ROOM STATUS UPDATE FROM MODAL
// ============================================================
window.updateRoomStatusFromModal = async function() {
  const roomId = document.getElementById('modal-room-id').value;
  if (!roomId) return;
  const status = document.getElementById('modal-status').value;
  // Will be saved on full save
};

// ============================================================
// ADD / EDIT ROOM
// ============================================================
window.showAddRoomModal = function() {
  AppState.currentEditRoom = null;
  document.getElementById('room-modal-title').textContent = 'إضافة غرفة جديدة';
  document.getElementById('edit-room-id').value = '';
  document.getElementById('room-number').value = '';
  document.getElementById('room-type').value = 'regular';
  document.getElementById('room-floor').value = '1';
  document.getElementById('room-init-status').value = 'available';
  openModal('room-modal');
};

window.showEditRoomModal = function(roomId) {
  const room = AppState.rooms[roomId];
  if (!room) return;
  AppState.currentEditRoom = roomId;
  document.getElementById('room-modal-title').textContent = 'تعديل الغرفة';
  document.getElementById('edit-room-id').value = roomId;
  document.getElementById('room-number').value = room.number;
  document.getElementById('room-type').value = room.type || 'regular';
  document.getElementById('room-floor').value = room.floor || '1';
  document.getElementById('room-init-status').value = room.status || 'available';
  openModal('room-modal');
};

window.saveRoom = async function() {
  const number = document.getElementById('room-number').value.trim();
  const type = document.getElementById('room-type').value;
  const floor = parseInt(document.getElementById('room-floor').value);
  const status = document.getElementById('room-init-status').value;

  if (!number) { showToast('يرجى إدخال رقم الغرفة', 'error'); return; }

  const editId = document.getElementById('edit-room-id').value;

  const roomData = { number, type, floor, status, createdAt: Date.now() };

  if (editId) {
    await dbUpdate(`rooms/${editId}`, { number, type, floor });
    logActivity('room_edit', `تعديل الغرفة ${number}`, '✏️');
    showToast('تم تحديث الغرفة ✅', 'success');
  } else {
    // Check duplicate
    const existing = Object.values(AppState.rooms).find(r => r.number === number);
    if (existing) { showToast('رقم الغرفة موجود مسبقاً', 'error'); return; }

    const key = await dbPush('rooms', roomData);
    logActivity('room_add', `إضافة غرفة ${number} (${type === 'vip' ? 'VIP' : 'عادية'})`, '🏨');
    showToast('تمت إضافة الغرفة ✅', 'success');
  }

  closeModal('room-modal');
};

window.deleteRoom = async function(roomId) {
  // الغرف لا تُحذف أبداً من النظام - تبقى دائماً في الرئيسية
  const room = AppState.rooms[roomId];
  if (!room) return;
  showToast('⚠️ الغرف لا تُحذف من النظام - تبقى دائماً في السجلات', 'info');
};

// ============================================================
// RESERVATIONS
// ============================================================
window.showReservationModal = function() {
  populateRoomDropdown();
  openModal('reservation-modal');
};

function populateRoomDropdown() {
  const sel = document.getElementById('res-room');
  if (!sel) return;
  const availableRooms = Object.entries(AppState.rooms)
    .filter(([,r]) => r.status === 'available')
    .sort(([,a],[,b]) => String(a.number).localeCompare(String(b.number), 'ar', {numeric:true}));

  sel.innerHTML = '<option value="">-- اختر الغرفة --</option>' +
    availableRooms.map(([id, r]) =>
      `<option value="${id}">${r.number} ${r.type === 'vip' ? '👑 VIP' : ''} - الدور ${r.floor}</option>`
    ).join('');
}

window.saveReservation = async function() {
  const name = document.getElementById('res-name').value.trim();
  const phone = document.getElementById('res-phone').value.trim();
  const roomId = document.getElementById('res-room').value;
  const date = document.getElementById('res-date').value;
  const time = document.getElementById('res-time').value;
  const notes = document.getElementById('res-notes').value.trim();

  if (!name) { showToast('يرجى إدخال اسم النزيل', 'error'); return; }

  const resData = {
    name, phone, roomId, date, time, notes,
    status: 'pending',
    createdAt: Date.now(),
    createdBy: AppState.currentUser?.name
  };

  const key = await dbPush('reservations', resData);

  if (roomId) {
    await dbUpdate(`rooms/${roomId}`, { status: 'reserved' });
  }

  logActivity('reservation', `حجز جديد: ${name} - الغرفة ${AppState.rooms[roomId]?.number || '-'}`, '📅');
  showToast('تم الحجز بنجاح ✅', 'success');
  closeModal('reservation-modal');
};

function renderReservations() {
  const container = document.getElementById('reservations-list');
  if (!container) return;

  const res = Object.entries(AppState.reservations || {});
  if (!res.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📅</div><p>لا توجد حجوزات</p></div>`;
    return;
  }

  res.sort(([,a],[,b]) => (b.createdAt||0) - (a.createdAt||0));

  container.innerHTML = res.map(([id, r]) => {
    const room = r.roomId ? AppState.rooms[r.roomId] : null;
    return `
    <div class="reservation-card">
      <div class="reservation-header">
        <div>
          <div class="res-name">${r.name}</div>
          <div class="res-room">${room ? `الغرفة ${room.number}` : 'بدون غرفة'}</div>
        </div>
        <span class="badge badge-reserved">محجوز</span>
      </div>
      ${r.phone ? `<div class="res-info">📞 ${r.phone}</div>` : ''}
      ${r.date ? `<div class="res-info">📅 ${r.date} ${r.time || ''}</div>` : ''}
      ${r.notes ? `<div class="res-info">📝 ${r.notes}</div>` : ''}
      <div class="reservation-actions">
        <button class="btn-primary btn-sm" onclick="convertReservationToCheckin('${id}')">✅ تسجيل وصول</button>
        <button class="btn-danger btn-sm" onclick="cancelReservation('${id}')">❌ إلغاء</button>
      </div>
    </div>`;
  }).join('');
}

window.convertReservationToCheckin = function(resId) {
  const res = AppState.reservations[resId];
  if (!res) return;
  if (res.roomId) {
    openRoomModal(res.roomId);
    // Pre-fill name and phone
    setTimeout(() => {
      document.getElementById('g-name').value = res.name;
      document.getElementById('g-phone').value = res.phone || '';
      document.getElementById('g-checkin-date').value = res.date || new Date().toISOString().split('T')[0];
      document.getElementById('modal-status').value = 'occupied';
    }, 300);
  }
};

window.cancelReservation = async function(resId) {
  const res = AppState.reservations[resId];
  if (!confirm('إلغاء الحجز؟')) return;
  if (res?.roomId) {
    await dbUpdate(`rooms/${res.roomId}`, { status: 'available' });
  }
  await dbRemove(`reservations/${resId}`);
  logActivity('reservation_cancel', `إلغاء حجز: ${res?.name}`, '❌');
  showToast('تم إلغاء الحجز', 'info');
};

// ============================================================
// SEARCH
// ============================================================
window.doSearch = function(query) {
  query = (query || '').trim().toLowerCase();
  const container = document.getElementById('search-results');
  if (!container) return;
  if (!query) { container.innerHTML = ''; return; }

  const results = [];

  // Search rooms
  Object.entries(AppState.rooms).forEach(([id, room]) => {
    const guest = AppState.guests[id];
    const match =
      String(room.number).toLowerCase().includes(query) ||
      (guest?.name && guest.name.toLowerCase().includes(query)) ||
      (guest?.phone && guest.phone.includes(query));

    if (match) results.push({ type: 'room', id, room, guest });
  });

  if (!results.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><p>لا توجد نتائج للبحث عن: "${query}"</p></div>`;
    return;
  }

  container.innerHTML = results.map(r => {
    const room = r.room;
    const guest = r.guest;
    return `
    <div class="search-result-card">
      <div class="search-result-header">
        <div>
          <strong>الغرفة ${room.number}</strong> ${room.type === 'vip' ? '👑' : ''}
          <span class="badge badge-${room.status || 'available'}" style="margin-right:8px">
            ${getStatusLabel(room.status)}
          </span>
        </div>
        <button class="btn-primary btn-sm" onclick="openRoomModal('${r.id}')">فتح الغرفة</button>
      </div>
      ${guest ? `
        <div class="guest-info-preview">
          <div class="res-info">👤 ${guest.name || '-'}</div>
          <div class="res-info">📞 ${guest.phone || '-'}</div>
          <div class="res-info">📅 ${guest.checkinDate || '-'} → ${guest.checkoutDate || '-'}</div>
          <div class="res-info">💰 إجمالي: ${(guest.total||0).toLocaleString('ar-EG')} ج | مدفوع: ${(guest.paid||0).toLocaleString('ar-EG')} ج | متبقي: ${(guest.remaining||0).toLocaleString('ar-EG')} ج</div>
        </div>
      ` : '<div class="res-info" style="color:var(--available)">✅ الغرفة شاغرة</div>'}
      ${guest?.phone ? `<button class="btn-secondary btn-sm" style="margin-top:8px" onclick="loadGuestHistory('${guest.phone}')">📋 سجل النزيل</button>` : ''}
    </div>`;
  }).join('');
};

window.loadGuestHistory = async function(phone) {
  const histKey = 'guest_history_' + phone.replace(/\D/g, '');
  const snap = await get(ref(db, `guestHistory/${histKey}`)).catch(() => null);

  if (!snap?.exists()) { showToast('لا يوجد سجل لهذا النزيل', 'info'); return; }

  const hist = snap.val();
  const container = document.getElementById('search-results');

  const visitsHtml = (hist.visits || []).reverse().map(v => `
    <div class="history-item">
      <span>الغرفة ${v.roomNumber || '-'}</span>
      <span>${v.checkinDate || '-'} → ${v.checkoutDate || '-'}</span>
      <span class="transaction-amount">${(v.paid||0).toLocaleString()} ج</span>
    </div>
  `).join('');

  const histCard = document.createElement('div');
  histCard.className = 'search-result-card';
  histCard.innerHTML = `
    <div class="search-result-header">
      <h4>📋 سجل النزيل: ${hist.name}</h4>
      <span class="badge badge-vip">${hist.totalVisits || 0} زيارة</span>
    </div>
    <div class="guest-history">${visitsHtml || '<p style="color:var(--text-muted)">لا توجد زيارات مسجلة</p>'}</div>
    <button class="btn-primary btn-sm" style="margin-top:12px" onclick="reuseGuestInfo('${phone}')">🔄 حجز جديد باستخدام بياناته</button>
  `;
  container.insertAdjacentElement('afterbegin', histCard);
};

window.reuseGuestInfo = async function(phone) {
  const histKey = 'guest_history_' + phone.replace(/\D/g, '');
  const snap = await get(ref(db, `guestHistory/${histKey}`)).catch(() => null);
  if (!snap?.exists()) return;

  const hist = snap.val();
  showReservationModal();
  setTimeout(() => {
    document.getElementById('res-name').value = hist.name || '';
    document.getElementById('res-phone').value = phone;
  }, 300);
};

// ============================================================
// FINANCIAL
// ============================================================
// ============================================================
// FINANCIAL PERIOD STATE
// ============================================================
AppState.finPeriod = 'day'; // default: today

window.setFinPeriod = function(period, btn) {
  AppState.finPeriod = period;

  // Update active button
  document.querySelectorAll('.fin-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  else {
    // For custom, mark none active
    document.querySelectorAll('.fin-period-btn').forEach(b => {
      if (b.dataset.period === 'custom') b.classList.add('active');
    });
  }

  updateFinancials();
};

window.toggleFinCustomRange = function() {
  const el = document.getElementById('fin-custom-range');
  if (!el) return;
  const show = el.style.display === 'none' || !el.style.display;
  el.style.display = show ? 'flex' : 'none';
  if (show) {
    // Set defaults if empty
    const today = new Date().toISOString().split('T')[0];
    const finFrom = document.getElementById('fin-from');
    const finTo = document.getElementById('fin-to');
    if (finFrom && !finFrom.value) finFrom.value = today;
    if (finTo && !finTo.value) finTo.value = today;
    AppState.finPeriod = 'custom';
    document.querySelectorAll('.fin-period-btn').forEach(b => b.classList.remove('active'));
    updateFinancials();
  }
};

function getFinDateRange() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];

  switch (AppState.finPeriod) {
    case 'day':
      return { from: todayStr, to: todayStr };
    case 'week': {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { from: start.toISOString().split('T')[0], to: todayStr };
    }
    case 'month': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: start.toISOString().split('T')[0], to: todayStr };
    }
    case 'year': {
      const start = new Date(today.getFullYear(), 0, 1);
      return { from: start.toISOString().split('T')[0], to: todayStr };
    }
    case 'custom': {
      const from = document.getElementById('fin-from')?.value || todayStr;
      const to = document.getElementById('fin-to')?.value || todayStr;
      return { from, to };
    }
    case 'all':
    default:
      return { from: '2000-01-01', to: '2099-12-31' };
  }
}

window.updateFinancials = function() {
  const currentGuests = Object.values(AppState.guests || {});
  const history = Object.values(AppState.checkoutHistory || {});

  // All records combined — current + archived (never deleted)
  const allGuests = [...currentGuests, ...history];

  const today = new Date().toISOString().split('T')[0];
  const thisWeekStart = (() => { const d = new Date(); d.setDate(d.getDate()-6); return d.toISOString().split('T')[0]; })();
  const thisMonth = today.substring(0, 7);
  const thisYear = today.substring(0, 4);

  // Always-visible summary cards (never affected by filter)
  let sumDaily = 0, sumWeekly = 0, sumMonthly = 0, sumYearly = 0;
  allGuests.forEach(g => {
    const d = g.checkinDate || '';
    const paid = parseFloat(g.paid) || 0;
    if (d === today) sumDaily += paid;
    if (d >= thisWeekStart && d <= today) sumWeekly += paid;
    if (d.startsWith(thisMonth)) sumMonthly += paid;
    if (d.startsWith(thisYear)) sumYearly += paid;
  });
  setText('fin-daily',   sumDaily.toLocaleString('ar-EG') + ' ج');
  setText('fin-weekly',  sumWeekly.toLocaleString('ar-EG') + ' ج');
  setText('fin-monthly', sumMonthly.toLocaleString('ar-EG') + ' ج');
  setText('fin-yearly',  sumYearly.toLocaleString('ar-EG') + ' ج');
  setText('stat-revenue', sumDaily.toLocaleString('ar-EG'));

  // Filtered stats (based on selected period)
  const { from, to } = getFinDateRange();
  const filtered = allGuests.filter(g => {
    const d = g.checkinDate || '';
    return d >= from && d <= to;
  });

  let totalPaid = 0, totalRevenue = 0, totalRemaining = 0;
  filtered.forEach(g => {
    const paid = parseFloat(g.paid) || 0;
    const remaining = parseFloat(g.remaining) || 0;
    const total = parseFloat(g.total) || 0;
    totalPaid += paid;
    totalRevenue += total;
    // مبالغ متبقية فقط للنزلاء الحاليين المشمولين في الفلتر
    if (currentGuests.find(cg => cg.roomId === g.roomId && cg.checkinDate === g.checkinDate)) {
      totalRemaining += remaining;
    }
  });

  setText('fin-total-paid',    totalPaid.toLocaleString('ar-EG') + ' ج');
  setText('fin-remaining',     totalRemaining.toLocaleString('ar-EG') + ' ج');
  setText('fin-count',         filtered.length.toString());
  setText('fin-total-revenue', totalRevenue.toLocaleString('ar-EG') + ' ج');

  renderTransactionsList(filtered, from, to);
  renderRevenueChart(allGuests, from, to);
};

function renderTransactionsList(guests, from, to) {
  const container = document.getElementById('financial-transactions');
  if (!container) return;

  const sorted = [...guests].filter(g => parseFloat(g.paid) > 0)
    .sort((a, b) => (b.updatedAt || b.checkoutActual || 0) - (a.updatedAt || a.checkoutActual || 0));

  const periodLabels = {
    day: 'اليوم', week: 'الأسبوع', month: 'الشهر', year: 'السنة', all: 'الكل', custom: 'المخصص'
  };
  const label = periodLabels[AppState.finPeriod] || '';

  if (!sorted.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><p>لا توجد معاملات مالية في هذه الفترة</p></div>`;
    return;
  }

  const roomMap = AppState.rooms || {};
  container.innerHTML = `
    <div style="font-size:13px;color:var(--text-muted);margin-bottom:10px;padding:0 4px;">
      📋 سجل المعاملات — <strong style="color:var(--neon-cyan)">${label}</strong> (${sorted.length} سجل)
    </div>
    ${sorted.map(g => {
      const roomNum = roomMap[g.roomId]?.number || g.roomNumber || '-';
      const isArchived = !!g.checkoutActual;
      return `
      <div class="transaction-item">
        <div>
          <strong>${g.name || 'نزيل'}</strong>
          <span style="font-size:11px;color:var(--text-muted);margin-right:6px">الغرفة ${roomNum}</span>
          ${isArchived ? '<span style="font-size:10px;background:rgba(255,255,255,0.08);padding:1px 6px;border-radius:6px;color:#a0b0d0">✔ مغادر</span>' : '<span style="font-size:10px;background:rgba(68,255,136,0.12);padding:1px 6px;border-radius:6px;color:#2ecc71">● حالي</span>'}
        </div>
        <div class="transaction-date">${g.checkinDate || '-'} ← ${g.checkoutDate || '-'}</div>
        <div style="text-align:left">
          <div class="transaction-amount">${(g.paid||0).toLocaleString('ar-EG')} ج</div>
          ${(g.remaining||0) > 0 ? `<div style="font-size:11px;color:#ff6b6b">متبقي: ${(g.remaining||0).toLocaleString('ar-EG')} ج</div>` : ''}
        </div>
      </div>`;
    }).join('')}
  `;
}

function renderRevenueChart(guests, from, to) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;

  // Build day-by-day data for the chart based on period
  const days = [];
  const amounts = [];

  // Determine how many days to show
  const fromDate = new Date(from || '2000-01-01');
  const toDate = new Date(to || new Date().toISOString().split('T')[0]);
  const diffDays = Math.round((toDate - fromDate) / (1000*60*60*24)) + 1;

  // For large ranges, group by month or week
  let groupBy = 'day';
  let numBuckets = Math.min(diffDays, 30);
  if (diffDays > 90) { groupBy = 'month'; numBuckets = Math.min(12, diffDays/30); }
  else if (diffDays > 30) { groupBy = 'week'; numBuckets = Math.min(8, Math.ceil(diffDays/7)); }

  if (groupBy === 'day') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(toDate);
      d.setDate(toDate.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push(d.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }));
      const dayTotal = guests
        .filter(g => g.checkinDate === dateStr)
        .reduce((sum, g) => sum + (parseFloat(g.paid) || 0), 0);
      amounts.push(dayTotal);
    }
  } else if (groupBy === 'week') {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const weekEnd = new Date(toDate);
      weekEnd.setDate(toDate.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      const ws = weekStart.toISOString().split('T')[0];
      const we = weekEnd.toISOString().split('T')[0];
      days.push(weekStart.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' }));
      const weekTotal = guests
        .filter(g => (g.checkinDate||'') >= ws && (g.checkinDate||'') <= we)
        .reduce((sum, g) => sum + (parseFloat(g.paid) || 0), 0);
      amounts.push(weekTotal);
    }
  } else {
    for (let i = numBuckets - 1; i >= 0; i--) {
      const d = new Date(toDate.getFullYear(), toDate.getMonth() - i, 1);
      const monthStr = d.toISOString().split('T')[0].substring(0, 7);
      days.push(d.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' }));
      const mTotal = guests
        .filter(g => (g.checkinDate||'').startsWith(monthStr))
        .reduce((sum, g) => sum + (parseFloat(g.paid) || 0), 0);
      amounts.push(mTotal);
    }
  }

  const max = Math.max(...amounts, 1);
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight || 260;
  canvas.width = W;
  canvas.height = H;

  const isDark = document.body.classList.contains('dark-mode');
  const textColor = isDark ? 'rgba(232,234,246,0.7)' : 'rgba(26,31,58,0.7)';
  const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

  ctx.clearRect(0, 0, W, H);

  const pad = { top: 20, right: 20, bottom: 50, left: 60 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;
  const barW = chartW / days.length * 0.6;
  const gap = chartW / days.length;

  // Grid lines
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (chartH / 4) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
    ctx.fillStyle = textColor;
    ctx.font = '11px Cairo';
    ctx.textAlign = 'right';
    const val = Math.round(max - (max / 4) * i);
    ctx.fillText(val.toLocaleString('ar-EG'), pad.left - 8, y + 4);
  }

  // Bars
  amounts.forEach((val, i) => {
    const x = pad.left + gap * i + (gap - barW) / 2;
    const barH = (val / max) * chartH;
    const y = pad.top + chartH - barH;

    // Gradient fill
    const grad = ctx.createLinearGradient(x, y, x, y + barH);
    grad.addColorStop(0, 'rgba(68,136,255,0.9)');
    grad.addColorStop(1, 'rgba(168,85,247,0.5)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(x, y, barW, barH, [4, 4, 0, 0]);
    ctx.fill();

    // Amount label
    if (val > 0) {
      ctx.fillStyle = 'rgba(68,136,255,1)';
      ctx.font = 'bold 10px Cairo';
      ctx.textAlign = 'center';
      ctx.fillText(val.toLocaleString('ar-EG'), x + barW / 2, y - 4);
    }

    // Day label
    ctx.fillStyle = textColor;
    ctx.font = '10px Cairo';
    ctx.textAlign = 'center';
    ctx.fillText(days[i], x + barW / 2, H - 10);
  });
}

window.exportFinancialReport = function() {
  const guests = Object.values(AppState.guests || {});
  let html = `
    <html dir="rtl"><head><meta charset="UTF-8">
    <style>body{font-family:Cairo,sans-serif;padding:20px}table{width:100%;border-collapse:collapse}
    th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#1a1a2e;color:#fff}
    h1{color:#1a1a2e}</style></head><body>
    <h1>تقرير مالي - دار الضيافة بالمنصورة</h1>
    <p>تاريخ التقرير: ${new Date().toLocaleDateString('ar-EG')}</p>
    <table><tr><th>الاسم</th><th>الغرفة</th><th>الوصول</th><th>المغادرة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr>
    ${guests.map(g => `<tr>
      <td>${g.name||'-'}</td>
      <td>${AppState.rooms[g.roomId]?.number||'-'}</td>
      <td>${g.checkinDate||'-'}</td><td>${g.checkoutDate||'-'}</td>
      <td>${(g.total||0).toLocaleString('ar-EG')} ج</td>
      <td>${(g.paid||0).toLocaleString('ar-EG')} ج</td>
      <td>${(g.remaining||0).toLocaleString('ar-EG')} ج</td>
    </tr>`).join('')}
    </table></body></html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `financial-report-${Date.now()}.html`;
  a.click();
  showToast('تم تصدير التقرير ✅', 'success');
};

// ============================================================
// EMPLOYEES
// ============================================================
window.showAddEmployeeModal = function() {
  if (AppState.currentUser?.role !== 'superadmin') {
    showToast('ليس لديك صلاحية لإدارة الموظفين', 'error');
    return;
  }
  document.getElementById('emp-modal-title').textContent = 'إضافة موظف جديد';
  document.getElementById('edit-emp-id').value = '';
  ['emp-name','emp-username','emp-password'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('emp-role').value = 'receptionist';

  // Default permissions for new employee
  setPermToggle('perm-dashboard', true);
  setPermToggle('perm-rooms', true);
  setPermToggle('perm-reservations', true);
  setPermToggle('perm-search', true);
  setPermToggle('perm-financial', false);
  setPermToggle('perm-employees', false);
  setPermToggle('perm-activity', true);

  openModal('employee-modal');
  setTimeout(updatePermPreview, 50);
};

function setPermToggle(id, val) {
  const el = document.getElementById(id);
  if (el && !el.disabled) el.checked = val;
}

window.saveEmployee = async function() {
  const name = document.getElementById('emp-name').value.trim();
  const username = document.getElementById('emp-username').value.trim();
  const password = document.getElementById('emp-password').value;
  const role = document.getElementById('emp-role').value;
  const editId = document.getElementById('edit-emp-id').value;

  if (!name || !username || !password) {
    showToast('يرجى ملء جميع الحقول المطلوبة', 'error'); return;
  }

  const permissions = {
    dashboard:    document.getElementById('perm-dashboard')?.checked    ?? true,
    rooms:        document.getElementById('perm-rooms')?.checked        ?? true,
    reservations: document.getElementById('perm-reservations')?.checked ?? true,
    search:       document.getElementById('perm-search')?.checked       ?? true,
    financial:    document.getElementById('perm-financial')?.checked    ?? false,
    employees:    document.getElementById('perm-employees')?.checked    ?? false,
    activity:     document.getElementById('perm-activity')?.checked     ?? true,
    guests:       document.getElementById('perm-rooms')?.checked        ?? true, // tied to rooms
  };

  const empData = { name, username, password, role, permissions, updatedAt: Date.now() };
  if (!editId) empData.createdAt = Date.now();

  if (editId) {
    await dbUpdate(`employees/${editId}`, empData);
    // If this is the currently logged-in user, update session AND permissions
    if (AppState.currentUser?.id === editId) {
      AppState.currentUser = { ...AppState.currentUser, ...empData };
      localStorage.setItem('hotelSession', JSON.stringify(AppState.currentUser));
      enforcePermissions(AppState.currentUser); // re-apply nav visibility immediately
    }
    logActivity('employee_edit', `تعديل موظف: ${name}`, '👤');
    showToast('تم تحديث بيانات الموظف ✅', 'success');
  } else {
    await dbPush('employees', empData);
    logActivity('employee_add', `إضافة موظف جديد: ${name}`, '👥');
    showToast('تمت إضافة الموظف ✅', 'success');
  }

  closeModal('employee-modal');
};

function renderEmployees() {
  const container = document.getElementById('employees-list');
  if (!container) return;

  const roleLabels = { receptionist: 'موظف استقبال', manager: 'مدير قسم', admin: 'مدير النظام', superadmin: 'مدير عام' };

  const allPermLabels = [
    { key: 'dashboard',    icon: '🏠', label: 'لوحة التحكم' },
    { key: 'rooms',        icon: '🚪', label: 'الغرف' },
    { key: 'reservations', icon: '📅', label: 'الحجوزات' },
    { key: 'search',       icon: '🔍', label: 'البحث' },
    { key: 'financial',    icon: '💰', label: 'المالية' },
    { key: 'employees',    icon: '👥', label: 'الموظفون' },
    { key: 'activity',     icon: '📋', label: 'النشاط' },
  ];

  const masterPerms = allPermLabels.map(p =>
    `<span class="perm-tag active">${p.icon} ${p.label}</span>`
  ).join('');

  const masterCard = `
    <div class="employee-card">
      <div class="emp-avatar">👑</div>
      <div class="emp-name">${MASTER_ADMIN.name}</div>
      <div class="emp-username">@${MASTER_ADMIN.username}</div>
      <div class="emp-role"><span class="badge badge-vip">مدير عام</span></div>
      <div class="emp-perms">${masterPerms}</div>
    </div>`;

  const emps = Object.entries(AppState.employees || {});
  if (!emps.length) {
    container.innerHTML = masterCard + `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px">لا يوجد موظفون مضافون</div>`;
    return;
  }

  container.innerHTML = masterCard + emps.map(([id, emp]) => {
    const perms = emp.permissions || {};
    const permTags = allPermLabels.map(p => {
      const hasPerm = p.key === 'dashboard' ? true : !!perms[p.key];
      return `<span class="perm-tag ${hasPerm ? 'active' : 'inactive'}">${p.icon} ${p.label}</span>`;
    }).join('');

    return `
    <div class="employee-card">
      <div class="emp-avatar">👤</div>
      <div class="emp-name">${emp.name}</div>
      <div class="emp-username">@${emp.username}</div>
      <div class="emp-role"><span class="badge badge-${emp.role === 'admin' ? 'vip' : 'reserved'}">${roleLabels[emp.role] || emp.role}</span></div>
      <div class="emp-password-row">
        <span class="emp-pass-label">🔒 كلمة المرور:</span>
        <span class="emp-pass-dots" id="pass-dots-${id}">••••••••</span>
        <span class="emp-pass-text hidden" id="pass-text-${id}">${emp.password || ''}</span>
        <button class="btn-show-pass" onclick="toggleEmpPassView('${id}')" title="إظهار/إخفاء كلمة المرور">👁️</button>
      </div>
      <div class="emp-perms">${permTags}</div>
      <div class="emp-actions">
        <button class="btn-secondary btn-sm" onclick="showEditEmployeeModal('${id}')">✏️ تعديل</button>
        <button class="btn-danger btn-sm" onclick="deleteEmployee('${id}')">🗑️ حذف</button>
      </div>
    </div>`;
  }).join('');
}

window.showEditEmployeeModal = function(empId) {
  if (AppState.currentUser?.role !== 'superadmin') {
    showToast('ليس لديك صلاحية لتعديل الموظفين', 'error');
    return;
  }
  const emp = AppState.employees[empId];
  if (!emp) return;

  document.getElementById('emp-modal-title').textContent = 'تعديل بيانات الموظف';
  document.getElementById('edit-emp-id').value = empId;
  document.getElementById('emp-name').value = emp.name || '';
  document.getElementById('emp-username').value = emp.username || '';
  document.getElementById('emp-password').value = emp.password || '';
  document.getElementById('emp-role').value = emp.role || 'receptionist';

  const p = emp.permissions || {};
  setPermToggle('perm-dashboard',    p.dashboard    !== false);
  setPermToggle('perm-rooms',        p.rooms        !== false);
  setPermToggle('perm-reservations', p.reservations !== false);
  setPermToggle('perm-search',       p.search       !== false);
  setPermToggle('perm-financial',    !!p.financial);
  setPermToggle('perm-employees',    !!p.employees);
  setPermToggle('perm-activity',     p.activity     !== false);

  openModal('employee-modal');
  setTimeout(updatePermPreview, 50);
};

window.deleteEmployee = async function(empId) {
  const emp = AppState.employees[empId];
  if (!confirm(`حذف الموظف ${emp?.name}؟`)) return;
  await dbRemove(`employees/${empId}`);
  logActivity('employee_delete', `حذف موظف: ${emp?.name}`, '🗑️');
  showToast('تم حذف الموظف', 'info');
};

// ============================================================
// ACTIVITY LOG
// ============================================================
async function logActivity(action, details, icon = '📋') {
  const logData = {
    action,
    details,
    icon,
    employee: AppState.currentUser?.name || 'نظام',
    timestamp: Date.now(),
    date: new Date().toLocaleDateString('ar-EG'),
    time: new Date().toLocaleTimeString('ar-EG'),
    device: navigator.userAgent.includes('Mobile') ? 'موبايل' : 'كمبيوتر'
  };

  await dbPush('activityLogs', logData);
}

function renderActivityLog() {
  const container = document.getElementById('activity-log');
  if (!container) return;

  if (!AppState.activityLogs.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>لا توجد أنشطة مسجلة</p></div>`;
    return;
  }

  container.innerHTML = AppState.activityLogs.map(log => `
    <div class="log-item">
      <div class="log-icon">${log.icon || '📋'}</div>
      <div class="log-content">
        <div class="log-action">${log.details}</div>
        <div class="log-details">بواسطة: ${log.employee} | ${log.device}</div>
      </div>
      <div class="log-meta">${log.date}<br>${log.time}</div>
    </div>
  `).join('');
}

window.clearOldLogs = async function() {
  if (!confirm('حذف السجلات القديمة (أكثر من 30 يوم)؟')) return;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const snap = await get(ref(db, 'activityLogs')).catch(() => null);
  if (!snap?.exists()) return;

  const logs = snap.val();
  const toDelete = Object.entries(logs)
    .filter(([, v]) => v.timestamp < cutoff)
    .map(([id]) => id);

  for (const id of toDelete) {
    await dbRemove(`activityLogs/${id}`);
  }

  showToast(`تم حذف ${toDelete.length} سجل قديم`, 'info');
};

// ============================================================
// INVOICE
// ============================================================
window.generateInvoice = function() {
  const roomId = document.getElementById('modal-room-id').value;
  const room = AppState.rooms[roomId];
  const guest = AppState.guests[roomId];

  if (!room) return;

  const invoiceHtml = `
    <div class="invoice-paper">
      <div class="invoice-header">
        <div style="font-size:32px;margin-bottom:8px">🏨</div>
        <div class="invoice-title">دار الضيافة بالمنصورة</div>
        <div class="invoice-subtitle">Dar Al Diyafa Mansoura</div>
        <div style="font-size:12px;color:#666;margin-top:8px">فاتورة رقم: INV-${Date.now()}</div>
      </div>

      <div class="invoice-row">
        <span class="invoice-row-label">اسم النزيل</span>
        <span class="invoice-row-value">${guest?.name || '-'}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-row-label">رقم الهاتف</span>
        <span class="invoice-row-value">${guest?.phone || '-'}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-row-label">رقم الغرفة</span>
        <span class="invoice-row-value">${room.number} ${room.type === 'vip' ? '👑 VIP' : ''}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-row-label">الدور</span>
        <span class="invoice-row-value">الدور ${room.floor}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-row-label">تاريخ الوصول</span>
        <span class="invoice-row-value">${guest?.checkinDate || '-'} ${guest?.checkinTime || ''}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-row-label">تاريخ المغادرة</span>
        <span class="invoice-row-value">${guest?.checkoutDate || '-'} ${guest?.checkoutTime || '12:00'}</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-row-label">عدد الأيام</span>
        <span class="invoice-row-value">${guest?.days || 0} يوم</span>
      </div>
      <div class="invoice-row">
        <span class="invoice-row-label">السعر لليلة</span>
        <span class="invoice-row-value">${(guest?.pricePerNight||0).toLocaleString('ar-EG')} جنيه</span>
      </div>
      ${Array.isArray(guest?.companions) && guest.companions.length > 0 ? `
      <div style="margin:10px 0 4px;font-weight:700;font-size:13px;color:#555;border-bottom:1px dashed #ddd;padding-bottom:4px;">👥 المرافقون</div>
      ${guest.companions.map((c, i) => `
      <div class="invoice-row" style="font-size:13px;">
        <span class="invoice-row-label">${i+1}. ${c.name || '-'}</span>
        <span class="invoice-row-value" style="font-size:12px;color:#666;">${c.nationalId ? 'ر.ق: ' + c.nationalId : ''}</span>
      </div>`).join('')}` : ''}

      <div class="invoice-total">
        <div class="invoice-row">
          <span class="invoice-row-label">الإجمالي</span>
          <span class="invoice-row-value">${(guest?.total||0).toLocaleString('ar-EG')} جنيه</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-row-label">المدفوع</span>
          <span class="invoice-row-value" style="color:#00e676">${(guest?.paid||0).toLocaleString('ar-EG')} جنيه</span>
        </div>
        <div class="invoice-row">
          <span class="invoice-row-label">المتبقي</span>
          <span class="invoice-row-value" style="color:#ff6b8a">${(guest?.remaining||0).toLocaleString('ar-EG')} جنيه</span>
        </div>
      </div>

      <div class="invoice-footer">
        <p>شكراً لاختياركم دار الضيافة بالمنصورة</p>
        <p>تصميم وتطوير: المهندس / محمد حماد</p>
        <p>${new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    </div>`;

  document.getElementById('invoice-content').innerHTML = invoiceHtml;
  openModal('invoice-modal');
};

window.printInvoice = function() {
  window.print();
};

window.sendInvoiceWhatsApp = function() {
  const roomId = document.getElementById('modal-room-id').value;
  const room = AppState.rooms[roomId];
  const guest = AppState.guests[roomId];

  if (!guest?.phone && !guest?.whatsapp) {
    showToast('لا يوجد رقم واتساب للنزيل', 'error');
    return;
  }

  const phone = '20' + (guest.whatsapp || guest.phone).replace(/^0/, '');
  const companionsList = Array.isArray(guest?.companions) && guest.companions.length > 0
    ? '\n👥 المرافقون:\n' + guest.companions.map((c, i) => `   ${i+1}. ${c.name || '-'}${c.nationalId ? ' | رقم قومي: ' + c.nationalId : ''}`).join('\n')
    : '';
  const msg = encodeURIComponent(`
🏨 *دار الضيافة بالمنصورة*
━━━━━━━━━━━━━━━━

*فاتورة إقامة*

👤 الاسم: ${guest?.name || '-'}
🚪 الغرفة: ${room?.number} ${room?.type === 'vip' ? '(VIP)' : ''}
📅 الوصول: ${guest?.checkinDate || '-'}
📅 المغادرة: ${guest?.checkoutDate || '-'}
🌙 عدد الأيام: ${guest?.days || 0}
💵 السعر لليلة: ${(guest?.pricePerNight||0).toLocaleString()} ج${companionsList}

━━━━━━━━━━━━━━━━
💰 الإجمالي: *${(guest?.total||0).toLocaleString()} جنيه*
✅ المدفوع: *${(guest?.paid||0).toLocaleString()} جنيه*
🔴 المتبقي: *${(guest?.remaining||0).toLocaleString()} جنيه*
━━━━━━━━━━━━━━━━
شكراً لاختياركم دار الضيافة 🙏
  `);

  window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
};

// ============================================================
// PHONE FEATURES
// ============================================================
window.callGuest = function() {
  const phone = document.getElementById('g-phone').value.trim();
  if (!phone) { showToast('لا يوجد رقم هاتف', 'error'); return; }
  window.open(`tel:${phone}`);
};

window.openWhatsApp = function() {
  const phone = document.getElementById('g-phone').value.trim();
  if (!phone) { showToast('لا يوجد رقم هاتف', 'error'); return; }
  const fullPhone = '20' + phone.replace(/^0/, '');
  window.open(`https://wa.me/${fullPhone}`, '_blank');
};

window.openWhatsAppAlt = function() {
  const phone = document.getElementById('g-whatsapp').value.trim();
  if (!phone) { showToast('لا يوجد رقم واتساب', 'error'); return; }
  const fullPhone = '20' + phone.replace(/^0/, '');
  window.open(`https://wa.me/${fullPhone}`, '_blank');
};

// ============================================================
// CALCULATIONS
// ============================================================
window.calcDays = function() {
  const checkin = document.getElementById('g-checkin-date').value;
  const checkout = document.getElementById('g-checkout-date').value;
  if (!checkin || !checkout) return;

  const d1 = new Date(checkin);
  const d2 = new Date(checkout);
  const days = Math.max(0, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)));

  document.getElementById('g-days').value = days;
  calcTotal();
  updateRemainingDays();
};

// ============================================================
// COMPANIONS
// ============================================================
let companions = []; // [{ id, name, nationalId }]

function renderCompanions() {
  const list = document.getElementById('companions-list');
  if (!list) return;
  if (companions.length === 0) {
    list.innerHTML = '<div style="color:#aaa;font-size:13px;text-align:center;padding:8px 0;">لا يوجد مرافقون</div>';
    return;
  }
  list.innerHTML = companions.map((c, i) => `
    <div class="companion-row" style="display:flex;gap:8px;align-items:center;background:var(--bg-secondary,#f8f9fa);border-radius:10px;padding:8px 10px;">
      <input type="text" value="${escapeHtml(c.name)}" placeholder="اسم المرافق"
        style="flex:2;padding:7px 10px;border-radius:8px;border:1px solid #ddd;font-size:13px;"
        onchange="updateCompanion(${i}, 'name', this.value)" oninput="updateCompanion(${i}, 'name', this.value)">
      <input type="text" value="${escapeHtml(c.nationalId)}" placeholder="الرقم القومي"
        style="flex:2;padding:7px 10px;border-radius:8px;border:1px solid #ddd;font-size:13px;"
        onchange="updateCompanion(${i}, 'nationalId', this.value)" oninput="updateCompanion(${i}, 'nationalId', this.value)">
      <button type="button" onclick="removeCompanion(${i})"
        style="background:#ff4d4f;color:#fff;border:none;border-radius:8px;width:32px;height:32px;font-size:16px;cursor:pointer;flex-shrink:0;">✕</button>
    </div>
  `).join('');
}

function escapeHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

window.addCompanionRow = function() {
  companions.push({ id: Date.now(), name: '', nationalId: '' });
  renderCompanions();
  // Focus the last name input
  setTimeout(() => {
    const inputs = document.querySelectorAll('.companion-row input');
    if (inputs.length) inputs[inputs.length - 2].focus();
  }, 50);
};

window.removeCompanion = function(index) {
  companions.splice(index, 1);
  renderCompanions();
};

window.updateCompanion = function(index, field, value) {
  if (companions[index]) companions[index][field] = value;
};

window.calcTotal = function() {
  const days = parseInt(document.getElementById('g-days').value) || 0;
  const price = parseFloat(document.getElementById('g-price-per-night').value) || 0;
  const total = days * price;
  document.getElementById('g-total').value = total;

  // Auto-calculate checkout date when days are entered
  if (days > 0) {
    const checkinDateEl = document.getElementById('g-checkin-date');
    const checkinTimeEl = document.getElementById('g-checkin-time');
    const checkoutDateEl = document.getElementById('g-checkout-date');
    const checkoutTimeEl = document.getElementById('g-checkout-time');

    // Use checkin date if set, otherwise use today
    let baseDate = checkinDateEl?.value
      ? new Date(checkinDateEl.value + 'T00:00:00')
      : new Date();
    baseDate.setHours(0, 0, 0, 0);

    // If no checkin date, set it to today
    if (!checkinDateEl?.value) {
      const today = new Date();
      checkinDateEl.value = today.toISOString().split('T')[0];
      if (checkinTimeEl && !checkinTimeEl.value) {
        const hh = String(today.getHours()).padStart(2, '0');
        const mm = String(today.getMinutes()).padStart(2, '0');
        checkinTimeEl.value = `${hh}:${mm}`;
      }
    }

    const checkoutDate = new Date(baseDate);
    checkoutDate.setDate(checkoutDate.getDate() + days);
    checkoutDateEl.value = checkoutDate.toISOString().split('T')[0];

    // Set checkout time to 12:00 noon
    if (checkoutTimeEl) checkoutTimeEl.value = '12:00';

    updateRemainingDays();
  }

  calcRemaining();
};

window.calcRemaining = function() {
  const total = parseFloat(document.getElementById('g-total').value) || 0;
  const paid = parseFloat(document.getElementById('g-paid').value) || 0;
  document.getElementById('g-remaining').value = total - paid;
};

function updateRemainingDays() {
  const checkout = document.getElementById('g-checkout-date').value;
  if (checkout) {
    document.getElementById('g-remaining-days').value = calcRemainingDays(checkout);
  }
}

// ============================================================
// MODAL HELPERS
// ============================================================
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
};

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.add('hidden');
  }
});

// Enter key for login
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen')?.classList.contains('active')) {
    doLogin();
  }
});

// ============================================================
// TOAST
// ============================================================
window.showToast = function(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(AppState.toastTimer);
  AppState.toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
};

// ============================================================
// HELPERS
// ============================================================
function getStatusLabel(status) {
  const map = { available: 'شاغرة', occupied: 'مشغولة', reserved: 'محجوزة', cleaning: 'تنظيف', maintenance: 'صيانة' };
  return map[status] || 'شاغرة';
}

window.toggleEmpPassword = function() {
  const inp = document.getElementById('emp-password');
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
};

// Toggle password visibility on employee card
window.toggleEmpPassView = function(empId) {
  const dots = document.getElementById(`pass-dots-${empId}`);
  const text = document.getElementById(`pass-text-${empId}`);
  if (!dots || !text) return;
  const isHidden = text.classList.contains('hidden');
  dots.classList.toggle('hidden', isHidden);
  text.classList.toggle('hidden', !isHidden);
};

// Live preview of section visibility when editing permissions
window.updatePermPreview = function() {
  const permMap = {
    dashboard:    'perm-dashboard',
    rooms:        'perm-rooms',
    reservations: 'perm-reservations',
    search:       'perm-search',
    financial:    'perm-financial',
    employees:    'perm-employees',
    activity:     'perm-activity',
  };
  document.querySelectorAll('#perm-preview-items .perm-preview-item').forEach(el => {
    const permKey = el.dataset.perm;
    const checkbox = document.getElementById(permMap[permKey]);
    const active = checkbox ? checkbox.checked : false;
    el.classList.toggle('active', active);
    el.classList.toggle('inactive', !active);
  });
};

// Make functions globally accessible
window.renderRooms = renderRooms;
window.updateStats = updateStats;
window.logActivity = logActivity;

// ============================================================
// GUESTS LIST SECTION
// ============================================================

function getAllGuestsData() {
  const currentGuests = Object.values(AppState.guests || {});
  const history = Object.values(AppState.checkoutHistory || {});

  // Mark source
  const current = currentGuests.map(g => ({ ...g, _isCurrent: true }));
  const archived = history.map(g => ({ ...g, _isCurrent: false }));

  // Merge, deduplicate by (phone + checkinDate + roomId)
  const seen = new Set();
  const merged = [];
  for (const g of [...current, ...archived]) {
    const key = `${g.phone||''}|${g.checkinDate||''}|${g.roomId||''}`;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(g);
    }
  }
  return merged;
}

function getDayName(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', { weekday: 'long' });
  } catch { return '-'; }
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'numeric', day: 'numeric' });
  } catch { return dateStr; }
}

window.clearGuestsFilter = function() {
  const s = document.getElementById('guests-search');
  const f = document.getElementById('guests-from');
  const t = document.getElementById('guests-to');
  if (s) s.value = '';
  if (f) f.value = '';
  if (t) t.value = '';
  renderGuestsList();
};

window.renderGuestsList = function() {
  const tbody = document.getElementById('guests-table-body');
  const emptyEl = document.getElementById('guests-empty');
  const statsBar = document.getElementById('guests-stats-bar');
  if (!tbody) return;

  const query = (document.getElementById('guests-search')?.value || '').trim().toLowerCase();
  const fromVal = document.getElementById('guests-from')?.value || '';
  const toVal = document.getElementById('guests-to')?.value || '';

  let data = getAllGuestsData();

  // Date filter
  if (fromVal) data = data.filter(g => (g.checkinDate || '') >= fromVal);
  if (toVal)   data = data.filter(g => (g.checkinDate || '') <= toVal);

  // Smart search
  if (query) {
    data = data.filter(g => {
      const roomNum = AppState.rooms[g.roomId]?.number || g.roomNumber || '';
      return (
        (g.name || '').toLowerCase().includes(query) ||
        (g.profession || '').toLowerCase().includes(query) ||
        (g.nationalId || '').toLowerCase().includes(query) ||
        (g.phone || '').includes(query) ||
        String(roomNum).includes(query)
      );
    });
  }

  // Sort newest first
  data.sort((a, b) => {
    const da = a.checkinDate || '';
    const db = b.checkinDate || '';
    return db > da ? 1 : db < da ? -1 : 0;
  });

  // Stats
  const totalPaid = data.reduce((s, g) => s + (parseFloat(g.paid) || 0), 0);
  const currentCount = data.filter(g => g._isCurrent).length;
  const archivedCount = data.length - currentCount;

  if (statsBar) {
    statsBar.innerHTML = `
      <div class="guests-stat-chip">👥 إجمالي النزلاء: <strong>${data.length}</strong></div>
      <div class="guests-stat-chip">🟢 حاليون: <strong>${currentCount}</strong></div>
      <div class="guests-stat-chip">✔ مغادرون: <strong>${archivedCount}</strong></div>
      <div class="guests-stat-chip">💰 إجمالي المدفوع: <strong>${totalPaid.toLocaleString('ar-EG')} ج</strong></div>
    `;
  }

  if (!data.length) {
    tbody.innerHTML = '';
    if (emptyEl) emptyEl.style.display = '';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  tbody.innerHTML = data.map((g, i) => {
    const roomNum = AppState.rooms[g.roomId]?.number || g.roomNumber || '-';
    const isCurrent = g._isCurrent;
    const statusBadge = isCurrent
      ? `<span class="guest-status-badge guest-status-current">● حالي</span>`
      : `<span class="guest-status-badge guest-status-out">✔ مغادر</span>`;

    return `
    <tr>
      <td class="row-num">${i + 1}</td>
      <td><strong style="color:var(--text-primary)">${g.name || '-'}</strong></td>
      <td>${g.profession || '-'}</td>
      <td style="font-size:12px;letter-spacing:0.5px">${g.nationalId || '-'}</td>
      <td>${getDayName(g.checkinDate)}</td>
      <td style="white-space:nowrap">${formatDate(g.checkinDate)}</td>
      <td style="text-align:center;font-weight:700;color:var(--neon-cyan)">${roomNum}</td>
      <td style="text-align:center">${g.days || '-'}</td>
      <td class="paid-amount">${(g.paid || 0).toLocaleString('ar-EG')} ج</td>
      <td>${statusBadge}</td>
    </tr>`;
  }).join('');
};

// ============================================================
// EXPORT GUESTS - EXCEL
// ============================================================
window.exportGuestsExcel = function() {
  const query = (document.getElementById('guests-search')?.value || '').trim().toLowerCase();
  const fromVal = document.getElementById('guests-from')?.value || '';
  const toVal = document.getElementById('guests-to')?.value || '';

  let data = getAllGuestsData();
  if (fromVal) data = data.filter(g => (g.checkinDate || '') >= fromVal);
  if (toVal)   data = data.filter(g => (g.checkinDate || '') <= toVal);
  if (query) {
    data = data.filter(g => {
      const roomNum = AppState.rooms[g.roomId]?.number || g.roomNumber || '';
      return (g.name||'').toLowerCase().includes(query) ||
             (g.profession||'').toLowerCase().includes(query) ||
             (g.nationalId||'').toLowerCase().includes(query) ||
             (g.phone||'').includes(query) ||
             String(roomNum).includes(query);
    });
  }
  data.sort((a, b) => ((b.checkinDate||'') > (a.checkinDate||'') ? 1 : -1));

  // Build CSV (Excel-compatible, UTF-8 BOM)
  const headers = ['#','الاسم','المهنة','الرقم القومي','اليوم','التاريخ','رقم الغرفة','عدد الأيام','المبلغ المدفوع','الحالة'];
  const rows = data.map((g, i) => {
    const roomNum = AppState.rooms[g.roomId]?.number || g.roomNumber || '-';
    return [
      i + 1,
      g.name || '-',
      g.profession || '-',
      g.nationalId || '-',
      getDayName(g.checkinDate),
      g.checkinDate || '-',
      roomNum,
      g.days || '-',
      (g.paid || 0),
      g._isCurrent ? 'حالي' : 'مغادر'
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

  const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `نزلاء-دار-الضيافة-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ تم تصدير ملف Excel بنجاح', 'success');
};

// ============================================================
// EXPORT GUESTS - PDF
// ============================================================
window.exportGuestsPDF = function() {
  const query = (document.getElementById('guests-search')?.value || '').trim().toLowerCase();
  const fromVal = document.getElementById('guests-from')?.value || '';
  const toVal = document.getElementById('guests-to')?.value || '';

  let data = getAllGuestsData();
  if (fromVal) data = data.filter(g => (g.checkinDate || '') >= fromVal);
  if (toVal)   data = data.filter(g => (g.checkinDate || '') <= toVal);
  if (query) {
    data = data.filter(g => {
      const roomNum = AppState.rooms[g.roomId]?.number || g.roomNumber || '-';
      return (g.name||'').toLowerCase().includes(query) ||
             (g.profession||'').toLowerCase().includes(query) ||
             (g.nationalId||'').toLowerCase().includes(query) ||
             (g.phone||'').includes(query) ||
             String(roomNum).includes(query);
    });
  }
  data.sort((a, b) => ((b.checkinDate||'') > (a.checkinDate||'') ? 1 : -1));

  const totalPaid = data.reduce((s, g) => s + (parseFloat(g.paid) || 0), 0);
  const today = new Date().toLocaleDateString('ar-EG', { year:'numeric', month:'long', day:'numeric' });

  const rows = data.map((g, i) => {
    const roomNum = AppState.rooms[g.roomId]?.number || g.roomNumber || '-';
    const status = g._isCurrent ? '<span style="color:#2ecc71">● حالي</span>' : '<span style="color:#a0b0d0">✔ مغادر</span>';
    return `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${g.name || '-'}</strong></td>
        <td>${g.profession || '-'}</td>
        <td style="font-size:11px">${g.nationalId || '-'}</td>
        <td>${getDayName(g.checkinDate)}</td>
        <td>${g.checkinDate || '-'}</td>
        <td style="font-weight:700;color:#2563eb">${roomNum}</td>
        <td style="text-align:center">${g.days || '-'}</td>
        <td style="font-weight:700;color:#0891b2">${(g.paid||0).toLocaleString('ar-EG')} ج</td>
        <td>${status}</td>
      </tr>`;
  }).join('');

  const filterNote = fromVal || toVal
    ? `<p style="color:#666;font-size:13px">الفترة: ${fromVal || 'البداية'} إلى ${toVal || 'اليوم'}</p>`
    : '';

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>سجل النزلاء - دار الضيافة</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 30px; color: #1a1f3a; background: #fff; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 3px solid #2563eb; padding-bottom: 16px; }
  .header h1 { font-size: 24px; color: #2563eb; font-weight: 900; }
  .header p { color: #666; font-size: 14px; margin-top: 4px; }
  .summary { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
  .chip { background: #f0f4ff; border: 1px solid #c7d7ff; border-radius: 8px; padding: 8px 16px; font-size: 13px; }
  .chip strong { color: #2563eb; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th { background: #2563eb; color: #fff; padding: 10px 8px; font-weight: 700; white-space: nowrap; }
  td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f9fafb; }
  tr:hover { background: #eff6ff; }
  .footer { margin-top: 20px; text-align: center; color: #999; font-size: 12px; }
  @media print { body { padding: 10px; } }
</style>
</head>
<body>
<div class="header">
  <h1>🏨 دار الضيافة — سجل النزلاء</h1>
  <p>تاريخ الطباعة: ${today}</p>
  ${filterNote}
</div>
<div class="summary">
  <div class="chip">👥 إجمالي النزلاء: <strong>${data.length}</strong></div>
  <div class="chip">🟢 حاليون: <strong>${data.filter(g=>g._isCurrent).length}</strong></div>
  <div class="chip">✔ مغادرون: <strong>${data.filter(g=>!g._isCurrent).length}</strong></div>
  <div class="chip">💰 إجمالي المدفوع: <strong>${totalPaid.toLocaleString('ar-EG')} ج</strong></div>
</div>
<table>
  <thead>
    <tr>
      <th>#</th><th>الاسم</th><th>المهنة</th><th>الرقم القومي</th>
      <th>اليوم</th><th>التاريخ</th><th>الغرفة</th><th>الأيام</th><th>المدفوع</th><th>الحالة</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<div class="footer">دار الضيافة بالمنصورة — نظام إدارة النزلاء</div>
</body>
</html>`;

  const w = window.open('', '_blank');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
  showToast('✅ جاري فتح نافذة الطباعة للـ PDF', 'success');
};


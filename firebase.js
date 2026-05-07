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
  theme: localStorage.getItem('theme') || 'dark',
  currentEditRoom: null
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
  applyTheme(AppState.theme);
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

// ============================================================
// TOGGLE PASSWORD VISIBILITY
// ============================================================
window.togglePasswordVisibility = function() {
  const input = document.getElementById('login-password');
  const icon = document.getElementById('eye-icon');
  if (!input) return;

  if (input.type === 'password') {
    input.type = 'text';
    // Eye with slash (hidden)
    icon.innerHTML = `
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    `;
  } else {
    input.type = 'password';
    // Eye open
    icon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
  }
};

function loginSuccess(user) {
  AppState.currentUser = user;
  localStorage.setItem('hotelSession', JSON.stringify(user));

  // Update UI
  document.getElementById('current-user-name').textContent = user.name;
  document.getElementById('sidebar-user-name').textContent = user.name;
  document.getElementById('sidebar-user-role').textContent =
    user.role === 'superadmin' ? 'مدير النظام' :
    user.role === 'admin' ? 'مدير' :
    user.role === 'manager' ? 'مدير' : 'موظف استقبال';

  // Show/hide admin features
  if (user.role !== 'superadmin' && user.role !== 'admin') {
    const navEmp = document.getElementById('nav-employees');
    if (navEmp) navEmp.style.display = 'none';
  }

  // Transition to main app
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('main-app').classList.remove('hidden');

  // Log login
  logActivity('login', `تسجيل دخول: ${user.name}`, '🔑');

  // Welcome message
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'صباح الخير' : hour < 17 ? 'مساء الخير' : 'مساء النور';
  const roleLabel = user.role === 'superadmin' ? 'مدير النظام' : user.role === 'admin' ? 'مدير' : 'موظف استقبال';
  setTimeout(() => {
    showToast(`${greeting}، ${user.name} 👋\nأهلاً بك في نظام دار الضيافة — ${roleLabel}`, 'success', 5000);
  }, 600);

  // Load data
  initDataListeners();
  updateFinancials();
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
  // Rooms — يحدّث الكروت + الجدول + الإحصائيات دايماً
  onValue(ref(db, 'rooms'), snap => {
    AppState.rooms = snap.exists() ? snap.val() : {};
    renderRooms();
    updateStats();
    updateRoomsTable();
    populateRoomDropdown();
  });

  // Guests — يحدّث الكروت + الجدول (بيانات النزيل بتظهر في الجدول)
  onValue(ref(db, 'guests'), snap => {
    AppState.guests = snap.exists() ? snap.val() : {};
    renderRooms();
    updateRoomsTable();
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
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));

  const sec = document.getElementById(`section-${name}`);
  if (sec) sec.classList.add('active');

  if (name === 'financial') updateFinancials();
  if (name === 'rooms') { renderRooms(); updateRoomsTable(); }

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
// FLOOR FILTER
// ============================================================
window.filterFloor = function(floor, btn) {
  AppState.currentFilter = floor;
  document.querySelectorAll('.floor-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderRooms();
};

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
      available: 'فارغة', occupied: 'شاغلة',
      reserved: 'محجوزة', cleaning: 'تنظيف', maintenance: 'صيانة'
    };
    const statusEmojis = {
      available: '🟢', occupied: '🔴', reserved: '🟠', cleaning: '🔵', maintenance: '⚙️'
    };

    const remainingDays = guest?.checkoutDate ?
      calcRemainingDays(guest.checkoutDate) : '';

    const keyIcon = room.keyWithReception ?
      `<span class="key-icon" title="المفتاح مع الاستقبال">🗝️</span>` : '';

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
  const tbody = document.getElementById('rooms-table-body');
  if (!tbody) return;

  const rooms = Object.entries(AppState.rooms);
  if (!rooms.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-muted)">لا توجد غرف</td></tr>`;
    return;
  }

  rooms.sort(([,a],[,b]) => {
    if (a.floor !== b.floor) return a.floor - b.floor;
    return String(a.number).localeCompare(String(b.number), 'ar', {numeric:true});
  });

  tbody.innerHTML = rooms.map(([id, room]) => {
    const guest = AppState.guests[id];
    const statusMap = {
      available: ['badge-available','فارغة'], occupied: ['badge-occupied','شاغلة'],
      reserved: ['badge-reserved','محجوزة'], cleaning: ['badge-cleaning','تنظيف'],
      maintenance: ['badge-maintenance','صيانة']
    };
    const [badgeClass, label] = statusMap[room.status] || ['badge-available','شاغرة'];

    return `
    <tr>
      <td><strong>${room.number}</strong></td>
      <td>${room.type === 'vip' ? '<span class="badge badge-vip">👑 VIP</span>' : 'عادية'}</td>
      <td>الدور ${room.floor}</td>
      <td><span class="badge ${badgeClass}">${label}</span></td>
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
  if (keyCb) keyCb.checked = room.keyWithReception || false;

  // Guest data
  const now = new Date();
  const todayDate = now.toISOString().split('T')[0];
  const currentTime = now.toTimeString().slice(0,5);

  const fields = {
    'g-name': guest?.name || '',
    'g-profession': guest?.profession || '',
    'g-phone': guest?.phone || '',
    'g-whatsapp': guest?.whatsapp || '',
    'g-national-id': guest?.nationalId || '',
    'g-notes': guest?.notes || '',
    'g-checkin-date': guest?.checkinDate || todayDate,
    'g-checkin-time': guest?.checkinTime || currentTime,
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

  // Room status & key
  const newStatus = document.getElementById('modal-status').value;
  const keyWithReception = document.getElementById('modal-key-reception').checked;

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

  // Save checkout to history
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

  // Archive guest
  if (guest) {
    await dbPush('checkoutHistory', { ...guest, checkoutActual: Date.now(), roomNumber: room?.number });
  }

  await dbUpdate(`rooms/${roomId}`, { status: 'cleaning', keyWithReception: false });
  await dbRemove(`guests/${roomId}`);

  logActivity('checkout', `خروج من الغرفة ${room?.number}: ${guest?.name}`, '🚪');
  showToast(`تم تسجيل خروج ${guest?.name || ''} بنجاح`, 'success');
  closeModal('guest-modal');
};

// ============================================================
// ROOM STATUS UPDATE FROM MODAL
// ============================================================
window.updateRoomStatusFromModal = async function() {
  const roomId = document.getElementById('modal-room-id').value;
  if (!roomId) return;
  const status = document.getElementById('modal-status').value;

  // حفظ فوري في Firebase — يُحدِّث الكروت والجدول في نفس اللحظة
  try {
    await dbUpdate(`rooms/${roomId}`, { status });
    // الـ onValue هيشتغل تلقائياً ويحدّث renderRooms + updateRoomsTable
  } catch(e) {
    console.warn('Status update failed:', e);
  }
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
    await dbUpdate(`rooms/${editId}`, { number, type, floor, status });
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
  const room = AppState.rooms[roomId];
  if (!room) return;
  if (room.status === 'occupied') { showToast('لا يمكن حذف غرفة مشغولة', 'error'); return; }
  if (!confirm(`هل تريد حذف الغرفة ${room.number}؟`)) return;

  await dbRemove(`rooms/${roomId}`);
  await dbRemove(`guests/${roomId}`);
  logActivity('room_delete', `حذف الغرفة ${room.number}`, '🗑️');
  showToast('تم حذف الغرفة', 'info');
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
window.updateFinancials = function() {
  const guests = Object.values(AppState.guests || {});
  const history = Object.values(AppState.checkoutHistory || {});

  const today = new Date().toISOString().split('T')[0];
  const thisMonth = today.substring(0, 7);
  const thisYear = today.substring(0, 4);

  let daily = 0, monthly = 0, yearly = 0, totalRemaining = 0;

  const allGuests = [...guests];

  allGuests.forEach(g => {
    const d = g.checkinDate || '';
    const paid = parseFloat(g.paid) || 0;
    const remaining = parseFloat(g.remaining) || 0;

    if (d === today) daily += paid;
    if (d.startsWith(thisMonth)) monthly += paid;
    if (d.startsWith(thisYear)) yearly += paid;
    totalRemaining += remaining;
  });

  setText('fin-daily', daily.toLocaleString('ar-EG') + ' ج');
  setText('fin-monthly', monthly.toLocaleString('ar-EG') + ' ج');
  setText('fin-yearly', yearly.toLocaleString('ar-EG') + ' ج');
  setText('fin-remaining', totalRemaining.toLocaleString('ar-EG') + ' ج');
  setText('stat-revenue', daily.toLocaleString('ar-EG'));

  renderTransactionsList(allGuests);
  renderRevenueChart(allGuests);
};

function renderTransactionsList(guests) {
  const container = document.getElementById('financial-transactions');
  if (!container) return;

  const sorted = [...guests].filter(g => g.paid > 0)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
    .slice(0, 30);

  if (!sorted.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><p>لا توجد معاملات مالية</p></div>`;
    return;
  }

  container.innerHTML = sorted.map(g => `
    <div class="transaction-item">
      <div>
        <strong>${g.name || 'نزيل'}</strong> - الغرفة ${AppState.rooms[g.roomId]?.number || '-'}
      </div>
      <div class="transaction-date">${g.checkinDate || '-'}</div>
      <div class="transaction-amount">${(g.paid||0).toLocaleString('ar-EG')} ج</div>
    </div>
  `).join('');
}

function renderRevenueChart(guests) {
  const canvas = document.getElementById('revenue-chart');
  if (!canvas) return;

  // Last 7 days
  const days = [];
  const amounts = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    days.push(d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }));
    const dayTotal = guests
      .filter(g => g.checkinDate === dateStr)
      .reduce((sum, g) => sum + (parseFloat(g.paid) || 0), 0);
    amounts.push(dayTotal);
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
  openModal('employee-modal');
};

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
    rooms: document.getElementById('perm-rooms').checked,
    guests: document.getElementById('perm-guests').checked,
    financial: document.getElementById('perm-financial').checked,
    employees: document.getElementById('perm-employees').checked
  };

  const empData = { name, username, password, role, permissions, createdAt: Date.now() };

  if (editId) {
    await dbUpdate(`employees/${editId}`, empData);
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

  const roleLabels = { receptionist: 'موظف استقبال', manager: 'مدير', admin: 'مدير النظام', superadmin: 'مدير عام' };

  // Always show master admin
  const masterCard = `
    <div class="employee-card">
      <div class="emp-avatar">👑</div>
      <div class="emp-name">${MASTER_ADMIN.name}</div>
      <div class="emp-username">@${MASTER_ADMIN.username}</div>
      <div class="emp-role"><span class="badge badge-vip">مدير عام</span></div>
    </div>`;

  const emps = Object.entries(AppState.employees || {});
  if (!emps.length) {
    container.innerHTML = masterCard + `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:20px">لا يوجد موظفون مضافون</div>`;
    return;
  }

  container.innerHTML = masterCard + emps.map(([id, emp]) => `
    <div class="employee-card">
      <div class="emp-avatar">👤</div>
      <div class="emp-name">${emp.name}</div>
      <div class="emp-username">@${emp.username}</div>
      <div class="emp-role"><span class="badge badge-${emp.role === 'admin' ? 'vip' : 'reserved'}">${roleLabels[emp.role] || emp.role}</span></div>
      <div class="emp-actions">
        <button class="btn-danger btn-sm" onclick="deleteEmployee('${id}')">🗑️ حذف</button>
      </div>
    </div>
  `).join('');
}

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

  const phone = '2' + (guest.whatsapp || guest.phone).replace(/^0/, '');
  const msg = encodeURIComponent(`
🏨 *دار الضيافة بالمنصورة*
━━━━━━━━━━━━━━━━

*فاتورة إقامة*

👤 الاسم: ${guest?.name || '-'}
🚪 الغرفة: ${room?.number} ${room?.type === 'vip' ? '(VIP)' : ''}
📅 الوصول: ${guest?.checkinDate || '-'}
📅 المغادرة: ${guest?.checkoutDate || '-'}
🌙 عدد الأيام: ${guest?.days || 0}
💵 السعر لليلة: ${(guest?.pricePerNight||0).toLocaleString()} ج

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
  const fullPhone = '2' + phone.replace(/^0/, '');
  window.open(`https://wa.me/${fullPhone}`, '_blank');
};

window.openWhatsAppAlt = function() {
  const phone = document.getElementById('g-whatsapp').value.trim();
  if (!phone) { showToast('لا يوجد رقم واتساب', 'error'); return; }
  const fullPhone = '2' + phone.replace(/^0/, '');
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

window.calcTotal = function() {
  const days = parseInt(document.getElementById('g-days').value) || 0;
  const price = parseFloat(document.getElementById('g-price-per-night').value) || 0;
  const total = days * price;
  document.getElementById('g-total').value = total;
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
window.showToast = function(msg, type = 'info', duration = 3000) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  toast.classList.remove('hidden');
  clearTimeout(AppState.toastTimer);
  AppState.toastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, duration);
};

// ============================================================
// HELPERS
// ============================================================
function getStatusLabel(status) {
  const map = { available: 'فارغة', occupied: 'شاغلة', reserved: 'محجوزة', cleaning: 'تنظيف', maintenance: 'صيانة' };
  return map[status] || 'فارغة';
}

// Make functions globally accessible
window.renderRooms = renderRooms;
window.updateStats = updateStats;
window.logActivity = logActivity;

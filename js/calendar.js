// ========================================================================
// CALENDEY — Interactive Calendar Engine
// Kalkulasi matriks tanggal, render titik kategori, & panel hari penting
// ========================================================================

import { state } from './state.js';
import { CONFIG } from './config.js';
import { modals } from './modals.js';

export const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const DAY_NAMES_ID = [
  'Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'
];

class CalendarEngine {
  constructor() {
    this.container = null;
  }

  init() {
    state.subscribe('activeYear', () => this.render());
    state.subscribe('activeMonth', () => this.render());
    state.subscribe('nationalDays', () => this.render());
    state.subscribe('contentPlans', () => this.render());
    state.subscribe('categoryFilter', () => this.render());
    state.subscribe('selectedDate', (newDate) => {
      document.querySelectorAll('.calendar-day-cell').forEach(c => {
        if (c.getAttribute('data-date') === newDate) {
          c.classList.add('is-selected');
        } else {
          c.classList.remove('is-selected');
        }
      });
      this.renderDetailPanel();
    });
  }

  prevMonth() {
    let year = state.get('activeYear');
    let month = state.get('activeMonth') - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    state.update({ activeYear: year, activeMonth: month });
  }

  nextMonth() {
    let year = state.get('activeYear');
    let month = state.get('activeMonth') + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    state.update({ activeYear: year, activeMonth: month });
  }

  goToToday() {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    state.update({
      activeYear: now.getFullYear(),
      activeMonth: now.getMonth() + 1,
      selectedDate: todayStr
    });

    setTimeout(() => {
      const todayCell = document.querySelector(`.calendar-day-cell[data-date="${todayStr}"]`) || document.querySelector('.calendar-day-cell.is-today');
      if (todayCell) {
        todayCell.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        todayCell.classList.add('pulse-highlight');
        setTimeout(() => todayCell.classList.remove('pulse-highlight'), 2200);
      }
    }, 80);
  }

  getDaysMatrix(year, month) {
    const firstDayIndex = new Date(year, month - 1, 1).getDay();
    const daysInCurrentMonth = new Date(year, month, 0).getDate();
    const daysInPrevMonth = new Date(year, month - 1, 0).getDate();

    const cells = [];

    // Hari dari bulan sebelumnya
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      cells.push({
        day: daysInPrevMonth - i,
        month: month === 1 ? 12 : month - 1,
        year: month === 1 ? year - 1 : year,
        isCurrentMonth: false
      });
    }

    // Hari bulan saat ini
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      cells.push({
        day: d,
        month: month,
        year: year,
        isCurrentMonth: true
      });
    }

    // Sisa hari dari bulan berikutnya untuk genap kelipatan 7
    const remaining = 42 - cells.length; // Matriks 6 baris x 7 hari
    for (let d = 1; d <= remaining; d++) {
      cells.push({
        day: d,
        month: month === 12 ? 1 : month + 1,
        year: month === 12 ? year + 1 : year,
        isCurrentMonth: false
      });
    }

    return cells;
  }

  render() {
    const calendarEl = document.getElementById('calendarGrid');
    const monthLabelEl = document.getElementById('currentMonthLabel');
    if (!calendarEl || !monthLabelEl) return;

    const year = state.get('activeYear');
    const month = state.get('activeMonth');
    const selectedDate = state.get('selectedDate');
    const todayStr = new Date().toISOString().split('T')[0];

    monthLabelEl.textContent = `${MONTH_NAMES_ID[month - 1]} ${year}`;

    const nationalDays = state.get('nationalDays') || [];
    const contentPlans = state.get('contentPlans') || [];
    const activeFilter = state.get('categoryFilter');

    const matrix = this.getDaysMatrix(year, month);
    calendarEl.innerHTML = '';

    matrix.forEach(cell => {
      const cellDateStr = `${cell.year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
      
      // Ambil hari nasional pada tanggal ini
      let daysOnDate = nationalDays.filter(n => n.day === cell.day && n.month === cell.month);
      if (activeFilter) {
        daysOnDate = daysOnDate.filter(n => n.category_id === activeFilter);
      }

      // Ambil rencana konten pada tanggal ini
      const plansOnDate = contentPlans.filter(p => p.planned_date === cellDateStr);
      const hasNationalDay = daysOnDate.length > 0;
      const isPublicHoliday = daysOnDate.some(n => n.is_public_holiday);

      const cellDiv = document.createElement('div');
      cellDiv.className = `calendar-day-cell ${cell.isCurrentMonth ? '' : 'other-month'} ${cellDateStr === todayStr ? 'is-today' : ''} ${cellDateStr === selectedDate ? 'is-selected' : ''} ${hasNationalDay ? 'has-national-day' : ''} ${isPublicHoliday ? 'is-holiday' : ''}`;
      cellDiv.setAttribute('data-date', cellDateStr);

      // Render Visual Chips Hari Nasional & Konten
      let eventsHtml = '<div class="day-events-wrapper">';
      if (cell.isCurrentMonth) {
        daysOnDate.slice(0, 2).forEach(event => {
          const cat = CONFIG.CATEGORIES.find(c => c.id === event.category_id);
          const color = cat ? cat.color_hex : '#ef4444';
          const icon = cat ? cat.icon : 'flag';
          eventsHtml += `
            <div class="day-event-chip" style="background: ${color}18; color: ${color}; border-left: 3px solid ${color};" title="${event.name}">
              <i class="ph-bold ph-${icon}"></i>
              <span>${event.name}</span>
            </div>
          `;
        });

        if (daysOnDate.length > 2) {
          eventsHtml += `<span style="font-size: 0.62rem; color: var(--text-muted); font-weight: 700;">+${daysOnDate.length - 2} lagi</span>`;
        }

        if (plansOnDate.length > 0) {
          const allPosted = plansOnDate.every(p => p.status === 'posted');
          eventsHtml += `
            <div class="day-plan-chip ${allPosted ? 'posted' : ''}" title="${plansOnDate.length} rencana konten">
              <i class="ph-bold ${allPosted ? 'ph-check-circle' : 'ph-notepad'}"></i>
              <span>${plansOnDate.length} Konten</span>
            </div>
          `;
        }
      }
      eventsHtml += '</div>';

      cellDiv.innerHTML = `
        <div class="day-header">
          <span class="day-number">${cell.day}</span>
          ${isPublicHoliday && cell.isCurrentMonth ? '<span class="holiday-pill">Libur</span>' : ''}
        </div>
        ${eventsHtml}
      `;

      cellDiv.addEventListener('click', () => {
        state.set('selectedDate', cellDateStr);
      });

      calendarEl.appendChild(cellDiv);
    });

    this.renderDetailPanel();
    this.renderUpcomingDays();
  }

  renderDetailPanel() {
    const panelEl = document.getElementById('selectedDayDetail');
    if (!panelEl) return;

    const selectedDate = state.get('selectedDate');
    const [y, m, d] = selectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayName = DAY_NAMES_ID[dateObj.getDay()];
    const monthName = MONTH_NAMES_ID[m - 1];

    const nationalDays = state.get('nationalDays') || [];
    const eventsOnDay = nationalDays.filter(n => n.day === d && n.month === m);
    const contentPlans = state.get('contentPlans') || [];
    const plansOnDay = contentPlans.filter(p => p.planned_date === selectedDate);

    let eventsHtml = '';
    if (eventsOnDay.length > 0) {
      eventsOnDay.forEach(ev => {
        const cat = CONFIG.CATEGORIES.find(c => c.id === ev.category_id);
        eventsHtml += `
          <div class="selected-event-box" style="border-left-color: ${cat ? cat.color_hex : 'var(--primary)'};">
            <div class="event-cat-badge" style="color: ${cat ? cat.color_hex : 'var(--primary)'};">
              <i class="ph-bold ph-${cat ? cat.icon : 'flag'}"></i>
              ${cat ? cat.name : 'Hari Penting'}
              ${ev.is_public_holiday ? '• <span style="color: var(--danger);">Libur Nasional</span>' : ''}
            </div>
            <div class="event-title">${ev.name}</div>
            ${ev.tagline ? `<div class="event-tagline">"${ev.tagline}"</div>` : ''}
            <div class="event-desc">${ev.description || ''}</div>
          </div>
        `;
      });
    } else {
      eventsHtml = `<p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 14px;">Tidak ada peringatan hari nasional khusus pada tanggal ini.</p>`;
    }

    let plansHtml = '';
    if (plansOnDay.length > 0) {
      plansHtml = `
        <div style="margin-top: 14px;">
          <h4 style="font-size: 0.85rem; font-weight: 700; margin-bottom: 8px; color: var(--text);">Rencana Konten (${plansOnDay.length})</h4>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            ${plansOnDay.map(p => `
              <div style="background: var(--bg-subtle); padding: 10px 12px; border-radius: var(--radius-md); display: flex; align-items: center; justify-content: space-between;">
                <div>
                  <div style="font-size: 0.84rem; font-weight: 700; color: var(--text);">${p.title}</div>
                  <div style="font-size: 0.72rem; color: var(--text-muted);">${p.status}</div>
                </div>
                <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="window.calendeyOpenPlanDetail('${p.id}')">Buka</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    panelEl.innerHTML = `
      <div class="detail-header-date">
        <div>
          <h3>${dayName}, ${d} ${monthName} ${y}</h3>
          <p style="font-size: 0.78rem; color: var(--text-muted);">Agenda & Hari Nasional</p>
        </div>
      </div>
      ${eventsHtml}
      ${plansHtml}
    `;
  }

  renderUpcomingDays() {
    const listEl = document.getElementById('upcomingDaysList');
    if (!listEl) return;

    const nationalDays = state.get('nationalDays') || [];
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();
    const currentYear = now.getFullYear();

    // Urutkan berdasarkan hari terdekat
    const upcoming = nationalDays
      .map(ev => {
        let evDate = new Date(currentYear, ev.month - 1, ev.day);
        if (evDate < now) {
          evDate = new Date(currentYear + 1, ev.month - 1, ev.day);
        }
        const diffDays = Math.ceil((evDate - now) / (1000 * 60 * 60 * 24));
        return { ...ev, dateObj: evDate, diffDays };
      })
      .sort((a, b) => a.diffDays - b.diffDays)
      .slice(0, 5);

    listEl.innerHTML = upcoming.map(item => `
      <div class="upcoming-item" onclick="window.calendeySelectDate('${item.dateObj.getFullYear()}-${String(item.month).padStart(2, '0')}-${String(item.day).padStart(2, '0')}')">
        <div class="upcoming-date-box">
          <span class="upcoming-date-day">${item.day}</span>
          <span class="upcoming-date-month">${MONTH_NAMES_ID[item.month - 1].slice(0, 3)}</span>
        </div>
        <div class="upcoming-info">
          <div class="upcoming-name">${item.name}</div>
          <div class="upcoming-countdown">${item.diffDays === 0 ? 'Hari ini!' : `H-${item.diffDays} hari`}</div>
        </div>
      </div>
    `).join('');
  }
}

export const calendar = new CalendarEngine();

window.calendeySelectDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  state.update({
    activeYear: y,
    activeMonth: m,
    selectedDate: dateStr
  });
};

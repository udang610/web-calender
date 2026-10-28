// ========================================================================
// CALENDEY — Content Planner View Engine
// Daftar Rencana Konten, Filter Cepat, Status Alur Kerja, & Ceklis Progres
// ========================================================================

import { state } from './state.js';
import { CONFIG } from './config.js';
import { db } from './db.js';
import { modals } from './modals.js';
import { MONTH_NAMES_ID } from './calendar.js';

class PlannerViewEngine {
  constructor() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.platformFilter = 'all';
  }

  init() {
    state.subscribe('contentPlans', () => {
      if (state.get('currentView') === 'planner') {
        this.render();
      }
    });
  }

  render() {
    const container = document.getElementById('plannerViewContainer');
    if (!container) return;

    const plans = state.get('contentPlans') || [];
    const nationalDays = state.get('nationalDays') || [];

    // Filter Logic
    let filtered = plans.filter(p => {
      if (this.statusFilter !== 'all' && p.status !== this.statusFilter) return false;
      if (this.platformFilter !== 'all' && !p.platforms?.includes(this.platformFilter)) return false;
      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const titleMatch = p.title?.toLowerCase().includes(q);
        const captionMatch = p.caption?.toLowerCase().includes(q);
        if (!titleMatch && !captionMatch) return false;
      }
      return true;
    });

    const actionFilterBarHtml = `
      <div class="planner-action-bar">
        <div class="filter-group">
          <!-- Search Box -->
          <div class="search-input-wrapper">
            <i class="ph-bold ph-magnifying-glass"></i>
            <input type="text" id="plannerSearchInput" class="form-input" placeholder="Cari rencana konten..." value="${this.searchQuery}">
          </div>

          <!-- Status Filter -->
          <select id="plannerStatusSelect" class="form-select">
            <option value="all" ${this.statusFilter === 'all' ? 'selected' : ''}>Semua Status</option>
            <option value="idea" ${this.statusFilter === 'idea' ? 'selected' : ''}>Ide Konten</option>
            <option value="design_done" ${this.statusFilter === 'design_done' ? 'selected' : ''}>Desain Dibuat</option>
            <option value="ready" ${this.statusFilter === 'ready' ? 'selected' : ''}>Siap Posting</option>
            <option value="posted" ${this.statusFilter === 'posted' ? 'selected' : ''}>Sudah Diposting</option>
          </select>

          <!-- Platform Filter -->
          <select id="plannerPlatformSelect" class="form-select">
            <option value="all" ${this.platformFilter === 'all' ? 'selected' : ''}>Semua Platform</option>
            ${CONFIG.PLATFORMS.map(pl => `
              <option value="${pl.id}" ${this.platformFilter === pl.id ? 'selected' : ''}>${pl.name}</option>
            `).join('')}
          </select>
        </div>

        <button class="btn-primary" id="btnNewPlanFromPlanner">
          <i class="ph-bold ph-plus"></i> Buat Rencana Konten
        </button>
      </div>
    `;

    let cardsHtml = '';
    if (filtered.length === 0) {
      cardsHtml = `
        <div style="text-align: center; padding: 60px 20px; background: var(--surface); border-radius: var(--radius-lg); border: 1px solid var(--surface-border);">
          <i class="ph-bold ph-calendar-plus" style="font-size: 3rem; color: var(--text-subtle); margin-bottom: 12px; display: block;"></i>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text); margin-bottom: 6px;">Belum Ada Rencana Konten</h3>
          <p style="font-size: 0.85rem; color: var(--text-muted); max-width: 400px; margin: 0 auto;">Mulai jadwalkan postingan sosial media Anda berdasarkan hari penting nasional Indonesia.</p>
        </div>
      `;
    } else {
      cardsHtml = `
        <div class="plans-grid">
          ${filtered.map(plan => {
            const nationalDay = nationalDays.find(n => n.id === plan.national_day_id);
            const statusConfig = CONFIG.STATUSES[plan.status?.toUpperCase()] || CONFIG.STATUSES.IDEA;
            const [y, m, d] = (plan.planned_date || '').split('-').map(Number);
            const formattedDate = d && m ? `${d} ${MONTH_NAMES_ID[m - 1]} ${y}` : plan.planned_date;

            return `
              <div class="plan-card">
                <div class="plan-card-header">
                  <div class="plan-date-badge">
                    <i class="ph-bold ph-calendar-blank"></i> ${formattedDate}
                  </div>
                  <span class="status-pill ${statusConfig.badgeClass}">
                    ${statusConfig.label}
                  </span>
                </div>

                <div class="plan-title">${plan.title}</div>

                ${nationalDay ? `
                  <div class="plan-national-tag">
                    <i class="ph-bold ph-flag"></i> ${nationalDay.name}
                  </div>
                ` : ''}

                <!-- Platforms -->
                <div class="plan-platforms">
                  ${(plan.platforms || []).map(platId => {
                    const pMeta = CONFIG.PLATFORMS.find(p => p.id === platId);
                    return `<span class="platform-pill"><i class="ph-bold ph-${pMeta ? pMeta.icon : 'share-network'}"></i> ${pMeta ? pMeta.name : platId}</span>`;
                  }).join('')}
                </div>

                <!-- WhatsApp Reminder Indicator -->
                ${plan.reminder_enabled !== false ? `
                  <div style="display: flex; align-items: center; gap: 5px; font-size: 0.72rem; color: #15803d; background: rgba(34, 197, 94, 0.12); padding: 3px 8px; border-radius: 6px; font-weight: 600; width: fit-content; margin-bottom: 8px;">
                    <i class="ph-bold ph-whatsapp-logo" style="color: #22c55e;"></i>
                    <span>Pengingat WA: H-${plan.remind_offset_days ?? 1} (${plan.remind_time || '09:00'})</span>
                  </div>
                ` : ''}

                <!-- Fast Checklist Progres -->
                <div class="plan-checklist">
                  <label class="checklist-label">
                    <input type="checkbox" class="checklist-checkbox" 
                           ${plan.design_done ? 'checked' : ''} 
                           onchange="window.calendeyToggleChecklist('${plan.id}', 'design_done')">
                    <span>Desain Selesai</span>
                  </label>
                  <label class="checklist-label">
                    <input type="checkbox" class="checklist-checkbox" 
                           ${plan.is_posted ? 'checked' : ''} 
                           onchange="window.calendeyToggleChecklist('${plan.id}', 'is_posted')">
                    <span>Sudah Diposting</span>
                  </label>
                </div>

                <!-- Thumbnails Asset -->
                ${plan.content_assets && plan.content_assets.length > 0 ? `
                  <div class="plan-thumbnails">
                    ${plan.content_assets.map(a => `
                      <img src="${a.storage_path}" class="plan-thumb-img" alt="${a.file_name}" onclick="window.calendeyPreviewImage('${a.storage_path}')">
                    `).join('')}
                  </div>
                ` : ''}

                <!-- Footer Actions -->
                <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: auto; padding-top: 10px; border-top: 1px solid var(--border-light);">
                  <button class="btn-secondary" style="padding: 5px 10px; font-size: 0.78rem; color: #16a34a; border-color: rgba(34, 197, 94, 0.35);" title="Kirim Pengingat WhatsApp Sekarang" onclick="window.calendeySendWhatsAppReminder('${plan.id}')">
                    <i class="ph-bold ph-whatsapp-logo"></i> Kirim WA
                  </button>
                  <button class="btn-secondary" style="padding: 5px 12px; font-size: 0.78rem;" onclick="window.calendeyOpenPlanDetail('${plan.id}')">
                    <i class="ph-bold ph-note-pencil"></i> Edit & Detail
                  </button>
                  <button class="btn-secondary" style="padding: 5px 8px; font-size: 0.78rem; color: var(--danger); border-color: rgba(239, 68, 68, 0.25);" title="Hapus Konten" onclick="window.calendeyDeletePlan('${plan.id}')">
                    <i class="ph-bold ph-trash"></i>
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    container.innerHTML = `
      <div class="planner-container">
        ${actionFilterBarHtml}
        ${cardsHtml}
      </div>
    `;

    // Attach Event Listeners
    const searchInput = document.getElementById('plannerSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.render();
      });
    }

    const statusSelect = document.getElementById('plannerStatusSelect');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.statusFilter = e.target.value;
        this.render();
      });
    }

    const platformSelect = document.getElementById('plannerPlatformSelect');
    if (platformSelect) {
      platformSelect.addEventListener('change', (e) => {
        this.platformFilter = e.target.value;
        this.render();
      });
    }

    const btnNew = document.getElementById('btnNewPlanFromPlanner');
    if (btnNew) {
      btnNew.addEventListener('click', () => modals.openContentForm());
    }
  }
}

export const planner = new PlannerViewEngine();

window.calendeyToggleChecklist = (planId, field) => {
  db.toggleChecklist(planId, field);
};
window.calendeyOpenNewPlan = () => modals.openContentForm();

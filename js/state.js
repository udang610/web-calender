// ========================================================================
// CALENDEY — Reactive State Manager
// Menyimpan state runtime dan memicu notifikasi perubahan UI
// ========================================================================

import { CONFIG } from './config.js';

class StateManager {
  constructor() {
    const today = new Date();
    this.state = {
      user: null,
      theme: localStorage.getItem('calendey_theme') || CONFIG.DEFAULT_THEME,
      currentView: 'calendar', // 'calendar', 'planner', 'categories', 'settings'
      activeYear: today.getFullYear(),
      activeMonth: today.getMonth() + 1, // 1 - 12
      selectedDate: today.toISOString().split('T')[0], // YYYY-MM-DD
      categoryFilter: null, // null for all
      nationalDays: [],
      contentPlans: [],
      customEvents: [],
      reminders: []
    };

    this.listeners = new Map();
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    const oldValue = this.state[key];
    this.state[key] = value;
    this.notify(key, value, oldValue);

    if (key === 'theme') {
      localStorage.setItem('calendey_theme', value);
      document.documentElement.setAttribute('data-theme', value);
    }
  }

  update(updates) {
    Object.keys(updates).forEach(key => {
      this.set(key, updates[key]);
    });
  }

  subscribe(key, callback) {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key).add(callback);
    return () => this.listeners.get(key).delete(callback);
  }

  notify(key, newValue, oldValue) {
    if (this.listeners.has(key)) {
      this.listeners.get(key).forEach(callback => callback(newValue, oldValue));
    }
    if (this.listeners.has('*')) {
      this.listeners.get('*').forEach(callback => callback(key, newValue, oldValue));
    }
  }
}

export const state = new StateManager();

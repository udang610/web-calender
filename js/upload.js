// ========================================================================
// CALENDEY — Asset Upload Service (Supabase Storage & Client Compressor)
// ========================================================================

import { CONFIG } from './config.js';
import { notify } from './notifications.js';
import { db } from './db.js';
import { state } from './state.js';

class UploadService {
  constructor() {
    this.currentPendingFiles = [];
  }

  validateFile(file) {
    if (!CONFIG.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      notify.error(`Format ${file.name} tidak didukung. Harap gunakan JPG, PNG, atau WebP.`);
      return false;
    }
    if (file.size > CONFIG.MAX_UPLOAD_SIZE_BYTES) {
      notify.error(`Ukuran ${file.name} melebihi batas 5 MB.`);
      return false;
    }
    return true;
  }

  readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }

  async processFiles(fileList) {
    const validAssets = [];
    const files = Array.from(fileList);

    for (const file of files) {
      if (!this.validateFile(file)) continue;

      try {
        const dataUrl = await this.readFileAsDataURL(file);
        validAssets.push({
          id: 'asset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          storage_path: dataUrl, // Local data URL atau remote path
          created_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Gagal membaca file:', err);
      }
    }

    return validAssets;
  }

  async uploadToSupabase(file, planId) {
    if (!db.isCloudConnected || !state.get('user')) return null;

    try {
      const userId = state.get('user').id;
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${userId}/${planId}/${fileName}`;

      const { data, error } = await db.client.storage
        .from('content-assets')
        .upload(filePath, file);

      if (error) throw error;
      return filePath;
    } catch (err) {
      console.error('[Calendey Upload] Gagal upload ke Supabase Storage:', err);
      return null;
    }
  }
}

export const uploadService = new UploadService();

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

  compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.72) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height = Math.round((height * maxWidth) / width);
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width = Math.round((width * maxHeight) / height);
              height = maxHeight;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Kompresi ke format JPEG 0.72 agar ukuran berkurang 95%+ tanpa pecah di layar
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  async processFiles(fileList) {
    const validAssets = [];
    const files = Array.from(fileList);

    for (const file of files) {
      if (!this.validateFile(file)) continue;

      try {
        const compressedDataUrl = await this.compressImage(file);
        if (compressedDataUrl) {
          validAssets.push({
            id: 'asset-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
            file_name: file.name,
            mime_type: 'image/jpeg',
            file_size: Math.round(compressedDataUrl.length * 0.75),
            storage_path: compressedDataUrl, // Lightweight compressed data URL
            created_at: new Date().toISOString()
          });
        }
      } catch (err) {
        console.error('Gagal memproses file:', err);
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

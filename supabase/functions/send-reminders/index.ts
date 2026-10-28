// ========================================================================
// CALENDEY — Edge Function: send-reminders
// Dipanggil secara berkala via pg_cron (tiap 5 menit)
// ========================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FONNTE_API_URL = "https://api.fonnte.com/send";

serve(async (req: Request) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const fonnteToken = Deno.env.get("FONNTE_TOKEN") || "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Ambil seluruh reminder yang statusnya 'pending' dan remind_at <= NOW()
    const nowIso = new Date().toISOString();
    const { data: pendingReminders, error: fetchErr } = await supabase
      .from("reminders")
      .select(`
        id,
        user_id,
        content_plan_id,
        remind_at,
        attempts,
        content_plans:content_plan_id (
          title,
          status,
          is_posted,
          scheduled_at,
          national_days:national_day_id (name)
        )
      `)
      .eq("status", "pending")
      .lte("remind_at", nowIso)
      .limit(50);

    if (fetchErr) {
      console.error("Error fetching reminders:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    if (!pendingReminders || pendingReminders.length === 0) {
      return new Response(JSON.stringify({ message: "No pending reminders to send" }), { status: 200 });
    }

    // Ambil profile pengguna secara efisien via batch query
    const userIds = [...new Set(pendingReminders.map((r: any) => r.user_id).filter(Boolean))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, full_name, whatsapp_number, reminders_enabled")
      .in("id", userIds);
    const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

    const results = [];

    // 2. Iterasi dan proses pengiriman tiap reminder
    for (const reminder of pendingReminders) {
      const profile: any = profileMap.get(reminder.user_id);
      const plan: any = reminder.content_plans;

      // Jika user mematikan notifikasi global
      if (!profile?.reminders_enabled) {
        await supabase
          .from("reminders")
          .update({ status: "cancelled" })
          .eq("id", reminder.id);
        continue;
      }

      // Jika konten sudah diposting (is_posted = true atau status = 'posted')
      if (plan?.is_posted || plan?.status === "posted") {
        await supabase
          .from("reminders")
          .update({ status: "cancelled" })
          .eq("id", reminder.id);
        continue;
      }

      // Validasi nomor WhatsApp
      const targetPhone = profile?.whatsapp_number;
      if (!targetPhone) {
        await supabase
          .from("reminders")
          .update({ status: "failed", attempts: (reminder.attempts || 0) + 1 })
          .eq("id", reminder.id);
        continue;
      }

      // Format teks pesan WhatsApp ramah & elegan
      const userName = profile.full_name || "Sahabat Calendey";
      const contentTitle = plan.title || "Konten Hari Nasional";
      const nationalDayName = plan.national_days?.name || "Hari Nasional Mendatang";
      const scheduleTime = plan.scheduled_at
        ? new Date(plan.scheduled_at).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "Jadwal posting Anda";

      const message = `Halo ${userName}! 🇮🇩\n\nBesok/Hari ini adalah peringatan *${nationalDayName}*.\nKonten Anda: "*${contentTitle}*" saat ini berstatus *${plan.status}*, dengan target tayang pukul *${scheduleTime} WIB*.\n\nPastikan desain sudah final dan siap diposting ke media sosial ya! ✨\n— Calendey`;

      let responseCode = 200;
      let responseBody = "";
      let isSuccess = false;

      // 3. Kirim ke Fonnte Gateway (atau simulator jika token belum diset)
      if (fonnteToken) {
        try {
          const res = await fetch(FONNTE_API_URL, {
            method: "POST",
            headers: {
              Authorization: fonnteToken,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              target: targetPhone,
              message: message,
              countryCode: "62",
            }),
          });
          responseCode = res.status;
          responseBody = await res.text();
          isSuccess = res.ok;
        } catch (netErr: any) {
          responseCode = 500;
          responseBody = netErr.message;
          isSuccess = false;
        }
      } else {
        // Simulasi pengiriman jika token gateway belum dipasang
        responseCode = 200;
        responseBody = JSON.stringify({ status: true, simulated: true });
        isSuccess = true;
      }

      // 4. Update status reminder & catat log
      const attemptsCount = (reminder.attempts || 0) + 1;
      const finalStatus = isSuccess ? "sent" : attemptsCount >= 3 ? "failed" : "pending";

      await supabase
        .from("reminders")
        .update({
          status: finalStatus,
          attempts: attemptsCount,
          sent_at: isSuccess ? new Date().toISOString() : null,
        })
        .eq("id", reminder.id);

      await supabase.from("reminder_logs").insert({
        reminder_id: reminder.id,
        provider: "fonnte",
        request_summary: `Pesan pengingat: ${contentTitle} ke ${targetPhone}`,
        response_code: responseCode,
        response_body: responseBody,
      });

      results.push({ id: reminder.id, status: finalStatus });
    }

    return new Response(JSON.stringify({ processed: results }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});

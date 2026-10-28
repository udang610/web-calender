-- ========================================================================
-- CALENDEY — Seed Data (Categories & Master Hari Nasional)
-- ========================================================================

-- 1. SEED CATEGORIES
insert into public.categories (id, name, slug, color_hex, icon) values
(1, 'Hari Nasional', 'hari-nasional', '#ef4444', 'flag'),
(2, 'Hari Bersejarah', 'hari-bersejarah', '#f97316', 'hourglass-medium'),
(3, 'Hari Keagamaan', 'hari-keagamaan', '#10b981', 'hands-praying'),
(4, 'Hari Perjuangan', 'hari-perjuangan', '#3b82f6', 'sword'),
(5, 'Hari Peringatan Khusus', 'hari-peringatan-khusus', '#8b5cf6', 'sparkle')
on conflict (id) do update set
    name = excluded.name,
    slug = excluded.slug,
    color_hex = excluded.color_hex,
    icon = excluded.icon;

-- 2. SEED NATIONAL DAYS
insert into public.national_days (category_id, name, day, month, year, description, tagline, is_public_holiday) values
(1, 'Tahun Baru Masehi', 1, 1, null, 'Perayaan awal tahun baru masehi.', 'Awal baru, resolusi baru, semangat membara.', true),
(1, 'Hari K3 Nasional', 12, 1, null, 'Bulan Keselamatan dan Kesehatan Kerja Nasional untuk lingkungan kerja aman.', 'Budayakan K3, ciptakan ruang kerja sehat dan produktif.', false),
(4, 'Hari Peristiwa Heroik Laut dan Samudera', 15, 1, null, 'Mengenang pertempuran Laut Aru dan gugurnya Komodor Yos Sudarso demi kedaulatan RI.', 'Kobarkan semangat ksatria samudra pertahankan kedaulatan.', false),
(5, 'Hari Gizi Nasional', 25, 1, null, 'Meningkatkan kesadaran masyarakat mengenai pentingnya nutrisi seimbang.', 'Gizi seimbang, generasi unggul bebas stunting.', false),
(5, 'Hari Kanker Sedunia', 4, 2, null, 'Peringatan kepedulian dan aksi global melawan kanker.', 'Peduli sedini mungkin, bersama lawan kanker.', false),
(5, 'Hari Pers Nasional (HPN)', 9, 2, null, 'Peringatan berdirinya PWI dan penghargaan atas peran pers bagi demokrasi bangsa.', 'Pers sehat, masyarakat cerdas, bangsa berdaulat.', false),
(5, 'Hari Peduli Sampah Nasional', 21, 2, null, 'Aksi nyata pengurangan sampah dan kelestarian lingkungan hidup.', 'Kelola sampah cerdas untuk bumi yang lestari.', false),
(4, 'Hari Penegakan Kedaulatan Negara', 1, 3, null, 'Peringatan Serangan Umum 1 Maret 1949 di Yogyakarta yang membuktikan eksistensi TNI dan RI.', 'Kedaulatan bangsa adalah kehormatan abadi.', false),
(5, 'Hari Musik Nasional', 9, 3, null, 'Peringatan hari lahir pahlawan nasional dan komponis lagu kebangsaan WR Soepratman.', 'Irama nada pemersatu harmoni nusantara.', false),
(5, 'Hari Film Nasional', 30, 3, null, 'Mengenang hari pertama pengambilan gambar film Darah dan Doa karya Usmar Ismail (1950).', 'Bangga karya sinema anak negeri.', false),
(5, 'Hari Nelayan Nasional', 6, 4, null, 'Apresiasi jasa nelayan dalam pemenuhan pangan bahari bangsa.', 'Penjaga laut tangguh, pilar pangan nusantara.', false),
(2, 'Hari Kartini', 21, 4, null, 'Peringatan kelahiran pahlawan emansipasi perempuan Indonesia RA Kartini.', 'Habis gelap terbitlah terang, perempuan berdaya bangsa berjaya.', false),
(5, 'Hari Bumi Internasional', 22, 4, null, 'Aksi global untuk pelestarian lingkungan dan keberlanjutan planet bumi.', 'Satu bumi untuk masa depan generasi kita.', false),
(1, 'Hari Buruh Internasional (May Day)', 1, 5, null, 'Penghormatan terhadap perjuangan hak dan martabat kaum pekerja sedunia.', 'Keringat pekerja adalah fondasi kemajuan ekonomi.', true),
(1, 'Hari Pendidikan Nasional (Hardiknas)', 2, 5, null, 'Peringatan hari lahir Ki Hadjar Dewantara, pelopor pendidikan rakyat Indonesia.', 'Ing ngarsa sung tulada, ing madya mangun karsa, tut wuri handayani.', false),
(2, 'Hari Kebangkitan Nasional (Harkitnas)', 20, 5, null, 'Peringatan berdirinya organisasi Boedi Oetomo 20 Mei 1908 sebagai tonggak kesadaran nasional.', 'Bangkit bersama, majukan Indonesia di panggung dunia.', false),
(1, 'Hari Lahir Pancasila', 1, 6, null, 'Mengenang pidato Ir. Soekarno dalam sidang BPUPKI tanggal 1 Juni 1945.', 'Pancasila jiwa pemersatu bangsa menuju Indonesia Emas.', true),
(5, 'Hari Lingkungan Hidup Sedunia', 5, 6, null, 'Aksi global pelestarian alam dan pengurangan polusi plastik.', 'Lestarikan alam, hijaukan masa depan.', false),
(5, 'Hari Bhayangkara (HUT Polri)', 1, 7, null, 'Peringatan hari kepolisian Republik Indonesia.', 'Polri presisi melayani dan mengayomi masyarakat.', false),
(5, 'Hari Anak Nasional', 23, 7, null, 'Perlindungan dan pemenuhan hak-hak tumbuh kembang anak Indonesia.', 'Anak terlindungi, Indonesia maju.', false),
(1, 'Hari Kemerdekaan Republik Indonesia (HUT RI)', 17, 8, null, 'Peringatan proklamasi kemerdekaan Republik Indonesia 17 Agustus 1945.', 'Dirgahayu Republik Indonesia! Merdeka berdaulat seutuhnya.', true),
(5, 'Hari Palang Merah Indonesia (PMI)', 17, 9, null, 'Penghargaan atas pengabdian relawan kemanusiaan di seluruh nusantara.', 'Setetes darah, sejuta senyuman harapan.', false),
(1, 'Hari Kesaktian Pancasila', 1, 10, null, 'Mengenang gugurnya pahlawan revolusi dan tegaknya ideologi Pancasila.', 'Pancasila sakti, pemersatu kebinekaan nusantara.', false),
(2, 'Hari Batik Nasional', 2, 10, null, 'Perayaan ditetapkannya batik sebagai Warisan Kemanusiaan untuk Budaya Lisan dan Nonbendawi oleh UNESCO.', 'Bangga berbatik, mahakarya luhur budaya nusantara.', false),
(4, 'Hari Tentara Nasional Indonesia (TNI)', 5, 10, null, 'Peringatan berdirinya Tentara Keamanan Rakyat (TKR) sebagai cikal bakal TNI.', 'TNI patriot NKRI, pengawal kedaulatan rakyat.', false),
(5, 'Hari Bahasa dan Sastra Indonesia', 20, 10, null, 'Bulan bahasa untuk menjunjung tinggi bahasa persatuan bahasa Indonesia.', 'Utamakan bahasa Indonesia, lestarikan bahasa daerah, kuasai bahasa asing.', false),
(1, 'Hari Sumpah Pemuda', 28, 10, null, 'Mengenang ikrar bersejarah para pemuda Indonesia dalam Kongres Pemuda II tahun 1928.', 'Satu tanah air, satu bangsa, satu bahasa persatuan.', false),
(4, 'Hari Pahlawan', 10, 11, null, 'Mengenang pertempuran heroik 10 November 1945 di Surabaya.', 'Pahlawanku teladanku, semangatmu baktiku untuk negeri.', false),
(5, 'Hari Guru Nasional', 25, 11, null, 'Peringatan hari lahir PGRI dan wujud terima kasih kepada para pendidik bangsa.', 'Guru pelita bangsa, pembuka gerbang peradaban cerdas.', false),
(2, 'Hari Ibu', 22, 12, null, 'Mengenang Kongres Perempuan Indonesia I tahun 1928 di Yogyakarta.', 'Kasih ibu sepanjang masa, perempuan berdaya keluarga bahagia.', false),
(3, 'Hari Raya Natal', 25, 12, null, 'Peringatan kelahiran Yesus Kristus bagi umat Kristiani.', 'Damai di bumi, sukacita bagi seluruh umat manusia.', true);

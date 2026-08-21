# ResQ Map — Product Requirements Document

## Problem Statement
Membangun aplikasi keselamatan mobile berbasis peta yang menampilkan laporan bencana dari komunitas, memperingatkan pengguna di sekitar, menyediakan SOS manual/otomatis saat jaringan lemah, dan mempertahankan komunikasi jarak dekat melalui Bluetooth ketika internet tidak tersedia.

## Product Scope
- Platform: iOS dan Android melalui Expo SDK 54.
- Bahasa: Bahasa Indonesia dan English.
- Peta: Mapbox native dengan fallback map-first untuk preview tanpa token/native module.
- Identitas: Emergent-managed Google OAuth; mode tamu dapat membaca peta.
- Backend: FastAPI + MongoDB.
- Offline: antrean SOS lokal dan BLE store-and-forward satu hop dengan TTL.

## Architecture
- **Frontend:** Expo Router, React Native, Safe Area, Reanimated-compatible UI, Mapbox native, expo-location, NetInfo, SecureStore, AsyncStorage.
- **Backend:** FastAPI REST API pada prefix `/api`, Motor/MongoDB, geospatial `2dsphere` indexes, bearer sessions.
- **Authentication:** callback Google ditukar server-side; session token disimpan aman di perangkat.
- **Emergency data:** laporan dan SOS memakai custom IDs, GeoJSON coordinates `[longitude, latitude]`, dan endpoint radius terdekat.
- **Offline transport:** `react-native-ble-plx` (GATT central) untuk mesh chat via Bluetooth Low Energy, dan `react-native-wifi-p2p` (Wi-Fi Direct) untuk pemindai perangkat terdekat sekaligus tautan chat bandwidth tinggi; keduanya digabung dalam composite transport yang menangani scan, connect, dan message delivery states.

## User Personas
1. **Warga terdampak:** membutuhkan SOS cepat, peta risiko, dan komunikasi saat internet terputus.
2. **Pelapor lokal:** mengirim laporan kebakaran, banjir, gempa, atau tabrakan dengan lokasi.
3. **Relawan/penolong:** memantau kejadian terdekat dan pesan darurat lokal.
4. **Pengguna tamu:** melihat kondisi sekitar tanpa membuat akun terlebih dahulu.

## Core Requirements (Static)
- Peta layar penuh dengan marker insiden dan status konektivitas.
- Laporan kejadian berbasis lokasi dengan jenis dan deskripsi.
- Peringatan kejadian/SOS dalam radius pengguna.
- SOS 5 detik yang dapat dibatalkan.
- SOS otomatis saat koneksi lemah/offline untuk pengguna yang sudah memberi lokasi.
- Antrean SOS dan pengiriman otomatis ketika koneksi kembali.
- Chat Bluetooth antarperangkat dengan status queued/relayed/delivered.
- Login Google dan penyimpanan sesi aman.
- UI bilingual, aksesibel, dan aman-area pada iOS/Android.

## Implemented
### 2026-08-19
- Selesai: autentikasi Google server-side, session persistence, guest map mode, dan logout.
- Selesai: REST API laporan, SOS idempotent, nearby alerts, validasi koordinat, dan indeks geospasial.
- Selesai: map-first dashboard, incident sheet, marker/detail card, network status, SOS countdown, queue/flush SOS.
- Selesai: reports feed dengan filter horizontal, empty/list states, dan target sentuh 44pt.
- Selesai: BLE transport native (scan/advertise/connect/GATT write), izin kontekstual, fallback preview, dan chat delivery states.
- Selesai: bilingual ID/EN, profil, permission rationale, safe areas, bottom tabs, toast, dan haptic feedback.
- Selesai: lint, TypeScript, Expo Doctor 18/18, backend API tests 8/8, dan frontend mobile-web regression.
- Selesai: revamp visual menyeluruh ke Material Design 3 dengan tonal surfaces, M3 navigation bar, choice chips, cards, FAB, dan filled/outlined buttons.
- Selesai: wizard laporan dua langkah berisi jenis kejadian, severity, deskripsi, jumlah korban, kebutuhan bantuan, lokasi, dan foto wajib.
- Selesai: unggah/download foto melalui Emergent Managed Object Storage; MongoDB hanya menyimpan metadata dan `photo_file_id`.
- Selesai: pengujian wizard terautentikasi, file chooser web, multipart upload, laporan lengkap, dan backend media workflow 16/16.
- Selesai: marker peta berwarna dan berikon per kategori dengan severity dot, filter horizontal, count badge, serta legenda eksplisit.
- Selesai: kartu informasi marker menampilkan severity, waktu, pelapor, deskripsi, korban, koordinat, kebutuhan bantuan, dan foto bukti publik.
  - Selesai: endpoint media insiden publik memverifikasi attachment sebelum menyajikan gambar; regresi backend langsung lulus 20/20.

### 2026-08-20
- Selesai: MESH CHAT fitur lengkap. Protokol envelope (chat/announce/presence/typing/receipt) dengan flood relay ber-TTL dan de-duplikasi antar-perangkat.
- Selesai: daftar percakapan per-peer + Siaran Mesh, badge pesan belum dibaca, preview, indikator online, dan indikator "sedang mengetik".
- Selesai: enkripsi end-to-end 1:1 via pairing (kode bersama + fingerprint keamanan, HKDF + AES-GCM/HMAC-keystream) dan receipt terkirim/dibaca.
- Selesai: persistensi lokal (AsyncStorage) untuk percakapan, riwayat pesan, identitas, dan pairing.
- Selesai: simulasi mesh di web (BroadcastChannel lintas-tab + ResQ Responder) agar fitur dapat diuji tanpa dua perangkat fisik; transport BLE native tetap membawa envelope via GATT.

## Prioritized Backlog
### P0
- Isi `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` dan native Mapbox download token untuk mengaktifkan tiles native.
- Uji BLE nyata pada dua perangkat: iPhone–iPhone, Android–Android, dan iPhone–Android.
- Validasi Google OAuth callback pada perangkat fisik iOS/Android.

### P1
- Enkripsi end-to-end tingkat pesan dengan identity keypair, pairing fingerprint/QR, nonce, dan replay protection.
- Push notification untuk alert radius saat aplikasi tidak aktif.
- Moderasi/verifikasi laporan, rate limiting, expiry, dan confidence score.
- Background location/SOS policy yang eksplisit dan hemat baterai.

### P2
- Clustering marker dan heatmap risiko untuk wilayah padat.
- Lampiran foto/video melalui managed object storage.
- Dashboard relawan dan status penanganan kejadian.
- Analitik keselamatan anonim dan ringkasan tren wilayah.

## Next Tasks
1. Masukkan token Mapbox dan verifikasi native map pada development build.
2. Jalankan matriks uji dua perangkat untuk Bluetooth dan permission denial/settings recovery.
3. Tambahkan notifikasi alert terdekat dan proses verifikasi laporan.
4. Hardening keamanan payload mesh sebelum penggunaan lapangan.
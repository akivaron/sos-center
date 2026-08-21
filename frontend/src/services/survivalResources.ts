import type { Coordinates, SurvivalResource, SurvivalResourceType } from "../types";
import { haversineMeters } from "../utils/geo";

export const SURVIVAL_RESOURCE_TYPES: SurvivalResourceType[] = [
  "water",
  "basecamp",
  "shelter",
  "food",
  "camping",
  "river",
  "settlement",
];

type Seed = {
  type: SurvivalResourceType;
  name: string;
  note: string;
  /** Offset in meters from the center along a bearing (for deterministic scatter). */
  bearingDeg: number;
  distanceM: number;
};

// Deterministic scatter so the resources stay stable across renders for a given center.
const SEEDS: Seed[] = [
  { type: "water", name: "Mata Air Ciomas", note: "Air bersih dari mata air pegunungan.", bearingDeg: 28, distanceM: 480 },
  { type: "water", name: "Sumur Bor Dusun II", note: "Sumur bor desa, ada ember pinjaman.", bearingDeg: 132, distanceM: 920 },
  { type: "water", name: "Sungai Jernih Cibalok", note: "Aliran air jernih, perlu disaring.", bearingDeg: 220, distanceM: 1450 },
  { type: "water", name: "Tandon Air Posko", note: "Tandon air bersih di posko relawan.", bearingDeg: 305, distanceM: 760 },
  { type: "basecamp", name: "Basecamp Gunung Putri", note: "Pos komando relawan, sinyal baik.", bearingDeg: 64, distanceM: 640 },
  { type: "basecamp", name: "Basecamp Lapangan Desa", note: "Titik kumpul darurat warga.", bearingDeg: 158, distanceM: 1120 },
  { type: "basecamp", name: "Basecamp Cagar Alam", note: "Pusat koordinasi SAR.", bearingDeg: 248, distanceM: 1700 },
  { type: "shelter", name: "Shelter Balai Desa", note: "Pengungsian tertutup, kapasitas 80.", bearingDeg: 42, distanceM: 560 },
  { type: "shelter", name: "Shelter GOR Kecamatan", note: "Gedung olahraga, kasur tersedia.", bearingDeg: 142, distanceM: 1340 },
  { type: "shelter", name: "Shelter Sekolah Dasar", note: "Kelas dipakai pengungsian sementara.", bearingDeg: 205, distanceM: 980 },
  { type: "food", name: "Dapur Umum Posko", note: "Makanan siap saji tiap 12.00 & 18.00.", bearingDeg: 96, distanceM: 700 },
  { type: "food", name: "Warung Air & Sembako", note: "Stok air galon dan mi instan.", bearingDeg: 176, distanceM: 1040 },
  { type: "food", name: "Kebun Sayur Warga", note: "Sayur segar, bisa dipetik untuk kelompok.", bearingDeg: 268, distanceM: 1280 },
  { type: "camping", name: "Ground Camp Cibodas", note: "Lahan datar untuk tenda, aman longsor.", bearingDeg: 18, distanceM: 880 },
  { type: "camping", name: "Bumi Perkemahan Hutan", note: "Area kemah terbuka, dekat sumber air.", bearingDeg: 118, distanceM: 1560 },
  { type: "camping", name: "Ladang Terbuka Selatan", note: "Tempat mendirikan tenda darurat.", bearingDeg: 232, distanceM: 1220 },
  { type: "river", name: "Sungai Ciliwung Hulu", note: "Aliran deras, cocok untuk air bersih.", bearingDeg: 50, distanceM: 1020 },
  { type: "river", name: "Sungai Cisadane", note: "Air tenang, bisa dilintasi untuk evakuasi.", bearingDeg: 150, distanceM: 1640 },
  { type: "river", name: "Anak Sungai Cibalok", note: "Cabang sungai, debit rendah.", bearingDeg: 290, distanceM: 1180 },
  { type: "settlement", name: "Pemukiman Dusun Krajan", note: "Perkampungan warga, bisa minta bantuan.", bearingDeg: 74, distanceM: 540 },
  { type: "settlement", name: "Pemukiman Pinggir Kali", note: "Rumah warga berjejer dekat sungai.", bearingDeg: 168, distanceM: 900 },
  { type: "settlement", name: "Kampung Sejahtera", note: "Pusat aktivitas warga setempat.", bearingDeg: 256, distanceM: 1360 },
];

const metersToCoord = (center: Coordinates, bearingDeg: number, distanceM: number): Coordinates => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const lat1 = rad(center.latitude);
  const lon1 = rad(center.longitude);
  const b = rad(bearingDeg);
  const dr = distanceM / R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dr) + Math.cos(lat1) * Math.sin(dr) * Math.cos(b));
  const lon2 =
    lon1 + Math.atan2(Math.sin(b) * Math.sin(dr) * Math.cos(lat1), Math.cos(dr) - Math.sin(lat1) * Math.sin(lat2));
  return { latitude: (lat2 * 180) / Math.PI, longitude: (lon2 * 180) / Math.PI };
};

/** Build a deterministic set of survival resources scattered around the given center. */
export function buildSurvivalResources(center: Coordinates): SurvivalResource[] {
  return SEEDS.map((seed, index) => {
    const coords = metersToCoord(center, seed.bearingDeg, seed.distanceM);
    return {
      id: `sr-${index}`,
      type: seed.type,
      name: seed.name,
      note: seed.note,
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
  });
}

/** Return resources of a type (or all), sorted by distance from `from`, with distance attached. */
export function nearestResources(
  from: Coordinates,
  resources: SurvivalResource[],
  type: SurvivalResourceType | "all" = "all",
): SurvivalResource[] {
  return resources
    .filter((item) => type === "all" || item.type === type)
    .map((item) => ({ ...item, distance_meters: Math.round(haversineMeters(from, item)) }))
    .sort((a, b) => (a.distance_meters ?? 0) - (b.distance_meters ?? 0));
}

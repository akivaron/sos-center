import type { MaterialCommunityIcons } from "@expo/vector-icons";

export type TutorialCategoryId =
  | "urgent"
  | "optional"
  | "trick"
  | "firstaid"
  | "water"
  | "signal";

export type TutorialPriority = "urgent" | "optional" | "trick";

export type Localized = { id: string; en: string };

export type TutorialItem = {
  id: string;
  category: TutorialCategoryId;
  priority: TutorialPriority;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: Localized;
  summary: Localized;
  steps: { id: string[]; en: string[] };
};

export type TutorialCategory = {
  id: TutorialCategoryId;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: Localized;
};

export const TUTORIAL_CATEGORIES: TutorialCategory[] = [
  { id: "urgent", icon: "alert-octagon-outline", label: { id: "Darurat", en: "Urgent" } },
  { id: "optional", icon: "clipboard-check-outline", label: { id: "Persiapan", en: "Optional" } },
  { id: "trick", icon: "lightbulb-on-outline", label: { id: "Trik", en: "Tricks" } },
  { id: "firstaid", icon: "medical-bag", label: { id: "P3K", en: "First Aid" } },
  { id: "water", icon: "water-outline", label: { id: "Air & Makanan", en: "Water & Food" } },
  { id: "signal", icon: "broadcast", label: { id: "Sinyal", en: "Signal" } },
];

const PRIORITY_RANK: Record<TutorialPriority, number> = {
  urgent: 0,
  optional: 1,
  trick: 2,
};

export const TUTORIAL_PRIORITY_LABEL: Record<TutorialPriority, Localized> = {
  urgent: { id: "Segera", en: "Urgent" },
  optional: { id: "Opsional", en: "Optional" },
  trick: { id: "Trik", en: "Trick" },
};

export const TUTORIAL_ITEMS: TutorialItem[] = [
  // ---- URGENT ----
  {
    id: "stop-breathe",
    category: "urgent",
    priority: "urgent",
    icon: "brain",
    title: { id: "STOP: Tenang sebelum bertindak", en: "STOP: Stay calm before acting" },
    summary: { id: "Saat panik, keputusan memburuk. Tarik napas dan susun rencana singkat.", en: "Panic clouds judgement. Breathe and make a short plan." },
    steps: {
      id: [
        "Berhenti bergerak, tarik napas perlahan 3 kali.",
        "Pikirkan: aman tidak dari bahaya saat ini?",
        "Tentukan satu tindakan paling penting (lindungi diri, hubungi bantuan).",
        "Baru jalankan tindakan itu secara tenang.",
      ],
      en: [
        "Stop moving and take 3 slow breaths.",
        "Ask: am I safe from the immediate danger?",
        "Pick the single most important action (protect yourself, call for help).",
        "Then carry out that action calmly.",
      ],
    },
  },
  {
    id: "shelter-now",
    category: "urgent",
    priority: "urgent",
    icon: "home-alert",
    title: { id: "Lindungi diri dari cuaca ekstrem", en: "Get out of the elements now" },
    summary: { id: "Hipotermia dan heatstroke membunuh lebih cepat dari kelaparan. Cari perlindungan dulu.", en: "Exposure kills faster than hunger. Find shelter before anything else." },
    steps: {
      id: [
        "Hindari tempat rendah saat banjir dan bawah pohon saat badai/petir.",
        "Gunakan apa pun yang ada: terpal, ponco, karton, ranting.",
        "Blokir angin dan jaga lantai tetap kering dengan daun/rubber.",
        "Kecilkan ruang agar tubuh sendiri menghangatkan area.",
      ],
      en: [
        "Avoid low ground in floods and under trees in storms.",
        "Use whatever you have: tarp, poncho, cardboard, branches.",
        "Block wind and keep the floor dry with leaves or matting.",
        "Make the space small so your body heat fills it.",
      ],
    },
  },
  // ---- OPTIONAL / PREP ----
  {
    id: "go-bag",
    category: "optional",
    priority: "optional",
    icon: "bag-personal-outline",
    title: { id: "Siapkan tas siaga 72 jam", en: "Pack a 72-hour go-bag" },
    summary: { id: "Siapkan di rumah sebelum bencana. Isi ringkas tapi lengkap.", en: "Prepare at home before disaster strikes. Compact but complete." },
    steps: {
      id: [
        "Air 3 liter/orang, makanan kaleng/energi, sendok lipat.",
        "Senter, baterai, peluit, dan pisau multifungsi.",
        "Obat pribadi, P3K, masker, dan salinan dokumen.",
        "Uang tunai, power bank, dan pakaian ganti.",
      ],
      en: [
        "3 L water per person, canned/energy food, foldable spoon.",
        "Flashlight, batteries, whistle, multi-tool.",
        "Personal meds, first-aid kit, mask, document copies.",
        "Cash, power bank, change of clothes.",
      ],
    },
  },
  {
    id: "meeting-point",
    category: "optional",
    priority: "optional",
    icon: "map-marker-path",
    title: { id: "Tetapkan titik kumpul keluarga", en: "Set a family meeting point" },
    summary: { id: "Saat sinyal mati, semua anggota tahu ke mana pergi.", en: "When signals die, everyone knows where to go." },
    steps: {
      id: [
        "Pilih dua titik: dekat rumah dan luar lingkungan.",
        "Latih jalur jalan kaki, bukan rute yang butuh kendaraan.",
        "Tetapkan satu kerabat di luar kota sebagai kontak pantau.",
        "Tulis nomor darurat di kartu untuk tiap anggota.",
      ],
      en: [
        "Pick two points: near home and outside the area.",
        "Rehearse a walking route, not one that needs a vehicle.",
        "Name one out-of-town relative as the check-in contact.",
        "Write emergency numbers on a card for each member.",
      ],
    },
  },
  // ---- TRICKS ----
  {
    id: "charger-trick",
    category: "trick",
    priority: "trick",
    icon: "battery-charging-10",
    title: { id: "Isi daya HP tanpa listrik", en: "Charge a phone without power" },
    summary: { id: "Trik darurat mengambil listrik dari sumber tak terduga.", en: "Emergency tricks to pull power from unexpected sources." },
    steps: {
      id: [
        "Baterai AA + penjepit kertas bisa jadi sumber 1.5V ke kabel.",
        "Power bank diisi lewat panel surya mini atau dinamo sepeda.",
        "Matikan data, turunkan layar, mode pesawat untuk tahan baterai.",
        "SMS butuh sinyal lebih lemah daripada telepon/Internet.",
      ],
      en: [
        "AA batteries + paperclips can act as a 1.5V source via wires.",
        "Top up a power bank with a mini solar panel or bike dynamo.",
        "Turn off data, dim screen, airplane mode to save battery.",
        "SMS needs weaker signal than calls or the Internet.",
      ],
    },
  },
  {
    id: "water-catch",
    category: "trick",
    priority: "trick",
    icon: "weather-rainy",
    title: { id: "Kumpulkan air hujan & embun", en: "Collect rain and dew" },
    summary: { id: "Plastik dan tali cukup untuk menangkap air minum.", en: "Plastic and string are enough to catch drinking water." },
    steps: {
      id: [
        "Kantong plastik diikat ke ranting berdaun, air embun menetes ke bawah.",
        "Terpal miring mengalirkan air hujan ke ember.",
        "Kondensasi: botol hitam di lubang tanah tertutup plastik berbatu.",
        "Saring dengan kain sebelum dimasak/rebus.",
      ],
      en: [
        "Bag tied around leafy branch collects dripping dew.",
        "Slanted tarp channels rainwater into a bucket.",
        "Condensation: dark bottle in soil pit covered by stoned plastic.",
        "Filter through cloth before boiling.",
      ],
    },
  },
  // ---- FIRST AID ----
  {
    id: "bleeding",
    category: "firstaid",
    priority: "urgent",
    icon: "bandage",
    title: { id: "Hentikan pendarahan parah", en: "Stop heavy bleeding" },
    summary: { id: "Tekanan langsung menyelamatkan nyawa sebelum bantuan tiba.", en: "Direct pressure saves lives before help arrives." },
    steps: {
      id: [
        "Tekan luka kuat-kuat dengan kain bersih, jangan lepas.",
        "Tambahkan lapisan di atasnya bila basah, jangan buka yang lama.",
        "Angkat bagian tubuh bila tidak ada patah tulang.",
        "Tourniquet hanya untuk pendarahan mematikan di lengan/kaki.",
      ],
      en: [
        "Press firmly with a clean cloth and do not remove it.",
        "Add layers on top if soaked; don't lift the first one.",
        "Elevate the limb if no broken bones are suspected.",
        "Use a tourniquet only for life-threatening limb bleeding.",
      ],
    },
  },
  {
    id: "cpr",
    category: "firstaid",
    priority: "urgent",
    icon: "heart-pulse",
    title: { id: "CPR dasar (tidak bernapas)", en: "Basic CPR (not breathing)" },
    summary: { id: "Kompresi dada tetap mengalirkan darah hingga ambulans tiba.", en: "Chest compressions keep blood flowing until EMS arrives." },
    steps: {
      id: [
        "Pastikan aman, panggil bantuan, cek napas 10 detik.",
        "Tengah dada, tekan 5–6 cm, 100–120 kali/menit.",
        "Lanjutkan tanpa henti, gantian bila lelah.",
        "Gunakan AED bila ada, ikuti suara perangkat.",
      ],
      en: [
        "Ensure safety, call for help, check breathing for 10s.",
        "Center of chest, press 5–6 cm deep, 100–120/min.",
        "Keep going without pause; swap if tired.",
        "Use an AED if available and follow its prompts.",
      ],
    },
  },
  // ---- WATER & FOOD ----
  {
    id: "purify-water",
    category: "water",
    priority: "optional",
    icon: "water-pump",
    title: { id: "Bersihkan air keruh jadi minum", en: "Make murky water drinkable" },
    summary: { id: "Saring lalu rebus. Rebusan 1 menit cukup membunuh kuman.", en: "Filter then boil. One minute of boiling kills germs." },
    steps: {
      id: [
        "Saring dengan kain bersih berisi pasir/arang.",
        "Biarkan mengendap, ambil air bagian atas yang jernih.",
        "Rebus minimal 1 menit (3 menit di dataran tinggi).",
        "Bila tak bisa rebus, pakai obat tetra atau filter lipat.",
      ],
      en: [
        "Filter through cloth packed with sand or charcoal.",
        "Let silt settle and take the clear top water.",
        "Boil at least 1 minute (3 at high altitude).",
        "If you can't boil, use purification tabs or a filter.",
      ],
    },
  },
  {
    id: "forage-safe",
    category: "water",
    priority: "optional",
    icon: "food-apple",
    title: { id: "Makanan darurat yang aman", en: "Safe emergency food" },
    summary: { id: "Hindari tanaman tak dikenal. Pilih yang yakin dan masak matang.", en: "Avoid unknown plants. Choose what you know and cook it." },
    steps: {
      id: [
        "Makan hanya tanaman yang kamu kenali pasti bisa dimakan.",
        "Uji kulit: tempel di lengan, tunggu 15 menit cari iritasi.",
        "Masak matang untuk membunuh bakteri dan racun ringan.",
        "Cacing/serangga berprotein, panggang dulu sebelum makan.",
      ],
      en: [
        "Eat only plants you are certain are edible.",
        "Skin test: place on forearm, wait 15 min for a reaction.",
        "Cook thoroughly to kill bacteria and mild toxins.",
        "Worms/insects are protein—roast before eating.",
      ],
    },
  },
  // ---- SIGNAL ----
  {
    id: "signal-sos",
    category: "signal",
    priority: "urgent",
    icon: "signal-5g",
    title: { id: "Kirim sinyal SOS darat", en: "Send a ground SOS signal" },
    summary: { id: "Tiga titik, tiga garis, tiga titik — pola SOS universal.", en: "Three dots, three dashes, three dots — the universal SOS." },
    steps: {
      id: [
        "Susun batu/kayu di tanah terbuka membentuk SOS raksasa.",
        "Gunakan cermin ke arah pesawat/helikopter: kilat 3-3-3.",
        "Peluit: 3 tiupan pendek berulang untuk panggilan darurat.",
        "Api siang = asap (daun basah), malam = nyala terang.",
      ],
      en: [
        "Arrange rocks/wood in the open to spell a giant SOS.",
        "Flash a mirror at aircraft: 3-3-3 blinks.",
        "Whistle: three short blasts repeated is the emergency call.",
        "Day fire = smoke (wet leaves), night fire = bright flame.",
      ],
    },
  },
  {
    id: "offline-comms",
    category: "signal",
    priority: "optional",
    icon: "bluetooth-connect",
    title: { id: "Berkomunikasi tanpa internet", en: "Communicate without internet" },
    summary: { id: "ResQ Mesh meneruskan pesan lewat Bluetooth antar-perangkat.", en: "ResQ Mesh relays messages over Bluetooth between devices." },
    steps: {
      id: [
        "Nyalakan Bluetooth Mesh di tab Mesh Chat.",
        "Pesan diteruskan perangkat ke perangkat hingga sampai tujuan.",
        "Status antre/diteruskan/terkirim menunjukkan progres.",
        "Dekatkan diri ke pengguna ResQ lain untuk jangkauan lebih baik.",
      ],
      en: [
        "Enable Bluetooth Mesh on the Mesh Chat tab.",
        "Messages hop device-to-device until they reach the target.",
        "Queued / relayed / delivered statuses show progress.",
        "Move closer to another ResQ user for better range.",
      ],
    },
  },
];

export function getTutorialItems(category: TutorialCategoryId | "all"): TutorialItem[] {
  const list = category === "all" ? TUTORIAL_ITEMS : TUTORIAL_ITEMS.filter((item) => item.category === category);
  return [...list].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
}

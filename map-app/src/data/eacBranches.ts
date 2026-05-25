export interface EacBranch {
  id: number;
  name: string;
  area: string;
  region: string;
  regionCode: string;
  x: number;
  y: number;
  special: boolean;
  highlighted: boolean;
}

export const eacBranches: EacBranch[] = [
  // === Sulawesi Selatan (15 cabang) ===
  { id: 1,  name: "Gowa",           area: "Sungguminasa",       region: "Sulawesi Selatan",  regionCode: "IDSN", x: 536, y: 228, special: false, highlighted: false },
  { id: 2,  name: "Makassar",       area: "Baruga",             region: "Sulawesi Selatan",  regionCode: "IDSN", x: 534, y: 214, special: false, highlighted: false },
  { id: 3,  name: "Makassar",       area: "Cendrawasih",        region: "Sulawesi Selatan",  regionCode: "IDSN", x: 540, y: 216, special: false, highlighted: false },
  { id: 4,  name: "Makassar",       area: "Hertasning Plus",    region: "Sulawesi Selatan",  regionCode: "IDSN", x: 537, y: 222, special: false, highlighted: false },
  { id: 5,  name: "Makassar",       area: "Sudiang",            region: "Sulawesi Selatan",  regionCode: "IDSN", x: 543, y: 220, special: false, highlighted: false },
  { id: 6,  name: "Palopo",         area: "Andi Kambo",         region: "Sulawesi Selatan",  regionCode: "IDSN", x: 542, y: 193, special: false, highlighted: false },
  { id: 7,  name: "Parepare",       area: "Mattirotasi",        region: "Sulawesi Selatan",  regionCode: "IDSN", x: 520, y: 213, special: false, highlighted: false },
  { id: 8,  name: "Tana Toraja",    area: "Makale",             region: "Sulawesi Selatan",  regionCode: "IDSN", x: 548, y: 200, special: false, highlighted: false },
  { id: 9,  name: "Toraja Utara",   area: "Poros Bolu",         region: "Sulawesi Selatan",  regionCode: "IDSN", x: 554, y: 195, special: false, highlighted: false },
  { id: 10, name: "Bone",           area: "Ahmad Yani",         region: "Sulawesi Selatan",  regionCode: "IDSN", x: 566, y: 218, special: true,  highlighted: false },
  { id: 11, name: "Bulukumba",      area: "Jend. Sudirman",     region: "Sulawesi Selatan",  regionCode: "IDSN", x: 558, y: 232, special: true,  highlighted: false },
  { id: 12, name: "Pangkep",        area: "Sultan Hasanuddin",  region: "Sulawesi Selatan",  regionCode: "IDSN", x: 524, y: 226, special: true,  highlighted: false },
  { id: 13, name: "Pinrang",        area: "Jend. Sudirman",     region: "Sulawesi Selatan",  regionCode: "IDSN", x: 518, y: 220, special: true,  highlighted: false },
  { id: 14, name: "Sidrap",         area: "Sidrap",             region: "Sulawesi Selatan",  regionCode: "IDSN", x: 530, y: 204, special: true,  highlighted: true },
  { id: 15, name: "Soppeng",        area: "Lalabata",           region: "Sulawesi Selatan",  regionCode: "IDSN", x: 548, y: 208, special: true,  highlighted: false },

  // === Sulawesi Tengah (3 cabang) ===
  { id: 16, name: "Palu",           area: "Jend. Sudirman Plus", region: "Sulawesi Tengah",   regionCode: "IDST", x: 575, y: 148, special: false, highlighted: false },
  { id: 17, name: "Toli-Toli",      area: "KH. Wahid Hasyim",    region: "Sulawesi Tengah",   regionCode: "IDST", x: 580, y: 128, special: false, highlighted: false },
  { id: 18, name: "Parigi Moutong", area: "Trans Sulawesi",      region: "Sulawesi Tengah",   regionCode: "IDST", x: 568, y: 168, special: true,  highlighted: false },

  // === Sulawesi Tenggara (4 cabang) ===
  { id: 19, name: "Kendari",        area: "Abdullah Silondae",  region: "Sulawesi Tenggara", regionCode: "IDSG", x: 585, y: 220, special: false, highlighted: false },
  { id: 20, name: "Baubau",         area: "Batara Guru",        region: "Sulawesi Tenggara", regionCode: "IDSG", x: 580, y: 238, special: true,  highlighted: false },
  { id: 21, name: "Kolaka",         area: "Pramuka",            region: "Sulawesi Tenggara", regionCode: "IDSG", x: 568, y: 228, special: true,  highlighted: false },
  { id: 22, name: "Raha",           area: "Gatot Subroto",       region: "Sulawesi Tenggara", regionCode: "IDSG", x: 602, y: 232, special: true,  highlighted: false },

  // === Sulawesi Utara (3 cabang) ===
  { id: 23, name: "Bitung",         area: "Girian",             region: "Sulawesi Utara",   regionCode: "IDSA", x: 656, y: 93,  special: false, highlighted: false },
  { id: 24, name: "Manado",         area: "Wenang Selatan Plus",region: "Sulawesi Utara",   regionCode: "IDSA", x: 640, y: 88,  special: false, highlighted: false },
  { id: 25, name: "Tomohon",        area: "Matani",             region: "Sulawesi Utara",   regionCode: "IDSA", x: 636, y: 102, special: false, highlighted: false },

  // === Sulawesi Barat (3 cabang) ===
  { id: 26, name: "Mamuju",         area: "Sultan Hasanuddin",  region: "Sulawesi Barat",   regionCode: "IDSR", x: 527, y: 178, special: false, highlighted: false },
  { id: 27, name: "Polewali Mandar",area: "Andi Depu",          region: "Sulawesi Barat",   regionCode: "IDSR", x: 521, y: 190, special: false, highlighted: false },
  { id: 28, name: "Gorontalo",      area: "Nani Wartabone",     region: "Gorontalo",         regionCode: "IDGO", x: 586, y: 120, special: false, highlighted: false },

  // === Maluku Utara / Maluku (2 cabang) ===
  { id: 29, name: "Ternate",        area: "Takoma",             region: "Maluku Utara",     regionCode: "IDMU", x: 686, y: 134, special: false, highlighted: false },
  { id: 30, name: "Ambon",          area: "Ambon",              region: "Maluku",            regionCode: "IDMA", x: 751, y: 248, special: true,  highlighted: true },

  // === Papua / Papua Barat Daya (2 cabang) ===
  { id: 31, name: "Jayapura",       area: "Padang Bulan",       region: "Papua",             regionCode: "IDPA", x: 902, y: 198, special: false, highlighted: false },
  { id: 32, name: "Sorong",         area: "Pramuka",            region: "Papua Barat",       regionCode: "IDPB", x: 786, y: 170, special: false, highlighted: false },
];

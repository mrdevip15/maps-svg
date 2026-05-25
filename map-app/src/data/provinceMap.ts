// Maps SVG path index → province code
// Derived from SimpleMaps color assignments
// Sulawesi (6), Maluku (2), Papua (2) = 10 target provinces
export const pathToProvince: Record<number, string> = {
  // Sulawesi
  1:  "IDGO",  // #4A90E2 - Gorontalo
  23: "IDSN",  // #8E44AD - Sulawesi Selatan
  25: "IDSG",  // #3498DB - Sulawesi Tenggara
  27: "IDSA",  // #2D5AA6 - Sulawesi Utara (default color, utara Sulawesi)
  30: "IDST",  // #16A085 - Sulawesi Tengah
  32: "IDSR",  // #D68910 - Sulawesi Barat
  // Maluku
  24: "IDMU",  // #E8907B - Maluku Utara
  29: "IDMA",  // #E74C3C - Maluku
  // Papua
  8:  "IDPB",  // #7FD8BE - Papua Barat
  9:  "IDPA",  // #27AE60 - Papua
};

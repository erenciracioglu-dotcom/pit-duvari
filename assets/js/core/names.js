// Ortak adlar: hem tarayici hem de Node veri hatti (takvim .ics) kullanir.
// F1DB grandPrixId -> Turkce kisa ad.
export const GP_TR = {
  '70th-anniversary': '70. Yıl GP',
  'abu-dhabi': 'Abu Dabi GP',
  'argentina': 'Arjantin GP',
  'australia': 'Avustralya GP',
  'austria': 'Avusturya GP',
  'azerbaijan': 'Azerbaycan GP',
  'bahrain': 'Bahreyn GP',
  'barcelona-catalunya': 'Barselona-Katalonya GP',
  'belgium': 'Belçika GP',
  'brazil': 'Brezilya GP',
  'caesars-palace': 'Caesars Palace GP',
  'canada': 'Kanada GP',
  'china': 'Çin GP',
  'dallas': 'Dallas GP',
  'detroit': 'Detroit GP',
  'eifel': 'Eifel GP',
  'emilia-romagna': 'Emilia-Romagna GP',
  'europe': 'Avrupa GP',
  'france': 'Fransa GP',
  'germany': 'Almanya GP',
  'great-britain': 'İngiltere GP',
  'hungary': 'Macaristan GP',
  'india': 'Hindistan GP',
  'indianapolis': 'Indianapolis 500',
  'italy': 'İtalya GP',
  'japan': 'Japonya GP',
  'korea': 'Kore GP',
  'las-vegas': 'Las Vegas GP',
  'luxembourg': 'Lüksemburg GP',
  'malaysia': 'Malezya GP',
  'mexico': 'Meksika GP',
  'miami': 'Miami GP',
  'monaco': 'Monako GP',
  'morocco': 'Fas GP',
  'netherlands': 'Hollanda GP',
  'pacific': 'Pasifik GP',
  'pescara': 'Pescara GP',
  'portugal': 'Portekiz GP',
  'qatar': 'Katar GP',
  'russia': 'Rusya GP',
  'sakhir': 'Sakhir GP',
  'san-marino': 'San Marino GP',
  'sao-paulo': 'São Paulo GP',
  'saudi-arabia': 'Suudi Arabistan GP',
  'singapore': 'Singapur GP',
  'south-africa': 'Güney Afrika GP',
  'spain': 'İspanya GP',
  'styria': 'Steiermark GP',
  'sweden': 'İsveç GP',
  'switzerland': 'İsviçre GP',
  'turkey': 'Türkiye GP',
  'tuscany': 'Toskana GP',
  'united-states-west': 'ABD Batı GP',
  'united-states': 'ABD GP'
};

// Seans anahtarlari: fp1, fp2, fp3, sq (sprint siralama), spr (sprint), q (siralama), r (yaris)
export const SESSION_ORDER = ['fp1', 'fp2', 'fp3', 'sq', 'spr', 'q', 'r'];
export const SESSION_LABEL = {
  tr: { fp1: '1. Antrenman', fp2: '2. Antrenman', fp3: '3. Antrenman', sq: 'Sprint Sıralama', spr: 'Sprint', q: 'Sıralama', r: 'Yarış' },
  en: { fp1: 'Practice 1', fp2: 'Practice 2', fp3: 'Practice 3', sq: 'Sprint Qualifying', spr: 'Sprint', q: 'Qualifying', r: 'Race' }
};
export const SESSION_SHORT = {
  tr: { fp1: 'A1', fp2: 'A2', fp3: 'A3', sq: 'SS', spr: 'Sprint', q: 'Sıralama', r: 'Yarış' },
  en: { fp1: 'FP1', fp2: 'FP2', fp3: 'FP3', sq: 'SQ', spr: 'Sprint', q: 'Quali', r: 'Race' }
};
// Seanslarin yaklasik suresi (dakika): canli/bitmis ayrimi ve takvim etkinlikleri icin.
export const SESSION_MINUTES = { fp1: 60, fp2: 60, fp3: 60, sq: 45, spr: 45, q: 60, r: 120 };

// F1DB reasonRetired -> Turkce
export const REASON_TR = {
  'Accident': 'Kaza', 'Collision': 'Çarpışma', 'Collision damage': 'Çarpışma hasarı', 'Spun off': 'Pistten çıktı',
  'Engine': 'Motor', 'Power Unit': 'Güç ünitesi', 'Power unit': 'Güç ünitesi', 'Gearbox': 'Şanzıman', 'Transmission': 'Aktarma',
  'Hydraulics': 'Hidrolik', 'Brakes': 'Frenler', 'Suspension': 'Süspansiyon', 'Electrical': 'Elektrik', 'Electronics': 'Elektronik',
  'Retired': 'Bıraktı', 'Withdrew': 'Çekildi', 'Disqualified': 'Diskalifiye', 'Overheating': 'Aşırı ısınma', 'Puncture': 'Lastik patladı',
  'Wheel': 'Tekerlek', 'Fuel pressure': 'Yakıt basıncı', 'Fuel system': 'Yakıt sistemi', 'Oil leak': 'Yağ kaçağı', 'Water leak': 'Su kaçağı',
  'Cooling system': 'Soğutma sistemi', 'Damage': 'Hasar', 'Driveshaft': 'Aks', 'Steering': 'Direksiyon', 'Turbo': 'Turbo',
  'ERS': 'ERS', 'Energy store': 'Enerji deposu', 'Exhaust': 'Egzoz', 'Clutch': 'Debriyaj', 'Throttle': 'Gaz kelebeği',
  'Mechanical': 'Mekanik', 'Illness': 'Hastalık', 'Injury': 'Sakatlık', 'Did not start': 'Start almadı', 'Not classified': 'Sınıflandırılmadı',
  'Fuel pump': 'Yakıt pompası', 'Wheel nut': 'Bijon', 'Tyre': 'Lastik', 'Front wing': 'Ön kanat', 'Rear wing': 'Arka kanat',
  'Debris': 'Parça hasarı', 'Battery': 'Batarya', 'Vibrations': 'Titreşim', 'Out of fuel': 'Yakıt bitti', 'Fire': 'Yangın'
};

// Yaris kontrol mesaj tipleri
export const TYRE = {
  SOFT: { c: '#FF3B3B', tr: 'Yumuşak', en: 'Soft', k: 'S' },
  MEDIUM: { c: '#FFD43B', tr: 'Orta', en: 'Medium', k: 'M' },
  HARD: { c: '#EDEFF2', tr: 'Sert', en: 'Hard', k: 'H' },
  INTERMEDIATE: { c: '#3CCB5A', tr: 'Ara', en: 'Inter', k: 'I' },
  WET: { c: '#2F80ED', tr: 'Islak', en: 'Wet', k: 'W' },
  UNKNOWN: { c: '#8796A5', tr: 'Bilinmiyor', en: 'Unknown', k: '?' }
};

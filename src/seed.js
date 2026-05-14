const { getDb, closeDb } = require('./config/database');
const { migrate } = require('./migrate');

function seed() {
  migrate();
  const db = getDb();

  // =========================================================================
  // UNSPLASH PHOTO IDS BY MAKE
  // =========================================================================
  const photoIds = {
    'BMW':           ['1555215695-3004980ad54e', '1617814076367-b28942f1558e', '1556189250-72ba954cfc2b'],
    'Mercedes-Benz': ['1618843479619-f3d0d81e4d10', '1563720223185-11003d516935', '1606016159991-dfe4f2746ad5'],
    'Audi':          ['1606664515524-ed2f786a0bd6', '1603584173870-7f23fdae1b7a', '1614200187524-dc4b892acf16'],
    'VW':            ['1609521263047-f8f205293f24', '1575090536534-5d5c70a7f7d5', '1471479917193-f00955256257'],
    'Porsche':       ['1503376780353-7e6692767b70', '1544636331-e26879cd4d9b', '1611859266261-c27b8f4a17f3'],
    'Opel':          ['1494976388531-d1058494cdd8', '1502877338535-766e1452684a', '1549399542-7e3f8b79c341'],
    'Skoda':         ['1552519507-da3b142c6e3b', '1580273916550-e323be2ae537', '1494976388531-d1058494cdd8'],
    'Ford':          ['1502877338535-766e1452684a', '1549399542-7e3f8b79c341', '1552519507-da3b142c6e3b'],
    'Toyota':        ['1580273916550-e323be2ae537', '1494976388531-d1058494cdd8', '1502877338535-766e1452684a'],
    'Hyundai':       ['1549399542-7e3f8b79c341', '1552519507-da3b142c6e3b', '1580273916550-e323be2ae537'],
    'Seat':          ['1494976388531-d1058494cdd8', '1580273916550-e323be2ae537', '1502877338535-766e1452684a'],
    'Renault':       ['1552519507-da3b142c6e3b', '1494976388531-d1058494cdd8', '1549399542-7e3f8b79c341'],
    'SUV':           ['1519641471654-76ce0107ad1b', '1533473359331-2f64c6aca49c'],
  };

  function imageUrl(make, index) {
    const ids = photoIds[make] || photoIds['Opel'];
    const id = ids[index % ids.length];
    return `https://images.unsplash.com/photo-${id}?w=600&h=400&fit=crop`;
  }

  // =========================================================================
  // 1. DEALERS (12 total)
  // =========================================================================
  console.log('Seeding dealers...');
  const dealers = [
    { id: 'D001', name: 'Autohaus Müller',         plz: '80331', email: 'mueller@autohaus.de',       phone: '+49 89 1234567',   spec: 'BMW, Mercedes Specialist',   radius: 200 },
    { id: 'D002', name: 'Auto König GmbH',         plz: '40210', email: 'info@autokoenig.de',        phone: '+49 211 9876543',  spec: 'VW, Opel, Skoda',           radius: 150 },
    { id: 'D003', name: 'Schmidt Automobile',       plz: '10115', email: 'kontakt@schmidt-auto.de',   phone: '+49 30 5551234',   spec: 'All brands',                radius: 250 },
    { id: 'D004', name: 'Fahrzeughaus Weber',       plz: '60311', email: 'weber@fhw.de',              phone: '+49 69 4445556',   spec: 'Audi, BMW',                 radius: 180 },
    { id: 'D005', name: 'Riedel & Söhne KFZ',      plz: '70173', email: 'info@riedel-kfz.de',        phone: '+49 711 3332221',  spec: 'Mercedes, Porsche',          radius: 200 },
    { id: 'D006', name: 'Kfz-Center Hamburg',       plz: '20095', email: 'info@kfz-hh.de',            phone: '+49 40 8887766',   spec: 'All brands',                radius: 300 },
    { id: 'D007', name: 'Bayerische Autohandel',    plz: '90402', email: 'info@bay-auto.de',          phone: '+49 911 2223344',  spec: 'BMW, Audi',                 radius: 250 },
    { id: 'D008', name: 'Prestige Cars Köln',       plz: '50667', email: 'info@prestige-koeln.de',    phone: '+49 221 5556677',  spec: 'Mercedes, Porsche, BMW',     radius: 200 },
    { id: 'D009', name: 'Autohaus Rhein-Main',      plz: '65185', email: 'kontakt@rhein-main-auto.de', phone: '+49 611 7778899', spec: 'Ford, Opel, Seat',           radius: 170 },
    { id: 'D010', name: 'Norddeutsche KFZ Börse',   plz: '28195', email: 'info@nkfz-boerse.de',      phone: '+49 421 6665544',  spec: 'All brands',                radius: 280 },
    { id: 'D011', name: 'Alpen Auto München',       plz: '81667', email: 'info@alpen-auto.de',        phone: '+49 89 9998877',   spec: 'BMW, Audi, Porsche',         radius: 220 },
    { id: 'D012', name: 'Dresdner Fahrzeugmarkt',   plz: '01067', email: 'info@dresdner-fzm.de',      phone: '+49 351 4443322',  spec: 'VW, Skoda, Hyundai',         radius: 190 },
  ];

  const crypto = require('crypto');
  const insertDealer = db.prepare(`
    INSERT OR REPLACE INTO dealers (dealer_id, company_name, postal_code, email, phone, specialization, max_pickup_radius_km, preferred_lang, dealer_password, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'de', ?, 1)
  `);
  const insertDealersTx = db.transaction(() => {
    for (const d of dealers) {
      const pwd = crypto.randomBytes(4).toString('hex').toUpperCase();
      insertDealer.run(d.id, d.name, d.plz, d.email, d.phone, d.spec, d.radius, pwd);
    }
  });
  insertDealersTx();

  // =========================================================================
  // 2. VEHICLES (100 records)
  // =========================================================================
  console.log('Seeding vehicles...');
  const vehicles = [
    // BMW (15 vehicles)
    { id: 'V001', make: 'BMW', model: '320d Touring',     type: 'Kombi',      price: 14500, yr: 2021, km: 87500,  fuel: 'Diesel',  plz: '80331', trans: 'Automatik' },
    { id: 'V002', make: 'BMW', model: '520d Touring',     type: 'Kombi',      price: 19800, yr: 2020, km: 95000,  fuel: 'Diesel',  plz: '86150', trans: 'Automatik' },
    { id: 'V003', make: 'BMW', model: 'X3 xDrive20d',    type: 'SUV',        price: 28700, yr: 2021, km: 62000,  fuel: 'Diesel',  plz: '80331', trans: 'Automatik' },
    { id: 'V004', make: 'BMW', model: '330e Limousine',   type: 'Limousine',  price: 31200, yr: 2022, km: 38000,  fuel: 'Hybrid',  plz: '80331', trans: 'Automatik' },
    { id: 'V005', make: 'BMW', model: '118i',             type: 'Kleinwagen', price: 18900, yr: 2022, km: 32000,  fuel: 'Benzin',  plz: '90402', trans: 'Automatik' },
    { id: 'V006', make: 'BMW', model: 'X5 xDrive30d',    type: 'SUV',        price: 42500, yr: 2021, km: 58000,  fuel: 'Diesel',  plz: '81667', trans: 'Automatik' },
    { id: 'V007', make: 'BMW', model: 'M3 Competition',   type: 'Limousine',  price: 62000, yr: 2022, km: 18000,  fuel: 'Benzin',  plz: '80331', trans: 'Automatik' },
    { id: 'V008', make: 'BMW', model: '320d Limousine',   type: 'Limousine',  price: 16500, yr: 2020, km: 98000,  fuel: 'Diesel',  plz: '90402', trans: 'Automatik' },
    { id: 'V009', make: 'BMW', model: '530d Touring',     type: 'Kombi',      price: 35800, yr: 2022, km: 42000,  fuel: 'Diesel',  plz: '50667', trans: 'Automatik' },
    { id: 'V010', make: 'BMW', model: 'X1 sDrive18d',    type: 'SUV',        price: 21500, yr: 2021, km: 55000,  fuel: 'Diesel',  plz: '60311', trans: 'Automatik' },
    { id: 'V011', make: 'BMW', model: '420d Gran Coupé',  type: 'Limousine',  price: 27900, yr: 2021, km: 64000,  fuel: 'Diesel',  plz: '70173', trans: 'Automatik' },
    { id: 'V012', make: 'BMW', model: '218i Active Tourer', type: 'Van',      price: 15200, yr: 2020, km: 78000,  fuel: 'Benzin',  plz: '28195', trans: 'Automatik' },
    { id: 'V013', make: 'BMW', model: '330d xDrive Touring', type: 'Kombi',   price: 33500, yr: 2022, km: 35000,  fuel: 'Diesel',  plz: '81667', trans: 'Automatik' },
    { id: 'V014', make: 'BMW', model: 'iX3',              type: 'SUV',        price: 38900, yr: 2022, km: 25000,  fuel: 'Elektro', plz: '80331', trans: 'Automatik' },
    { id: 'V015', make: 'BMW', model: '116d',             type: 'Kleinwagen', price: 12800, yr: 2019, km: 112000, fuel: 'Diesel',  plz: '40210', trans: 'Manuell' },

    // Mercedes-Benz (14 vehicles)
    { id: 'V016', make: 'Mercedes-Benz', model: 'C 200 Limousine',   type: 'Limousine',  price: 22900, yr: 2022, km: 45200,  fuel: 'Benzin',  plz: '20095', trans: 'Automatik' },
    { id: 'V017', make: 'Mercedes-Benz', model: 'E 220d T-Modell',   type: 'Kombi',      price: 26400, yr: 2021, km: 68000,  fuel: 'Diesel',  plz: '90402', trans: 'Automatik' },
    { id: 'V018', make: 'Mercedes-Benz', model: 'A 200',             type: 'Kleinwagen', price: 19500, yr: 2022, km: 28000,  fuel: 'Benzin',  plz: '20095', trans: 'Automatik' },
    { id: 'V019', make: 'Mercedes-Benz', model: 'GLC 300',           type: 'SUV',        price: 38500, yr: 2022, km: 29000,  fuel: 'Benzin',  plz: '70173', trans: 'Automatik' },
    { id: 'V020', make: 'Mercedes-Benz', model: 'S 350d',            type: 'Limousine',  price: 52000, yr: 2021, km: 48000,  fuel: 'Diesel',  plz: '50667', trans: 'Automatik' },
    { id: 'V021', make: 'Mercedes-Benz', model: 'GLE 350d',          type: 'SUV',        price: 45800, yr: 2022, km: 35000,  fuel: 'Diesel',  plz: '80331', trans: 'Automatik' },
    { id: 'V022', make: 'Mercedes-Benz', model: 'B 200',             type: 'Van',        price: 17500, yr: 2021, km: 52000,  fuel: 'Benzin',  plz: '10115', trans: 'Automatik' },
    { id: 'V023', make: 'Mercedes-Benz', model: 'C 220d T-Modell',   type: 'Kombi',      price: 28900, yr: 2022, km: 38000,  fuel: 'Diesel',  plz: '60311', trans: 'Automatik' },
    { id: 'V024', make: 'Mercedes-Benz', model: 'CLA 200 Shooting Brake', type: 'Kombi', price: 24500, yr: 2021, km: 42000, fuel: 'Benzin', plz: '65185', trans: 'Automatik' },
    { id: 'V025', make: 'Mercedes-Benz', model: 'E 300 Limousine',   type: 'Limousine',  price: 34200, yr: 2022, km: 32000,  fuel: 'Benzin',  plz: '70173', trans: 'Automatik' },
    { id: 'V026', make: 'Mercedes-Benz', model: 'GLA 200',           type: 'SUV',        price: 23800, yr: 2021, km: 48000,  fuel: 'Benzin',  plz: '40210', trans: 'Automatik' },
    { id: 'V027', make: 'Mercedes-Benz', model: 'EQC 400',           type: 'SUV',        price: 41200, yr: 2022, km: 22000,  fuel: 'Elektro', plz: '50667', trans: 'Automatik' },
    { id: 'V028', make: 'Mercedes-Benz', model: 'A 250e',            type: 'Kleinwagen', price: 26800, yr: 2022, km: 18000,  fuel: 'Hybrid',  plz: '81667', trans: 'Automatik' },
    { id: 'V029', make: 'Mercedes-Benz', model: 'V 250d',            type: 'Van',        price: 35500, yr: 2021, km: 65000,  fuel: 'Diesel',  plz: '28195', trans: 'Automatik' },

    // Audi (12 vehicles)
    { id: 'V030', make: 'Audi', model: 'A4 Avant 40 TDI',    type: 'Kombi',      price: 18750, yr: 2020, km: 112000, fuel: 'Diesel',  plz: '10115', trans: 'Automatik' },
    { id: 'V031', make: 'Audi', model: 'Q5 45 TFSI',         type: 'SUV',        price: 32500, yr: 2022, km: 35000,  fuel: 'Benzin',  plz: '70173', trans: 'Automatik' },
    { id: 'V032', make: 'Audi', model: 'A3 Sportback',       type: 'Kleinwagen', price: 21500, yr: 2022, km: 32000,  fuel: 'Benzin',  plz: '60311', trans: 'Automatik' },
    { id: 'V033', make: 'Audi', model: 'A6 Avant 45 TDI',    type: 'Kombi',      price: 34800, yr: 2021, km: 58000,  fuel: 'Diesel',  plz: '90402', trans: 'Automatik' },
    { id: 'V034', make: 'Audi', model: 'Q3 35 TDI',          type: 'SUV',        price: 25600, yr: 2021, km: 48000,  fuel: 'Diesel',  plz: '50667', trans: 'Automatik' },
    { id: 'V035', make: 'Audi', model: 'A5 Sportback',       type: 'Limousine',  price: 29200, yr: 2022, km: 28000,  fuel: 'Benzin',  plz: '80331', trans: 'Automatik' },
    { id: 'V036', make: 'Audi', model: 'Q7 50 TDI',          type: 'SUV',        price: 48500, yr: 2021, km: 52000,  fuel: 'Diesel',  plz: '81667', trans: 'Automatik' },
    { id: 'V037', make: 'Audi', model: 'e-tron GT',           type: 'Limousine',  price: 68000, yr: 2023, km: 12000,  fuel: 'Elektro', plz: '70173', trans: 'Automatik' },
    { id: 'V038', make: 'Audi', model: 'A1 Sportback',       type: 'Kleinwagen', price: 14200, yr: 2020, km: 65000,  fuel: 'Benzin',  plz: '40210', trans: 'Manuell' },
    { id: 'V039', make: 'Audi', model: 'A4 Limousine 35 TDI', type: 'Limousine', price: 22800, yr: 2021, km: 72000,  fuel: 'Diesel',  plz: '01067', trans: 'Automatik' },
    { id: 'V040', make: 'Audi', model: 'Q2 30 TDI',          type: 'SUV',        price: 19800, yr: 2021, km: 45000,  fuel: 'Diesel',  plz: '65185', trans: 'Automatik' },
    { id: 'V041', make: 'Audi', model: 'A6 Limousine 40 TDI', type: 'Limousine', price: 31500, yr: 2022, km: 38000,  fuel: 'Diesel',  plz: '28195', trans: 'Automatik' },

    // VW (13 vehicles)
    { id: 'V042', make: 'VW', model: 'Golf 8 GTI',              type: 'Kleinwagen', price: 28400, yr: 2023, km: 22300,  fuel: 'Benzin',  plz: '50667', trans: 'Manuell' },
    { id: 'V043', make: 'VW', model: 'Passat Variant 2.0 TDI',  type: 'Kombi',      price: 15600, yr: 2020, km: 98000,  fuel: 'Diesel',  plz: '40210', trans: 'Automatik' },
    { id: 'V044', make: 'VW', model: 'Tiguan 2.0 TDI',          type: 'SUV',        price: 24800, yr: 2021, km: 55000,  fuel: 'Diesel',  plz: '50667', trans: 'Automatik' },
    { id: 'V045', make: 'VW', model: 'Golf 8 1.5 TSI',          type: 'Kleinwagen', price: 18500, yr: 2021, km: 42000,  fuel: 'Benzin',  plz: '10115', trans: 'Manuell' },
    { id: 'V046', make: 'VW', model: 'T-Roc 2.0 TDI',           type: 'SUV',        price: 22400, yr: 2021, km: 48000,  fuel: 'Diesel',  plz: '01067', trans: 'Automatik' },
    { id: 'V047', make: 'VW', model: 'Touareg 3.0 TDI',         type: 'SUV',        price: 45000, yr: 2022, km: 35000,  fuel: 'Diesel',  plz: '60311', trans: 'Automatik' },
    { id: 'V048', make: 'VW', model: 'Polo 1.0 TSI',            type: 'Kleinwagen', price: 12200, yr: 2021, km: 38000,  fuel: 'Benzin',  plz: '28195', trans: 'Manuell' },
    { id: 'V049', make: 'VW', model: 'ID.4 Pro Performance',    type: 'SUV',        price: 32800, yr: 2023, km: 15000,  fuel: 'Elektro', plz: '20095', trans: 'Automatik' },
    { id: 'V050', make: 'VW', model: 'Arteon Shooting Brake',   type: 'Kombi',      price: 28500, yr: 2022, km: 32000,  fuel: 'Benzin',  plz: '90402', trans: 'Automatik' },
    { id: 'V051', make: 'VW', model: 'Caddy 2.0 TDI',           type: 'Van',        price: 19800, yr: 2021, km: 68000,  fuel: 'Diesel',  plz: '65185', trans: 'Manuell' },
    { id: 'V052', make: 'VW', model: 'Passat Limousine 1.5 TSI', type: 'Limousine', price: 17200, yr: 2020, km: 85000,  fuel: 'Benzin',  plz: '01067', trans: 'Automatik' },
    { id: 'V053', make: 'VW', model: 'Golf Variant 2.0 TDI',    type: 'Kombi',      price: 16900, yr: 2020, km: 92000,  fuel: 'Diesel',  plz: '40210', trans: 'Manuell' },
    { id: 'V054', make: 'VW', model: 'Tiguan Allspace',          type: 'SUV',        price: 27800, yr: 2022, km: 38000,  fuel: 'Diesel',  plz: '80331', trans: 'Automatik' },

    // Porsche (7 vehicles)
    { id: 'V055', make: 'Porsche', model: 'Macan S',            type: 'SUV',        price: 48900, yr: 2021, km: 42000,  fuel: 'Benzin',  plz: '70173', trans: 'Automatik' },
    { id: 'V056', make: 'Porsche', model: 'Cayenne',            type: 'SUV',        price: 58500, yr: 2022, km: 28000,  fuel: 'Benzin',  plz: '81667', trans: 'Automatik' },
    { id: 'V057', make: 'Porsche', model: '911 Carrera',        type: 'Cabrio',     price: 75000, yr: 2022, km: 15000,  fuel: 'Benzin',  plz: '70173', trans: 'Automatik' },
    { id: 'V058', make: 'Porsche', model: 'Taycan 4S',          type: 'Limousine',  price: 72000, yr: 2023, km: 12000,  fuel: 'Elektro', plz: '80331', trans: 'Automatik' },
    { id: 'V059', make: 'Porsche', model: 'Macan',              type: 'SUV',        price: 38500, yr: 2020, km: 62000,  fuel: 'Benzin',  plz: '50667', trans: 'Automatik' },
    { id: 'V060', make: 'Porsche', model: 'Cayenne E-Hybrid',   type: 'SUV',        price: 65000, yr: 2022, km: 22000,  fuel: 'Hybrid',  plz: '81667', trans: 'Automatik' },
    { id: 'V061', make: 'Porsche', model: 'Panamera 4',         type: 'Limousine',  price: 68000, yr: 2021, km: 35000,  fuel: 'Benzin',  plz: '90402', trans: 'Automatik' },

    // Opel (8 vehicles)
    { id: 'V062', make: 'Opel', model: 'Astra Sports Tourer',   type: 'Kombi',      price: 11200, yr: 2021, km: 68900,  fuel: 'Diesel',  plz: '60311', trans: 'Manuell' },
    { id: 'V063', make: 'Opel', model: 'Mokka-e',               type: 'SUV',        price: 22100, yr: 2023, km: 15000,  fuel: 'Elektro', plz: '10115', trans: 'Automatik' },
    { id: 'V064', make: 'Opel', model: 'Corsa 1.2 Turbo',       type: 'Kleinwagen', price: 11500, yr: 2021, km: 42000,  fuel: 'Benzin',  plz: '65185', trans: 'Manuell' },
    { id: 'V065', make: 'Opel', model: 'Grandland X 1.5 CDTi',  type: 'SUV',        price: 18900, yr: 2021, km: 58000,  fuel: 'Diesel',  plz: '40210', trans: 'Automatik' },
    { id: 'V066', make: 'Opel', model: 'Insignia Sports Tourer', type: 'Kombi',     price: 14800, yr: 2020, km: 88000,  fuel: 'Diesel',  plz: '50667', trans: 'Automatik' },
    { id: 'V067', make: 'Opel', model: 'Crossland X',           type: 'SUV',        price: 13500, yr: 2020, km: 72000,  fuel: 'Benzin',  plz: '28195', trans: 'Manuell' },
    { id: 'V068', make: 'Opel', model: 'Astra 1.4 Turbo',       type: 'Kleinwagen', price: 9800,  yr: 2019, km: 95000,  fuel: 'Benzin',  plz: '01067', trans: 'Manuell' },
    { id: 'V069', make: 'Opel', model: 'Corsa-e',               type: 'Kleinwagen', price: 19200, yr: 2022, km: 22000,  fuel: 'Elektro', plz: '20095', trans: 'Automatik' },

    // Skoda (7 vehicles)
    { id: 'V070', make: 'Skoda', model: 'Octavia Combi',        type: 'Kombi',      price: 12800, yr: 2021, km: 75000,  fuel: 'Diesel',  plz: '40210', trans: 'Manuell' },
    { id: 'V071', make: 'Skoda', model: 'Superb Combi',         type: 'Kombi',      price: 18500, yr: 2021, km: 62000,  fuel: 'Diesel',  plz: '01067', trans: 'Automatik' },
    { id: 'V072', make: 'Skoda', model: 'Kodiaq 2.0 TDI',      type: 'SUV',        price: 24200, yr: 2022, km: 38000,  fuel: 'Diesel',  plz: '10115', trans: 'Automatik' },
    { id: 'V073', make: 'Skoda', model: 'Karoq 1.5 TSI',       type: 'SUV',        price: 19800, yr: 2021, km: 45000,  fuel: 'Benzin',  plz: '28195', trans: 'Automatik' },
    { id: 'V074', make: 'Skoda', model: 'Fabia 1.0 TSI',       type: 'Kleinwagen', price: 10500, yr: 2021, km: 38000,  fuel: 'Benzin',  plz: '01067', trans: 'Manuell' },
    { id: 'V075', make: 'Skoda', model: 'Scala 1.5 TSI',       type: 'Kleinwagen', price: 14200, yr: 2022, km: 28000,  fuel: 'Benzin',  plz: '65185', trans: 'Manuell' },
    { id: 'V076', make: 'Skoda', model: 'Enyaq iV 80',         type: 'SUV',        price: 33500, yr: 2023, km: 12000,  fuel: 'Elektro', plz: '40210', trans: 'Automatik' },

    // Ford (8 vehicles)
    { id: 'V077', make: 'Ford', model: 'Focus Turnier 1.5 TDCi', type: 'Kombi',     price: 11800, yr: 2020, km: 82000,  fuel: 'Diesel',  plz: '65185', trans: 'Manuell' },
    { id: 'V078', make: 'Ford', model: 'Kuga 2.0 EcoBlue',     type: 'SUV',        price: 22500, yr: 2021, km: 48000,  fuel: 'Diesel',  plz: '60311', trans: 'Automatik' },
    { id: 'V079', make: 'Ford', model: 'Fiesta 1.0 EcoBoost',  type: 'Kleinwagen', price: 9500,  yr: 2020, km: 58000,  fuel: 'Benzin',  plz: '28195', trans: 'Manuell' },
    { id: 'V080', make: 'Ford', model: 'Puma 1.0 EcoBoost',    type: 'SUV',        price: 18200, yr: 2022, km: 28000,  fuel: 'Benzin',  plz: '50667', trans: 'Manuell' },
    { id: 'V081', make: 'Ford', model: 'Mustang Mach-E',        type: 'SUV',        price: 42000, yr: 2023, km: 15000,  fuel: 'Elektro', plz: '20095', trans: 'Automatik' },
    { id: 'V082', make: 'Ford', model: 'Mondeo Turnier',        type: 'Kombi',      price: 13500, yr: 2019, km: 115000, fuel: 'Diesel',  plz: '65185', trans: 'Automatik' },
    { id: 'V083', make: 'Ford', model: 'Galaxy 2.0 TDCi',      type: 'Van',        price: 16800, yr: 2020, km: 92000,  fuel: 'Diesel',  plz: '40210', trans: 'Automatik' },
    { id: 'V084', make: 'Ford', model: 'Explorer PHEV',         type: 'SUV',        price: 48000, yr: 2022, km: 25000,  fuel: 'Hybrid',  plz: '81667', trans: 'Automatik' },

    // Toyota (7 vehicles)
    { id: 'V085', make: 'Toyota', model: 'Corolla Touring Sports', type: 'Kombi',   price: 19800, yr: 2022, km: 35000,  fuel: 'Hybrid',  plz: '20095', trans: 'Automatik' },
    { id: 'V086', make: 'Toyota', model: 'RAV4 Hybrid',         type: 'SUV',        price: 28500, yr: 2022, km: 32000,  fuel: 'Hybrid',  plz: '10115', trans: 'Automatik' },
    { id: 'V087', make: 'Toyota', model: 'Yaris 1.5 Hybrid',    type: 'Kleinwagen', price: 15800, yr: 2022, km: 22000,  fuel: 'Hybrid',  plz: '50667', trans: 'Automatik' },
    { id: 'V088', make: 'Toyota', model: 'C-HR 2.0 Hybrid',     type: 'SUV',        price: 22800, yr: 2021, km: 42000,  fuel: 'Hybrid',  plz: '01067', trans: 'Automatik' },
    { id: 'V089', make: 'Toyota', model: 'Camry 2.5 Hybrid',    type: 'Limousine',  price: 26500, yr: 2022, km: 28000,  fuel: 'Hybrid',  plz: '60311', trans: 'Automatik' },
    { id: 'V090', make: 'Toyota', model: 'Supra 3.0',           type: 'Cabrio',     price: 48000, yr: 2022, km: 18000,  fuel: 'Benzin',  plz: '80331', trans: 'Automatik' },
    { id: 'V091', make: 'Toyota', model: 'Proace City Verso',   type: 'Van',        price: 21500, yr: 2021, km: 55000,  fuel: 'Diesel',  plz: '28195', trans: 'Manuell' },

    // Hyundai (7 vehicles)
    { id: 'V092', make: 'Hyundai', model: 'Tucson 1.6 T-GDi',  type: 'SUV',        price: 24500, yr: 2022, km: 32000,  fuel: 'Hybrid',  plz: '01067', trans: 'Automatik' },
    { id: 'V093', make: 'Hyundai', model: 'i30 Kombi 1.6 CRDi', type: 'Kombi',     price: 13200, yr: 2021, km: 58000,  fuel: 'Diesel',  plz: '40210', trans: 'Manuell' },
    { id: 'V094', make: 'Hyundai', model: 'Kona Elektro',       type: 'SUV',        price: 28800, yr: 2022, km: 18000,  fuel: 'Elektro', plz: '10115', trans: 'Automatik' },
    { id: 'V095', make: 'Hyundai', model: 'i20 1.0 T-GDi',     type: 'Kleinwagen', price: 12500, yr: 2021, km: 35000,  fuel: 'Benzin',  plz: '28195', trans: 'Manuell' },
    { id: 'V096', make: 'Hyundai', model: 'IONIQ 5',            type: 'SUV',        price: 38500, yr: 2023, km: 12000,  fuel: 'Elektro', plz: '20095', trans: 'Automatik' },
    { id: 'V097', make: 'Hyundai', model: 'Santa Fe 2.2 CRDi',  type: 'SUV',        price: 32000, yr: 2021, km: 52000,  fuel: 'Diesel',  plz: '65185', trans: 'Automatik' },
    { id: 'V098', make: 'Hyundai', model: 'Bayon 1.0 T-GDi',   type: 'SUV',        price: 15800, yr: 2022, km: 28000,  fuel: 'Benzin',  plz: '01067', trans: 'Manuell' },

    // Seat (1 vehicle)
    { id: 'V099', make: 'Seat', model: 'Leon Sportstourer 1.5 TSI', type: 'Kombi',  price: 16500, yr: 2021, km: 48000,  fuel: 'Benzin',  plz: '65185', trans: 'Manuell' },

    // Renault (1 vehicle)
    { id: 'V100', make: 'Renault', model: 'Mégane E-Tech',      type: 'SUV',        price: 32500, yr: 2023, km: 10000,  fuel: 'Elektro', plz: '50667', trans: 'Automatik' },
  ];

  const insertVehicle = db.prepare(`
    INSERT OR REPLACE INTO vehicles (vehicle_id, make, model, body_type, price, year, first_registration, mileage_km, fuel_type, transmission, postal_code, image_url, listed_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), 1)
  `);
  const insertVehiclesTx = db.transaction(() => {
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const hoursAgo = (i * 3) % 120 + 1; // spread listings over the last 5 days
      insertVehicle.run(
        v.id, v.make, v.model, v.type, v.price, v.yr,
        `${v.yr}-${String((i % 12) + 1).padStart(2, '0')}`,
        v.km, v.fuel, v.trans, v.plz,
        imageUrl(v.make, i),
        hoursAgo
      );
    }
  });
  insertVehiclesTx();

  // =========================================================================
  // 3. PURCHASE HISTORY (~120 records)
  // =========================================================================
  console.log('Seeding purchase history...');
  const purchases = [
    // D001 Autohaus Müller — BMW & Mercedes specialist (14 purchases)
    { tx: 'T001', dealer: 'D001', make: 'BMW',           model: '320d',        type: 'Kombi',      price: 13200, date: '2025-09-15', yr: 2020, km: 92000,  fuel: 'Diesel' },
    { tx: 'T002', dealer: 'D001', make: 'BMW',           model: '520d',        type: 'Kombi',      price: 21500, date: '2025-10-03', yr: 2021, km: 78000,  fuel: 'Diesel' },
    { tx: 'T003', dealer: 'D001', make: 'Mercedes-Benz', model: 'C 200',       type: 'Limousine',  price: 24000, date: '2025-11-10', yr: 2021, km: 55000,  fuel: 'Benzin' },
    { tx: 'T004', dealer: 'D001', make: 'BMW',           model: '330d',        type: 'Limousine',  price: 18900, date: '2025-12-20', yr: 2020, km: 88000,  fuel: 'Diesel' },
    { tx: 'T005', dealer: 'D001', make: 'Mercedes-Benz', model: 'E 220d',      type: 'Kombi',      price: 27500, date: '2026-01-14', yr: 2021, km: 62000,  fuel: 'Diesel' },
    { tx: 'T006', dealer: 'D001', make: 'BMW',           model: 'X3',          type: 'SUV',        price: 29800, date: '2026-02-05', yr: 2022, km: 45000,  fuel: 'Diesel' },
    { tx: 'T007', dealer: 'D001', make: 'Audi',          model: 'A4 Avant',    type: 'Kombi',      price: 19200, date: '2026-02-22', yr: 2020, km: 105000, fuel: 'Diesel' },
    { tx: 'T008', dealer: 'D001', make: 'BMW',           model: '320d',        type: 'Kombi',      price: 15800, date: '2026-03-01', yr: 2021, km: 82000,  fuel: 'Diesel' },
    { tx: 'T009', dealer: 'D001', make: 'BMW',           model: '530d',        type: 'Limousine',  price: 32000, date: '2026-03-18', yr: 2022, km: 48000,  fuel: 'Diesel' },
    { tx: 'T010', dealer: 'D001', make: 'Mercedes-Benz', model: 'GLC 300',     type: 'SUV',        price: 36500, date: '2026-04-02', yr: 2022, km: 32000,  fuel: 'Benzin' },
    { tx: 'T011', dealer: 'D001', make: 'BMW',           model: '118i',        type: 'Kleinwagen', price: 17500, date: '2026-04-15', yr: 2021, km: 42000,  fuel: 'Benzin' },
    { tx: 'T012', dealer: 'D001', make: 'BMW',           model: 'X5',          type: 'SUV',        price: 41000, date: '2026-04-28', yr: 2021, km: 55000,  fuel: 'Diesel' },
    { tx: 'T013', dealer: 'D001', make: 'Mercedes-Benz', model: 'C 220d',      type: 'Kombi',      price: 26800, date: '2026-05-05', yr: 2022, km: 38000,  fuel: 'Diesel' },
    { tx: 'T014', dealer: 'D001', make: 'BMW',           model: '320d',        type: 'Kombi',      price: 14200, date: '2026-05-10', yr: 2020, km: 98000,  fuel: 'Diesel' },

    // D002 Auto König — VW, Opel, Skoda (12 purchases)
    { tx: 'T015', dealer: 'D002', make: 'VW',    model: 'Golf',            type: 'Kleinwagen', price: 14500, date: '2025-08-08', yr: 2020, km: 65000,  fuel: 'Benzin' },
    { tx: 'T016', dealer: 'D002', make: 'Opel',  model: 'Astra',           type: 'Kombi',      price: 10200, date: '2025-09-22', yr: 2019, km: 95000,  fuel: 'Diesel' },
    { tx: 'T017', dealer: 'D002', make: 'VW',    model: 'Passat',          type: 'Kombi',      price: 16800, date: '2025-11-05', yr: 2020, km: 88000,  fuel: 'Diesel' },
    { tx: 'T018', dealer: 'D002', make: 'Skoda', model: 'Octavia',         type: 'Kombi',      price: 13500, date: '2025-12-15', yr: 2021, km: 72000,  fuel: 'Diesel' },
    { tx: 'T019', dealer: 'D002', make: 'VW',    model: 'Tiguan',          type: 'SUV',        price: 22000, date: '2026-01-10', yr: 2021, km: 58000,  fuel: 'Diesel' },
    { tx: 'T020', dealer: 'D002', make: 'Opel',  model: 'Mokka',           type: 'SUV',        price: 18500, date: '2026-02-18', yr: 2022, km: 35000,  fuel: 'Benzin' },
    { tx: 'T021', dealer: 'D002', make: 'VW',    model: 'Polo',            type: 'Kleinwagen', price: 11200, date: '2026-03-05', yr: 2021, km: 42000,  fuel: 'Benzin' },
    { tx: 'T022', dealer: 'D002', make: 'Skoda', model: 'Fabia',           type: 'Kleinwagen', price: 9800,  date: '2026-03-20', yr: 2020, km: 55000,  fuel: 'Benzin' },
    { tx: 'T023', dealer: 'D002', make: 'VW',    model: 'Golf Variant',    type: 'Kombi',      price: 15500, date: '2026-04-08', yr: 2020, km: 82000,  fuel: 'Diesel' },
    { tx: 'T024', dealer: 'D002', make: 'Opel',  model: 'Corsa',           type: 'Kleinwagen', price: 10800, date: '2026-04-22', yr: 2021, km: 38000,  fuel: 'Benzin' },
    { tx: 'T025', dealer: 'D002', make: 'Skoda', model: 'Superb',          type: 'Kombi',      price: 17500, date: '2026-05-02', yr: 2021, km: 65000,  fuel: 'Diesel' },
    { tx: 'T026', dealer: 'D002', make: 'VW',    model: 'T-Roc',           type: 'SUV',        price: 20500, date: '2026-05-10', yr: 2021, km: 48000,  fuel: 'Diesel' },

    // D003 Schmidt Automobile — All brands (11 purchases)
    { tx: 'T027', dealer: 'D003', make: 'BMW',           model: '118i',      type: 'Kleinwagen', price: 18000, date: '2025-11-20', yr: 2021, km: 42000,  fuel: 'Benzin' },
    { tx: 'T028', dealer: 'D003', make: 'VW',            model: 'Golf',      type: 'Kleinwagen', price: 15500, date: '2025-12-08', yr: 2021, km: 55000,  fuel: 'Benzin' },
    { tx: 'T029', dealer: 'D003', make: 'Audi',          model: 'A3',        type: 'Kleinwagen', price: 20500, date: '2026-01-01', yr: 2022, km: 30000,  fuel: 'Benzin' },
    { tx: 'T030', dealer: 'D003', make: 'Opel',          model: 'Corsa-e',   type: 'Kleinwagen', price: 16200, date: '2026-01-12', yr: 2022, km: 25000,  fuel: 'Elektro' },
    { tx: 'T031', dealer: 'D003', make: 'Mercedes-Benz', model: 'A 200',     type: 'Kleinwagen', price: 21000, date: '2026-02-02', yr: 2022, km: 28000,  fuel: 'Benzin' },
    { tx: 'T032', dealer: 'D003', make: 'Toyota',        model: 'Yaris',     type: 'Kleinwagen', price: 14800, date: '2026-02-18', yr: 2022, km: 22000,  fuel: 'Hybrid' },
    { tx: 'T033', dealer: 'D003', make: 'Hyundai',       model: 'i20',       type: 'Kleinwagen', price: 11500, date: '2026-03-08', yr: 2021, km: 35000,  fuel: 'Benzin' },
    { tx: 'T034', dealer: 'D003', make: 'Skoda',         model: 'Scala',     type: 'Kleinwagen', price: 13800, date: '2026-03-25', yr: 2022, km: 28000,  fuel: 'Benzin' },
    { tx: 'T035', dealer: 'D003', make: 'Renault',       model: 'Clio',      type: 'Kleinwagen', price: 12200, date: '2026-04-10', yr: 2021, km: 38000,  fuel: 'Benzin' },
    { tx: 'T036', dealer: 'D003', make: 'Ford',          model: 'Fiesta',    type: 'Kleinwagen', price: 9800,  date: '2026-04-28', yr: 2020, km: 52000,  fuel: 'Benzin' },
    { tx: 'T037', dealer: 'D003', make: 'Seat',          model: 'Leon',      type: 'Kombi',      price: 15200, date: '2026-05-08', yr: 2021, km: 48000,  fuel: 'Benzin' },

    // D004 Fahrzeughaus Weber — Audi, BMW (10 purchases)
    { tx: 'T038', dealer: 'D004', make: 'Audi', model: 'A4',          type: 'Limousine',  price: 22000, date: '2025-10-10', yr: 2021, km: 65000,  fuel: 'Diesel' },
    { tx: 'T039', dealer: 'D004', make: 'BMW',  model: '520d',        type: 'Limousine',  price: 25000, date: '2025-11-28', yr: 2021, km: 72000,  fuel: 'Diesel' },
    { tx: 'T040', dealer: 'D004', make: 'Audi', model: 'Q5',          type: 'SUV',        price: 31000, date: '2026-01-05', yr: 2022, km: 40000,  fuel: 'Benzin' },
    { tx: 'T041', dealer: 'D004', make: 'BMW',  model: '330d',        type: 'Limousine',  price: 28500, date: '2026-02-15', yr: 2022, km: 48000,  fuel: 'Diesel' },
    { tx: 'T042', dealer: 'D004', make: 'Audi', model: 'A6 Avant',    type: 'Kombi',      price: 33000, date: '2026-03-02', yr: 2021, km: 58000,  fuel: 'Diesel' },
    { tx: 'T043', dealer: 'D004', make: 'Audi', model: 'Q3',          type: 'SUV',        price: 24500, date: '2026-03-18', yr: 2021, km: 45000,  fuel: 'Diesel' },
    { tx: 'T044', dealer: 'D004', make: 'BMW',  model: 'X1',          type: 'SUV',        price: 22000, date: '2026-04-05', yr: 2021, km: 52000,  fuel: 'Diesel' },
    { tx: 'T045', dealer: 'D004', make: 'Audi', model: 'A5 Sportback', type: 'Limousine', price: 28800, date: '2026-04-20', yr: 2022, km: 32000,  fuel: 'Benzin' },
    { tx: 'T046', dealer: 'D004', make: 'BMW',  model: '420d',        type: 'Limousine',  price: 26500, date: '2026-05-01', yr: 2021, km: 58000,  fuel: 'Diesel' },
    { tx: 'T047', dealer: 'D004', make: 'Audi', model: 'A4 Avant',    type: 'Kombi',      price: 20500, date: '2026-05-12', yr: 2020, km: 95000,  fuel: 'Diesel' },

    // D005 Riedel & Söhne — Mercedes, Porsche (10 purchases)
    { tx: 'T048', dealer: 'D005', make: 'Mercedes-Benz', model: 'GLC 300',  type: 'SUV',        price: 38000, date: '2025-10-15', yr: 2022, km: 32000, fuel: 'Benzin' },
    { tx: 'T049', dealer: 'D005', make: 'Porsche',       model: 'Macan',    type: 'SUV',        price: 45000, date: '2025-11-22', yr: 2021, km: 38000, fuel: 'Benzin' },
    { tx: 'T050', dealer: 'D005', make: 'Mercedes-Benz', model: 'E 220d',   type: 'Kombi',      price: 29000, date: '2025-12-20', yr: 2021, km: 55000, fuel: 'Diesel' },
    { tx: 'T051', dealer: 'D005', make: 'Porsche',       model: 'Cayenne',  type: 'SUV',        price: 55000, date: '2026-01-08', yr: 2022, km: 28000, fuel: 'Benzin' },
    { tx: 'T052', dealer: 'D005', make: 'Mercedes-Benz', model: 'S 350d',   type: 'Limousine',  price: 48000, date: '2026-02-12', yr: 2021, km: 42000, fuel: 'Diesel' },
    { tx: 'T053', dealer: 'D005', make: 'Porsche',       model: 'Panamera', type: 'Limousine',  price: 62000, date: '2026-03-05', yr: 2021, km: 35000, fuel: 'Benzin' },
    { tx: 'T054', dealer: 'D005', make: 'Mercedes-Benz', model: 'GLE 350d', type: 'SUV',        price: 44000, date: '2026-03-22', yr: 2022, km: 38000, fuel: 'Diesel' },
    { tx: 'T055', dealer: 'D005', make: 'Mercedes-Benz', model: 'C 200',    type: 'Limousine',  price: 23500, date: '2026-04-10', yr: 2022, km: 35000, fuel: 'Benzin' },
    { tx: 'T056', dealer: 'D005', make: 'Porsche',       model: 'Macan S',  type: 'SUV',        price: 48500, date: '2026-04-28', yr: 2021, km: 42000, fuel: 'Benzin' },
    { tx: 'T057', dealer: 'D005', make: 'Mercedes-Benz', model: 'E 300',    type: 'Limousine',  price: 35000, date: '2026-05-10', yr: 2022, km: 30000, fuel: 'Benzin' },

    // D006 Kfz-Center Hamburg — All brands (10 purchases)
    { tx: 'T058', dealer: 'D006', make: 'VW',            model: 'Golf',       type: 'Kleinwagen', price: 13000, date: '2025-11-05', yr: 2020, km: 70000, fuel: 'Benzin' },
    { tx: 'T059', dealer: 'D006', make: 'BMW',           model: '320d',       type: 'Kombi',      price: 16500, date: '2025-12-18', yr: 2021, km: 80000, fuel: 'Diesel' },
    { tx: 'T060', dealer: 'D006', make: 'Mercedes-Benz', model: 'C 200',      type: 'Limousine',  price: 23000, date: '2026-01-25', yr: 2022, km: 40000, fuel: 'Benzin' },
    { tx: 'T061', dealer: 'D006', make: 'Opel',          model: 'Grandland',  type: 'SUV',        price: 18000, date: '2026-02-08', yr: 2021, km: 55000, fuel: 'Diesel' },
    { tx: 'T062', dealer: 'D006', make: 'Toyota',        model: 'Corolla',    type: 'Kombi',      price: 18500, date: '2026-02-22', yr: 2022, km: 32000, fuel: 'Hybrid' },
    { tx: 'T063', dealer: 'D006', make: 'Ford',          model: 'Focus',      type: 'Kombi',      price: 12000, date: '2026-03-10', yr: 2020, km: 78000, fuel: 'Diesel' },
    { tx: 'T064', dealer: 'D006', make: 'Hyundai',       model: 'Tucson',     type: 'SUV',        price: 23500, date: '2026-03-28', yr: 2022, km: 28000, fuel: 'Hybrid' },
    { tx: 'T065', dealer: 'D006', make: 'Skoda',         model: 'Kodiaq',     type: 'SUV',        price: 22500, date: '2026-04-12', yr: 2022, km: 35000, fuel: 'Diesel' },
    { tx: 'T066', dealer: 'D006', make: 'Audi',          model: 'A3',         type: 'Kleinwagen', price: 19800, date: '2026-04-28', yr: 2022, km: 30000, fuel: 'Benzin' },
    { tx: 'T067', dealer: 'D006', make: 'VW',            model: 'Passat',     type: 'Kombi',      price: 15800, date: '2026-05-08', yr: 2020, km: 88000, fuel: 'Diesel' },

    // D007 Bayerische Autohandel — BMW, Audi (10 purchases)
    { tx: 'T068', dealer: 'D007', make: 'BMW',  model: '520d',        type: 'Kombi',      price: 24000, date: '2025-10-12', yr: 2021, km: 68000, fuel: 'Diesel' },
    { tx: 'T069', dealer: 'D007', make: 'Audi', model: 'A6 Avant',    type: 'Kombi',      price: 28000, date: '2025-11-28', yr: 2021, km: 75000, fuel: 'Diesel' },
    { tx: 'T070', dealer: 'D007', make: 'BMW',  model: 'X3',          type: 'SUV',        price: 32000, date: '2026-01-02', yr: 2022, km: 45000, fuel: 'Diesel' },
    { tx: 'T071', dealer: 'D007', make: 'BMW',  model: '330e',        type: 'Limousine',  price: 30000, date: '2026-01-20', yr: 2022, km: 35000, fuel: 'Hybrid' },
    { tx: 'T072', dealer: 'D007', make: 'Audi', model: 'Q5',          type: 'SUV',        price: 30500, date: '2026-02-10', yr: 2022, km: 38000, fuel: 'Benzin' },
    { tx: 'T073', dealer: 'D007', make: 'BMW',  model: '320d',        type: 'Kombi',      price: 14800, date: '2026-02-28', yr: 2020, km: 92000, fuel: 'Diesel' },
    { tx: 'T074', dealer: 'D007', make: 'Audi', model: 'A4',          type: 'Limousine',  price: 21500, date: '2026-03-15', yr: 2021, km: 65000, fuel: 'Diesel' },
    { tx: 'T075', dealer: 'D007', make: 'BMW',  model: 'X1',          type: 'SUV',        price: 20500, date: '2026-04-02', yr: 2021, km: 55000, fuel: 'Diesel' },
    { tx: 'T076', dealer: 'D007', make: 'Audi', model: 'A3 Sportback', type: 'Kleinwagen', price: 19800, date: '2026-04-18', yr: 2022, km: 28000, fuel: 'Benzin' },
    { tx: 'T077', dealer: 'D007', make: 'BMW',  model: '530d',        type: 'Limousine',  price: 31000, date: '2026-05-05', yr: 2022, km: 42000, fuel: 'Diesel' },

    // D008 Prestige Cars Köln — Mercedes, Porsche, BMW (10 purchases)
    { tx: 'T078', dealer: 'D008', make: 'Mercedes-Benz', model: 'E 300',    type: 'Limousine', price: 35000, date: '2025-10-08', yr: 2022, km: 35000, fuel: 'Benzin' },
    { tx: 'T079', dealer: 'D008', make: 'Porsche',       model: 'Macan',    type: 'SUV',       price: 42000, date: '2025-11-14', yr: 2021, km: 40000, fuel: 'Benzin' },
    { tx: 'T080', dealer: 'D008', make: 'BMW',           model: '530d',     type: 'Limousine', price: 30000, date: '2025-12-22', yr: 2021, km: 65000, fuel: 'Diesel' },
    { tx: 'T081', dealer: 'D008', make: 'Mercedes-Benz', model: 'GLC 300',  type: 'SUV',       price: 37500, date: '2026-01-15', yr: 2022, km: 30000, fuel: 'Benzin' },
    { tx: 'T082', dealer: 'D008', make: 'BMW',           model: 'X5',       type: 'SUV',       price: 43000, date: '2026-02-08', yr: 2021, km: 52000, fuel: 'Diesel' },
    { tx: 'T083', dealer: 'D008', make: 'Porsche',       model: 'Cayenne',  type: 'SUV',       price: 56000, date: '2026-02-25', yr: 2022, km: 25000, fuel: 'Benzin' },
    { tx: 'T084', dealer: 'D008', make: 'Mercedes-Benz', model: 'S 350d',   type: 'Limousine', price: 50000, date: '2026-03-12', yr: 2021, km: 45000, fuel: 'Diesel' },
    { tx: 'T085', dealer: 'D008', make: 'BMW',           model: 'M3',       type: 'Limousine', price: 58000, date: '2026-03-28', yr: 2022, km: 18000, fuel: 'Benzin' },
    { tx: 'T086', dealer: 'D008', make: 'Mercedes-Benz', model: 'E 220d',   type: 'Kombi',     price: 28500, date: '2026-04-15', yr: 2021, km: 58000, fuel: 'Diesel' },
    { tx: 'T087', dealer: 'D008', make: 'Porsche',       model: 'Macan S',  type: 'SUV',       price: 47000, date: '2026-05-05', yr: 2021, km: 38000, fuel: 'Benzin' },

    // D009 Autohaus Rhein-Main — Ford, Opel, Seat (10 purchases)
    { tx: 'T088', dealer: 'D009', make: 'Ford', model: 'Focus Turnier', type: 'Kombi',      price: 12500, date: '2025-10-20', yr: 2020, km: 78000, fuel: 'Diesel' },
    { tx: 'T089', dealer: 'D009', make: 'Opel', model: 'Astra',         type: 'Kombi',      price: 10800, date: '2025-11-15', yr: 2019, km: 92000, fuel: 'Diesel' },
    { tx: 'T090', dealer: 'D009', make: 'Seat', model: 'Leon',          type: 'Kombi',      price: 14500, date: '2025-12-08', yr: 2021, km: 48000, fuel: 'Benzin' },
    { tx: 'T091', dealer: 'D009', make: 'Ford', model: 'Kuga',          type: 'SUV',        price: 21500, date: '2026-01-12', yr: 2021, km: 45000, fuel: 'Diesel' },
    { tx: 'T092', dealer: 'D009', make: 'Opel', model: 'Grandland',     type: 'SUV',        price: 18200, date: '2026-02-05', yr: 2021, km: 52000, fuel: 'Diesel' },
    { tx: 'T093', dealer: 'D009', make: 'Ford', model: 'Puma',          type: 'SUV',        price: 17500, date: '2026-02-22', yr: 2022, km: 28000, fuel: 'Benzin' },
    { tx: 'T094', dealer: 'D009', make: 'Opel', model: 'Corsa',         type: 'Kleinwagen', price: 10500, date: '2026-03-10', yr: 2021, km: 38000, fuel: 'Benzin' },
    { tx: 'T095', dealer: 'D009', make: 'Seat', model: 'Ateca',         type: 'SUV',        price: 20200, date: '2026-03-28', yr: 2021, km: 42000, fuel: 'Diesel' },
    { tx: 'T096', dealer: 'D009', make: 'Ford', model: 'Fiesta',        type: 'Kleinwagen', price: 9200,  date: '2026-04-15', yr: 2020, km: 55000, fuel: 'Benzin' },
    { tx: 'T097', dealer: 'D009', make: 'Opel', model: 'Mokka-e',       type: 'SUV',        price: 21000, date: '2026-05-02', yr: 2023, km: 15000, fuel: 'Elektro' },

    // D010 Norddeutsche KFZ Börse — All brands (10 purchases)
    { tx: 'T098', dealer: 'D010', make: 'VW',            model: 'Passat',     type: 'Kombi',      price: 16200, date: '2025-10-25', yr: 2020, km: 85000, fuel: 'Diesel' },
    { tx: 'T099', dealer: 'D010', make: 'BMW',           model: '320d',       type: 'Kombi',      price: 15000, date: '2025-11-18', yr: 2021, km: 78000, fuel: 'Diesel' },
    { tx: 'T100', dealer: 'D010', make: 'Mercedes-Benz', model: 'A 200',      type: 'Kleinwagen', price: 19500, date: '2025-12-12', yr: 2022, km: 28000, fuel: 'Benzin' },
    { tx: 'T101', dealer: 'D010', make: 'Toyota',        model: 'RAV4',       type: 'SUV',        price: 27000, date: '2026-01-08', yr: 2022, km: 32000, fuel: 'Hybrid' },
    { tx: 'T102', dealer: 'D010', make: 'Hyundai',       model: 'Tucson',     type: 'SUV',        price: 23000, date: '2026-02-02', yr: 2022, km: 30000, fuel: 'Hybrid' },
    { tx: 'T103', dealer: 'D010', make: 'Ford',          model: 'Focus',      type: 'Kombi',      price: 11500, date: '2026-02-20', yr: 2020, km: 82000, fuel: 'Diesel' },
    { tx: 'T104', dealer: 'D010', make: 'Skoda',         model: 'Octavia',    type: 'Kombi',      price: 14000, date: '2026-03-10', yr: 2021, km: 68000, fuel: 'Diesel' },
    { tx: 'T105', dealer: 'D010', make: 'Opel',          model: 'Corsa-e',    type: 'Kleinwagen', price: 17000, date: '2026-03-28', yr: 2022, km: 22000, fuel: 'Elektro' },
    { tx: 'T106', dealer: 'D010', make: 'Audi',          model: 'A3',         type: 'Kleinwagen', price: 20000, date: '2026-04-15', yr: 2022, km: 30000, fuel: 'Benzin' },
    { tx: 'T107', dealer: 'D010', make: 'VW',            model: 'Tiguan',     type: 'SUV',        price: 21800, date: '2026-05-05', yr: 2021, km: 52000, fuel: 'Diesel' },

    // D011 Alpen Auto München — BMW, Audi, Porsche (12 purchases)
    { tx: 'T108', dealer: 'D011', make: 'BMW',     model: '530d',       type: 'Limousine', price: 33000, date: '2025-09-15', yr: 2022, km: 42000, fuel: 'Diesel' },
    { tx: 'T109', dealer: 'D011', make: 'Audi',    model: 'Q7',         type: 'SUV',       price: 46000, date: '2025-10-22', yr: 2021, km: 48000, fuel: 'Diesel' },
    { tx: 'T110', dealer: 'D011', make: 'Porsche', model: 'Macan',      type: 'SUV',       price: 44000, date: '2025-11-10', yr: 2021, km: 42000, fuel: 'Benzin' },
    { tx: 'T111', dealer: 'D011', make: 'BMW',     model: 'X5',         type: 'SUV',       price: 42500, date: '2025-12-05', yr: 2021, km: 55000, fuel: 'Diesel' },
    { tx: 'T112', dealer: 'D011', make: 'Audi',    model: 'A6 Avant',   type: 'Kombi',     price: 32000, date: '2026-01-10', yr: 2021, km: 62000, fuel: 'Diesel' },
    { tx: 'T113', dealer: 'D011', make: 'BMW',     model: 'M3',         type: 'Limousine', price: 59000, date: '2026-02-02', yr: 2022, km: 18000, fuel: 'Benzin' },
    { tx: 'T114', dealer: 'D011', make: 'Porsche', model: 'Cayenne',    type: 'SUV',       price: 57000, date: '2026-02-18', yr: 2022, km: 25000, fuel: 'Benzin' },
    { tx: 'T115', dealer: 'D011', make: 'Audi',    model: 'e-tron GT',  type: 'Limousine', price: 65000, date: '2026-03-05', yr: 2023, km: 12000, fuel: 'Elektro' },
    { tx: 'T116', dealer: 'D011', make: 'BMW',     model: '330e',       type: 'Limousine', price: 29500, date: '2026-03-22', yr: 2022, km: 35000, fuel: 'Hybrid' },
    { tx: 'T117', dealer: 'D011', make: 'BMW',     model: 'X3',         type: 'SUV',       price: 31000, date: '2026-04-08', yr: 2022, km: 40000, fuel: 'Diesel' },
    { tx: 'T118', dealer: 'D011', make: 'Audi',    model: 'A5 Sportback', type: 'Limousine', price: 29000, date: '2026-04-25', yr: 2022, km: 32000, fuel: 'Benzin' },
    { tx: 'T119', dealer: 'D011', make: 'Porsche', model: 'Taycan',     type: 'Limousine', price: 70000, date: '2026-05-10', yr: 2023, km: 10000, fuel: 'Elektro' },

    // D012 Dresdner Fahrzeugmarkt — VW, Skoda, Hyundai (11 purchases)
    { tx: 'T120', dealer: 'D012', make: 'VW',      model: 'Golf',       type: 'Kleinwagen', price: 14000, date: '2025-10-05', yr: 2020, km: 62000, fuel: 'Benzin' },
    { tx: 'T121', dealer: 'D012', make: 'Skoda',   model: 'Octavia',    type: 'Kombi',      price: 13800, date: '2025-11-12', yr: 2021, km: 68000, fuel: 'Diesel' },
    { tx: 'T122', dealer: 'D012', make: 'Hyundai', model: 'Tucson',     type: 'SUV',        price: 23500, date: '2025-12-02', yr: 2022, km: 30000, fuel: 'Hybrid' },
    { tx: 'T123', dealer: 'D012', make: 'VW',      model: 'Passat',     type: 'Kombi',      price: 15500, date: '2026-01-08', yr: 2020, km: 88000, fuel: 'Diesel' },
    { tx: 'T124', dealer: 'D012', make: 'Skoda',   model: 'Superb',     type: 'Kombi',      price: 17800, date: '2026-01-25', yr: 2021, km: 60000, fuel: 'Diesel' },
    { tx: 'T125', dealer: 'D012', make: 'Hyundai', model: 'i30',        type: 'Kombi',      price: 12800, date: '2026-02-10', yr: 2021, km: 52000, fuel: 'Diesel' },
    { tx: 'T126', dealer: 'D012', make: 'VW',      model: 'T-Roc',      type: 'SUV',        price: 21000, date: '2026-02-28', yr: 2021, km: 45000, fuel: 'Diesel' },
    { tx: 'T127', dealer: 'D012', make: 'Skoda',   model: 'Karoq',      type: 'SUV',        price: 19500, date: '2026-03-15', yr: 2021, km: 42000, fuel: 'Benzin' },
    { tx: 'T128', dealer: 'D012', make: 'Hyundai', model: 'Kona',       type: 'SUV',        price: 27500, date: '2026-04-02', yr: 2022, km: 18000, fuel: 'Elektro' },
    { tx: 'T129', dealer: 'D012', make: 'VW',      model: 'Polo',       type: 'Kleinwagen', price: 11000, date: '2026-04-18', yr: 2021, km: 35000, fuel: 'Benzin' },
    { tx: 'T130', dealer: 'D012', make: 'Skoda',   model: 'Enyaq',      type: 'SUV',        price: 32000, date: '2026-05-08', yr: 2023, km: 12000, fuel: 'Elektro' },
  ];

  const insertPurchase = db.prepare(`
    INSERT OR REPLACE INTO purchase_history
      (transaction_id, dealer_id, purchased_make, purchased_model, purchased_body_type,
       purchase_price, purchased_at, purchased_year, purchased_mileage, purchased_fuel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertPurchasesTx = db.transaction(() => {
    for (const p of purchases) {
      insertPurchase.run(p.tx, p.dealer, p.make, p.model, p.type, p.price, p.date, p.yr, p.km, p.fuel);
    }
  });
  insertPurchasesTx();

  console.log(`Seeded: ${dealers.length} dealers, ${vehicles.length} vehicles, ${purchases.length} purchases`);

  // =========================================================================
  // 4. RUN MATCHING ENGINE (build profiles + score)
  // =========================================================================
  console.log('Building dealer profiles and running matching...');
  try {
    const MatchingEngine = require('./services/matching-engine');
    const engine = new MatchingEngine();
    const profileCount = engine.buildDealerProfiles();
    console.log(`  Built ${profileCount} dealer profiles`);

    const today = new Date().toISOString().split('T')[0];
    const result = engine.runMatching(today);
    console.log(`  Matching: ${result.matchesTotal} matches from ${result.vehiclesCount} vehicles x ${result.dealersCount} dealers`);
  } catch (err) {
    console.warn('  Matching engine not available, skipping profile build:', err.message);
  }

  // =========================================================================
  // 5. DEALER ACTIONS (~40 records)
  // =========================================================================
  console.log('Seeding dealer actions...');
  const dealerActions = [
    // 15 'contact' actions — dealers who clicked "Get in touch"
    { dealer: 'D001', vehicle: 'V001', action: 'contact', reason: null, link: null, daysAgo: 5 },
    { dealer: 'D001', vehicle: 'V009', action: 'contact', reason: null, link: null, daysAgo: 3 },
    { dealer: 'D001', vehicle: 'V016', action: 'contact', reason: null, link: null, daysAgo: 2 },
    { dealer: 'D004', vehicle: 'V030', action: 'contact', reason: null, link: null, daysAgo: 7 },
    { dealer: 'D004', vehicle: 'V035', action: 'contact', reason: null, link: null, daysAgo: 4 },
    { dealer: 'D005', vehicle: 'V019', action: 'contact', reason: null, link: null, daysAgo: 6 },
    { dealer: 'D005', vehicle: 'V055', action: 'contact', reason: null, link: null, daysAgo: 2 },
    { dealer: 'D007', vehicle: 'V005', action: 'contact', reason: null, link: null, daysAgo: 8 },
    { dealer: 'D007', vehicle: 'V033', action: 'contact', reason: null, link: null, daysAgo: 1 },
    { dealer: 'D008', vehicle: 'V020', action: 'contact', reason: null, link: null, daysAgo: 5 },
    { dealer: 'D008', vehicle: 'V057', action: 'contact', reason: null, link: null, daysAgo: 3 },
    { dealer: 'D009', vehicle: 'V062', action: 'contact', reason: null, link: null, daysAgo: 4 },
    { dealer: 'D010', vehicle: 'V085', action: 'contact', reason: null, link: null, daysAgo: 6 },
    { dealer: 'D011', vehicle: 'V007', action: 'contact', reason: null, link: null, daysAgo: 2 },
    { dealer: 'D012', vehicle: 'V071', action: 'contact', reason: null, link: null, daysAgo: 3 },

    // 25 'not_interested' actions (8 with external_link)
    { dealer: 'D001', vehicle: 'V042', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 6 },
    { dealer: 'D001', vehicle: 'V062', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 4 },
    { dealer: 'D002', vehicle: 'V007', action: 'not_interested', reason: 'price_too_high',   link: 'https://www.mobile.de/fahrzeug/384756291', daysAgo: 7 },
    { dealer: 'D002', vehicle: 'V055', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 5 },
    { dealer: 'D002', vehicle: 'V057', action: 'not_interested', reason: 'price_too_high',   link: null, daysAgo: 3 },
    { dealer: 'D003', vehicle: 'V056', action: 'not_interested', reason: 'price_too_high',   link: 'https://www.autoscout24.de/angebote/67890123', daysAgo: 8 },
    { dealer: 'D003', vehicle: 'V006', action: 'not_interested', reason: 'too_high_mileage', link: null, daysAgo: 6 },
    { dealer: 'D004', vehicle: 'V055', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 5 },
    { dealer: 'D004', vehicle: 'V077', action: 'not_interested', reason: 'wrong_brand',      link: 'https://www.mobile.de/fahrzeug/192837465', daysAgo: 3 },
    { dealer: 'D005', vehicle: 'V042', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 7 },
    { dealer: 'D005', vehicle: 'V070', action: 'not_interested', reason: 'wrong_type',       link: null, daysAgo: 4 },
    { dealer: 'D006', vehicle: 'V058', action: 'not_interested', reason: 'price_too_high',   link: 'https://www.autoscout24.de/angebote/44556677', daysAgo: 9 },
    { dealer: 'D006', vehicle: 'V037', action: 'not_interested', reason: 'price_too_high',   link: null, daysAgo: 6 },
    { dealer: 'D007', vehicle: 'V062', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 5 },
    { dealer: 'D007', vehicle: 'V070', action: 'not_interested', reason: 'wrong_brand',      link: 'https://www.mobile.de/fahrzeug/556677889', daysAgo: 3 },
    { dealer: 'D008', vehicle: 'V043', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 6 },
    { dealer: 'D008', vehicle: 'V015', action: 'not_interested', reason: 'too_high_mileage', link: 'https://www.autoscout24.de/angebote/99887766', daysAgo: 4 },
    { dealer: 'D009', vehicle: 'V007', action: 'not_interested', reason: 'price_too_high',   link: null, daysAgo: 7 },
    { dealer: 'D009', vehicle: 'V056', action: 'not_interested', reason: 'price_too_high',   link: 'https://www.mobile.de/fahrzeug/778899001', daysAgo: 5 },
    { dealer: 'D010', vehicle: 'V058', action: 'not_interested', reason: 'price_too_high',   link: null, daysAgo: 6 },
    { dealer: 'D010', vehicle: 'V090', action: 'not_interested', reason: 'wrong_type',       link: null, daysAgo: 3 },
    { dealer: 'D011', vehicle: 'V043', action: 'not_interested', reason: 'wrong_brand',      link: null, daysAgo: 5 },
    { dealer: 'D011', vehicle: 'V070', action: 'not_interested', reason: 'too_far',          link: null, daysAgo: 2 },
    { dealer: 'D012', vehicle: 'V007', action: 'not_interested', reason: 'price_too_high',   link: 'https://www.autoscout24.de/angebote/11223344', daysAgo: 4 },
    { dealer: 'D012', vehicle: 'V057', action: 'not_interested', reason: 'price_too_high',   link: null, daysAgo: 1 },
  ];

  const insertAction = db.prepare(`
    INSERT INTO dealer_actions (dealer_id, vehicle_id, action_type, decline_reason, external_link, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' days'))
  `);
  const insertActionsTx = db.transaction(() => {
    for (const a of dealerActions) {
      insertAction.run(a.dealer, a.vehicle, a.action, a.reason, a.link, a.daysAgo);
    }
  });
  insertActionsTx();

  // =========================================================================
  // 6. DEALER SEARCH PROFILES (6 records)
  // =========================================================================
  console.log('Seeding dealer search profiles...');
  const searchProfiles = [
    {
      dealer: 'D001',
      makes: JSON.stringify(['BMW', 'Mercedes-Benz']),
      models: JSON.stringify(['320d', '520d', 'C 200', 'E 220d', 'X3']),
      types: JSON.stringify(['Kombi', 'Limousine', 'SUV']),
      fuels: JSON.stringify(['Diesel', 'Benzin']),
      priceMin: 12000, priceMax: 45000, yearMin: 2020, mileageMax: 120000,
    },
    {
      dealer: 'D002',
      makes: JSON.stringify(['VW', 'Opel', 'Skoda']),
      models: JSON.stringify(['Golf', 'Passat', 'Tiguan', 'Astra', 'Octavia']),
      types: JSON.stringify(['Kleinwagen', 'Kombi', 'SUV']),
      fuels: JSON.stringify(['Benzin', 'Diesel']),
      priceMin: 8000, priceMax: 25000, yearMin: 2019, mileageMax: 100000,
    },
    {
      dealer: 'D005',
      makes: JSON.stringify(['Mercedes-Benz', 'Porsche']),
      models: JSON.stringify(['GLC 300', 'E 220d', 'Macan', 'Cayenne', 'S 350d']),
      types: JSON.stringify(['SUV', 'Limousine']),
      fuels: JSON.stringify(['Benzin', 'Diesel']),
      priceMin: 25000, priceMax: 70000, yearMin: 2021, mileageMax: 60000,
    },
    {
      dealer: 'D009',
      makes: JSON.stringify(['Ford', 'Opel', 'Seat']),
      models: JSON.stringify(['Focus', 'Kuga', 'Puma', 'Astra', 'Leon']),
      types: JSON.stringify(['Kombi', 'SUV', 'Kleinwagen']),
      fuels: JSON.stringify(['Diesel', 'Benzin', 'Elektro']),
      priceMin: 8000, priceMax: 25000, yearMin: 2019, mileageMax: 100000,
    },
    {
      dealer: 'D011',
      makes: JSON.stringify(['BMW', 'Audi', 'Porsche']),
      models: JSON.stringify(['530d', 'X5', 'M3', 'Q7', 'A6 Avant', 'Macan', 'Cayenne']),
      types: JSON.stringify(['SUV', 'Limousine', 'Kombi']),
      fuels: JSON.stringify(['Diesel', 'Benzin', 'Hybrid', 'Elektro']),
      priceMin: 25000, priceMax: 75000, yearMin: 2021, mileageMax: 60000,
    },
    {
      dealer: 'D012',
      makes: JSON.stringify(['VW', 'Skoda', 'Hyundai']),
      models: JSON.stringify(['Golf', 'Passat', 'T-Roc', 'Octavia', 'Superb', 'Tucson', 'Kona']),
      types: JSON.stringify(['Kombi', 'SUV', 'Kleinwagen']),
      fuels: JSON.stringify(['Diesel', 'Benzin', 'Hybrid', 'Elektro']),
      priceMin: 10000, priceMax: 35000, yearMin: 2020, mileageMax: 90000,
    },
  ];

  const insertSearchProfile = db.prepare(`
    INSERT INTO dealer_search_profiles (dealer_id, wanted_makes, wanted_models, wanted_types, wanted_fuels, price_min, price_max, year_min, mileage_max, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-3 days'), datetime('now'))
  `);
  const insertSearchProfilesTx = db.transaction(() => {
    for (const sp of searchProfiles) {
      insertSearchProfile.run(sp.dealer, sp.makes, sp.models, sp.types, sp.fuels, sp.priceMin, sp.priceMax, sp.yearMin, sp.mileageMax);
    }
  });
  insertSearchProfilesTx();

  // =========================================================================
  // 7. PUSH LOG (~20 records)
  // =========================================================================
  console.log('Seeding push log...');
  const pushLogEntries = [
    { dealer: 'D001', matchIds: '[1,2,3]',     vehicles: 3, status: 'sent',   daysAgo: 7 },
    { dealer: 'D002', matchIds: '[4,5]',        vehicles: 2, status: 'sent',   daysAgo: 7 },
    { dealer: 'D005', matchIds: '[6,7,8]',      vehicles: 3, status: 'sent',   daysAgo: 7 },
    { dealer: 'D007', matchIds: '[9,10]',       vehicles: 2, status: 'sent',   daysAgo: 7 },
    { dealer: 'D001', matchIds: '[11,12,13,14]', vehicles: 4, status: 'sent', daysAgo: 6 },
    { dealer: 'D003', matchIds: '[15,16]',      vehicles: 2, status: 'sent',   daysAgo: 6 },
    { dealer: 'D004', matchIds: '[17,18,19]',   vehicles: 3, status: 'sent',   daysAgo: 6 },
    { dealer: 'D008', matchIds: '[20,21]',      vehicles: 2, status: 'sent',   daysAgo: 6 },
    { dealer: 'D009', matchIds: '[22,23,24]',   vehicles: 3, status: 'sent',   daysAgo: 5 },
    { dealer: 'D010', matchIds: '[25,26]',      vehicles: 2, status: 'sent',   daysAgo: 5 },
    { dealer: 'D011', matchIds: '[27,28,29]',   vehicles: 3, status: 'sent',   daysAgo: 5 },
    { dealer: 'D012', matchIds: '[30,31]',      vehicles: 2, status: 'sent',   daysAgo: 5 },
    { dealer: 'D001', matchIds: '[32,33]',      vehicles: 2, status: 'sent',   daysAgo: 3 },
    { dealer: 'D005', matchIds: '[34,35,36]',   vehicles: 3, status: 'sent',   daysAgo: 3 },
    { dealer: 'D006', matchIds: '[37,38]',      vehicles: 2, status: 'sent',   daysAgo: 3 },
    { dealer: 'D011', matchIds: '[39,40,41]',   vehicles: 3, status: 'sent',   daysAgo: 2 },
    { dealer: 'D002', matchIds: '[42,43]',      vehicles: 2, status: 'sent',   daysAgo: 1 },
    { dealer: 'D004', matchIds: '[44,45]',      vehicles: 2, status: 'sent',   daysAgo: 1 },
    { dealer: 'D008', matchIds: '[46,47,48]',   vehicles: 3, status: 'queued', daysAgo: 0 },
    { dealer: 'D012', matchIds: '[49,50]',      vehicles: 2, status: 'queued', daysAgo: 0 },
  ];

  const insertPushLog = db.prepare(`
    INSERT INTO push_log (dealer_id, match_ids, payload, status, sent_at, created_at)
    VALUES (?, ?, ?, ?, datetime('now', '-' || ? || ' days'), datetime('now', '-' || ? || ' days'))
  `);
  const insertPushLogTx = db.transaction(() => {
    for (const pl of pushLogEntries) {
      const payload = JSON.stringify({
        title: `${pl.vehicles} neue Fahrzeuge passen zu Ihrem Profil`,
        body: `Wir haben ${pl.vehicles} passende Angebote für Sie gefunden. Jetzt ansehen!`,
        data: { matchIds: JSON.parse(pl.matchIds), dealerId: pl.dealer },
      });
      insertPushLog.run(pl.dealer, pl.matchIds, payload, pl.status, pl.daysAgo, pl.daysAgo);
    }
  });
  insertPushLogTx();

  console.log(`Seeded: ${dealerActions.length} dealer actions, ${searchProfiles.length} search profiles, ${pushLogEntries.length} push log entries`);
  console.log('Done! Run "npm run start" to launch the server.');
}

if (require.main === module) {
  seed();
  closeDb();
}

module.exports = { seed };

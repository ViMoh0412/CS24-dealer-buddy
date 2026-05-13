const { getDb, closeDb } = require('./config/database');
const { migrate } = require('./migrate');

function seed() {
  migrate();
  const db = getDb();

  console.log('Seeding dealers...');
  const dealers = [
    { id: 'D001', name: 'Autohaus Müller', plz: '80331', email: 'mueller@autohaus.de', phone: '+49 89 1234567', spec: 'BMW, Mercedes Specialist', radius: 200 },
    { id: 'D002', name: 'Auto König GmbH', plz: '40210', email: 'info@autokoenig.de', phone: '+49 211 9876543', spec: 'VW, Opel, Skoda', radius: 150 },
    { id: 'D003', name: 'Schmidt Automobile', plz: '10115', email: 'kontakt@schmidt-auto.de', phone: '+49 30 5551234', spec: 'All brands', radius: 250 },
    { id: 'D004', name: 'Fahrzeughaus Weber', plz: '60311', email: 'weber@fhw.de', phone: '+49 69 4445556', spec: 'Audi, BMW', radius: 180 },
    { id: 'D005', name: 'Riedel & Söhne KFZ', plz: '70173', email: 'info@riedel-kfz.de', phone: '+49 711 3332221', spec: 'Mercedes, Porsche', radius: 200 },
    { id: 'D006', name: 'Kfz-Center Hamburg', plz: '20095', email: 'info@kfz-hh.de', phone: '+49 40 8887766', spec: 'All brands', radius: 300 },
    { id: 'D007', name: 'Bayerische Autohandel', plz: '90402', email: 'info@bay-auto.de', phone: '+49 911 2223344', spec: 'BMW, Audi', radius: 250 },
    { id: 'D008', name: 'Prestige Cars Köln', plz: '50667', email: 'info@prestige-koeln.de', phone: '+49 221 5556677', spec: 'Mercedes, Porsche, BMW', radius: 200 },
  ];

  const insertDealer = db.prepare(`
    INSERT OR REPLACE INTO dealers (dealer_id, company_name, postal_code, email, phone, specialization, max_pickup_radius_km, preferred_lang)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'de')
  `);
  for (const d of dealers) {
    insertDealer.run(d.id, d.name, d.plz, d.email, d.phone, d.spec, d.radius);
  }

  console.log('Seeding vehicles...');
  const vehicles = [
    { id: 'V001', make: 'BMW', model: '320d Touring', type: 'Kombi', price: 14500, yr: 2021, km: 87500, fuel: 'Diesel', plz: '80331', trans: 'Automatik' },
    { id: 'V002', make: 'Mercedes-Benz', model: 'C 200 Limousine', type: 'Limousine', price: 22900, yr: 2022, km: 45200, fuel: 'Benzin', plz: '20095', trans: 'Automatik' },
    { id: 'V003', make: 'Audi', model: 'A4 Avant 40 TDI', type: 'Kombi', price: 18750, yr: 2020, km: 112000, fuel: 'Diesel', plz: '10115', trans: 'Automatik' },
    { id: 'V004', make: 'VW', model: 'Golf 8 GTI', type: 'Kleinwagen', price: 28400, yr: 2023, km: 22300, fuel: 'Benzin', plz: '50667', trans: 'Manuell' },
    { id: 'V005', make: 'Opel', model: 'Astra Sports Tourer', type: 'Kombi', price: 11200, yr: 2021, km: 68900, fuel: 'Diesel', plz: '60311', trans: 'Manuell' },
    { id: 'V006', make: 'BMW', model: '520d Touring', type: 'Kombi', price: 19800, yr: 2020, km: 95000, fuel: 'Diesel', plz: '86150', trans: 'Automatik' },
    { id: 'V007', make: 'Mercedes-Benz', model: 'E 220d T-Modell', type: 'Kombi', price: 26400, yr: 2021, km: 68000, fuel: 'Diesel', plz: '90402', trans: 'Automatik' },
    { id: 'V008', make: 'Audi', model: 'Q5 45 TFSI', type: 'SUV', price: 32500, yr: 2022, km: 35000, fuel: 'Benzin', plz: '70173', trans: 'Automatik' },
    { id: 'V009', make: 'VW', model: 'Passat Variant 2.0 TDI', type: 'Kombi', price: 15600, yr: 2020, km: 98000, fuel: 'Diesel', plz: '40210', trans: 'Automatik' },
    { id: 'V010', make: 'Porsche', model: 'Macan S', type: 'SUV', price: 48900, yr: 2021, km: 42000, fuel: 'Benzin', plz: '70173', trans: 'Automatik' },
    { id: 'V011', make: 'BMW', model: 'X3 xDrive20d', type: 'SUV', price: 28700, yr: 2021, km: 62000, fuel: 'Diesel', plz: '80331', trans: 'Automatik' },
    { id: 'V012', make: 'Mercedes-Benz', model: 'A 200', type: 'Kleinwagen', price: 19500, yr: 2022, km: 28000, fuel: 'Benzin', plz: '20095', trans: 'Automatik' },
    { id: 'V013', make: 'Skoda', model: 'Octavia Combi', type: 'Kombi', price: 12800, yr: 2021, km: 75000, fuel: 'Diesel', plz: '40210', trans: 'Manuell' },
    { id: 'V014', make: 'BMW', model: '330e Limousine', type: 'Limousine', price: 31200, yr: 2022, km: 38000, fuel: 'Hybrid', plz: '80331', trans: 'Automatik' },
    { id: 'V015', make: 'Audi', model: 'A3 Sportback', type: 'Kleinwagen', price: 21500, yr: 2022, km: 32000, fuel: 'Benzin', plz: '60311', trans: 'Automatik' },
    { id: 'V016', make: 'VW', model: 'Tiguan 2.0 TDI', type: 'SUV', price: 24800, yr: 2021, km: 55000, fuel: 'Diesel', plz: '50667', trans: 'Automatik' },
    { id: 'V017', make: 'Opel', model: 'Mokka-e', type: 'SUV', price: 22100, yr: 2023, km: 15000, fuel: 'Elektro', plz: '10115', trans: 'Automatik' },
    { id: 'V018', make: 'Mercedes-Benz', model: 'GLC 300', type: 'SUV', price: 38500, yr: 2022, km: 29000, fuel: 'Benzin', plz: '70173', trans: 'Automatik' },
  ];

  const insertVehicle = db.prepare(`
    INSERT OR REPLACE INTO vehicles (vehicle_id, make, model, body_type, price, year, first_registration, mileage_km, fuel_type, transmission, postal_code, listed_at, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || abs(random() % 48) || ' hours'), 1)
  `);
  for (const v of vehicles) {
    insertVehicle.run(v.id, v.make, v.model, v.type, v.price, v.yr, `${v.yr}-01`, v.km, v.fuel, v.trans, v.plz);
  }

  console.log('Seeding purchase history...');
  const purchases = [
    // Autohaus Müller (D001) — BMW & Mercedes specialist
    { tx: 'T001', dealer: 'D001', make: 'BMW', model: '320d', type: 'Kombi', price: 13200, date: '2025-11-15', yr: 2020, km: 92000, fuel: 'Diesel' },
    { tx: 'T002', dealer: 'D001', make: 'BMW', model: '520d', type: 'Kombi', price: 21500, date: '2025-12-03', yr: 2021, km: 78000, fuel: 'Diesel' },
    { tx: 'T003', dealer: 'D001', make: 'Mercedes-Benz', model: 'C 200', type: 'Limousine', price: 24000, date: '2026-01-10', yr: 2021, km: 55000, fuel: 'Benzin' },
    { tx: 'T004', dealer: 'D001', make: 'BMW', model: '330d', type: 'Limousine', price: 18900, date: '2026-02-20', yr: 2020, km: 88000, fuel: 'Diesel' },
    { tx: 'T005', dealer: 'D001', make: 'Mercedes-Benz', model: 'E 220d', type: 'Kombi', price: 27500, date: '2026-03-14', yr: 2021, km: 62000, fuel: 'Diesel' },
    { tx: 'T006', dealer: 'D001', make: 'BMW', model: 'X3', type: 'SUV', price: 29800, date: '2026-04-05', yr: 2022, km: 45000, fuel: 'Diesel' },
    { tx: 'T007', dealer: 'D001', make: 'Audi', model: 'A4 Avant', type: 'Kombi', price: 19200, date: '2026-04-22', yr: 2020, km: 105000, fuel: 'Diesel' },
    { tx: 'T008', dealer: 'D001', make: 'BMW', model: '320d', type: 'Kombi', price: 15800, date: '2026-05-01', yr: 2021, km: 82000, fuel: 'Diesel' },

    // Auto König (D002) — VW, Opel, Skoda
    { tx: 'T009', dealer: 'D002', make: 'VW', model: 'Golf', type: 'Kleinwagen', price: 14500, date: '2025-10-08', yr: 2020, km: 65000, fuel: 'Benzin' },
    { tx: 'T010', dealer: 'D002', make: 'Opel', model: 'Astra', type: 'Kombi', price: 10200, date: '2025-11-22', yr: 2019, km: 95000, fuel: 'Diesel' },
    { tx: 'T011', dealer: 'D002', make: 'VW', model: 'Passat', type: 'Kombi', price: 16800, date: '2026-01-05', yr: 2020, km: 88000, fuel: 'Diesel' },
    { tx: 'T012', dealer: 'D002', make: 'Skoda', model: 'Octavia', type: 'Kombi', price: 13500, date: '2026-02-15', yr: 2021, km: 72000, fuel: 'Diesel' },
    { tx: 'T013', dealer: 'D002', make: 'VW', model: 'Tiguan', type: 'SUV', price: 22000, date: '2026-03-10', yr: 2021, km: 58000, fuel: 'Diesel' },
    { tx: 'T014', dealer: 'D002', make: 'Opel', model: 'Mokka', type: 'SUV', price: 18500, date: '2026-04-18', yr: 2022, km: 35000, fuel: 'Benzin' },

    // Schmidt Automobile (D003) — All brands
    { tx: 'T015', dealer: 'D003', make: 'BMW', model: '118i', type: 'Kleinwagen', price: 18000, date: '2026-01-20', yr: 2021, km: 42000, fuel: 'Benzin' },
    { tx: 'T016', dealer: 'D003', make: 'VW', model: 'Golf', type: 'Kleinwagen', price: 15500, date: '2026-02-08', yr: 2021, km: 55000, fuel: 'Benzin' },
    { tx: 'T017', dealer: 'D003', make: 'Audi', model: 'A3', type: 'Kleinwagen', price: 20500, date: '2026-03-01', yr: 2022, km: 30000, fuel: 'Benzin' },
    { tx: 'T018', dealer: 'D003', make: 'Opel', model: 'Corsa-e', type: 'Kleinwagen', price: 16200, date: '2026-04-12', yr: 2022, km: 25000, fuel: 'Elektro' },
    { tx: 'T019', dealer: 'D003', make: 'Mercedes-Benz', model: 'A 200', type: 'Kleinwagen', price: 21000, date: '2026-05-02', yr: 2022, km: 28000, fuel: 'Benzin' },

    // Fahrzeughaus Weber (D004) — Audi, BMW
    { tx: 'T020', dealer: 'D004', make: 'Audi', model: 'A4', type: 'Limousine', price: 22000, date: '2025-12-10', yr: 2021, km: 65000, fuel: 'Diesel' },
    { tx: 'T021', dealer: 'D004', make: 'BMW', model: '520d', type: 'Limousine', price: 25000, date: '2026-01-28', yr: 2021, km: 72000, fuel: 'Diesel' },
    { tx: 'T022', dealer: 'D004', make: 'Audi', model: 'Q5', type: 'SUV', price: 31000, date: '2026-03-05', yr: 2022, km: 40000, fuel: 'Benzin' },
    { tx: 'T023', dealer: 'D004', make: 'BMW', model: '330d', type: 'Limousine', price: 28500, date: '2026-04-15', yr: 2022, km: 48000, fuel: 'Diesel' },

    // Riedel & Söhne (D005) — Mercedes, Porsche
    { tx: 'T024', dealer: 'D005', make: 'Mercedes-Benz', model: 'GLC 300', type: 'SUV', price: 38000, date: '2026-01-15', yr: 2022, km: 32000, fuel: 'Benzin' },
    { tx: 'T025', dealer: 'D005', make: 'Porsche', model: 'Macan', type: 'SUV', price: 45000, date: '2026-02-22', yr: 2021, km: 38000, fuel: 'Benzin' },
    { tx: 'T026', dealer: 'D005', make: 'Mercedes-Benz', model: 'E 220d', type: 'Kombi', price: 29000, date: '2026-03-20', yr: 2021, km: 55000, fuel: 'Diesel' },
    { tx: 'T027', dealer: 'D005', make: 'Porsche', model: 'Cayenne', type: 'SUV', price: 55000, date: '2026-04-08', yr: 2022, km: 28000, fuel: 'Benzin' },

    // Kfz-Center Hamburg (D006)
    { tx: 'T028', dealer: 'D006', make: 'VW', model: 'Golf', type: 'Kleinwagen', price: 13000, date: '2026-02-05', yr: 2020, km: 70000, fuel: 'Benzin' },
    { tx: 'T029', dealer: 'D006', make: 'BMW', model: '320d', type: 'Kombi', price: 16500, date: '2026-03-18', yr: 2021, km: 80000, fuel: 'Diesel' },
    { tx: 'T030', dealer: 'D006', make: 'Mercedes-Benz', model: 'C 200', type: 'Limousine', price: 23000, date: '2026-04-25', yr: 2022, km: 40000, fuel: 'Benzin' },

    // Bayerische Autohandel (D007)
    { tx: 'T031', dealer: 'D007', make: 'BMW', model: '520d', type: 'Kombi', price: 24000, date: '2026-01-12', yr: 2021, km: 68000, fuel: 'Diesel' },
    { tx: 'T032', dealer: 'D007', make: 'Audi', model: 'A6 Avant', type: 'Kombi', price: 28000, date: '2026-02-28', yr: 2021, km: 75000, fuel: 'Diesel' },
    { tx: 'T033', dealer: 'D007', make: 'BMW', model: 'X3', type: 'SUV', price: 32000, date: '2026-04-02', yr: 2022, km: 45000, fuel: 'Diesel' },

    // Prestige Cars Köln (D008)
    { tx: 'T034', dealer: 'D008', make: 'Mercedes-Benz', model: 'E 300', type: 'Limousine', price: 35000, date: '2026-01-08', yr: 2022, km: 35000, fuel: 'Benzin' },
    { tx: 'T035', dealer: 'D008', make: 'Porsche', model: 'Macan', type: 'SUV', price: 42000, date: '2026-02-14', yr: 2021, km: 40000, fuel: 'Benzin' },
    { tx: 'T036', dealer: 'D008', make: 'BMW', model: '530d', type: 'Limousine', price: 30000, date: '2026-03-22', yr: 2021, km: 65000, fuel: 'Diesel' },
  ];

  const insertPurchase = db.prepare(`
    INSERT OR REPLACE INTO purchase_history
      (transaction_id, dealer_id, purchased_make, purchased_model, purchased_body_type,
       purchase_price, purchased_at, purchased_year, purchased_mileage, purchased_fuel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of purchases) {
    insertPurchase.run(p.tx, p.dealer, p.make, p.model, p.type, p.price, p.date, p.yr, p.km, p.fuel);
  }

  console.log(`Seeded: ${dealers.length} dealers, ${vehicles.length} vehicles, ${purchases.length} purchases`);
  console.log('Done! Run "npm run start" to launch the server.');
}

if (require.main === module) {
  seed();
  closeDb();
}

module.exports = { seed };

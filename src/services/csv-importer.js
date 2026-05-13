const { parse } = require('csv-parse/sync');
const { getDb } = require('../config/database');

class CsvImporter {
  constructor() {
    this.db = getDb();
  }

  importVehicles(csvContent) {
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO vehicles
        (vehicle_id, make, model, body_type, price, first_registration, year,
         mileage_km, fuel_type, transmission, postal_code, condition_notes,
         image_url, hsn_tsn, listed_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const importAll = this.db.transaction((rows) => {
      let imported = 0;
      for (const row of rows) {
        const year = row.year || (row.first_registration ? parseInt(row.first_registration) : null);
        stmt.run(
          row.vehicle_id,
          row.make,
          row.model,
          row.body_type,
          parseFloat(row.price) || 0,
          row.first_registration || null,
          year,
          parseInt(row.mileage_km) || null,
          row.fuel_type || null,
          row.transmission || null,
          row.postal_code || null,
          row.condition_notes || null,
          row.image_url || null,
          row.hsn_tsn || null,
          row.listed_at || new Date().toISOString(),
        );
        imported++;
      }
      return imported;
    });

    return importAll(records);
  }

  importPurchaseHistory(csvContent) {
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO purchase_history
        (transaction_id, dealer_id, purchased_make, purchased_model,
         purchased_body_type, purchase_price, purchased_at, purchased_year,
         purchased_mileage, purchased_fuel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const importAll = this.db.transaction((rows) => {
      let imported = 0;
      for (const row of rows) {
        stmt.run(
          row.transaction_id,
          row.dealer_id,
          row.purchased_make,
          row.purchased_model,
          row.purchased_body_type,
          parseFloat(row.purchase_price) || 0,
          row.purchased_at,
          parseInt(row.purchased_year) || null,
          parseInt(row.purchased_mileage) || null,
          row.purchased_fuel || null,
        );
        imported++;
      }
      return imported;
    });

    return importAll(records);
  }

  importDealers(csvContent) {
    const records = parse(csvContent, { columns: true, skip_empty_lines: true, trim: true });
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO dealers
        (dealer_id, company_name, postal_code, email, phone,
         specialization, max_pickup_radius_km)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const importAll = this.db.transaction((rows) => {
      let imported = 0;
      for (const row of rows) {
        stmt.run(
          row.dealer_id,
          row.company_name,
          row.postal_code,
          row.email || null,
          row.phone || null,
          row.specialization || null,
          parseInt(row.max_pickup_radius_km) || 200,
        );
        imported++;
      }
      return imported;
    });

    return importAll(records);
  }
}

module.exports = CsvImporter;

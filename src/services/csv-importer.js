const { parse } = require('csv-parse/sync');
const crypto = require('crypto');
const XLSX = require('xlsx');
const { getDb } = require('../config/database');

class CsvImporter {
  constructor() {
    this.db = getDb();
  }

  _parseInput(bufferOrString, originalName) {
    if (originalName && /\.xlsx?$/i.test(originalName)) {
      const wb = XLSX.read(bufferOrString, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { defval: '' });
    }
    const content = typeof bufferOrString === 'string' ? bufferOrString : bufferOrString.toString('utf-8');
    return parse(content, { columns: true, skip_empty_lines: true, trim: true });
  }

  importVehicles(data, originalName) {
    const records = this._parseInput(data, originalName);
    const checkExisting = this.db.prepare('SELECT 1 FROM vehicles WHERE vehicle_id = ?');
    const stmt = this.db.prepare(`
      INSERT INTO vehicles
        (vehicle_id, make, model, body_type, price, first_registration, year,
         mileage_km, fuel_type, transmission, postal_code, condition_notes,
         image_url, hsn_tsn, listed_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    let imported = 0;
    let duplicates = 0;

    const importAll = this.db.transaction((rows) => {
      for (const row of rows) {
        if (checkExisting.get(row.vehicle_id)) {
          duplicates++;
          continue;
        }
        const year = row.year || (row.first_registration ? parseInt(row.first_registration) : null);
        stmt.run(
          row.vehicle_id, row.make, row.model, row.body_type,
          parseFloat(row.price) || 0, row.first_registration || null, year,
          parseInt(row.mileage_km) || null, row.fuel_type || null,
          row.transmission || null, row.postal_code || null,
          row.condition_notes || null, row.image_url || null,
          row.hsn_tsn || null, row.listed_at || new Date().toISOString(),
        );
        imported++;
      }
    });

    importAll(records);
    return { imported, duplicates, totalRows: records.length };
  }

  importPurchaseHistory(data, originalName) {
    const records = this._parseInput(data, originalName);
    const checkByTxId = this.db.prepare('SELECT 1 FROM purchase_history WHERE transaction_id = ?');
    const checkByData = this.db.prepare(`
      SELECT 1 FROM purchase_history
      WHERE dealer_id = ? AND purchased_make = ? AND purchased_model = ?
        AND purchase_price = ? AND purchased_at = ?
    `);
    const stmt = this.db.prepare(`
      INSERT INTO purchase_history
        (transaction_id, dealer_id, purchased_make, purchased_model,
         purchased_body_type, purchase_price, purchased_at, purchased_year,
         purchased_mileage, purchased_fuel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let imported = 0;
    let duplicates = 0;

    const importAll = this.db.transaction((rows) => {
      for (const row of rows) {
        if (row.transaction_id && checkByTxId.get(row.transaction_id)) {
          duplicates++;
          continue;
        }
        if (checkByData.get(row.dealer_id, row.purchased_make, row.purchased_model || '',
            parseFloat(row.purchase_price) || 0, row.purchased_at)) {
          duplicates++;
          continue;
        }
        const txId = row.transaction_id || `TX-${row.dealer_id}-${Date.now()}-${imported}`;
        stmt.run(
          txId, row.dealer_id, row.purchased_make, row.purchased_model,
          row.purchased_body_type, parseFloat(row.purchase_price) || 0,
          row.purchased_at, parseInt(row.purchased_year) || null,
          parseInt(row.purchased_mileage) || null, row.purchased_fuel || null,
        );
        imported++;
      }
    });

    importAll(records);
    return { imported, duplicates, totalRows: records.length };
  }

  _generatePassword() {
    return crypto.randomBytes(4).toString('hex').toUpperCase();
  }

  importDealers(data, originalName) {
    const records = this._parseInput(data, originalName);
    const checkExisting = this.db.prepare('SELECT 1 FROM dealers WHERE dealer_id = ?');
    const stmt = this.db.prepare(`
      INSERT INTO dealers
        (dealer_id, company_name, postal_code, email, phone,
         specialization, max_pickup_radius_km, dealer_password, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    let imported = 0;
    let duplicates = 0;
    const onboarded = [];

    const importAll = this.db.transaction((rows) => {
      for (const row of rows) {
        if (checkExisting.get(row.dealer_id)) {
          duplicates++;
          continue;
        }
        const password = row.dealer_password || this._generatePassword();
        stmt.run(
          row.dealer_id, row.company_name, row.postal_code,
          row.email || null, row.phone || null,
          row.specialization || null, parseInt(row.max_pickup_radius_km) || 200,
          password,
        );
        onboarded.push({
          dealer_id: row.dealer_id,
          company_name: row.company_name,
          email: row.email || '',
          password,
        });
        imported++;
      }
    });

    importAll(records);
    return { imported, duplicates, totalRows: records.length, onboarded };
  }

  importSalesPerformance(data, originalName) {
    const records = this._parseInput(data, originalName);
    const checkByTxId = this.db.prepare('SELECT 1 FROM purchase_history WHERE transaction_id = ?');
    const checkByData = this.db.prepare(`
      SELECT 1 FROM purchase_history
      WHERE dealer_id = ? AND purchased_make = ? AND purchased_model = ?
        AND purchase_price = ? AND purchased_at = ?
    `);
    const stmt = this.db.prepare(`
      INSERT INTO purchase_history
        (transaction_id, dealer_id, purchased_make, purchased_model,
         purchased_body_type, purchase_price, purchased_at, purchased_year,
         purchased_mileage, purchased_fuel)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const errors = [];
    let imported = 0;
    let duplicates = 0;
    let skipped = 0;

    const importAll = this.db.transaction((rows) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row.dealer_id || !row.purchased_make || !row.purchase_price || !row.purchased_at) {
          errors.push({ row: i + 2, reason: 'Missing required field (dealer_id, purchased_make, purchase_price, or purchased_at)' });
          skipped++;
          continue;
        }

        const price = parseFloat(row.purchase_price) || 0;
        const model = row.purchased_model || '';

        if (row.transaction_id && checkByTxId.get(row.transaction_id)) {
          duplicates++;
          continue;
        }
        if (checkByData.get(row.dealer_id, row.purchased_make, model, price, row.purchased_at)) {
          duplicates++;
          continue;
        }

        const txId = row.transaction_id || `AUTO-${row.dealer_id}-${row.purchased_at}-${i}`;
        stmt.run(
          txId, row.dealer_id, row.purchased_make, model,
          row.purchased_body_type || 'Limousine', price,
          row.purchased_at, parseInt(row.purchased_year) || null,
          parseInt(row.purchased_mileage) || null, row.purchased_fuel || null,
        );
        imported++;
      }
    });

    importAll(records);
    const dealerIds = [...new Set(records.map(r => r.dealer_id).filter(Boolean))];
    return { imported, duplicates, skipped, errors: errors.slice(0, 20), totalRows: records.length, dealerIds };
  }
}

module.exports = CsvImporter;

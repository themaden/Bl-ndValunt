import { pool } from "./db";
import { encryptString } from "./encryption";


type CustomerSeed = {
  name: string;
  email: string;
  segment: string;
};

const customers: CustomerSeed[] = [
  {
    name: "yasın Maden",
    email: "emel@example.com",
    segment: "Premium",
  },
  {
    name: "Ayşe Yılmaz",
    email: "ayse@example.com",
    segment: "Mass",
  },
  {
    name: "Mehmet Demir",
    email: "mehmet@example.com",
    segment: "Affluent",
  },
];

const categories = ["GIDA", "KONUT", "EGLENCE", "ULASIM", "DIGER"];

function randomAmount(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDateWithinDays(days: number): Date {
  const now = new Date();
  const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const timestamp =
    past.getTime() + Math.random() * (now.getTime() - past.getTime());
  return new Date(timestamp);
}

async function seed() {
  console.log("Seeding started...");

  try {
    // Temiz bir başlangıç için tabloları boşaltalım
    await pool.query("TRUNCATE TABLE scores RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE transactions RESTART IDENTITY CASCADE;");
    await pool.query("TRUNCATE TABLE customers RESTART IDENTITY CASCADE;");

    // Müşterileri ekle
    const insertedCustomers: { id: number; name: string }[] = [];
    for (const c of customers) {
      const result = await pool.query(
        `
        INSERT INTO customers (name, email, segment)
        VALUES ($1, $2, $3)
        RETURNING id, name;
      `,
        [c.name, c.email, c.segment]
      );
      insertedCustomers.push(result.rows[0]);
    }

    console.log("Inserted customers:", insertedCustomers);

    for (const customer of insertedCustomers) {
      await pool.query(
        `
        INSERT INTO consents (customer_id, allow_analytics)
        VALUES ($1, $2)
        ON CONFLICT (customer_id) DO UPDATE
        SET allow_analytics = EXCLUDED.allow_analytics,
            updated_at = NOW();
      `,
        [customer.id, true]
      );
    }

    console.log("Inserted consents for customers");


    // Her müşteri için 20 işlem üret
    for (const customer of insertedCustomers) {
      const txCount = 20;
      for (let i = 0; i < txCount; i++) {
        const amount = randomAmount(50, 15000);
        const category =
          categories[Math.floor(Math.random() * categories.length)];
        const txDate = randomDateWithinDays(90);
        const rawDataObject = {
  merchant: `Merchant-${Math.ceil(Math.random() * 50)}`,
  channel: Math.random() > 0.5 ? "POS" : "ONLINE",
  country: "TR",
};

// Önce JSON string'e çevir
const rawDataJson = JSON.stringify(rawDataObject);

// Sonra şifrele
const encryptedRawData = encryptString(rawDataJson);

await pool.query(
  `
  INSERT INTO transactions (customer_id, amount, currency, category, tx_date, raw_data)
  VALUES ($1, $2, $3, $4, $5, $6);
`,
  [
    customer.id,
    amount,
    "TRY",
    category,
    txDate.toISOString(),
    encryptedRawData,
  ]
);
      }
      console.log(`Inserted ${txCount} transactions for customer ${customer.name}`);
    }

    console.log("Seeding completed successfully.");
  } catch (error) {
    console.error("Error during seeding:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

seed();

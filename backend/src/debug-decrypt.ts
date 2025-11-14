import { pool } from "./db";
import { decryptString } from "./encryption";

async function run() {
  try {
    const res = await pool.query(
      "SELECT id, raw_data FROM transactions ORDER BY id ASC LIMIT 1"
    );
    if (res.rowCount === 0) {
      console.log("No transactions found.");
      return;
    }

    const row = res.rows[0];
    console.log("Encrypted raw_data:", row.raw_data);

    const decrypted = decryptString(row.raw_data);
    console.log("Decrypted JSON:", decrypted);
  } catch (error) {
    console.error("Error in debug-decrypt:", error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();

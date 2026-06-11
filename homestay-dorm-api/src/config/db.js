// Tầng kết nối CSDL: pool node-postgres tới Postgres của Supabase
import pg from 'pg'
import dotenv from 'dotenv'
dotenv.config()

const { Pool } = pg
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase yêu cầu SSL khi chạy thật; local thì tắt
  ssl: process.env.DATABASE_URL?.includes('supabase.co') ? { rejectUnauthorized: false } : false,
  // Ép dùng IPv4 thay vì IPv6 để tránh timeout
  family: 4,
})

// Helper truy vấn
export const query = (text, params) => pool.query(text, params)

// Helper chạy 1 transaction (nhiều câu lệnh nguyên tử)
export async function withTransaction(fn) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (e) {
    await client.query('ROLLBACK')
    throw e
  } finally {
    client.release()
  }
}
import dotenv from 'dotenv'; dotenv.config()
import bcrypt from 'bcryptjs'
import { pool } from '../src/config/db.js'
const hash = await bcrypt.hash('123456', 10)
await pool.query(`update nhan_vien set mat_khau_hash=$1 where email in ('sale@homestay.vn','manager@homestay.vn','accountant@homestay.vn')`, [hash])
console.log('Đã đặt mật khẩu demo (123456) cho 3 tài khoản nhân viên')
await pool.end()

import dotenv from 'dotenv'; dotenv.config()
import { createApp } from './app.js'
const port = process.env.PORT || 4000
createApp().listen(port, () => console.log(`HomeStay Dorm API chạy tại http://localhost:${port}`))

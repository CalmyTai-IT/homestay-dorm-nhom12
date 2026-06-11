import express from 'express'
import cors from 'cors'
import authRoutes from './routes/authRoutes.js'
import roomRoutes from './routes/roomRoutes.js'
import bookingRoutes from './routes/bookingRoutes.js'
import depositRoutes from './routes/depositRoutes.js'
import contractRoutes from './routes/contractRoutes.js'
import paymentRoutes from './routes/paymentRoutes.js'
import statsRoutes from './routes/statsRoutes.js'
import checkoutRoutes from './routes/checkoutRoutes.js'
import configRoutes from './routes/configRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import notifyRoutes from './routes/notifyRoutes.js'
import handoverRoutes from './routes/handoverRoutes.js'
import { errorHandler } from './middleware/errorHandler.js'

export function createApp() {
  const app = express()
  app.use(cors())
  app.use(express.json({ limit: '5mb' }))
  app.get('/api/health', (_req,res)=>res.json({ ok: true, service: 'homestay-dorm-api' }))
  app.use('/api/auth', authRoutes)
  app.use('/api/rooms', roomRoutes)
  app.use('/api/bookings', bookingRoutes)
  app.use('/api/deposits', depositRoutes)
  app.use('/api/contracts', contractRoutes)
  app.use('/api/payments', paymentRoutes)
  app.use('/api/checkouts', checkoutRoutes)
  app.use('/api/stats', statsRoutes)
  app.use('/api/config', configRoutes)
  app.use('/api/admin', adminRoutes)
  app.use('/api/notifications', notifyRoutes)
  app.use('/api/handovers', handoverRoutes)
  app.use(errorHandler)
  return app
}

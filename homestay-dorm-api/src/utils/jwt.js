import jwt from 'jsonwebtoken'
const SECRET = process.env.JWT_SECRET || 'dev_secret'
const EXPIRES = process.env.JWT_EXPIRES || '2d'
export const signToken = (payload, expiresIn = EXPIRES) => jwt.sign(payload, SECRET, { expiresIn })
export const verifyToken = (token) => jwt.verify(token, SECRET)

// Sinh mã nghiệp vụ (giống generateBookingCode/... ở frontend)
const rnd = () => Math.floor(1000 + Math.random() * 9000)
const year = () => new Date().getFullYear()
export const bookingCode  = () => `PDK-${year()}-${rnd()}`
export const depositCode  = () => `DC-${year()}-${rnd()}`
export const contractCode = () => `HD-${year()}-${rnd()}`
export const checkoutCode = () => `TP-${year()}-${rnd()}`

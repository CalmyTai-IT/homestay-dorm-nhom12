// Chứng minh SỬA LỖI tiền thuê/tháng: dùng so_thang_coc = 3 (khác mặc định 2).
// Đúng: tiền thuê/tháng = cọc / so_thang_coc = giá × số giường.
// Lỗi cũ (cọc/2) sẽ ra số khác -> test bắt được.
const BASE = 'http://localhost:4010/api'
let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  \u2713', m)) : (fail++, console.log('  \u2717 THẤT BẠI:', m)) }
const vnd = n => Number(n).toLocaleString('vi-VN') + 'đ'
const api = async (p, { method = 'GET', token, body } = {}) => {
  const r = await fetch(BASE + p, {
    method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: r.status, data: await r.json().catch(() => ({})) }
}

console.log('\n=== KIỂM THỬ SỬA LỖI TIỀN THUÊ/THÁNG (so_thang_coc = 3) ===\n')
const SO_THANG_COC = 3   // đã set trong DB trước khi chạy
const sale = (await api('/auth/staff/login', { method: 'POST', body: { email: 'sale@homestay.vn', password: '123456' } })).data
const mgr = (await api('/auth/staff/login', { method: 'POST', body: { email: 'manager@homestay.vn', password: '123456' } })).data
const acc = (await api('/auth/staff/login', { method: 'POST', body: { email: 'accountant@homestay.vn', password: '123456' } })).data

const email = `rent_${Date.now()}@t.vn`
const cust = (await api('/auth/customer/register', { method: 'POST', body: { hoTen: 'Khách thuê', email, password: '123456', gioiTinh: 'nam', soDienThoai: '0911111111', soGiayTo: '079111111111' } })).data
const rooms = (await api('/rooms', { token: sale.token })).data
const pick = rooms.find(r => r.loai_phong === 'o_ghep' && r.gioi_tinh_ap_dung === 'nam' && Number(r.giuong_trong) >= 2)
const gia = Number(pick.gia_thue_giuong)
const beds = 2

// Thuê CÁ NHÂN (không nhóm) 2 giường
const bk = (await api('/bookings', { method: 'POST', token: cust.token, body: { thoiHan: 12, tieuChi: {
  roomDbId: pick.id, roomId: pick.ma_phong, numberOfBeds: beds, numberOfPeople: beds, hasGroup: false,
} } })).data
const dep = (await api('/deposits', { method: 'POST', token: sale.token, body: { roomId: pick.id, rentType: 'bed', numberOfBeds: beds, khachHangId: cust.user.id, bookingCode: bk.ma_phieu, phieuDangKyId: bk.id } })).data
const coc = Number(dep.so_tien_coc)
ok(coc === gia * SO_THANG_COC * beds, `Cọc = giá×${SO_THANG_COC}×${beds} = ${vnd(coc)} (đúng theo so_thang_coc)`)

await api(`/deposits/${dep.ma_phieu}/reconcile`, { method: 'POST', token: acc.token, body: { soTienThucNhan: coc } })
await api(`/deposits/${dep.ma_phieu}/confirm`, { method: 'POST', token: mgr.token })

const ct = (await api('/contracts', { method: 'POST', token: mgr.token, body: { depositCode: dep.ma_phieu, ngayBatDau: '2026-07-01', thoiHan: 12 } })).data
const rent = Number(ct.gia_thue_thang)
const dung = gia * beds                 // = cọc / so_thang_coc
const loiCu = Math.round(coc / 2)       // công thức hardcode cũ

ok(rent === dung, `Tiền thuê/tháng = ${vnd(dung)} (= giá×${beds} giường = cọc/${SO_THANG_COC}) ✓ ĐÃ SỬA`)
ok(rent !== loiCu, `KHÁC công thức cũ cọc/2 (=${vnd(loiCu)}) — xác nhận lỗi đã hết`)
ok(rent * SO_THANG_COC === coc, `Nhất quán: tiền thuê × ${SO_THANG_COC} tháng = đúng tiền cọc`)

console.log(`\n=== KẾT QUẢ SỬA LỖI TIỀN THUÊ: ${pass} đạt / ${fail} lỗi ===`)
process.exit(fail ? 1 : 0)

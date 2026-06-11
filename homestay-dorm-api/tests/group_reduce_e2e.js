// Kiểm thử GIẢM GIƯỜNG/CỌC theo số người đủ điều kiện (mở rộng của luồng thuê nhóm).
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

console.log('\n=== KIỂM THỬ GIẢM GIƯỜNG/CỌC (NHÓM) ===\n')
const sale = (await api('/auth/staff/login', { method: 'POST', body: { email: 'sale@homestay.vn', password: '123456' } })).data
const mgr = (await api('/auth/staff/login', { method: 'POST', body: { email: 'manager@homestay.vn', password: '123456' } })).data
const acc = (await api('/auth/staff/login', { method: 'POST', body: { email: 'accountant@homestay.vn', password: '123456' } })).data

const email = `gr_${Date.now()}@t.vn`
const cust = (await api('/auth/customer/register', { method: 'POST', body: { hoTen: 'Đại diện Nhóm', email, password: '123456', gioiTinh: 'nam', soDienThoai: '0911111111', soGiayTo: '079111111111' } })).data
const rooms = (await api('/rooms', { token: sale.token })).data
const pick = rooms.find(r => r.loai_phong === 'o_ghep' && r.gioi_tinh_ap_dung === 'nam' && Number(r.giuong_trong) >= 3)
const G = Number(pick.gia_thue_giuong), SUC = Number(pick.suc_chua)
console.log(`Phòng ${pick.ma_phong}: giá giường ${vnd(G)}, sức chứa ${SUC}, trống ${pick.giuong_trong}`)

// Đăng ký nhóm 3 người, thuê 3 giường
const tieuChi = {
  roomDbId: pick.id, roomId: pick.ma_phong, numberOfBeds: 3, numberOfPeople: 3,
  hasGroup: true, representativeIsMe: true,
  groupMembers: [
    { name: 'Thành viên B', phone: '0922222222', idNumber: '079222222222', gender: 'Nam' },
    { name: 'Thành viên C', phone: '0933333333', idNumber: '079333333333', gender: 'Nam' },
  ],
}
const bk = (await api('/bookings', { method: 'POST', token: cust.token, body: { tieuChi, thoiHan: 12 } })).data
const dep = (await api('/deposits', { method: 'POST', token: sale.token, body: { roomId: pick.id, rentType: 'bed', numberOfBeds: 3, khachHangId: cust.user.id, bookingCode: bk.ma_phieu, phieuDangKyId: bk.id } })).data
await api(`/deposits/${dep.ma_phieu}/reconcile`, { method: 'POST', token: acc.token, body: { soTienThucNhan: dep.so_tien_coc } })
await api(`/deposits/${dep.ma_phieu}/confirm`, { method: 'POST', token: mgr.token })
ok(Number(dep.so_tien_coc) === G * 2 * 3, `Cọc ban đầu 3 giường = ${vnd(G * 2 * 3)}`)

// Quản lý kiểm tra điều kiện: đại diện + 1 ĐẠT, 1 KHÔNG ĐẠT -> tiếp tục (giảm 1 giường)
const mem = (await api(`/deposits/${dep.ma_phieu}/members`, { token: mgr.token })).data
const elig = mem.members.map((m, i) => ({ khachHangId: m.khachHangId, datDieuKien: i !== 2 }))
const dec = (await api(`/deposits/${dep.ma_phieu}/check-members`, { method: 'POST', token: mgr.token, body: { eligibility: elig, decision: 'continue' } })).data
ok(dec.eligibleCount === 2 && dec.excludedCount === 1, `Tiếp tục: 2 đạt / 1 loại`)
ok(dec.partialRefund && dec.partialRefund.beds === 1, `Có giảm giường: ${dec.partialRefund?.beds} giường`)
const expRefund = Math.round(G * 2 * 1 * 0.8)   // 80% cọc của 1 giường bị loại
ok(dec.partialRefund && Number(dec.partialRefund.amount) === expRefund, `Phần hoàn dự kiến = ${vnd(expRefund)} (80% cọc 1 giường)`)
ok(Number(dec.partialRefund.newCoc) === G * 2 * 2, `Cọc mới = ${vnd(G * 2 * 2)} (còn 2 giường)`)

// Phiếu cọc đã giảm còn 2 giường + giường thừa trả về trống
const room2 = (await api(`/rooms/${pick.id}`, { token: sale.token })).data
const datCoc = room2.giuong.filter(g => g.trang_thai === 'dat_coc').length
ok(datCoc === 2, `Phòng còn 2 giường 'dat_coc' (đã trả 1 giường về trống) — thực: ${datCoc}`)

// RBAC + hàng đợi hoàn cọc giảm giường của Kế toán
ok((await api('/deposits/partial-refunds', { token: sale.token })).status === 403, 'Sale GET /partial-refunds -> 403')
const queue = (await api('/deposits/partial-refunds', { token: acc.token })).data
const item = queue.find(d => d.ma_phieu === dep.ma_phieu)
ok(!!item, 'Cọc xuất hiện ở hàng đợi "Giảm giường (nhóm)" của Kế toán')
ok(Number(item.so_tien_coc) === G * 2 * 2, 'Hàng đợi hiển thị cọc đã giảm (2 giường)')

// Lập hợp đồng -> chỉ 2 giường, tiền thuê/tháng = cọc mới / 2 = 2 giường
const ct = (await api('/contracts', { method: 'POST', token: mgr.token, body: { depositCode: dep.ma_phieu, ngayBatDau: '2026-07-01', thoiHan: 12 } })).data
ok(Number(ct.gia_thue_thang) === G * 2, `HĐ: tiền thuê/tháng = ${vnd(G * 2)} (2 giường)`)

// Kế toán hoàn phần cọc dư
const refund = (await api(`/deposits/${dep.ma_phieu}/refund-partial`, { method: 'POST', token: acc.token })).data
ok(Number(refund.soTienHoan) === expRefund, `Kế toán hoàn = ${vnd(expRefund)} (thực: ${vnd(refund.soTienHoan || 0)})`)
// Không hoàn 2 lần
ok((await api(`/deposits/${dep.ma_phieu}/refund-partial`, { method: 'POST', token: acc.token })).status >= 400, 'Hoàn lần 2 -> bị chặn')
// Đã rời khỏi hàng đợi
const queue2 = (await api('/deposits/partial-refunds', { token: acc.token })).data
ok(!queue2.find(d => d.ma_phieu === dep.ma_phieu), 'Sau khi hoàn, cọc rời khỏi hàng đợi')

console.log(`\n=== KẾT QUẢ GIẢM GIƯỜNG: ${pass} đạt / ${fail} lỗi ===`)
process.exit(fail ? 1 : 0)
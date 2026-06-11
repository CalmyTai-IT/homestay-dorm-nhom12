// Kiểm thử LUỒNG THUÊ THEO NHÓM end-to-end qua HTTP (ngoài bộ e2e gốc).
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

console.log('\n=== KIỂM THỬ THUÊ THEO NHÓM ===\n')
const sale = (await api('/auth/staff/login', { method: 'POST', body: { email: 'sale@homestay.vn', password: '123456' } })).data
const mgr = (await api('/auth/staff/login', { method: 'POST', body: { email: 'manager@homestay.vn', password: '123456' } })).data
const acc = (await api('/auth/staff/login', { method: 'POST', body: { email: 'accountant@homestay.vn', password: '123456' } })).data

// Hàm tiện ích: đăng ký 1 khách + tạo booking nhóm (đại diện + 2 thành viên) trên phòng ghép nam
async function setupGroupBooking(tag) {
  const email = `${tag}_${Date.now()}@t.vn`
  const cust = (await api('/auth/customer/register', { method: 'POST', body: { hoTen: `Đại diện ${tag}`, email, password: '123456', gioiTinh: 'nam', soDienThoai: '0911111111', soGiayTo: '079111111111' } })).data
  const rooms = (await api('/rooms', { token: sale.token })).data
  const pick = rooms.find(r => r.loai_phong === 'o_ghep' && r.gioi_tinh_ap_dung === 'nam' && Number(r.giuong_trong) >= 3)
  const tieuChi = {
    roomDbId: pick.id, roomId: pick.ma_phong, numberOfBeds: 3, numberOfPeople: 3,
    hasGroup: true, representativeIsMe: true, representative: null,
    groupMembers: [
      { name: 'Nguyễn Văn B', phone: '0922222222', idNumber: '079222222222', gender: 'Nam' },
      { name: 'Trần Văn C', phone: '0933333333', idNumber: '079333333333', gender: 'Nam' },
    ],
  }
  const bk = (await api('/bookings', { method: 'POST', token: cust.token, body: { tieuChi, thoiHan: 12 } })).data
  const dep = (await api('/deposits', { method: 'POST', token: sale.token, body: { roomId: pick.id, rentType: 'bed', numberOfBeds: 3, khachHangId: cust.user.id, bookingCode: bk.ma_phieu, phieuDangKyId: bk.id } })).data
  // chốt cọc (đối soát đủ -> chốt)
  await api(`/deposits/${dep.ma_phieu}/reconcile`, { method: 'POST', token: acc.token, body: { soTienThucNhan: dep.so_tien_coc } })
  await api(`/deposits/${dep.ma_phieu}/confirm`, { method: 'POST', token: mgr.token })
  return { cust, pick, bk, dep }
}

// ---------- KỊCH BẢN 1: tạo nhóm + tiếp tục ký với 1 người bị loại ----------
console.log('--- Kịch bản 1: lập nhóm, kiểm tra điều kiện, KÝ TIẾP (loại 1 người) ---')
{
  const { pick, dep } = await setupGroupBooking('g1')
  ok(Number(dep.nhom_thue_id) > 0, `Phiếu cọc kế thừa nhom_thue_id từ đơn (#${dep.nhom_thue_id})`)
  ok(Number(dep.so_tien_coc) === Number(pick.gia_thue_giuong) * 2 * 3, `Cọc 3 giường đúng công thức = ${vnd(dep.so_tien_coc)}`)

  // RBAC: Sale không xem được /members
  ok((await api(`/deposits/${dep.ma_phieu}/members`, { token: sale.token })).status === 403, 'Sale GET /members -> 403 (chỉ Quản lý)')

  const mem = (await api(`/deposits/${dep.ma_phieu}/members`, { token: mgr.token })).data
  ok(mem.hasGroup === true && mem.members.length === 3, `Quản lý xem nhóm: ${mem.members?.length} người (1 đại diện + 2 thành viên)`)
  const repObj = mem.members.find(m => m.isDaiDien)
  ok(!!repObj && repObj.hoTen.includes('Đại diện'), `Đại diện được đánh dấu đúng: ${repObj?.hoTen}`)
  ok(mem.members.every(m => m.datDieuKien === null || m.datDieuKien === undefined), 'Ban đầu: chưa ai được kiểm tra (dat_dieu_kien null)')

  // Đánh dấu: đại diện + 1 thành viên ĐẠT, 1 thành viên KHÔNG ĐẠT
  const elig = mem.members.map((m, i) => ({ khachHangId: m.khachHangId, datDieuKien: !(i === 2) }))
  const dec = (await api(`/deposits/${dep.ma_phieu}/check-members`, { method: 'POST', token: mgr.token, body: { eligibility: elig, decision: 'continue' } })).data
  ok(dec.decision === 'continue' && dec.eligibleCount === 2 && dec.excludedCount === 1, `Tiếp tục: ${dec.eligibleCount} đạt / ${dec.excludedCount} loại`)

  // Kết quả đã lưu vào DB?
  const mem2 = (await api(`/deposits/${dep.ma_phieu}/members`, { token: mgr.token })).data
  const excluded = mem2.members.filter(m => m.datDieuKien === false).length
  ok(excluded === 1, 'Kết quả kiểm tra đã lưu (1 người không đạt)')

  // Lập hợp đồng -> thành công (đại diện đạt)
  const ct = (await api('/contracts', { method: 'POST', token: mgr.token, body: { depositCode: dep.ma_phieu, ngayBatDau: '2026-06-15', thoiHan: 12 } }))
  ok(ct.status === 201 && ct.data.ma_hop_dong, `Lập HĐ thành công cho nhóm: ${ct.data.ma_hop_dong}`)
  ok(Number(ct.data.nhom_thue_id) === Number(dep.nhom_thue_id), 'Hợp đồng mang đúng nhom_thue_id')
}

// ---------- KỊCH BẢN 2: đại diện KHÔNG đạt -> bị chặn ở cả 2 nơi ----------
console.log('\n--- Kịch bản 2: ĐẠI DIỆN không đủ điều kiện -> chặn ký ---')
{
  const { dep } = await setupGroupBooking('g2')
  const mem = (await api(`/deposits/${dep.ma_phieu}/members`, { token: mgr.token })).data
  // đánh dấu đại diện KHÔNG đạt
  const elig = mem.members.map(m => ({ khachHangId: m.khachHangId, datDieuKien: !m.isDaiDien }))
  const dec = await api(`/deposits/${dep.ma_phieu}/check-members`, { method: 'POST', token: mgr.token, body: { eligibility: elig, decision: 'continue' } })
  ok(dec.status === 409, 'check-members (continue) khi đại diện không đạt -> 409 (chặn)')
  // thử lập HĐ thẳng -> guard ở createContract cũng chặn
  const ct = await api('/contracts', { method: 'POST', token: mgr.token, body: { depositCode: dep.ma_phieu, ngayBatDau: '2026-06-15', thoiHan: 12 } })
  ok(ct.status === 409, 'createContract khi đại diện không đạt -> 409 (guard backend)')
}

// ---------- KỊCH BẢN 3: hủy thuê nhóm -> hoàn 80% ----------
console.log('\n--- Kịch bản 3: nhóm KHÔNG ký -> hủy thuê, Kế toán hoàn 80% ---')
{
  const { dep } = await setupGroupBooking('g3')
  const mem = (await api(`/deposits/${dep.ma_phieu}/members`, { token: mgr.token })).data
  const elig = mem.members.map(m => ({ khachHangId: m.khachHangId, datDieuKien: m.isDaiDien }))  // chỉ đại diện đạt
  const dec = (await api(`/deposits/${dep.ma_phieu}/check-members`, { method: 'POST', token: mgr.token, body: { eligibility: elig, decision: 'cancel' } })).data
  ok(dec.decision === 'cancelled' && dec.refundRate === 80, 'Quyết định hủy thuê -> cancelled, mức hoàn 80%')
  // phiếu cọc đã hủy & vào hàng đợi hoàn của Kế toán
  const queue = (await api('/deposits/rejected-refunds', { token: acc.token })).data
  const inQueue = queue.find(d => d.ma_phieu === dep.ma_phieu)
  ok(!!inQueue, 'Cọc nhóm bị hủy xuất hiện ở hàng đợi "Hoàn cọc 80%" của Kế toán')
  const refund = (await api(`/deposits/${dep.ma_phieu}/refund-rejected`, { method: 'POST', token: acc.token })).data
  const exp = Math.round(Number(dep.so_tien_coc) * 80 / 100)
  ok(Number(refund.soTienHoan) === exp, `Kế toán hoàn 80% = ${vnd(exp)} (thực: ${vnd(refund.soTienHoan || 0)})`)
}

// ---------- KỊCH BẢN 4: ràng buộc giới tính TỪNG THÀNH VIÊN ----------
console.log('\n--- Kịch bản 4: giới tính từng thành viên phải khớp loại phòng ---')
{
  const email = `g4_${Date.now()}@t.vn`
  const cust = (await api('/auth/customer/register', { method: 'POST', body: { hoTen: 'Nam đại diện', email, password: '123456', gioiTinh: 'nam', soDienThoai: '0911111111', soGiayTo: '079111111111' } })).data
  const rooms = (await api('/rooms', { token: sale.token })).data

  // (a) Phòng dành RIÊNG NAM + thành viên NỮ -> phải bị từ chối, gợi ý phòng hỗn hợp
  const namRoom = rooms.find(r => r.gioi_tinh_ap_dung === 'nam' && Number(r.giuong_trong) >= 2)
  const r1 = await api('/bookings', { method: 'POST', token: cust.token, body: { thoiHan: 12, tieuChi: {
    roomDbId: namRoom.id, roomId: namRoom.ma_phong, numberOfBeds: 2, numberOfPeople: 2,
    hasGroup: true, representativeIsMe: true, representative: null,
    groupMembers: [{ name: 'Bạn nữ', phone: '0922222222', idNumber: '079222222222', gender: 'Nữ' }],
  } } })
  ok(r1.status >= 400, `Đăng ký phòng NAM có thành viên NỮ -> bị từ chối (status ${r1.status})`)
  ok(/hỗn hợp/i.test(r1.data?.error || r1.data?.message || ''), 'Thông báo gợi ý chọn phòng hỗn hợp')

  // (b) Phòng HỖN HỢP + nhóm có cả nam và nữ -> chấp nhận
  const mixRoom = rooms.find(r => r.gioi_tinh_ap_dung === 'khong_quy_dinh' && Number(r.suc_chua) >= 2)
  const r2 = await api('/bookings', { method: 'POST', token: cust.token, body: { thoiHan: 12, tieuChi: {
    roomDbId: mixRoom.id, roomId: mixRoom.ma_phong, rentType: 'whole_room',
    numberOfBeds: mixRoom.suc_chua, numberOfPeople: mixRoom.suc_chua,
    hasGroup: true, representativeIsMe: true, representative: null,
    groupMembers: [{ name: 'Bạn nữ', phone: '0922222222', idNumber: '079222222222', gender: 'Nữ' }],
  } } })
  ok(r2.status < 400 && r2.data?.ma_phieu, `Đăng ký phòng HỖN HỢP có nam+nữ -> thành công (${r2.data?.ma_phieu})`)
  ok(Number(r2.data?.nhom_thue_id) > 0, 'Nhóm nam+nữ được tạo trong phòng hỗn hợp')
}

console.log(`\n=== KẾT QUẢ THUÊ NHÓM: ${pass} đạt / ${fail} lỗi ===`)
process.exit(fail ? 1 : 0)
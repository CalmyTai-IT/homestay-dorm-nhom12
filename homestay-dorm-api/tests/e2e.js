// Kiểm thử end-to-end toàn bộ luồng nghiệp vụ qua HTTP
// Cập nhật cho API hiện tại: tra phòng theo ID số, luồng cọc 2 bước
// (Kế toán đối soát -> Quản lý chốt), và kiểm thử các "chốt cửa" trạng thái (A1-A4).
// Mọi giá trị kỳ vọng được TÍNH TỪ dữ liệu phòng thật trả về (không phụ thuộc seed cụ thể).
const BASE = 'http://localhost:4010/api'
let pass = 0, fail = 0
const ok = (c, m) => { c ? (pass++, console.log('  \u2713', m)) : (fail++, console.log('  \u2717 TH\u1EA4T B\u1EA0I:', m)) }
const api = async (path, { method='GET', token, body } = {}) => {
  const res = await fetch(BASE+path, {
    method, headers: { 'Content-Type':'application/json', ...(token?{Authorization:`Bearer ${token}`}:{}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(()=>({}))
  return { status: res.status, data }
}
const vnd = (n) => Number(n).toLocaleString('vi-VN') + 'đ'

console.log('\n=== KIỂM THỬ API HOMESTAY DORM ===\n')

// 0) health
ok((await api('/health')).data.ok === true, 'GET /health')

// 1) Đăng nhập nhân viên
const sale = (await api('/auth/staff/login', { method:'POST', body:{ email:'sale@homestay.vn', password:'123456' }})).data
const mgr  = (await api('/auth/staff/login', { method:'POST', body:{ email:'manager@homestay.vn', password:'123456' }})).data
const acc  = (await api('/auth/staff/login', { method:'POST', body:{ email:'accountant@homestay.vn', password:'123456' }})).data
ok(sale.token && sale.user.role==='sale', 'Đăng nhập Sale')
ok(mgr.token && mgr.user.role==='manager', 'Đăng nhập Quản lý')
ok(acc.token && acc.user.role==='accountant', 'Đăng nhập Kế toán')
ok((await api('/auth/staff/login', { method:'POST', body:{ email:'sale@homestay.vn', password:'sai' }})).status===401, 'Sai mật khẩu → 401')

// 2) Đăng ký khách hàng + đăng nhập
const email = `kh_${Date.now()}@test.vn`
const reg = await api('/auth/customer/register', { method:'POST', body:{ hoTen:'Khách Test', email, password:'123456', gioiTinh:'nam', soGiayTo:'079999999999', soDienThoai:'0900000000' }})
ok(reg.status===201 && reg.data.token, 'Đăng ký khách hàng')
const cust = reg.data

// 3) Xem phòng — chọn 1 phòng NGUYÊN CĂN còn trống hoàn toàn để thuê cả phòng
const rooms = (await api('/rooms', { token: sale.token })).data
ok(Array.isArray(rooms) && rooms.length>0, `GET /rooms (${rooms.length} phòng)`)
const pick = rooms.find(r => r.loai_phong==='nguyen_can' && Number(r.giuong_trong)===Number(r.suc_chua)
  && (r.gioi_tinh_ap_dung==='khong_quy_dinh' || r.gioi_tinh_ap_dung==='nam' || !r.gioi_tinh_ap_dung))
ok(!!pick, `Chọn được phòng nguyên căn trống hợp giới tính: ${pick?.ma_phong} (sức chứa ${pick?.suc_chua})`)
const ROOM_ID = pick.id, SUC_CHUA = Number(pick.suc_chua), GIA = Number(pick.gia_thue_giuong)
const room = (await api(`/rooms/${ROOM_ID}`, { token: sale.token })).data        // tra theo ID số
ok(room.ma_phong===pick.ma_phong && Array.isArray(room.giuong) && room.giuong.length===SUC_CHUA,
   `GET /rooms/${ROOM_ID} (${SUC_CHUA} giường)`)
ok(room.giuong.filter(g=>g.trang_thai==='trong').length===SUC_CHUA, `Ban đầu: ${SUC_CHUA} giường trống`)

// Kỳ vọng theo công thức đề: Tiền cọc = giá giường × 2 tháng × số giường (cả phòng = sức chứa)
const COC = GIA * 2 * SUC_CHUA

// 4) Khách tạo phiếu đăng ký (kèm roomDbId để hệ thống tra đúng phòng)
const booking = (await api('/bookings', { method:'POST', token: cust.token, body:{
  tieuChi:{ roomDbId: ROOM_ID, roomId: pick.ma_phong, rentType:'whole_room' },
  ngayVaoO:'2026-06-01', thoiHan:12,
}})).data
ok(booking.ma_phieu && booking.trang_thai==='cho_xem_phong', 'Khách tạo phiếu đăng ký (cho_xem_phong)')

// 5) Sale lập phiếu đặt cọc (thuê nguyên phòng) — tra phòng theo ID số
const dep = (await api('/deposits', { method:'POST', token: sale.token, body:{
  roomId: ROOM_ID, rentType:'whole_room', khachHangId: cust.user.id,
  phieuDangKyId: booking.id, bookingCode: booking.ma_phieu,
}})).data
ok(Number(dep.so_tien_coc)===COC, `Tiền cọc đúng công thức = ${vnd(COC)}`)
ok(dep.trang_thai==='cho_thanh_toan', 'Phiếu cọc trạng thái cho_thanh_toan')

// 6) RBAC luồng cọc 2 bước
ok((await api(`/deposits/${dep.ma_phieu}/reconcile`, { method:'POST', token: sale.token, body:{ soTienThucNhan: COC }})).status===403,
   'Sale gọi reconcile → 403 (RBAC: chỉ Kế toán)')
ok((await api(`/deposits/${dep.ma_phieu}/confirm`, { method:'POST', token: sale.token })).status===403,
   'Sale gọi confirm → 403 (RBAC: chỉ Quản lý)')
ok((await api(`/deposits/${dep.ma_phieu}/confirm`, { method:'POST', token: mgr.token })).status>=400,
   'Quản lý chốt khi CHƯA đối soát → bị chặn')

// 7) Kế toán đối soát: thiếu tiền → insufficient; đủ tiền → cho_duyet
ok((await api(`/deposits/${dep.ma_phieu}/reconcile`, { method:'POST', token: acc.token, body:{}})).status===400,
   'Đối soát thiếu số tiền thực nhận → 400')
const recShort = (await api(`/deposits/${dep.ma_phieu}/reconcile`, { method:'POST', token: acc.token, body:{ soTienThucNhan: 1000 }})).data
ok(recShort.result==='insufficient' && recShort.shortfall===COC-1000, `Đối soát thiếu → còn thiếu ${vnd(COC-1000)}`)
const recOk = (await api(`/deposits/${dep.ma_phieu}/reconcile`, { method:'POST', token: acc.token, body:{ soTienThucNhan: COC }})).data
ok(recOk.result==='sufficient', 'Đối soát đủ → result=sufficient (chuyển chờ duyệt)')

// 8) Quản lý chốt cọc → đã thanh toán + giao dịch thu_coc
const conf = (await api(`/deposits/${dep.ma_phieu}/confirm`, { method:'POST', token: mgr.token, body:{ hinhThuc:'chuyen_khoan' }})).data
ok(conf.deposit.trang_thai==='da_thanh_toan' && conf.giaoDich.loai_giao_dich==='thu_coc',
   'Quản lý chốt → da_thanh_toan + giao dịch thu_coc')

// 9) Quản lý lập hợp đồng (tiền thuê/tháng = cọc/2)
const ct = (await api('/contracts', { method:'POST', token: mgr.token, body:{
  depositCode: dep.ma_phieu, ngayBatDau:'2026-06-01', thoiHan:12,
}})).data
ok(ct.ma_hop_dong && Number(ct.gia_thue_thang)===COC/2, `Lập HĐ, tiền thuê/tháng = ${vnd(COC/2)}`)
// [A2] Lập HĐ lần 2 trên cùng phiếu cọc phải bị chặn
ok((await api('/contracts', { method:'POST', token: mgr.token, body:{ depositCode: dep.ma_phieu, ngayBatDau:'2026-06-01', thoiHan:12 }})).status>=400,
   '[A2] Lập HĐ thứ 2 trên cùng phiếu cọc → bị chặn')

// 10) Ký HĐ → giường dang_thue + thu tiền thuê kỳ đầu
const sign = (await api(`/contracts/${ct.ma_hop_dong}/sign`, { method:'POST', token: mgr.token })).data
ok(sign.giaoDich.loai_giao_dich==='thu_tien_thue', 'Ký HĐ → giao dịch thu_tien_thue')
const roomAfterSign = (await api(`/rooms/${ROOM_ID}`, { token: sale.token })).data
ok(roomAfterSign.giuong.every(g=>g.trang_thai==='dang_thue'), `Sau ký: ${SUC_CHUA} giường dang_thue`)
// [A3] Ký lần 2 phải bị chặn (không thu tiền/bàn giao trùng)
ok((await api(`/contracts/${ct.ma_hop_dong}/sign`, { method:'POST', token: mgr.token })).status>=400,
   '[A3] Ký HĐ lần 2 → bị chặn')

// 11) Trả phòng → kiểm tra → đối soát (lưu trú ≥6 tháng = 70%) → thanh lý/hoàn cọc
const co = (await api('/checkouts', { method:'POST', token: sale.token, body:{ contractCode: ct.ma_hop_dong, ngayTraDuKien:'2026-12-01' }})).data
ok(co.ma_phieu, 'Sale đăng ký trả phòng')
const insp = (await api(`/checkouts/${co.ma_phieu}/inspect`, { method:'POST', token: mgr.token, body:{ veSinh:'đạt', ketQua:{the_tu:'đủ'} }})).data
ok(insp.trang_thai==='cho_doi_soat', 'Quản lý kiểm tra hiện trạng → cho_doi_soat')
const KHAU_TRU = 500000
const rec = (await api(`/checkouts/${co.ma_phieu}/reconcile`, { method:'POST', token: acc.token, body:{
  soThangLuuTru: 8, khoanKhauTru:[{ loai:'dien_nuoc_no', moTa:'điện nước', soTien: KHAU_TRU }],
}})).data
const expHoanCoBan = Math.round(COC*0.7)
ok(Number(rec.ty_le_hoan_coc)===70 && Number(rec.hoan_coc_co_ban)===expHoanCoBan, `Đối soát: 70%, hoàn cơ bản = ${vnd(expHoanCoBan)}`)
ok(Number(rec.so_tien_hoan_thuc_te)===expHoanCoBan-KHAU_TRU, `Hoàn thực tế = ${vnd(expHoanCoBan-KHAU_TRU)}`)
const settle = (await api(`/checkouts/${co.ma_phieu}/settle`, { method:'POST', token: acc.token })).data
ok(settle.giaoDich.loai_giao_dich==='hoan_coc', 'Thanh lý → giao dịch hoan_coc')
const roomAfterSettle = (await api(`/rooms/${ROOM_ID}`, { token: sale.token })).data
ok(roomAfterSettle.giuong.every(g=>g.trang_thai==='trong'), `Sau thanh lý: ${SUC_CHUA} giường trở lại trống`)
// [A4] Thanh lý lần 2 phải bị chặn (không hoàn cọc trùng)
ok((await api(`/checkouts/${co.ma_phieu}/settle`, { method:'POST', token: acc.token })).status>=400,
   '[A4] Thanh lý/hoàn cọc lần 2 → bị chặn')

// 12) [A1] Hai phiếu cọc SONG SONG vào cùng phòng → không giường nào bị 2 phiếu cùng giữ
const r2 = rooms.find(x => x.loai_phong==='o_ghep' && Number(x.suc_chua)>=2)
if (r2) {
  const mk = async (i) => {
    const rr = (await api('/auth/customer/register', { method:'POST', body:{ hoTen:'P'+i, email:`p${i}_${Date.now()}@t.vn`, password:'123456', gioiTinh:'nam', soDienThoai:'09'+i }})).data
    const bk = (await api('/bookings', { method:'POST', token: rr.token, body:{ tieuChi:{ roomDbId:r2.id, roomId:r2.ma_phong, rentType:'shared_bed', numberOfBeds:1 }, thoiHan:6 }})).data
    return { id: rr.user.id, bk: bk.ma_phieu, bid: bk.id }
  }
  const A = await mk('a'), B = await mk('b')
  const [da, db] = await Promise.all([
    api('/deposits', { method:'POST', token: sale.token, body:{ roomId:r2.id, rentType:'shared_bed', numberOfBeds:1, khachHangId:A.id, phieuDangKyId:A.bid, bookingCode:A.bk }}),
    api('/deposits', { method:'POST', token: sale.token, body:{ roomId:r2.id, rentType:'shared_bed', numberOfBeds:1, khachHangId:B.id, phieuDangKyId:B.bid, bookingCode:B.bk }}),
  ])
  const created = [da, db].filter(x=>x.status===201).length
  // Đếm số GIƯỜNG thực tế bị giữ chỗ trong phòng: phải đúng bằng số phiếu cọc thành công.
  // (Lỗi cũ: 2 phiếu cùng giữ 1 giường -> giu_cho < số phiếu. Đã vá -> mỗi phiếu 1 giường riêng.)
  const r2after = (await api(`/rooms/${r2.id}`, { token: sale.token })).data
  const giuCho = r2after.giuong.filter(g=>g.trang_thai==='giu_cho').length
  ok(created>=1 && giuCho===created, `[A1] ${created} cọc song song giữ ${giuCho} giường riêng (không trùng giường)`)
} else {
  ok(true, '[A1] (bỏ qua: không có phòng ghép ≥2 giường)')
}

// 13) Tổng hợp giao dịch
const sum = (await api('/payments/summary', { token: acc.token })).data
ok(Array.isArray(sum) && sum.length>0, `Tổng hợp giao dịch (${sum.map(s=>s.loai_giao_dich).join(', ')})`)

console.log(`\n=== KẾT QUẢ: ${pass} đạt / ${fail} lỗi ===`)
process.exit(fail===0 ? 0 : 1)

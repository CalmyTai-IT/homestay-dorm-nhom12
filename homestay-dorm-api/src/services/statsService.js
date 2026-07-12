import { query } from '../config/db.js'

const trieu = (v) => Math.round(Number(v || 0) / 1e6)
const monthLabel = (ym) => 'T' + Number(String(ym).split('-')[1])

// Lọc theo chi nhánh: nhân viên thuộc 1 chi nhánh -> chỉ thấy số liệu chi nhánh đó.
// Nhân viên TOÀN HỆ THỐNG (chiNhanhId = null) -> thấy tất cả (không thêm điều kiện).
// Trả về mảnh SQL " and <col>=$1" (hoặc rỗng) và params tương ứng.
const bf = (chiNhanhId, col) => chiNhanhId != null ? ` and ${col}=$1` : ''
const bp = (chiNhanhId) => chiNhanhId != null ? [chiNhanhId] : []

// ===== SALE =====
export async function sale(chiNhanhId = null) {
  const params = bp(chiNhanhId)
  const fb = bf(chiNhanhId, 'chi_nhanh_id')      // dùng cho bảng có cột chi_nhanh_id trực tiếp
  const fbB = bf(chiNhanhId, 'b.chi_nhanh_id')

  const c = (await query(`select
    (select count(*) from phieu_dang_ky_thue where trang_thai='cho_xem_phong'${fb})::int as new_bookings,
    (select count(*) from phieu_dang_ky_thue p
       where p.trang_thai='da_hen_xem'
         and coalesce(
               (select (l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh')::date
                  from lich_xem_phong l
                  where l.phieu_dang_ky_id=p.id and l.trang_thai in ('da_len_lich','doi_lich')
                  order by l.id desc limit 1),
               (p.tieu_chi->'scheduledViewing'->>'date')::date
             ) = (now() at time zone 'Asia/Ho_Chi_Minh')::date${fb})::int as viewings_today,
    (select count(*) from phieu_dat_coc where trang_thai='cho_thanh_toan'${fb})::int as awaiting_deposit,
    (select count(*) from phieu_dat_coc
       where trang_thai='da_thanh_toan'
         and date_trunc('month', coalesce(thoi_diem_chot, thoi_diem_tao))=date_trunc('month', now())${fb})::int as closed_this_month
  `, params)).rows[0]

  const pending = (await query(`
    select b.ma_phieu, b.tieu_chi, b.created_at, b.trang_thai, k.ho_ten
    from phieu_dang_ky_thue b join khach_hang k on k.id=b.khach_hang_id
    where b.trang_thai in ('cho_xem_phong','dang_xu_ly')${fbB}
    order by b.created_at asc limit 8`, params)).rows

  const viewings = (await query(`
    select b.ma_phieu, k.ho_ten, k.so_dien_thoai,
           b.tieu_chi->>'roomId' as room_id,
           coalesce(
             to_char(l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh','HH24:MI'),
             b.tieu_chi->'scheduledViewing'->>'time'
           ) as gio
    from phieu_dang_ky_thue b join khach_hang k on k.id=b.khach_hang_id
      left join lateral (
        select l.thoi_gian_hen from lich_xem_phong l
        where l.phieu_dang_ky_id=b.id and l.trang_thai in ('da_len_lich','doi_lich')
        order by l.id desc limit 1
      ) l on true
    where b.trang_thai='da_hen_xem'
      and coalesce(
            (l.thoi_gian_hen at time zone 'Asia/Ho_Chi_Minh')::date,
            (b.tieu_chi->'scheduledViewing'->>'date')::date
          ) = (now() at time zone 'Asia/Ho_Chi_Minh')::date${fbB}
    order by gio asc limit 8`, params)).rows

  return {
    stats: {
      newBookings: c.new_bookings,
      viewingsToday: c.viewings_today,
      awaitingDeposit: c.awaiting_deposit,
      closedThisMonth: c.closed_this_month,
    },
    pendingBookings: pending.map(b => ({
      code: b.ma_phieu,
      customerName: b.ho_ten,
      roomId: b.tieu_chi?.roomId || '—',
      branch: b.tieu_chi?.branch || '',
      rentType: b.tieu_chi?.rentType === 'whole_room' ? 'Nguyên căn' : 'Ở ghép',
      priority: 'normal',
      createdAt: b.created_at,
    })),
    viewingsToday: viewings.map(v => ({
      code: v.ma_phieu,
      time: v.gio || '--:--',
      customerName: v.ho_ten,
      roomId: v.room_id || '—',
      phone: v.so_dien_thoai || '',
    })),
  }
}

// ===== MANAGER =====
export async function manager(chiNhanhId = null) {
  const params = bp(chiNhanhId)
  const fbP = bf(chiNhanhId, 'p.chi_nhanh_id')
  const fbD = bf(chiNhanhId, 'd.chi_nhanh_id')
  const fb = bf(chiNhanhId, 'chi_nhanh_id')

  const beds = (await query(`select count(*)::int as total,
      count(*) filter (where g.trang_thai='trong')::int as available,
      count(*) filter (where g.trang_thai<>'trong')::int as occupied
    from giuong g join phong p on p.id=g.phong_id
    where p.trang_thai<>'ngung'${fbP}`, params)).rows[0]

  const c = (await query(`select
      (select count(*) from phieu_dat_coc d where d.trang_thai='cho_duyet'${fbD})::int as pending_deposits,
      (select count(*) from hop_dong_thue where trang_thai='cho_ky'${fb})::int as contracts_to_sign
  `, params)).rows[0]

  const pendingDeposits = (await query(`
    select d.ma_phieu, d.so_tien_coc, d.thoi_diem_tao, d.hinh_thuc, k.ho_ten,
           dk.tieu_chi->>'roomId' as ma_phong
    from phieu_dat_coc d
      join khach_hang k on k.id=d.khach_hang_id
      left join phieu_dang_ky_thue dk on dk.id=d.phieu_dang_ky_id
    where d.trang_thai='cho_duyet'${fbD}
    order by coalesce(d.thoi_diem_doi_soat, d.thoi_diem_tao) desc limit 8`, params)).rows

  // Tỉ lệ lấp đầy theo chi nhánh: QL chi nhánh chỉ thấy chi nhánh mình
  const branches = (await query(`
    select cn.ten as branch, count(g.*)::int as total,
           count(g.*) filter (where g.trang_thai<>'trong')::int as occupied
    from chi_nhanh cn
      join phong p on p.chi_nhanh_id=cn.id
      join giuong g on g.phong_id=p.id
    where p.trang_thai<>'ngung'${chiNhanhId != null ? ' and cn.id=$1' : ''}
    group by cn.ten order by cn.ten`, params)).rows

  const total = beds.total || 0, occupied = beds.occupied || 0
  return {
    stats: {
      totalRooms: total,
      available: beds.available,
      occupied,
      occupancyRate: total ? Math.round(occupied / total * 100) : 0,
      pendingDeposits: c.pending_deposits,
      contractsToSign: c.contracts_to_sign,
    },
    pendingDeposits: pendingDeposits.map(d => ({
      code: d.ma_phieu,
      customerName: d.ho_ten,
      roomId: d.ma_phong || '—',
      method: d.hinh_thuc === 'tien_mat' ? 'cash' : 'transfer',
      amount: Number(d.so_tien_coc || 0),
      submittedAt: d.thoi_diem_tao,
    })),
    branchOccupancy: branches.map(b => ({ branch: b.branch, occupied: b.occupied, total: b.total })),
  }
}

// ===== ACCOUNTANT =====
export async function accountant(chiNhanhId = null) {
  const params = bp(chiNhanhId)
  const fb = bf(chiNhanhId, 'chi_nhanh_id')
  const fbD = bf(chiNhanhId, 'd.chi_nhanh_id')
  const fbH = bf(chiNhanhId, 'h.chi_nhanh_id')
  // Doanh thu: giao dịch suy chi nhánh qua phiếu cọc hoặc hợp đồng liên kết
  const gdBranch = chiNhanhId != null
    ? ' and coalesce(pdc.chi_nhanh_id, hd.chi_nhanh_id)=$1' : ''
  const gdJoin = `left join phieu_dat_coc pdc on pdc.id=g.phieu_dat_coc_id
                  left join hop_dong_thue hd on hd.id=g.hop_dong_id`

  const c = (await query(`select
      (select count(*) from phieu_dat_coc where trang_thai='cho_thanh_toan'${fb})::int as deposits_to_reconcile,
      (select coalesce(sum(g.so_tien),0) from giao_dich_thanh_toan g ${gdJoin}
         where g.loai_giao_dich in ('thu_coc','thu_tien_thue','thu_chenh_lech')
           and date_trunc('month', g.thoi_diem)=date_trunc('month', now())${gdBranch})::bigint as revenue_this_month,
      (select count(*) from phieu_tra_phong t join hop_dong_thue h on h.id=t.hop_dong_id
         where t.trang_thai in ('cho_doi_soat','cho_thanh_ly')${fbH})::int as refunds_pending
  `, params)).rows[0]

  const pendingPayments = (await query(`
    select d.ma_phieu, d.so_tien_coc, d.thoi_diem_tao, k.ho_ten,
           dk.tieu_chi->>'roomId' as ma_phong
    from phieu_dat_coc d
      join khach_hang k on k.id=d.khach_hang_id
      left join phieu_dang_ky_thue dk on dk.id=d.phieu_dang_ky_id
    where d.trang_thai='cho_thanh_toan'${fbD}
    order by d.thoi_diem_tao desc limit 8`, params)).rows

  const chart = (await query(`
    select to_char(m, 'YYYY-MM') as ym,
           coalesce(sum(g.so_tien) filter (
             where g.loai_giao_dich in ('thu_coc','thu_tien_thue','thu_chenh_lech')${gdBranch}),0)::bigint as revenue
    from generate_series(date_trunc('month',now()) - interval '5 months',
                         date_trunc('month',now()), interval '1 month') m
    left join giao_dich_thanh_toan g on date_trunc('month', g.thoi_diem)=m
    ${gdJoin}
    group by m order by m`, params)).rows

  const LABEL = { thu_coc: 'Tiền cọc', thu_tien_thue: 'Tiền thuê', hoan_coc: 'Hoàn cọc', thu_chenh_lech: 'Thu chênh lệch' }
  const breakdownRows = (await query(`
    select g.loai_giao_dich, coalesce(sum(g.so_tien),0)::bigint as tong
    from giao_dich_thanh_toan g ${gdJoin}
    where g.loai_giao_dich in ('thu_coc','thu_tien_thue','thu_chenh_lech')${gdBranch}
    group by g.loai_giao_dich order by tong desc`, params)).rows

  const refunds = (await query(`
    select t.ma_phieu, k.ho_ten,
           rm.ma_phong, bds.ty_le_hoan_coc, bds.so_tien_hoan_thuc_te, pdc.so_tien_coc
    from phieu_tra_phong t
      join hop_dong_thue h on h.id=t.hop_dong_id
      join khach_hang k on k.id=h.khach_hang_id
      left join phieu_dat_coc pdc on pdc.id=h.phieu_dat_coc_id
      left join lateral (
        select p.ma_phong from chi_tiet_hop_dong cth
        join giuong g on g.id=cth.giuong_id join phong p on p.id=g.phong_id
        where cth.hop_dong_id=h.id limit 1) rm on true
      left join lateral (
        select ty_le_hoan_coc, so_tien_hoan_thuc_te from bang_doi_soat
        where phieu_tra_phong_id=t.id order by id desc limit 1) bds on true
    where t.trang_thai in ('cho_doi_soat','cho_thanh_ly')${fbH}
    order by t.ngay_dang_ky desc limit 8`, params)).rows

  return {
    stats: {
      depositsToReconcile: c.deposits_to_reconcile,
      revenueThisMonth: Number(c.revenue_this_month || 0),
      refundsPending: c.refunds_pending,
      receivables: 0,
    },
    pendingPayments: pendingPayments.map(d => ({
      code: d.ma_phieu,
      customerName: d.ho_ten,
      type: 'Tiền cọc',
      amount: Number(d.so_tien_coc || 0),
      submittedAt: d.thoi_diem_tao,
      roomId: d.ma_phong || '—',
    })),
    revenueChart: chart.map(r => ({ month: monthLabel(r.ym), revenue: trieu(r.revenue) })),
    revenueBreakdown: breakdownRows
      .map(r => ({ name: LABEL[r.loai_giao_dich] || r.loai_giao_dich, value: trieu(r.tong) }))
      .filter(x => x.value > 0),
    pendingRefunds: refunds.map(r => ({
      code: r.ma_phieu,
      customerName: r.ho_ten,
      roomId: r.ma_phong || '—',
      refundRate: r.ty_le_hoan_coc != null ? Number(r.ty_le_hoan_coc) : 0,
      refundAmount: r.so_tien_hoan_thuc_te != null ? Number(r.so_tien_hoan_thuc_te) : Number(r.so_tien_coc || 0),
    })),
  }
}
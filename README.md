# SA Builder

Game web dạy tư duy **Solution Architect**, gameplay tối giản: đọc mục tiêu → dựng kiến trúc trên board → chạy.
Traffic, sự cố và tấn công chạy qua thiết kế; đạt mọi ràng buộc là qua level. Ràng buộc không chỉ là tải và latency
mà cả ngân sách, TCO, deadline, pháp lý (NĐ 13/2023, PCI-DSS), DR, hệ thống cũ và migration; một số level có thêm
thẻ quyết định (build/buy, mức DR, tenancy, cutover…).

Lấy cảm hứng từ [systemdesign.200lab.io](https://systemdesign.200lab.io) và [gonnacrash.com](https://gonnacrash.com),
nhưng đi xa hơn client-server: ngân sách, pháp lý (NĐ 13/2023, PCI-DSS), hệ thống cũ, migration, multi-tenancy và con người.

## Chạy thử

Cần Node 20+ và pnpm 10.

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

Không cần cấu hình gì: tiến độ lưu trong trình duyệt. Tài khoản và bảng xếp hạng bật khi cấu hình Supabase (xem dưới).

```bash
pnpm test                         # engine + content + web unit tests
pnpm --filter web build && pnpm --filter web start
pnpm --filter web e2e             # Playwright chơi level 1 qua UI (BASE_URL mặc định http://localhost:3000)
pnpm --filter @sa/content exec tsx scripts/report.ts [levelId]   # xem điểm lời giải mẫu và thiết kế "ngây thơ"
```

## Cấu trúc

```
packages/engine    Engine thuần TypeScript, deterministic: compile graph → phân tích tĩnh → mô phỏng → rule → review
packages/content   Catalog thành phần trung lập (+ mapping AWS/Azure/GCP/On-prem), khái niệm, World 1 (8 level)
apps/web           Next.js 16 + React Flow: bản đồ, board, quyết định, chạy, kết quả, khái niệm, bảng xếp hạng
supabase/          Migration SQL (profiles, runs, level_progress, leaderboard, RLS)
docs/superpowers   Spec thiết kế và kế hoạch triển khai
```

### Engine

`evaluate(level, design, catalog)` là hàm thuần: không I/O, không `Date`, không `Math.random`, không hàm siêu việt.
Cùng input cho cùng kết quả trên browser và server, nên server chấm lại được để chống gian lận bảng xếp hạng.

1. **Compile**: kiểm tra palette/giới hạn, dò đường từng loại traffic (router chia đều, cache read-through, queue → worker,
   VPN/đường riêng tới on-prem).
2. **Phân tích tĩnh**: dữ liệu `pii`/`card` chảy qua đâu (residency, mã hoá, phạm vi PCI), chi phí tháng, TCO 3 năm
   (hạ tầng × 36 + chi phí một lần + dev-tháng xây dựng và vận hành), thời gian ra mắt, công nghệ team chưa quen.
3. **Mô phỏng** (fluid, tick 1 giây): capacity × instance còn sống, latency theo utilization, failover nhờ standby,
   job xả theo capacity còn dư của hệ thống phía sau, WAF chặn tấn công, quota theo tenant.
4. **Rule**: `metric`, `residency`, `encryption`, `on_path`, `isolation`, `flag`, `decision`; ràng buộc cứng (trượt là
   không qua) và điểm cộng.
5. **Kết quả**: mục tiêu đạt/trượt, lý do kèm khái niệm, sao (1★ qua mọi ràng buộc cứng,
   2★ điểm ≥ 70, 3★ điểm ≥ 85 và TCO dưới ngưỡng của level).

Engine chỉ biết ~10 *behavior* (`router`, `compute`, `provider`, `cache`, `queue`, `link`…). Mỗi thành phần là dữ liệu
chọn một behavior, nên world theo provider (AWS, GCP…) chủ yếu là viết thêm dữ liệu.

## Thêm một level

1. Tạo `packages/content/src/levels/lN-*.ts` export `level` và `examples` (một lời giải mẫu + vài thiết kế ngây thơ kèm
   rule phải trượt). Xem các level có sẵn làm mẫu.
2. Thêm vào `packages/content/src/levels/index.ts`.
3. `pnpm --filter @sa/content test`: golden test kiểm tra schema, lời giải mẫu đạt ≥ 2★ và thiết kế ngây thơ trượt đúng lý do.
4. Dùng `scripts/report.ts` để cân chỉnh số liệu.

## Bật tài khoản và bảng xếp hạng (Supabase)

1. Tạo project Supabase, chạy `supabase/migrations/0001_init.sql` trong SQL editor (hoặc `supabase db push`).
2. Bật provider GitHub và/hoặc Email trong Authentication; thêm `https://<domain>/auth/callback` vào Redirect URLs.
3. Đặt biến môi trường cho `apps/web`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # chỉ ở server: dùng để ghi run đã được chấm lại
```

Người chơi đã đăng nhập: sau mỗi lần chạy, client gửi thiết kế lên `POST /api/runs`, server chạy lại engine và ghi kết quả.
Người chơi không ghi trực tiếp được vào bảng `runs` (RLS chỉ cho đọc của mình).

## Deploy

Vercel: Root Directory `apps/web`, Install Command `pnpm install`, Build Command `pnpm build`. Thêm các biến Supabase nếu cần.

## Lộ trình

- [x] MVP: engine, World 1 "Hợp đồng đầu tiên" (8 level), vòng Đọc mục tiêu → Dựng → Chạy, khái niệm, Supabase tuỳ chọn
- [ ] Studio + gallery cộng đồng (fork, duyệt)
- [ ] World theo provider: AWS, GCP, Azure, On-premise (palette chỉ gồm dịch vụ của provider đó)
- [ ] Career mode: một công ty qua nhiều năm, quyết định cũ và nợ kỹ thuật đi theo
- [ ] World luyện cert (SAA/SAP, AZ-305, PCA) và cho SA đang làm
- [ ] Giao diện tiếng Anh, dark mode, xem lại các lần chạy

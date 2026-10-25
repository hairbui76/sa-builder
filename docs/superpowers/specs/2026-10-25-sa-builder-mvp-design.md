# SA Builder — MVP design

Ngày: 2026-10-25 · Trạng thái: đã duyệt qua hội thoại (phần 1–2), phần 3–5 do Claude chốt theo yêu cầu "làm nốt".

## 1. Mục tiêu và phạm vi

SA Builder là game web công khai dạy tư duy **Solution Architect**, lấy cảm hứng từ
systemdesign.200lab.io (vòng "dựng → chạy → tìm chỗ sập") nhưng mở rộng sang lớp kiến
thức SA: khai thác yêu cầu, ràng buộc kinh doanh, build/buy, TCO 3 năm, DR, legacy,
migration, multi-tenancy, compliance, và bảo vệ quyết định trước hội đồng.

Người chơi: hỗn hợp tăng dần độ khó, ưu tiên **dev 2–5 năm muốn lên SA/Tech Lead**.

Cloud: trung lập, mỗi component hiện mapping AWS/Azure/GCP/On-prem. Sau MVP sẽ có các
world riêng theo provider (palette chỉ gồm component của provider đó).

### Trong MVP (sub-project 1)

- `packages/engine`: engine mô phỏng + phân tích tĩnh + chấm điểm, thuần TypeScript, deterministic.
- `packages/content`: catalog component trung lập + World 1 "Hợp đồng đầu tiên" (8 level) + khái niệm.
- `apps/web`: Next.js. Vòng 4 bước Khảo sát → Thiết kế → Mô phỏng → Review; bản đồ world; trang khái niệm.
- Tiến độ lưu localStorage (chơi ngay không cần tài khoản). Khi cấu hình Supabase: đăng nhập,
  đồng bộ tiến độ, server chạy lại engine để chấm chính thức, bảng xếp hạng tuần.
- UI tạm thời mô phỏng bố cục/phong cách sketch của 200Lab (tự viết, không dùng asset/nội dung của họ).

### Ngoài MVP (sub-project sau)

2. Studio + gallery cộng đồng (fork, duyệt). 3. World theo provider: AWS, GCP, Azure, On-premise.
4. Career mode (một công ty qua nhiều năm, quyết định cũ mang theo). 5. World luyện cert và cho SA đang làm.

## 2. Nội dung World 1 — "Hợp đồng đầu tiên"

Người chơi vừa từ Senior Dev lên SA ở một công ty tư vấn. Mỗi level là một khách hàng.

| # | Level | Khái niệm chính |
|---|---|---|
| 1 | Hỏi trước khi vẽ (chuỗi phòng khám) | Khai thác yêu cầu, data residency (NĐ 13/2023) |
| 2 | Build hay Buy (shop thời trang) | Build vs Buy vs SaaS, TCO 3 năm, deadline |
| 3 | DR bao nhiêu là đủ (logistics) | HA vs DR, RTO/RPO theo quy trình, DR tier |
| 4 | Hệ thống cũ không được tắt (bán lẻ + ERP on-prem) | Tích hợp legacy, hybrid link, queue làm đệm rate limit |
| 5 | Di chuyển không downtime (bảo hiểm) | 6R, strangler fig, cutover |
| 6 | Khách nào cũng muốn riêng (SaaS HR) | Multi-tenancy silo/pool/bridge, noisy neighbor |
| 7 | Kiểm toán gõ cửa (ví fintech) | PCI-DSS scope, tokenization, WAF, KMS, audit log |
| 8 | Boss: Hồ sơ dự thầu (chuỗi 200 cửa hàng) | Tổng hợp, stakeholder mâu thuẫn, ADR |

Mỗi level có: stakeholder (mối quan tâm ẩn), ràng buộc cứng (fail là trượt), mục tiêu mềm
(ảnh hưởng điểm), thẻ quyết định, sự kiện trong mô phỏng, chấm review theo 6 trụ cột
Well-Architected + phù hợp kinh doanh + rủi ro triển khai.

Sao: 1★ = qua mọi ràng buộc cứng; 2★ = điểm review tổng ≥ 70; 3★ = ≥ 85 và TCO 3 năm ≤ ngưỡng 3★ của level.

## 3. Engine (`packages/engine`)

`evaluate(level, design, catalog) → Result`. Hàm thuần: không I/O, không `Date`, không
`Math.random`, không hàm siêu việt (chỉ + − × ÷, làm tròn ở biên). Cùng input → cùng output
trên browser và server. `evaluationId = engineVersion + hash(level)`.

### 3.1 Mô hình dữ liệu

- **ComponentDef** (catalog, dữ liệu): `type`, `behavior`, tiers (capacity ops/s, latency ms,
  giá/tháng, giá theo triệu request), `provides` (call family), props (`stateful`,
  `onPrem`, `strips` dữ liệu nhạy cảm, `blocksMalicious`, `region` cố định cho SaaS…),
  settings (count, tier, region, encryption, standby, tenantQuota), `tech` (kỹ năng cần),
  `flags` (vd `audit_log`), mapping AWS/Azure/GCP/On-prem.
- **Behavior** (engine biết ~10 loại): `entry`, `router` (LB, gateway, WAF, tokenizer),
  `edge_cache` (CDN), `compute`, `worker`, `provider` (DB, KV, object, search, SaaS, ERP),
  `cache`, `queue`, `link` (VPN/đường riêng), `attachment` (KMS, IdP, audit log, monitoring — không nằm trên luồng).
- **TrafficKind** (theo level): nguồn (`from` entry), `calls: [{family, count}]`, `async`
  (`jobCalls` cho worker), `carries` (`pii`, `card`), `malicious`.
- **Level**: story, stakeholders, discovery (giờ họp, câu hỏi → fact), facts, rules, decisions
  (thẻ, option có effects), traffic phases, events, palette, limits, regions, team (số dev,
  kỹ năng, chi phí dev/tháng), budget, ngưỡng sao.
- **Design**: nodes (type, settings, vị trí), edges, decisions đã chọn, câu hỏi đã hỏi, ghi chú ADR.

### 3.2 Pipeline

1. **Validate & compile**: palette, giới hạn, edge hợp lệ; dò đường của từng traffic kind qua
   graph (router chia đều, cache hit/miss, queue → worker, link trong suốt). Thiếu đường → `no_path`.
2. **Phân tích tĩnh**: gắn nhãn dữ liệu (`pii`, `card`) theo luồng, tính phạm vi PCI, residency,
   mã hoá; TCO 3 năm (hạ tầng ×36 + thẻ quyết định + dev-months × lương); rủi ro triển khai
   (effort/team so với deadline, công nghệ ngoài kỹ năng team); flags.
3. **Mô phỏng động** (fluid, tick 1 s): traffic theo phase; mỗi node: capacity × instance còn
   sống, utilization ρ, tỷ lệ phục vụ `min(1, 1/ρ)`, latency `base·(1 + ρ³/(1−ρ))` (ρ chặn 0.95),
   độ trễ chéo vùng; queue tích backlog, worker xả theo capacity còn dư của provider phía sau;
   sự kiện: node chết (standby thì failover), spike, tấn công.
4. **Rules**: so số đo với ràng buộc (answered, latency, jobs, wait, budget, TCO, residency,
   encryption, scope, on_path, isolation, deadline, skills, RTO/RPO, flags, quyết định).
5. **Review**: điểm 0–100 mỗi trụ cột từ các rule gắn trụ cột, verdict từng stakeholder,
   lý do thất bại (code + node + khái niệm), sao.

## 4. Vòng chơi và UX (`apps/web`)

Bố cục theo phong cách 200Lab: header (traffic, cost/tháng, budget, nút Chạy), panel vàng
"Mục tiêu" bên trái, board sketch ở giữa (React Flow), panel Components/Quyết định bên phải.

1. **Khảo sát**: thẻ stakeholder, mỗi câu hỏi tốn giờ họp; câu trả lời mở ra fact. Fact là ràng
   buộc hiện trong panel Mục tiêu. Ràng buộc ẩn vẫn được chấm dù chưa hỏi (bài học của level 1).
2. **Thiết kế**: kéo/nhấp thêm component, nối dây, chỉnh cấu hình node; tab Quyết định chọn
   option cho từng thẻ, ghi chú ADR tuỳ chọn.
3. **Mô phỏng**: chạy engine, biểu đồ answered%/latency theo thời gian, node lỗi tô đỏ.
4. **Review**: bảng mục tiêu đạt/trượt, lý do + khái niệm, chi phí & TCO, điểm trụ cột,
   verdict stakeholder, sao. Fact bỏ lỡ được nêu rõ.

Trang khác: trang chủ (world, tiếp tục chơi), bản đồ world, trang khái niệm (kèm mapping
cloud), bảng xếp hạng, đăng nhập.

## 5. Dữ liệu & backend

- Không cấu hình: localStorage (`progress`, `design:<level>`).
- Có `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` + `SUPABASE_SERVICE_ROLE_KEY`: Supabase Auth (GitHub, magic
  link); bảng `profiles`, `level_progress`, `runs`; view leaderboard tuần; RLS chỉ cho user đọc/ghi của mình.
  `POST /api/runs` chạy lại engine trên server, ghi run + cập nhật progress, trả kết quả chính thức.
- Migration SQL ở `supabase/migrations`.

## 6. Kiểm thử

- Vitest cho engine: từng module + golden test mỗi level (lời giải mẫu đạt ≥ 2★, các thiết kế
  "ngây thơ" trượt đúng lý do), test determinism.
- Test schema content (zod) cho catalog và level.
- Playwright smoke: mở level, khảo sát, dựng lời giải, chạy, thấy kết quả.
- SQL migration chạy được trên Postgres 16 local.

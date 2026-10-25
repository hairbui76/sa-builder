export interface Concept {
  key: string;
  title: string;
  summary: string;
  /** What an SA should ask or check in a real engagement. */
  saTip: string;
  mapping?: { aws: string; azure: string; gcp: string; onprem: string };
}

export const concepts: Concept[] = [
  {
    key: 'requirements_elicitation',
    title: 'Khai thác yêu cầu',
    summary:
      'Khách hàng hiếm khi nói hết yêu cầu ngay từ đầu. Ràng buộc quan trọng nhất (pháp lý, ngân sách, deadline, SLA) thường nằm trong đầu những người khác nhau: giám đốc, pháp chế, vận hành, IT.',
    saTip: 'Lập danh sách stakeholder trước khi vẽ. Hỏi mỗi người: điều gì làm dự án thất bại trong mắt họ?',
  },
  {
    key: 'stakeholder_tradeoffs',
    title: 'Cân bằng giữa các stakeholder',
    summary:
      'CFO muốn rẻ, CISO muốn an toàn, CTO muốn nhanh, vận hành muốn ổn định. Không có thiết kế làm tất cả hài lòng tuyệt đối; SA chọn điểm cân bằng và giải thích được vì sao.',
    saTip: 'Ghi rõ đánh đổi trong ADR và để stakeholder ký xác nhận trước khi build.',
  },
  {
    key: 'adr',
    title: 'Architecture Decision Record (ADR)',
    summary:
      'Một ghi chép ngắn cho mỗi quyết định kiến trúc: bối cảnh, phương án đã cân nhắc, lựa chọn, hệ quả. Giúp người đến sau hiểu vì sao hệ thống như hiện tại.',
    saTip: 'Viết ADR ngay khi quyết định, không phải sau khi dự án xong.',
  },
  {
    key: 'data_residency',
    title: 'Data residency (Nghị định 13/2023)',
    summary:
      'Một số dữ liệu phải lưu trong lãnh thổ hoặc chỉ được chuyển ra nước ngoài khi có đánh giá tác động. Dữ liệu sức khoẻ, tài chính là dữ liệu cá nhân nhạy cảm. Gửi dữ liệu cho SaaS nước ngoài (email, SMS, analytics) cũng là chuyển dữ liệu ra nước ngoài.',
    saTip: 'Vẽ bản đồ luồng dữ liệu cá nhân: nó đi qua và nằm lại ở những đâu, kể cả bên thứ ba.',
    mapping: { aws: 'Region / Local Zone phù hợp', azure: 'Region / Sovereign cloud', gcp: 'Region + Assured Workloads', onprem: 'Data center trong nước' },
  },
  {
    key: 'build_vs_buy',
    title: 'Build vs Buy vs SaaS',
    summary:
      'Tự xây cho bạn quyền kiểm soát và khác biệt, nhưng tốn thời gian, tiền lương và công vận hành suốt vòng đời. Mua SaaS ra mắt nhanh, trả phí hằng tháng và chấp nhận phụ thuộc nhà cung cấp.',
    saTip: 'Chỉ tự xây phần tạo ra lợi thế cạnh tranh; phần "ai cũng cần" (thanh toán, email, search) thường nên mua.',
  },
  {
    key: 'tco',
    title: 'TCO 3 năm',
    summary:
      'Tổng chi phí sở hữu gồm hạ tầng hằng tháng × 36, chi phí một lần (license, audit, migration) và công người: xây dựng lẫn vận hành. Phương án rẻ nhất mỗi tháng chưa chắc rẻ nhất sau 3 năm.',
    saTip: 'So sánh phương án bằng TCO, không chỉ bằng hoá đơn cloud tháng đầu.',
  },
  {
    key: 'delivery_risk',
    title: 'Rủi ro triển khai',
    summary:
      'Thiết kế đẹp mà team không kịp làm hoặc không biết vận hành là thiết kế tồi. Công nghệ mới với team cần thời gian học; việc tự xây cần dev-tháng.',
    saTip: 'Hỏi team đang giỏi gì và deadline cứng là gì trước khi chọn stack.',
  },
  {
    key: 'ha_vs_dr',
    title: 'High Availability khác Disaster Recovery',
    summary:
      'HA giữ hệ thống chạy khi một máy hay một zone hỏng (standby, nhiều instance sau Load Balancer). DR khôi phục khi cả region hay data center mất. Cần cả hai, ở mức phù hợp với thiệt hại kinh doanh.',
    saTip: 'Hỏi: mất dịch vụ 1 giờ thì thiệt hại bao nhiêu? Câu trả lời quyết định ngân sách DR.',
  },
  {
    key: 'rto_rpo',
    title: 'RTO và RPO',
    summary:
      'RTO: được phép ngừng dịch vụ tối đa bao lâu. RPO: được phép mất tối đa bao nhiêu phút dữ liệu. Mỗi quy trình kinh doanh có RTO/RPO riêng; không phải mọi thứ đều cần bằng 0.',
    saTip: 'Lấy RTO/RPO từ người chịu trách nhiệm kinh doanh, không phải từ team kỹ thuật.',
  },
  {
    key: 'dr_tiers',
    title: 'Các mức DR',
    summary:
      'Backup & restore (rẻ, RTO nhiều giờ) → Pilot light (dữ liệu sao chép sẵn, RTO ~1 giờ) → Warm standby (bản thu nhỏ chạy sẵn, RTO vài phút) → Active-active (chạy song song nhiều region, RTO gần 0, đắt và phức tạp nhất).',
    saTip: 'Chọn mức thấp nhất vẫn đạt RTO/RPO của từng quy trình.',
    mapping: { aws: 'AWS Elastic Disaster Recovery / Aurora Global', azure: 'Azure Site Recovery / geo-replication', gcp: 'Backup and DR / cross-region replica', onprem: 'DR site + replication' },
  },
  {
    key: 'failover',
    title: 'Failover',
    summary: 'Khi node chính chết, một bản dự phòng (standby) ở zone khác được nâng lên thay trong vài giây. Không có standby thì phải chờ sửa xong.',
    saTip: 'Mọi store giữ dữ liệu quan trọng đều cần standby ở zone khác.',
    mapping: { aws: 'RDS Multi-AZ', azure: 'Zone-redundant / failover group', gcp: 'Cloud SQL HA', onprem: 'Patroni / Always On' },
  },
  {
    key: 'single_point_of_failure',
    title: 'Single point of failure',
    summary: 'Thành phần duy nhất mà khi chết thì cả luồng chết. Cần ít nhất N+1 instance sau Load Balancer, hoặc standby.',
    saTip: 'Đi dọc từng luồng request và hỏi: thứ này chết thì sao?',
  },
  {
    key: 'legacy_integration',
    title: 'Tích hợp hệ thống cũ',
    summary:
      'Hệ thống cũ (ERP, core banking) thường chậm, chịu tải thấp và không được phép sửa. Đừng để traffic người dùng đổ thẳng vào: đọc qua cache/bản sao, ghi qua queue với tốc độ hệ thống cũ chịu được.',
    saTip: 'Hỏi giới hạn tải thật của hệ thống cũ và ai chịu trách nhiệm khi nó treo.',
  },
  {
    key: 'anti_corruption_layer',
    title: 'Anti-corruption layer',
    summary: 'Một lớp dịch giữa hệ thống mới và hệ thống cũ, để mô hình dữ liệu cũ không "nhiễm" sang hệ thống mới, và thay hệ thống cũ sau này không phải sửa mọi nơi.',
    saTip: 'Khi biết hệ thống cũ sẽ bị thay, cô lập nó sau một interface của riêng bạn.',
  },
  {
    key: 'hybrid_connectivity',
    title: 'Kết nối hybrid',
    summary: 'Cloud nói chuyện với data center của khách qua VPN (rẻ, nhanh dựng, băng thông thấp) hoặc đường truyền riêng (ổn định, nhanh, đắt). Không mở hệ thống nội bộ ra internet.',
    saTip: 'Ước lượng băng thông và độ trễ cần thiết trước khi chọn VPN hay đường riêng.',
    mapping: { aws: 'Site-to-Site VPN / Direct Connect', azure: 'VPN Gateway / ExpressRoute', gcp: 'Cloud VPN / Interconnect', onprem: 'IPsec / leased line' },
  },
  {
    key: 'queue_buffering',
    title: 'Queue làm đệm',
    summary: 'Queue tách người gửi khỏi người xử lý: app trả lời ngay, worker xử lý theo nhịp mà hệ thống phía sau chịu được. Spike được "dàn phẳng" theo thời gian.',
    saTip: 'Hỏi: kết quả có cần ngay lập tức không, hay chậm vài phút cũng được?',
    mapping: { aws: 'SQS', azure: 'Service Bus', gcp: 'Pub/Sub', onprem: 'RabbitMQ / Kafka' },
  },
  {
    key: 'migration_6r',
    title: '6R của migration',
    summary:
      'Rehost (lift & shift), Replatform (đổi nền tảng, ít sửa code), Refactor (viết lại cho cloud), Repurchase (đổi sang SaaS), Retain (giữ lại), Retire (bỏ đi). Mỗi module chọn một R khác nhau tuỳ giá trị và rủi ro.',
    saTip: 'Không có R đúng cho cả hệ thống; phân loại từng module.',
  },
  {
    key: 'strangler_fig',
    title: 'Strangler fig',
    summary: 'Đặt một "mặt tiền" (API Gateway) trước hệ thống cũ, chuyển dần từng chức năng sang hệ thống mới phía sau mặt tiền đó. Không có ngày "big bang", có thể quay lui từng phần.',
    saTip: 'Chọn chức năng ít rủi ro chuyển trước để team học cách làm.',
  },
  {
    key: 'cutover',
    title: 'Cutover',
    summary: 'Thời điểm chuyển traffic từ hệ thống cũ sang mới. Big bang nhanh nhưng downtime và rủi ro lớn; chạy song song an toàn nhưng tốn tiền vận hành hai hệ thống.',
    saTip: 'Luôn có kế hoạch rollback được diễn tập trước.',
  },
  {
    key: 'multi_tenancy',
    title: 'Multi-tenancy: silo, pool, bridge',
    summary:
      'Pool: mọi tenant dùng chung hạ tầng, rẻ nhất. Silo: mỗi tenant một bộ riêng, cách ly nhất và đắt nhất. Bridge: dùng chung một phần (vd chung app, riêng database). Thường dùng pool cho khách nhỏ, silo cho khách lớn trả tiền cho sự cách ly.',
    saTip: 'Gắn mô hình tenancy với gói giá: khách nào trả tiền cho sự cách ly?',
  },
  {
    key: 'noisy_neighbor',
    title: 'Noisy neighbor',
    summary: 'Một tenant dùng quá nhiều tài nguyên chung làm chậm mọi tenant khác. Giới hạn theo tenant (quota, rate limit) ở cửa vào để bảo vệ phần còn lại.',
    saTip: 'Hỏi: nếu một khách chạy script import 1 triệu dòng lúc 9h sáng thì sao?',
  },
  {
    key: 'pci_scope',
    title: 'Phạm vi PCI-DSS',
    summary:
      'Mọi thành phần lưu, xử lý hay truyền số thẻ đều nằm trong phạm vi PCI-DSS và phải đạt hàng trăm yêu cầu kiểm soát. Giảm số thành phần chạm vào số thẻ là cách rẻ nhất để đạt chuẩn.',
    saTip: 'Đừng bảo vệ dữ liệu thẻ ở khắp nơi; hãy làm cho nó chỉ xuất hiện ở rất ít nơi.',
  },
  {
    key: 'tokenization',
    title: 'Tokenization',
    summary: 'Thay số thẻ thật bằng token ngay ở cửa vào. Hệ thống phía sau chỉ thấy token nên ra khỏi phạm vi PCI; chỉ vault giữ số thẻ thật.',
    saTip: 'Đặt tokenization càng gần người dùng càng tốt.',
  },
  {
    key: 'defence_in_depth',
    title: 'Phòng thủ nhiều lớp',
    summary: 'Không lớp bảo vệ nào hoàn hảo: WAF, xác thực, phân quyền tối thiểu, mã hoá, audit log cùng nhau làm kẻ tấn công phải vượt nhiều rào.',
    saTip: 'Giả sử một lớp đã bị vượt qua: lớp tiếp theo là gì?',
  },
  {
    key: 'encryption_kms',
    title: 'Mã hoá và quản lý khoá',
    summary: 'Mã hoá at-rest mặc định bảo vệ khi ổ đĩa bị lấy cắp. Dữ liệu nhạy cảm cần khoá do bạn quản lý trong KMS: kiểm soát ai dùng khoá, xoay vòng và có log.',
    saTip: 'Hỏi kiểm toán viên: họ có yêu cầu khoá do khách hàng quản lý không?',
    mapping: { aws: 'KMS / CloudHSM', azure: 'Key Vault / Managed HSM', gcp: 'Cloud KMS / Cloud HSM', onprem: 'HSM / Vault' },
  },
  {
    key: 'identity',
    title: 'Định danh và SSO',
    summary: 'Nhân viên đăng nhập một lần qua Identity Provider có MFA, quyền cấp theo vai trò, nghỉ việc là thu hồi ở một chỗ.',
    saTip: 'Tài khoản admin dùng chung là phát hiện kiểm toán phổ biến nhất.',
  },
  {
    key: 'observability',
    title: 'Observability',
    summary: 'Metric, log, trace và cảnh báo giúp team biết hệ thống có vấn đề và vì sao, trước khi khách hàng báo.',
    saTip: 'Định nghĩa SLO trước, rồi cảnh báo theo SLO.',
  },
  {
    key: 'load_balancing',
    title: 'Load balancing',
    summary: 'Load Balancer chia request cho nhiều instance và bỏ qua instance đã chết. Người dùng chỉ cần biết một địa chỉ.',
    saTip: 'Nhiều instance mà không có Load Balancer thì chỉ một instance làm việc.',
  },
  {
    key: 'scale_out',
    title: 'Scale out',
    summary: 'Thêm instance để chia tải. Cần Load Balancer phía trước và ứng dụng không giữ trạng thái trong máy.',
    saTip: 'Chừa dư ít nhất một instance cho lúc một cái chết (N+1).',
  },
  {
    key: 'caching',
    title: 'Cache',
    summary: 'Giữ bản sao dữ liệu hay đọc trong RAM. Mỗi lượt trúng cache là một lượt đọc database được tiết kiệm.',
    saTip: 'Hỏi tỷ lệ đọc/ghi và dữ liệu được phép cũ bao lâu.',
  },
  {
    key: 'read_replicas',
    title: 'Read replica',
    summary: 'Bản sao chỉ đọc gánh lượt đọc cho database chính. Mọi lượt ghi vẫn về primary.',
    saTip: 'Replica không giúp khi nghẽn vì ghi.',
  },
  {
    key: 'cdn_offload',
    title: 'CDN',
    summary: 'Phục vụ file tĩnh từ edge gần người dùng, giảm tải và độ trễ cho hệ thống gốc.',
    saTip: 'Ảnh và file tĩnh không nên đi qua App Server.',
  },
  {
    key: 'serverless_tradeoff',
    title: 'Serverless: khi nào rẻ, khi nào đắt',
    summary: 'Serverless rẻ khi traffic thấp hoặc thất thường vì không trả tiền lúc rảnh. Traffic lớn và đều thì trả theo request thường đắt hơn server chạy liên tục.',
    saTip: 'Tính chi phí ở mức traffic thật, không ở mức demo.',
  },
  {
    key: 'data_store_choice',
    title: 'Chọn kiểu lưu trữ',
    summary: 'SQL cho dữ liệu quan hệ và giao dịch; key-value cho truy cập theo key ở quy mô lớn; object storage cho file. Chọn theo cách dữ liệu được đọc, không theo trào lưu.',
    saTip: 'Mỗi loại store mới là thêm một thứ team phải vận hành.',
  },
  {
    key: 'request_flow',
    title: 'Luồng request',
    summary: 'Mỗi loại request phải có đường đi đầy đủ từ người dùng tới nơi lưu dữ liệu. Thiếu một kết nối là request đó thất bại.',
    saTip: 'Đi dọc từng loại request trên sơ đồ trước khi chạy.',
  },
  {
    key: 'sustainability',
    title: 'Bền vững và right-sizing',
    summary: 'Máy chạy không tải vẫn tốn điện và tiền. Chọn đúng cỡ, tắt thứ không dùng, dùng dịch vụ managed dùng chung hạ tầng.',
    saTip: 'Mục tiêu sử dụng tài nguyên trung bình hợp lý, không phải 5%.',
  },
];

export const conceptByKey: Record<string, Concept> = Object.fromEntries(concepts.map((c) => [c.key, c]));

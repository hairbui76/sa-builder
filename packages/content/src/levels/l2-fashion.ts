import type { Level } from '@sa/engine';
import { DEV_MONTHLY_USD, REGIONS, REGION_LATENCY, WORLD1, example, fixed, type LevelExamples } from './common';

const fixedNodes = [fixed('users', 'users', 'Khách mua sắm', 520, 60, { region: 'vn' })];

export const level: Level = {
  id: 'build_or_buy',
  worldId: WORLD1,
  order: 2,
  title: 'Build hay Buy',
  client: 'Thời trang Mây',
  brief: 'Dựng web shop chịu được flash sale và chọn build hay buy cho thanh toán, search, email marketing.',
  difficulty: 2,
  conceptKeys: ['build_vs_buy', 'tco', 'delivery_risk'],
  team: { size: 3, skills: ['nodejs', 'sql', 'redis'], devMonthlyUsd: DEV_MONTHLY_USD, baseMonths: 2.5 },
  regions: REGIONS,
  defaultRegion: 'sg',
  regionLatencyMs: REGION_LATENCY,
  fixedNodes,
  traffic: {
    ticks: 120,
    usageScale: 0.3,
    kinds: [
      { id: 'browse', title: 'Xem sản phẩm', from: 'users', userFacing: true, calls: [{ family: 'sql_read', count: 2 }] },
      { id: 'images', title: 'Tải ảnh sản phẩm', from: 'users', userFacing: true, target: 'static', edgeCacheable: true, calls: [] },
      { id: 'search', title: 'Tìm kiếm', from: 'users', userFacing: true, calls: [{ family: 'search', count: 1 }] },
      {
        id: 'checkout',
        title: 'Đặt hàng',
        from: 'users',
        userFacing: true,
        carries: ['pii'],
        calls: [
          { family: 'sql_read', count: 1 },
          { family: 'sql_write', count: 2 },
        ],
      },
    ],
    phases: [
      { from: 0, to: 60, rates: { browse: 150, images: 300, search: 40, checkout: 5 } },
      { from: 60, to: 90, rates: { browse: 450, images: 900, search: 120, checkout: 20 } },
      { from: 90, to: 120, rates: { browse: 150, images: 300, search: 40, checkout: 5 } },
    ],
  },
  events: [],
  palette: [
    { type: 'cdn' },
    { type: 'load_balancer' },
    { type: 'app_server', tiers: ['s', 'm'] },
    { type: 'relational_db', tiers: ['s', 'm'], max: 1 },
    { type: 'read_replica', tiers: ['s', 'm'] },
    { type: 'cache', tiers: ['s', 'l'] },
    { type: 'object_storage' },
    { type: 'search_index' },
    { type: 'search_saas' },
    { type: 'email_service' },
    { type: 'monitoring' },
  ],
  limits: { maxNodes: 12, maxEdges: 20 },
  decisions: [
    {
      id: 'payments',
      title: 'Thanh toán',
      prompt: 'Khách trả tiền bằng cách nào?',
      conceptKey: 'build_vs_buy',
      options: [
        { id: 'psp', title: 'Dùng cổng thanh toán (PSP)', summary: 'Tích hợp VNPay/Stripe: 2 tuần. Phí giao dịch ước ~$250/tháng.', effects: { monthlyUsd: 250, devMonths: 0.5, flags: ['online_payment'] } },
        { id: 'build', title: 'Tự xây xử lý thẻ', summary: 'Kết nối thẳng ngân hàng: 5 dev-tháng, phải tự đạt PCI-DSS (audit 3 năm ~$60.000).', effects: { monthlyUsd: 60, oneOffUsd: 60000, devMonths: 5, flags: ['online_payment'] } },
        { id: 'cod', title: 'Chỉ nhận COD', summary: 'Không làm thanh toán online. Gần như không tốn gì.', effects: { devMonths: 0.2 } },
      ],
    },
    {
      id: 'search',
      title: 'Tìm kiếm sản phẩm',
      prompt: 'Search được làm bằng gì? (Phải khớp với thành phần trên board.)',
      conceptKey: 'build_vs_buy',
      options: [
        { id: 'saas', title: 'Search SaaS', summary: 'Tích hợp API: 0.3 dev-tháng. Cần Search SaaS trên board.', effects: { devMonths: 0.3 }, requires: ['search_saas'] },
        { id: 'self_host', title: 'Tự dựng Search Index', summary: 'Dựng cụm, đồng bộ dữ liệu, tuning: 1.5 dev-tháng, sau đó tự vận hành. Cần Search Index trên board.', effects: { devMonths: 1.5 }, requires: ['search_index'] },
      ],
    },
    {
      id: 'email',
      title: 'Email marketing',
      prompt: 'Chiến dịch email marketing chạy bằng gì?',
      conceptKey: 'build_vs_buy',
      options: [
        { id: 'saas', title: 'Mua SaaS marketing', summary: 'Có sẵn phân nhóm, A/B test, template: ~$120/tháng.', effects: { monthlyUsd: 120, devMonths: 0.3, flags: ['campaigns'] } },
        { id: 'build', title: 'Tự xây công cụ campaign', summary: '2.5 dev-tháng, gửi qua Email SaaS (cần trên board).', effects: { devMonths: 2.5, flags: ['campaigns'] }, requires: ['email_service'] },
      ],
    },
  ],
  rules: [
    { id: 'browse_ok', check: 'metric', metric: 'answered_pct:browse', op: '>=', value: 99, unit: '%', text: 'Xem sản phẩm: ít nhất 99% được phản hồi', failText: 'Lượt xem sản phẩm bị rớt lúc flash sale.', pillar: 'reliability', hard: true, conceptKey: 'scale_out' },
    { id: 'images_ok', check: 'metric', metric: 'answered_pct:images', op: '>=', value: 99, unit: '%', text: 'Ảnh sản phẩm: ít nhất 99% tải được', failText: 'Ảnh sản phẩm không tải được: cần nơi lưu file và đường đi tới đó.', pillar: 'reliability', hard: true, conceptKey: 'cdn_offload' },
    { id: 'search_ok', check: 'metric', metric: 'answered_pct:search', op: '>=', value: 99, unit: '%', text: 'Tìm kiếm: ít nhất 99% được phản hồi', failText: 'Tìm kiếm không phản hồi.', pillar: 'reliability', hard: true, conceptKey: 'request_flow' },
    { id: 'checkout_ok', check: 'metric', metric: 'answered_pct:checkout', op: '>=', value: 99.5, unit: '%', text: 'Đặt hàng: ít nhất 99.5% được phản hồi', failText: 'Đơn hàng bị rớt.', pillar: 'reliability', hard: true, conceptKey: 'request_flow' },
    { id: 'browse_fast', check: 'metric', metric: 'latency_ms:browse', op: '<=', value: 200, unit: 'ms', text: 'Xem sản phẩm: trung bình dưới 200 ms', failText: 'Trang sản phẩm chậm.', pillar: 'performance', hard: true, conceptKey: 'caching' },
    { id: 'deadline', check: 'metric', metric: 'calendar_months', op: '<=', value: 4, unit: 'months', text: 'Ra mắt trong 4 tháng', failText: 'Không kịp Tết: tự xây quá nhiều thứ với team 3 người.', pillar: 'delivery', hard: true, conceptKey: 'delivery_risk' },
    { id: 'online_pay', check: 'flag', flag: 'online_payment', present: true, text: 'Có thanh toán online', failText: 'Không có thanh toán online: khách trẻ bỏ giỏ hàng.', pillar: 'business', hard: true, conceptKey: 'build_vs_buy' },
    { id: 'tco', check: 'metric', metric: 'tco3y_usd', op: '<=', value: 80000, unit: '$', text: 'TCO 3 năm tối đa $80.000', failText: 'TCO 3 năm vượt trần $80.000 của CFO.', pillar: 'cost', hard: true, conceptKey: 'tco' },
    { id: 'campaign', check: 'decision', decision: 'email', options: ['saas'], text: 'Có email marketing ngay tháng đầu', failText: 'Tự xây công cụ campaign mất 2.5 dev-tháng: không kịp chiến dịch tháng đầu.', pillar: 'business', hard: false, conceptKey: 'build_vs_buy' },
    { id: 'skills', check: 'metric', metric: 'unfamiliar_tech', op: '<=', value: 0, text: 'Chỉ dùng công nghệ team đã quen', failText: 'Team phải học vận hành công nghệ mới.', pillar: 'delivery', hard: false, conceptKey: 'delivery_risk' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo', failText: 'Không có monitoring cho mùa sale.', pillar: 'ops', hard: false, conceptKey: 'observability' },
    { id: 'util', check: 'metric', metric: 'fleet_util_pct', op: '>=', value: 20, unit: '%', text: 'Sử dụng tài nguyên trung bình ≥ 20%', failText: 'Hạ tầng thừa so với tải.', pillar: 'sustainability', hard: false, conceptKey: 'sustainability' },
  ],
  stars: { tco3yUsd: 40000 },
  hints: [
    'Mỗi thẻ quyết định đều có chi phí ẩn: dev-tháng là tiền lương và là thời gian.',
    'Ảnh sản phẩm nên nằm ở Object Storage sau CDN, không đi qua App Server.',
    'Tự vận hành Search Index rẻ về hạ tầng nhưng tốn công đội vận hành mỗi năm.',
  ],
};

export const examples: LevelExamples = {
  reference: example(fixedNodes, {
    nodes: [
      ['cdn', 'cdn'],
      ['lb', 'load_balancer'],
      ['app', 'app_server', { tier: 'm', count: 1 }],
      ['cache', 'cache', { tier: 's' }],
      ['db', 'relational_db', { tier: 's', encryption: 'at_rest' }],
      ['files', 'object_storage'],
      ['search', 'search_saas'],
      ['mon', 'monitoring'],
    ],
    wires: 'users>cdn cdn>files cdn>lb lb>app app>cache cache>db app>db app>search',
    decisions: { payments: 'psp', search: 'saas', email: 'saas' },
  }),
  naive: [
    {
      name: 'Team tự xây mọi thứ',
      design: example(fixedNodes, {
        nodes: [
          ['cdn', 'cdn'],
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 1 }],
          ['cache', 'cache', { tier: 's' }],
          ['db', 'relational_db', { tier: 's' }],
          ['files', 'object_storage'],
          ['search', 'search_index'],
          ['mail', 'email_service'],
        ],
        wires: 'users>cdn cdn>files cdn>lb lb>app app>cache cache>db app>db app>search',
        decisions: { payments: 'build', search: 'self_host', email: 'build' },
      }),
      mustFail: ['deadline', 'tco'],
    },
    {
      name: 'Chỉ nhận COD cho nhanh',
      design: example(fixedNodes, {
        nodes: [
          ['cdn', 'cdn'],
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 1 }],
          ['cache', 'cache', { tier: 's' }],
          ['db', 'relational_db', { tier: 's' }],
          ['files', 'object_storage'],
          ['search', 'search_saas'],
        ],
        wires: 'users>cdn cdn>files cdn>lb lb>app app>cache cache>db app>db app>search',
        decisions: { payments: 'cod', search: 'saas', email: 'saas' },
      }),
      mustFail: ['online_pay'],
    },
  ],
};

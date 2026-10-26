import type { Level } from '@sa/engine';
import { DEV_MONTHLY_USD, REGIONS, REGION_LATENCY, WORLD1, example, fixed, type LevelExamples } from './common';

const fixedNodes = [
  fixed('users', 'users', 'Khách online', 520, 60, { region: 'vn' }),
  fixed('erp', 'legacy_erp', 'ERP Phúc An (on-prem)', 900, 620),
];

export const level: Level = {
  id: 'legacy_stays',
  worldId: WORLD1,
  order: 4,
  title: 'Hệ thống cũ không được tắt',
  client: 'Siêu thị mini Phúc An',
  brief: 'Đưa shop online lên cloud, đọc tồn kho và đẩy đơn vào ERP on-prem mà không làm sập nó.',
  difficulty: 3,
  conceptKeys: ['legacy_integration', 'hybrid_connectivity', 'queue_buffering', 'anti_corruption_layer'],
  team: { size: 3, skills: ['dotnet', 'sql', 'redis'], devMonthlyUsd: DEV_MONTHLY_USD, baseMonths: 2 },
  regions: REGIONS,
  defaultRegion: 'vn',
  regionLatencyMs: REGION_LATENCY,
  fixedNodes,
  traffic: {
    ticks: 120,
    usageScale: 0.4,
    kinds: [
      { id: 'browse', title: 'Xem sản phẩm', from: 'users', userFacing: true, calls: [{ family: 'sql_read', count: 2 }] },
      { id: 'stock', title: 'Xem tồn kho', from: 'users', userFacing: true, calls: [{ family: 'erp_read', count: 1 }] },
      {
        id: 'order',
        title: 'Đặt hàng',
        from: 'users',
        userFacing: true,
        carries: ['pii'],
        calls: [
          { family: 'sql_write', count: 1 },
          { family: 'job', count: 1 },
        ],
        jobCalls: [{ family: 'erp_write', count: 1 }],
      },
    ],
    phases: [
      { from: 0, to: 60, rates: { browse: 200, stock: 80, order: 3 } },
      { from: 60, to: 90, rates: { browse: 500, stock: 200, order: 15 } },
      { from: 90, to: 120, rates: { browse: 200, stock: 80, order: 3 } },
    ],
  },
  events: [],
  palette: [
    { type: 'load_balancer' },
    { type: 'app_server', tiers: ['s', 'm'] },
    { type: 'relational_db', tiers: ['s', 'm'], max: 1 },
    { type: 'cache', tiers: ['s', 'l'] },
    { type: 'queue' },
    { type: 'worker' },
    { type: 'vpn' },
    { type: 'dedicated_link' },
    { type: 'monitoring' },
  ],
  limits: { maxNodes: 12, maxEdges: 22 },
  discovery: {
    hours: 4,
    stakeholders: [
      {
        id: 'it',
        name: 'Anh Bình',
        role: 'Quản trị ERP',
        avatar: 'B',
        intro: 'Người duy nhất hiểu ERP. Đã nghỉ phép 3 năm chưa dùng.',
        concerns: ['erp_safe', 'stock_fast'],
        quotes: {
          happy: 'ERP chạy êm như chưa có shop online. Lần đầu tôi ngủ trọn giấc.',
          neutral: 'ERP gánh được, nhưng tôi vẫn phải canh.',
          unhappy: 'ERP treo là 40 cửa hàng đứng quầy. Tôi không đồng ý.',
        },
      },
      {
        id: 'wh',
        name: 'Chị Hạnh',
        role: 'Quản lý kho',
        avatar: 'H',
        intro: 'Soạn hàng theo đơn trong ERP.',
        concerns: ['order_ok', 'order_sync', 'order_fast_sync'],
        quotes: {
          happy: 'Đơn vào ERP ngay, kho soạn kịp giao trong ngày.',
          neutral: 'Đơn vào hơi chậm nhưng vẫn soạn kịp.',
          unhappy: 'Đơn vào trễ là kho giao trễ, khách huỷ.',
        },
      },
      {
        id: 'cio',
        name: 'Ông Thịnh',
        role: 'Giám đốc công nghệ',
        avatar: 'T',
        intro: 'Đang chuẩn bị dự án thay ERP.',
        concerns: ['acl', 'budget'],
        quotes: {
          happy: 'Khi thay ERP, shop online không phải sửa gì. Đúng tầm nhìn.',
          neutral: 'Được, nhưng 2 năm nữa sẽ phải làm lại nhiều.',
          unhappy: 'Shop online dính chặt vào ERP cũ thế này thì làm sao thay?',
        },
      },
    ],
    questions: [
      { id: 'q_limit', stakeholder: 'it', hours: 1, text: 'ERP chịu được bao nhiêu request?', answer: 'Khoảng 25 request mỗi giây là hết cỡ. Vượt là treo cả hệ thống, 40 cửa hàng không bán được.', reveals: ['erp_limit'] },
      { id: 'q_net', stakeholder: 'it', hours: 0.5, text: 'Cloud kết nối vào ERP bằng cách nào?', answer: 'ERP không bao giờ được mở ra internet. Phải đi qua kênh mã hoá riêng.', reveals: ['no_internet'] },
      { id: 'q_sync', stakeholder: 'wh', hours: 1, text: 'Đơn online cần vào ERP nhanh cỡ nào?', answer: 'Trong vòng 2 phút, để kho kịp soạn trong đợt giao kế tiếp.', reveals: ['order_sync'] },
      { id: 'q_future', stakeholder: 'cio', hours: 1, text: 'ERP này còn dùng bao lâu?', answer: 'Khoảng 2 năm nữa chúng tôi thay bằng SAP. Lúc đó tôi không muốn viết lại shop online.', reveals: ['replace'] },
      { id: 'q_budget', stakeholder: 'cio', hours: 0.5, text: 'Ngân sách hạ tầng hằng tháng?', answer: 'Tối đa 900 đô một tháng.', reveals: ['budget'] },
      { id: 'q_stock', stakeholder: 'wh', hours: 0.5, text: 'Tồn kho hiển thị trên web cần chính xác tới mức nào?', answer: 'Lệch vài chục giây không sao, miễn không bán hàng đã hết quá lâu.', reveals: ['stale_ok'] },
    ],
    facts: [
      { id: 'erp_limit', text: 'ERP chịu tối đa ~25 request/giây, vượt là treo cả 40 cửa hàng.', key: true },
      { id: 'order_sync', text: 'Đơn online phải vào ERP trong 2 phút.', key: true },
      { id: 'replace', text: 'ERP sẽ bị thay bằng SAP sau ~2 năm.', key: true },
      { id: 'budget', text: 'Ngân sách hạ tầng tối đa $900/tháng.', key: false },
      { id: 'no_internet', text: 'ERP không được mở ra internet.', key: false },
      { id: 'stale_ok', text: 'Tồn kho trên web được phép cũ vài chục giây.', key: false },
    ],
  },
  decisions: [
    {
      id: 'integration',
      title: 'Cách tích hợp với ERP',
      prompt: 'Code shop online nói chuyện với ERP thế nào?',
      conceptKey: 'anti_corruption_layer',
      options: [
        { id: 'p2p', title: 'Gọi thẳng API ERP', summary: 'Nhanh nhất: 0.3 dev-tháng. Code shop dùng trực tiếp mô hình dữ liệu của ERP.', effects: { devMonths: 0.3 } },
        { id: 'acl', title: 'Xây lớp tích hợp (anti-corruption layer)', summary: 'Một service dịch giữa shop và ERP: 1.5 dev-tháng. Đổi ERP chỉ sửa lớp này.', effects: { devMonths: 1.5, flags: ['acl'] } },
        { id: 'ipaas', title: 'Mua nền tảng iPaaS', summary: 'MuleSoft/Boomi: 0.5 dev-tháng, license ~$900/tháng.', effects: { monthlyUsd: 900, devMonths: 0.5, flags: ['acl'] } },
      ],
    },
  ],
  rules: [
    { id: 'browse_ok', check: 'metric', metric: 'answered_pct:browse', op: '>=', value: 99, unit: '%', text: 'Xem sản phẩm: ít nhất 99% được phản hồi', failText: 'Lượt xem sản phẩm bị rớt.', pillar: 'reliability', hard: true, conceptKey: 'scale_out' },
    { id: 'stock_ok', check: 'metric', metric: 'answered_pct:stock', op: '>=', value: 99, unit: '%', text: 'Xem tồn kho: ít nhất 99% được phản hồi', failText: 'Xem tồn kho bị rớt: ERP không gánh nổi.', pillar: 'reliability', hard: true, conceptKey: 'legacy_integration' },
    { id: 'stock_fast', check: 'metric', metric: 'latency_ms:stock', op: '<=', value: 500, unit: 'ms', text: 'Xem tồn kho: trung bình dưới 500 ms', failText: 'Xem tồn kho quá chậm: mỗi lượt đều chờ ERP.', pillar: 'performance', hard: true, conceptKey: 'caching' },
    { id: 'order_ok', check: 'metric', metric: 'answered_pct:order', op: '>=', value: 99.5, unit: '%', text: 'Đặt hàng: ít nhất 99.5% được phản hồi', failText: 'Đơn hàng bị rớt.', pillar: 'reliability', hard: true, conceptKey: 'request_flow' },
    { id: 'order_sync', check: 'metric', metric: 'jobs_done_pct:order', op: '>=', value: 99, unit: '%', text: 'Đơn hàng: ít nhất 99% vào được ERP', failText: 'Đơn không vào được ERP.', pillar: 'reliability', hard: true, conceptKey: 'queue_buffering' },
    { id: 'order_fast_sync', check: 'metric', metric: 'job_wait_s:order', op: '<=', value: 120, unit: 's', text: 'Đơn vào ERP trong 2 phút', failText: 'Đơn chờ quá 2 phút mới vào ERP: kho soạn không kịp.', pillar: 'performance', hard: true, hiddenUntil: 'order_sync', conceptKey: 'queue_buffering' },
    { id: 'erp_safe', check: 'metric', metric: 'peak_util_pct:legacy_erp', op: '<=', value: 100, unit: '%', text: 'ERP không bao giờ bị quá tải', failText: 'ERP bị dồn quá 25 request/giây: 40 cửa hàng đứng quầy.', pillar: 'reliability', hard: true, hiddenUntil: 'erp_limit', conceptKey: 'legacy_integration' },
    { id: 'acl', check: 'flag', flag: 'acl', present: true, text: 'Shop online không phụ thuộc chặt vào ERP cũ', failText: 'Shop gọi thẳng ERP: khi thay ERP sẽ phải viết lại mọi chỗ gọi.', pillar: 'business', hard: false, weight: 2, hiddenUntil: 'replace', conceptKey: 'anti_corruption_layer' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 900, unit: '$', text: 'Chi phí tối đa $900/tháng', failText: 'Vượt ngân sách $900/tháng.', pillar: 'cost', hard: true, hiddenUntil: 'budget', conceptKey: 'tco' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo', failText: 'Không có monitoring cho đường kết nối tới ERP.', pillar: 'ops', hard: false, conceptKey: 'observability' },
    { id: 'util', check: 'metric', metric: 'fleet_util_pct', op: '>=', value: 15, unit: '%', text: 'Sử dụng tài nguyên trung bình ≥ 15%', failText: 'Hạ tầng thừa so với tải.', pillar: 'sustainability', hard: false, conceptKey: 'sustainability' },
  ],
  stars: { tco3yUsd: 22000 },
  hints: [
    'ERP on-prem chỉ gọi được qua VPN hoặc đường truyền riêng.',
    'Tồn kho được phép cũ vài chục giây: một cache đặt trước đường tới ERP chặn phần lớn lượt đọc.',
    'Đơn không cần vào ERP ngay trong request: Queue + Worker để ERP nhận theo nhịp nó chịu được.',
  ],
};

export const examples: LevelExamples = {
  reference: example(fixedNodes, {
    nodes: [
      ['lb', 'load_balancer'],
      ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
      ['cache', 'cache', { tier: 'l', region: 'vn' }],
      ['db', 'relational_db', { tier: 's', region: 'vn' }],
      ['q', 'queue', { region: 'vn' }],
      ['w', 'worker', { count: 1, region: 'vn' }],
      ['vpn', 'vpn'],
      ['mon', 'monitoring'],
    ],
    wires: 'users>lb lb>app app>cache cache>db cache>vpn app>db app>q q>w w>vpn vpn>erp',
    decisions: { integration: 'acl' },
    asked: ['q_limit', 'q_sync', 'q_future', 'q_budget'],
  }),
  naive: [
    {
      name: 'Đọc tồn kho thẳng từ ERP',
      design: example(fixedNodes, {
        nodes: [
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn' }],
          ['q', 'queue', { region: 'vn' }],
          ['w', 'worker', { region: 'vn' }],
          ['vpn', 'vpn'],
        ],
        wires: 'users>lb lb>app app>db app>vpn app>q q>w w>vpn vpn>erp',
        decisions: { integration: 'p2p' },
      }),
      mustFail: ['stock_ok', 'erp_safe'],
    },
    {
      name: 'Mua iPaaS cho chắc',
      design: example(fixedNodes, {
        nodes: [
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
          ['cache', 'cache', { tier: 'l', region: 'vn' }],
          ['db', 'relational_db', { tier: 's', region: 'vn' }],
          ['q', 'queue', { region: 'vn' }],
          ['w', 'worker', { region: 'vn' }],
          ['link', 'dedicated_link'],
        ],
        wires: 'users>lb lb>app app>cache cache>db cache>link app>db app>q q>w w>link link>erp',
        decisions: { integration: 'ipaas' },
      }),
      mustFail: ['budget'],
    },
  ],
};

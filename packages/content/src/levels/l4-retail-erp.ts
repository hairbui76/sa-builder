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
    { id: 'order_fast_sync', check: 'metric', metric: 'job_wait_s:order', op: '<=', value: 120, unit: 's', text: 'Đơn vào ERP trong 2 phút', failText: 'Đơn chờ quá 2 phút mới vào ERP: kho soạn không kịp.', pillar: 'performance', hard: true, conceptKey: 'queue_buffering' },
    { id: 'erp_safe', check: 'metric', metric: 'peak_util_pct:legacy_erp', op: '<=', value: 100, unit: '%', text: 'ERP (tối đa 25 request/giây) không bao giờ bị quá tải', failText: 'ERP bị dồn quá 25 request/giây: 40 cửa hàng đứng quầy.', pillar: 'reliability', hard: true, conceptKey: 'legacy_integration' },
    { id: 'acl', check: 'flag', flag: 'acl', present: true, text: 'Shop online không phụ thuộc chặt vào ERP cũ (sẽ thay bằng SAP sau 2 năm)', failText: 'Shop gọi thẳng ERP: khi thay ERP sẽ phải viết lại mọi chỗ gọi.', pillar: 'business', hard: false, weight: 2, conceptKey: 'anti_corruption_layer' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 900, unit: '$', text: 'Chi phí tối đa $900/tháng', failText: 'Vượt ngân sách $900/tháng.', pillar: 'cost', hard: true, conceptKey: 'tco' },
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

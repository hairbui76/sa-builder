import type { Level } from '@sa/engine';
import { DEV_MONTHLY_USD, REGIONS, REGION_LATENCY, WORLD1, example, fixed, type LevelExamples } from './common';

const fixedNodes = [
  fixed('users', 'users', 'Khách hàng', 520, 60, { region: 'vn' }),
  fixed('core', 'legacy_core', 'Core hợp đồng (on-prem)', 900, 620),
];

export const level: Level = {
  id: 'migrate_no_downtime',
  worldId: WORLD1,
  order: 5,
  title: 'Di chuyển không downtime',
  client: 'Bảo hiểm An Tâm',
  brief: 'Thiết kế kiến trúc đích trên cloud và chiến lược migration cho từng phần, không làm gián đoạn khách hàng.',
  difficulty: 3,
  conceptKeys: ['migration_6r', 'strangler_fig', 'cutover'],
  team: { size: 4, skills: ['java', 'sql', 'redis'], devMonthlyUsd: DEV_MONTHLY_USD, baseMonths: 3.5 },
  regions: REGIONS,
  defaultRegion: 'vn',
  regionLatencyMs: REGION_LATENCY,
  fixedNodes,
  traffic: {
    ticks: 120,
    usageScale: 0.4,
    kinds: [
      { id: 'portal', title: 'Xem hợp đồng & hồ sơ', from: 'users', userFacing: true, carries: ['pii'], calls: [{ family: 'sql_read', count: 2 }] },
      {
        id: 'claim',
        title: 'Nộp hồ sơ bồi thường',
        from: 'users',
        userFacing: true,
        carries: ['pii'],
        calls: [
          { family: 'sql_write', count: 1 },
          { family: 'blob', count: 1 },
          { family: 'job', count: 1 },
        ],
        jobCalls: [{ family: 'policy_core', count: 1 }],
      },
      { id: 'benefit', title: 'Tra cứu quyền lợi', from: 'users', userFacing: true, carries: ['pii'], calls: [{ family: 'policy_core', count: 1 }] },
    ],
    phases: [
      { from: 0, to: 50, rates: { portal: 200, claim: 10, benefit: 20 } },
      { from: 50, to: 90, rates: { portal: 200, claim: 60, benefit: 20 } },
      { from: 90, to: 120, rates: { portal: 200, claim: 10, benefit: 20 } },
    ],
  },
  events: [],
  palette: [
    { type: 'api_gateway' },
    { type: 'load_balancer' },
    { type: 'app_server', tiers: ['s', 'm'] },
    { type: 'relational_db', tiers: ['s', 'm'], max: 1 },
    { type: 'cache', tiers: ['s'] },
    { type: 'object_storage' },
    { type: 'queue' },
    { type: 'worker' },
    { type: 'vpn' },
    { type: 'dedicated_link' },
    { type: 'monitoring' },
    { type: 'backup_vault' },
  ],
  limits: { maxNodes: 14, maxEdges: 24 },
  decisions: [
    {
      id: 'cutover',
      title: 'Chiến lược chuyển đổi',
      prompt: 'Chuyển traffic từ hệ thống cũ sang mới thế nào?',
      conceptKey: 'cutover',
      options: [
        { id: 'big_bang', title: 'Big bang cuối tuần', summary: 'Tắt hệ thống cũ tối thứ Bảy, bật hệ thống mới sáng Chủ nhật. Ngừng ~8 giờ, rollback khó.', effects: { devMonths: 0.5, metrics: { downtime_min: 480 } } },
        { id: 'strangler', title: 'Strangler fig qua API Gateway', summary: 'Gateway đứng trước, chuyển dần từng đường dẫn sang hệ thống mới. Không downtime. Cần API Gateway trên board.', effects: { devMonths: 2, metrics: { downtime_min: 0 } }, requires: ['api_gateway'] },
        { id: 'parallel', title: 'Chạy song song rồi chuyển', summary: 'Chạy cả hai hệ thống 3 tháng, đồng bộ dữ liệu, chuyển trong 20 phút. Tốn ~$7.200 chạy song song.', effects: { devMonths: 1.5, oneOffUsd: 7200, metrics: { downtime_min: 20 } } },
      ],
    },
    {
      id: 'portal',
      title: 'Cổng khách hàng: chiến lược 6R',
      prompt: 'Đưa cổng khách hàng lên cloud theo cách nào?',
      conceptKey: 'migration_6r',
      options: [
        { id: 'rehost', title: 'Rehost (lift & shift)', summary: 'Chuyển nguyên trạng lên VM: 0.5 dev-tháng.', effects: { devMonths: 0.5 } },
        { id: 'replatform', title: 'Replatform', summary: 'Đóng container, dùng DB managed: 1 dev-tháng.', effects: { devMonths: 1 } },
        { id: 'refactor', title: 'Refactor', summary: 'Viết lại thành service mới: 3 dev-tháng.', effects: { devMonths: 3 } },
        { id: 'repurchase', title: 'Repurchase (mua SaaS portal)', summary: 'Mua portal SaaS ngành bảo hiểm: 0.5 dev-tháng, $800/tháng.', effects: { devMonths: 0.5, monthlyUsd: 800 } },
      ],
    },
    {
      id: 'claims',
      title: 'Bồi thường: chiến lược 6R',
      prompt: 'Đưa hệ thống bồi thường lên cloud theo cách nào?',
      conceptKey: 'migration_6r',
      options: [
        { id: 'rehost', title: 'Rehost (lift & shift)', summary: 'Chuyển nguyên monolith lên VM: 0.5 dev-tháng. Vẫn là khối cũ, không co giãn theo từng phần.', effects: { devMonths: 0.5, metrics: { claims_elastic: 0 } } },
        { id: 'replatform', title: 'Replatform', summary: 'Tách khối bồi thường ra container, upload ảnh lên object storage, xử lý qua queue: 2 dev-tháng.', effects: { devMonths: 2, metrics: { claims_elastic: 1 } } },
        { id: 'refactor', title: 'Refactor sang serverless', summary: 'Viết lại hướng sự kiện trên serverless: 4.5 dev-tháng.', effects: { devMonths: 4.5, tech: ['serverless'], metrics: { claims_elastic: 1 } } },
      ],
    },
  ],
  rules: [
    { id: 'portal_ok', check: 'metric', metric: 'answered_pct:portal', op: '>=', value: 99, unit: '%', text: 'Cổng khách hàng: ít nhất 99% được phản hồi', failText: 'Cổng khách hàng rớt request.', pillar: 'reliability', hard: true, conceptKey: 'read_replicas' },
    { id: 'portal_fast', check: 'metric', metric: 'latency_ms:portal', op: '<=', value: 250, unit: 'ms', text: 'Cổng khách hàng: trung bình dưới 250 ms', failText: 'Cổng khách hàng chậm.', pillar: 'performance', hard: true, conceptKey: 'caching' },
    { id: 'claim_ok', check: 'metric', metric: 'answered_pct:claim', op: '>=', value: 99, unit: '%', text: 'Nộp hồ sơ bồi thường: ít nhất 99% được nhận, cả mùa bão', failText: 'Hồ sơ bồi thường bị rớt lúc cao điểm.', pillar: 'reliability', hard: true, conceptKey: 'queue_buffering' },
    { id: 'benefit_ok', check: 'metric', metric: 'answered_pct:benefit', op: '>=', value: 99, unit: '%', text: 'Tra cứu quyền lợi: ít nhất 99% được phản hồi', failText: 'Tra cứu quyền lợi không tới được core on-prem.', pillar: 'reliability', hard: true, conceptKey: 'hybrid_connectivity' },
    { id: 'claim_sync', check: 'metric', metric: 'jobs_done_pct:claim', op: '>=', value: 99, unit: '%', text: 'Hồ sơ bồi thường: ít nhất 99% được ghi vào core', failText: 'Hồ sơ không được ghi vào core hợp đồng.', pillar: 'reliability', hard: true, conceptKey: 'queue_buffering' },
    { id: 'claim_wait', check: 'metric', metric: 'job_wait_s:claim', op: '<=', value: 300, unit: 's', text: 'Hồ sơ vào core trong 5 phút', failText: 'Hồ sơ chờ quá lâu mới vào core.', pillar: 'performance', hard: false, conceptKey: 'queue_buffering' },
    { id: 'residency', check: 'residency', tag: 'pii', regions: ['vn', 'onprem'], text: 'Dữ liệu khách hàng lưu tại Việt Nam', failText: 'Dữ liệu khách hàng bảo hiểm nằm ngoài Việt Nam.', pillar: 'security', hard: true, conceptKey: 'data_residency' },
    { id: 'encrypt', check: 'encryption', tag: 'pii', level: 'at_rest', text: 'Dữ liệu khách hàng được mã hoá khi lưu', failText: 'Store chứa dữ liệu khách hàng chưa bật mã hoá.', pillar: 'security', hard: false, conceptKey: 'encryption_kms' },
    { id: 'downtime', check: 'metric', metric: 'downtime_min', op: '<=', value: 60, unit: 'min', text: 'Chuyển đổi không làm ngừng dịch vụ quá 1 giờ', failText: 'Chiến lược chuyển đổi làm ngừng dịch vụ quá 1 giờ.', pillar: 'reliability', hard: true, conceptKey: 'cutover' },
    { id: 'deadline', check: 'metric', metric: 'calendar_months', op: '<=', value: 6, unit: 'months', text: 'Xong giai đoạn 1 trong 6 tháng (hết hạn thuê data center)', failText: 'Không kịp trước khi hết hợp đồng thuê data center.', pillar: 'delivery', hard: true, conceptKey: 'delivery_risk' },
    { id: 'elastic', check: 'metric', metric: 'claims_elastic', op: '>=', value: 1, text: 'Phần bồi thường co giãn được (mùa bão hồ sơ tăng 6 lần)', failText: 'Lift & shift giữ nguyên khối cũ: mùa bão sẽ sập như năm ngoái.', pillar: 'business', hard: true, conceptKey: 'migration_6r' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 1500, unit: '$', text: 'Chi phí tối đa $1.500/tháng', failText: 'Vượt ngân sách $1.500/tháng.', pillar: 'cost', hard: true, conceptKey: 'tco' },
    { id: 'skills', check: 'metric', metric: 'unfamiliar_tech', op: '<=', value: 0, text: 'Chỉ dùng công nghệ team đã quen', failText: 'Team phải học công nghệ mới giữa lúc migration.', pillar: 'delivery', hard: false, conceptKey: 'delivery_risk' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo', failText: 'Không có monitoring trong lúc chuyển đổi.', pillar: 'ops', hard: false, conceptKey: 'observability' },
  ],
  stars: { tco3yUsd: 42000 },
  hints: [
    'Mỗi module có thể chọn một R khác nhau. Không phải thứ gì cũng cần viết lại.',
    'Strangler fig cần một mặt tiền (API Gateway) để chuyển dần từng đường dẫn.',
    'Core hợp đồng ở lại on-prem: cloud gọi nó qua kết nối hybrid, và hồ sơ bồi thường nên vào core qua queue.',
  ],
};

export const examples: LevelExamples = {
  reference: example(fixedNodes, {
    nodes: [
      ['gw', 'api_gateway'],
      ['lb', 'load_balancer'],
      ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
      ['db', 'relational_db', { tier: 'm', region: 'vn', encryption: 'at_rest', standby: true }],
      ['files', 'object_storage', { region: 'vn', encryption: 'at_rest' }],
      ['q', 'queue', { region: 'vn' }],
      ['w', 'worker', { count: 1, region: 'vn' }],
      ['vpn', 'vpn'],
      ['mon', 'monitoring'],
    ],
    wires: 'users>gw gw>lb lb>app app>db app>files app>q q>w w>vpn app>vpn vpn>core',
    decisions: { cutover: 'strangler', portal: 'replatform', claims: 'replatform' },
  }),
  naive: [
    {
      name: 'Lift & shift big bang cuối tuần',
      design: example(fixedNodes, {
        nodes: [
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn' }],
          ['files', 'object_storage', { region: 'vn' }],
          ['q', 'queue', { region: 'vn' }],
          ['w', 'worker', { region: 'vn' }],
          ['vpn', 'vpn'],
        ],
        wires: 'users>lb lb>app app>db app>files app>q q>w w>vpn app>vpn vpn>core',
        decisions: { cutover: 'big_bang', portal: 'rehost', claims: 'rehost' },
      }),
      mustFail: ['downtime', 'elastic'],
    },
    {
      name: 'Viết lại tất cả cho "chuẩn cloud-native"',
      design: example(fixedNodes, {
        nodes: [
          ['gw', 'api_gateway'],
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn' }],
          ['files', 'object_storage', { region: 'vn' }],
          ['q', 'queue', { region: 'vn' }],
          ['w', 'worker', { region: 'vn' }],
          ['vpn', 'vpn'],
        ],
        wires: 'users>gw gw>lb lb>app app>db app>files app>q q>w w>vpn app>vpn vpn>core',
        decisions: { cutover: 'strangler', portal: 'refactor', claims: 'refactor' },
      }),
      mustFail: ['deadline'],
    },
  ],
};

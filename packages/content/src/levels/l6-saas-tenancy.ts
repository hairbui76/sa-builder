import type { Level } from '@sa/engine';
import { DEV_MONTHLY_USD, REGIONS, REGION_LATENCY, WORLD1, example, fixed, type LevelExamples } from './common';

const fixedNodes = [
  fixed('smb', 'users', '800 công ty nhỏ', 320, 60, { region: 'vn' }),
  fixed('ent', 'users', 'Tập đoàn Vạn Phát', 760, 60, { region: 'vn' }),
];

export const level: Level = {
  id: 'everyone_wants_own',
  worldId: WORLD1,
  order: 6,
  title: 'Khách nào cũng muốn riêng',
  client: 'NhânSự360 (SaaS quản lý nhân sự)',
  brief: 'Thiết kế mô hình multi-tenancy: khách nhỏ chạy rẻ, khách lớn được cách ly và không bị hàng xóm làm phiền.',
  difficulty: 3,
  conceptKeys: ['multi_tenancy', 'noisy_neighbor'],
  team: { size: 5, skills: ['go', 'sql', 'redis'], devMonthlyUsd: DEV_MONTHLY_USD, baseMonths: 1 },
  regions: REGIONS,
  defaultRegion: 'vn',
  regionLatencyMs: REGION_LATENCY,
  fixedNodes,
  traffic: {
    ticks: 120,
    usageScale: 0.3,
    kinds: [
      {
        id: 'smb_ops',
        title: 'Thao tác của khách nhỏ',
        from: 'smb',
        userFacing: true,
        carries: ['pii'],
        calls: [
          { family: 'sql_read', count: 2 },
          { family: 'sql_write', count: 1 },
        ],
      },
      { id: 'smb_import', title: 'Script import của một khách nhỏ', from: 'smb', userFacing: false, quotaRps: 10, calls: [{ family: 'sql_write', count: 3 }] },
      {
        id: 'ent_ops',
        title: 'Thao tác của Vạn Phát',
        from: 'ent',
        userFacing: true,
        carries: ['pii'],
        calls: [
          { family: 'sql_read', count: 2 },
          { family: 'sql_write', count: 1 },
        ],
      },
    ],
    phases: [
      { from: 0, to: 40, rates: { smb_ops: 250, smb_import: 0, ent_ops: 120 } },
      { from: 40, to: 80, rates: { smb_ops: 250, smb_import: 400, ent_ops: 120 } },
      { from: 80, to: 120, rates: { smb_ops: 250, smb_import: 0, ent_ops: 120 } },
    ],
  },
  events: [],
  palette: [
    { type: 'api_gateway' },
    { type: 'load_balancer' },
    { type: 'app_server', tiers: ['s', 'm'] },
    { type: 'relational_db', tiers: ['s', 'm'], max: 3 },
    { type: 'read_replica', tiers: ['s', 'm'] },
    { type: 'cache', tiers: ['s'] },
    { type: 'kms' },
    { type: 'monitoring' },
  ],
  limits: { maxNodes: 14, maxEdges: 24 },
  decisions: [
    {
      id: 'smb_model',
      title: 'Mô hình tenancy cho 800 khách nhỏ',
      prompt: 'Khách nhỏ dùng chung hạ tầng tới mức nào?',
      conceptKey: 'multi_tenancy',
      options: [
        { id: 'pool', title: 'Pool: chung app, chung DB', summary: 'Tách dữ liệu bằng tenant_id và row-level security: 0.5 dev-tháng.', effects: { devMonths: 0.5 } },
        { id: 'bridge', title: 'Bridge: chung app, mỗi khách một schema', summary: '800 schema, migration chạy 800 lần: 1.5 dev-tháng, +$150/tháng vận hành.', effects: { devMonths: 1.5, monthlyUsd: 150 } },
        { id: 'silo', title: 'Silo: mỗi khách một bộ riêng', summary: '800 bộ hạ tầng nhỏ: 3 dev-tháng tự động hoá, ~$12.000/tháng.', effects: { devMonths: 3, monthlyUsd: 12000 } },
      ],
    },
  ],
  rules: [
    { id: 'smb_ok', check: 'metric', metric: 'answered_pct:smb_ops', op: '>=', value: 99, unit: '%', text: 'Khách nhỏ: ít nhất 99% thao tác được phản hồi', failText: 'Khách nhỏ bị rớt request khi có tenant chạy script.', pillar: 'reliability', hard: true, conceptKey: 'noisy_neighbor' },
    { id: 'ent_ok', check: 'metric', metric: 'answered_pct:ent_ops', op: '>=', value: 99.9, unit: '%', text: 'Vạn Phát: ít nhất 99,9% thao tác được phản hồi', failText: 'Vạn Phát bị ảnh hưởng bởi hàng xóm ồn ào.', pillar: 'reliability', hard: true, conceptKey: 'noisy_neighbor' },
    { id: 'ent_fast', check: 'metric', metric: 'latency_ms:ent_ops', op: '<=', value: 150, unit: 'ms', text: 'Vạn Phát: trung bình dưới 150 ms', failText: 'Vạn Phát thấy hệ thống chậm.', pillar: 'performance', hard: false, conceptKey: 'caching' },
    { id: 'ent_isolated', check: 'isolation', kind: 'ent_ops', from: ['smb_ops', 'smb_import'], text: 'Dữ liệu Vạn Phát nằm trên database riêng (điều khoản hợp đồng)', failText: 'Dữ liệu Vạn Phát dùng chung store với khách khác: vi phạm hợp đồng.', pillar: 'security', hard: true, conceptKey: 'multi_tenancy' },
    { id: 'ent_kms', check: 'encryption', tag: 'pii', level: 'kms', text: 'Dữ liệu nhân sự mã hoá bằng khoá trong KMS', failText: 'Dữ liệu chưa được mã hoá bằng khoá trong KMS như Vạn Phát yêu cầu.', pillar: 'security', hard: false, conceptKey: 'encryption_kms' },
    { id: 'smb_model', check: 'decision', decision: 'smb_model', options: ['pool', 'bridge'], text: 'Mô hình cho 800 khách nhỏ phù hợp giá $5/tháng', failText: 'Silo cho từng khách nhỏ không bao giờ có lãi ở giá $5/tháng.', pillar: 'business', hard: false, weight: 2, conceptKey: 'multi_tenancy' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 1500, unit: '$', text: 'Chi phí tối đa $1.500/tháng', failText: 'Vượt ngân sách $1.500/tháng.', pillar: 'cost', hard: true, conceptKey: 'tco' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo theo tenant', failText: 'Không có monitoring: không biết tenant nào đang gây tải.', pillar: 'ops', hard: false, conceptKey: 'observability' },
    { id: 'util', check: 'metric', metric: 'fleet_util_pct', op: '>=', value: 20, unit: '%', text: 'Sử dụng tài nguyên trung bình ≥ 20%', failText: 'Hạ tầng thừa so với tải.', pillar: 'sustainability', hard: false, conceptKey: 'sustainability' },
  ],
  stars: { tco3yUsd: 36000 },
  hints: [
    'Mỗi nguồn traffic có thể đi theo đường riêng. Router chia đều mọi loại traffic cho các nhánh phía sau.',
    'API Gateway có tuỳ chọn giới hạn theo tenant (tenant quota).',
    'Pool cho khách nhỏ, silo cho khách trả tiền vì sự cách ly.',
  ],
};

export const examples: LevelExamples = {
  reference: example(fixedNodes, {
    nodes: [
      ['gw', 'api_gateway', { tenantQuota: true }],
      ['lb', 'load_balancer'],
      ['app', 'app_server', { tier: 's', count: 2, region: 'vn' }],
      ['cache', 'cache', { tier: 's', region: 'vn', encryption: 'kms' }],
      ['db', 'relational_db', { tier: 'm', region: 'vn', encryption: 'kms' }],
      ['lb2', 'load_balancer'],
      ['app2', 'app_server', { tier: 's', count: 2, region: 'vn' }],
      ['db2', 'relational_db', { tier: 'm', region: 'vn', encryption: 'kms' }],
      ['kms', 'kms'],
      ['mon', 'monitoring'],
    ],
    wires: 'smb>gw gw>lb lb>app app>cache cache>db app>db ent>lb2 lb2>app2 app2>db2',
    decisions: { smb_model: 'pool' },
  }),
  naive: [
    {
      name: 'Tất cả dùng chung một bộ',
      design: example(fixedNodes, {
        nodes: [
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn' }],
        ],
        wires: 'smb>lb ent>lb lb>app app>db',
        decisions: { smb_model: 'pool' },
      }),
      mustFail: ['ent_ok', 'ent_isolated'],
    },
    {
      name: 'Tách riêng Vạn Phát nhưng quên quota',
      design: example(fixedNodes, {
        nodes: [
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 's', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn' }],
          ['lb2', 'load_balancer'],
          ['app2', 'app_server', { tier: 's', count: 2, region: 'vn' }],
          ['db2', 'relational_db', { tier: 's', region: 'vn' }],
        ],
        wires: 'smb>lb lb>app app>db ent>lb2 lb2>app2 app2>db2',
        decisions: { smb_model: 'pool' },
      }),
      mustFail: ['smb_ok'],
    },
    {
      name: 'Silo cho tất cả',
      design: example(fixedNodes, {
        nodes: [
          ['gw', 'api_gateway', { tenantQuota: true }],
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 's', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn' }],
          ['lb2', 'load_balancer'],
          ['app2', 'app_server', { tier: 's', count: 2, region: 'vn' }],
          ['db2', 'relational_db', { tier: 's', region: 'vn' }],
        ],
        wires: 'smb>gw gw>lb lb>app app>db ent>lb2 lb2>app2 app2>db2',
        decisions: { smb_model: 'silo' },
      }),
      mustFail: ['budget'],
    },
  ],
};

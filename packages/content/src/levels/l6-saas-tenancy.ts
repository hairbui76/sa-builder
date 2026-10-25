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
  story:
    'NhânSự360 phục vụ 800 công ty nhỏ trên một hệ thống dùng chung. Vừa ký được Tập đoàn Vạn Phát, 12.000 nhân viên, chiếm 30% doanh thu. Tuần trước một khách nhỏ chạy script import làm cả hệ thống chậm 20 phút, và Vạn Phát đã gửi email hỏi thăm.',
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
  discovery: {
    hours: 4,
    stakeholders: [
      {
        id: 'ceo',
        name: 'Anh Khải',
        role: 'CEO',
        avatar: 'K',
        intro: 'Muốn giữ Vạn Phát bằng mọi giá, nhưng không muốn lỗ ở khách nhỏ.',
        concerns: ['smb_model', 'budget', 'smb_ok'],
        quotes: {
          happy: 'Khách nhỏ vẫn lãi, khách lớn vẫn vui. Mô hình kinh doanh đứng vững.',
          neutral: 'Ổn, nhưng biên lợi nhuận mỏng hơn tôi muốn.',
          unhappy: 'Với giá 5 đô/tháng, kiến trúc này làm chúng ta lỗ trên mỗi khách nhỏ.',
        },
      },
      {
        id: 'am',
        name: 'Chị Uyên',
        role: 'Quản lý khách hàng Vạn Phát',
        avatar: 'U',
        intro: 'Cầm hợp đồng Vạn Phát, biết từng điều khoản.',
        concerns: ['ent_isolated', 'ent_ok', 'ent_kms'],
        quotes: {
          happy: 'Vạn Phát vừa gia hạn 3 năm!',
          neutral: 'Vạn Phát tạm hài lòng, nhưng audit năm sau sẽ hỏi kỹ.',
          unhappy: 'Vạn Phát sẽ chấm dứt hợp đồng vì vi phạm điều khoản cách ly dữ liệu.',
        },
      },
      {
        id: 'support',
        name: 'Anh Toàn',
        role: 'Trưởng nhóm hỗ trợ',
        avatar: 'T',
        intro: 'Người nghe khách than khi hệ thống chậm.',
        concerns: ['smb_ok', 'ent_ok'],
        quotes: {
          happy: 'Tuần này không có ticket "hệ thống chậm" nào.',
          neutral: 'Thỉnh thoảng vẫn có khách phàn nàn.',
          unhappy: 'Một khách chạy script là cả 800 khách gọi lên.',
        },
      },
    ],
    questions: [
      { id: 'q_contract', stakeholder: 'am', hours: 1, text: 'Hợp đồng Vạn Phát có điều khoản kỹ thuật nào đặc biệt?', answer: 'Dữ liệu Vạn Phát phải nằm trên database riêng, không chung với khách khác. Họ audit điều này hằng năm.', reveals: ['ent_contract'] },
      { id: 'q_keys', stakeholder: 'am', hours: 0.5, text: 'Vạn Phát có yêu cầu gì về mã hoá?', answer: 'Họ muốn dữ liệu được mã hoá bằng khoá do một dịch vụ quản lý khoá kiểm soát, có log mỗi lần dùng.', reveals: ['byok'] },
      { id: 'q_incident', stakeholder: 'support', hours: 1, text: 'Sự cố tuần trước xảy ra thế nào?', answer: 'Một khách nhỏ chạy script import vài trăm request/giây. Database chung nghẽn, mọi khách chậm 20 phút, kể cả Vạn Phát.', reveals: ['noisy'] },
      { id: 'q_price', stakeholder: 'ceo', hours: 0.5, text: 'Khách nhỏ trả bao nhiêu?', answer: 'Gói SMB chỉ 5 đô/công ty/tháng. Không thể cho mỗi khách nhỏ một bộ hạ tầng riêng.', reveals: ['smb_price'] },
      { id: 'q_budget', stakeholder: 'ceo', hours: 1, text: 'Ngân sách hạ tầng hằng tháng?', answer: 'Tối đa 1.500 đô một tháng cho toàn bộ.', reveals: ['budget'] },
      { id: 'q_sla', stakeholder: 'am', hours: 0.5, text: 'SLA với Vạn Phát là bao nhiêu?', answer: '99,9% request được phục vụ.', reveals: ['sla'] },
    ],
    facts: [
      { id: 'ent_contract', text: 'Dữ liệu Vạn Phát phải nằm trên database riêng (audit hằng năm).', key: true },
      { id: 'noisy', text: 'Một khách nhỏ chạy script import có thể làm nghẽn cả hệ thống chung.', key: true },
      { id: 'smb_price', text: 'Khách nhỏ chỉ trả $5/tháng: không thể silo cho từng khách nhỏ.', key: true },
      { id: 'byok', text: 'Vạn Phát muốn dữ liệu mã hoá bằng khoá trong KMS.', key: false },
      { id: 'budget', text: 'Ngân sách hạ tầng tối đa $1.500/tháng.', key: false },
      { id: 'sla', text: 'SLA với Vạn Phát: 99,9%.', key: false },
    ],
  },
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
    { id: 'ent_isolated', check: 'isolation', kind: 'ent_ops', from: ['smb_ops', 'smb_import'], text: 'Dữ liệu Vạn Phát nằm trên store riêng', failText: 'Dữ liệu Vạn Phát dùng chung store với khách khác: vi phạm hợp đồng.', pillar: 'security', hard: true, hiddenUntil: 'ent_contract', conceptKey: 'multi_tenancy' },
    { id: 'ent_kms', check: 'encryption', tag: 'pii', level: 'kms', text: 'Dữ liệu nhân sự mã hoá bằng khoá trong KMS', failText: 'Dữ liệu chưa được mã hoá bằng khoá trong KMS như Vạn Phát yêu cầu.', pillar: 'security', hard: false, hiddenUntil: 'byok', conceptKey: 'encryption_kms' },
    { id: 'smb_model', check: 'decision', decision: 'smb_model', options: ['pool', 'bridge'], text: 'Mô hình cho khách nhỏ phù hợp giá $5/tháng', failText: 'Silo cho từng khách nhỏ không bao giờ có lãi ở giá $5/tháng.', pillar: 'business', hard: false, weight: 2, hiddenUntil: 'smb_price', conceptKey: 'multi_tenancy' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 1500, unit: '$', text: 'Chi phí tối đa $1.500/tháng', failText: 'Vượt ngân sách $1.500/tháng.', pillar: 'cost', hard: true, hiddenUntil: 'budget', conceptKey: 'tco' },
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
    asked: ['q_contract', 'q_incident', 'q_price', 'q_keys', 'q_budget'],
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

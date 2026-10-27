import type { Level } from '@sa/engine';
import { DEV_MONTHLY_USD, REGIONS, REGION_LATENCY, WORLD1, example, fixed, type LevelExamples } from './common';

const fixedNodes = [fixed('users', 'users', 'Người dùng ví', 520, 60, { region: 'vn' })];

export const level: Level = {
  id: 'auditors_knock',
  worldId: WORLD1,
  order: 7,
  title: 'Kiểm toán gõ cửa',
  client: 'Ví điện tử VíXanh',
  brief: 'Thiết kế lại hệ thống ví để qua kiểm toán PCI-DSS với phạm vi nhỏ nhất, chặn được tấn công, và vẫn chạy ổn.',
  difficulty: 3,
  conceptKeys: ['pci_scope', 'tokenization', 'defence_in_depth', 'encryption_kms'],
  team: { size: 6, skills: ['java', 'sql', 'redis'], devMonthlyUsd: DEV_MONTHLY_USD, baseMonths: 2 },
  regions: REGIONS,
  defaultRegion: 'vn',
  regionLatencyMs: REGION_LATENCY,
  fixedNodes,
  traffic: {
    ticks: 120,
    usageScale: 0.3,
    kinds: [
      { id: 'browse', title: 'Xem số dư & lịch sử', from: 'users', userFacing: true, carries: ['pii'], calls: [{ family: 'sql_read', count: 2 }] },
      {
        id: 'topup',
        title: 'Nạp tiền bằng thẻ',
        from: 'users',
        userFacing: true,
        carries: ['card', 'pii'],
        calls: [
          { family: 'sql_write', count: 2 },
          { family: 'payment', count: 1 },
        ],
      },
      { id: 'attack', title: 'Bot dò quét SQL injection', from: 'users', userFacing: false, malicious: true, calls: [{ family: 'sql_read', count: 3 }] },
    ],
    phases: [
      { from: 0, to: 40, rates: { browse: 300, topup: 30, attack: 0 } },
      { from: 40, to: 70, rates: { browse: 300, topup: 30, attack: 80 } },
      { from: 70, to: 100, rates: { browse: 300, topup: 90, attack: 0 } },
      { from: 100, to: 120, rates: { browse: 300, topup: 30, attack: 0 } },
    ],
  },
  events: [{ kind: 'node_down', at: 105, targetType: 'relational_db', text: 'Ổ đĩa của database primary hỏng ngay sau đợt cao điểm nạp tiền.' }],
  palette: [
    { type: 'waf' },
    { type: 'tokenization_vault' },
    { type: 'load_balancer' },
    { type: 'api_gateway' },
    { type: 'app_server', tiers: ['s', 'm'] },
    { type: 'relational_db', tiers: ['s', 'm'], max: 1 },
    { type: 'read_replica', tiers: ['s', 'm'] },
    { type: 'cache', tiers: ['s'] },
    { type: 'payment_gateway' },
    { type: 'kms' },
    { type: 'idp' },
    { type: 'audit_log' },
    { type: 'monitoring' },
  ],
  limits: { maxNodes: 14, maxEdges: 22 },
  decisions: [],
  rules: [
    { id: 'browse_ok', check: 'metric', metric: 'answered_pct:browse', op: '>=', value: 99, unit: '%', text: 'Xem số dư: ít nhất 99% được phản hồi', failText: 'Xem số dư bị rớt.', pillar: 'reliability', hard: true, conceptKey: 'scale_out' },
    { id: 'topup_ok', check: 'metric', metric: 'answered_pct:topup', op: '>=', value: 98, unit: '%', text: 'Nạp tiền: ít nhất 98% thành công, kể cả khi database hỏng', failText: 'Nạp tiền thất bại khi database hỏng.', pillar: 'reliability', hard: true, conceptKey: 'failover' },
    { id: 'browse_fast', check: 'metric', metric: 'latency_ms:browse', op: '<=', value: 150, unit: 'ms', text: 'Xem số dư: trung bình dưới 150 ms', failText: 'Xem số dư chậm.', pillar: 'performance', hard: false, conceptKey: 'caching' },
    { id: 'no_breach', check: 'metric', metric: 'breach_pct', op: '<=', value: 10, unit: '%', text: 'Tối đa 10% request tấn công lọt tới ứng dụng', failText: 'Bot tấn công lọt thẳng vào ứng dụng.', pillar: 'security', hard: true, conceptKey: 'defence_in_depth' },
    { id: 'waf_all', check: 'on_path', flag: 'waf', kinds: ['browse', 'topup'], text: 'Mọi request người dùng đi qua WAF', failText: 'Có đường vào hệ thống không qua WAF.', pillar: 'security', hard: true, conceptKey: 'defence_in_depth' },
    { id: 'scope', check: 'metric', metric: 'scope_card', op: '<=', value: 2, text: 'Phạm vi PCI: tối đa 2 thành phần chạm số thẻ', failText: 'Số thẻ chạy qua quá nhiều thành phần: phạm vi PCI quá rộng.', pillar: 'security', hard: true, conceptKey: 'pci_scope' },
    { id: 'card_kms', check: 'encryption', tag: 'card', level: 'kms', text: 'Dữ liệu thẻ mã hoá bằng khoá trong KMS', failText: 'Nơi lưu dữ liệu thẻ chưa mã hoá bằng khoá trong KMS.', pillar: 'security', hard: true, conceptKey: 'encryption_kms' },
    { id: 'pii_enc', check: 'encryption', tag: 'pii', level: 'at_rest', text: 'Dữ liệu khách hàng được mã hoá khi lưu', failText: 'Store chứa dữ liệu khách hàng chưa bật mã hoá.', pillar: 'security', hard: false, conceptKey: 'encryption_kms' },
    { id: 'audit', check: 'flag', flag: 'audit_log', present: true, text: 'Có audit log chống sửa xoá', failText: 'Không có audit log: trượt PCI Requirement 10.', pillar: 'security', hard: true, conceptKey: 'pci_scope' },
    { id: 'residency', check: 'residency', tag: 'pii', regions: ['vn'], text: 'Dữ liệu khách hàng lưu tại Việt Nam', failText: 'Dữ liệu khách hàng nằm ngoài Việt Nam: không xin được giấy phép NHNN.', pillar: 'security', hard: true, conceptKey: 'data_residency' },
    { id: 'sso', check: 'flag', flag: 'sso', present: true, text: 'Quản trị viên đăng nhập qua SSO + MFA', failText: 'Không có đăng nhập tập trung cho quản trị viên.', pillar: 'ops', hard: false, conceptKey: 'identity' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo', failText: 'Không có monitoring.', pillar: 'ops', hard: false, conceptKey: 'observability' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 1800, unit: '$', text: 'Chi phí tối đa $1.800/tháng', failText: 'Vượt ngân sách $1.800/tháng.', pillar: 'cost', hard: true, conceptKey: 'tco' },
  ],
  stars: { tco3yUsd: 45000 },
  hints: [
    'Phạm vi PCI tính mọi thành phần mà số thẻ đi qua, kể cả Load Balancer.',
    'Tokenization Vault đặt càng gần người dùng càng tốt: mọi thứ phía sau chỉ thấy token.',
    'Store giữ số thẻ cần mã hoá "kms" và phải có KMS trong thiết kế.',
  ],
};

export const examples: LevelExamples = {
  reference: example(fixedNodes, {
    nodes: [
      ['waf', 'waf'],
      ['vault', 'tokenization_vault', { region: 'vn', encryption: 'kms' }],
      ['lb', 'load_balancer'],
      ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
      ['cache', 'cache', { tier: 's', region: 'vn', encryption: 'at_rest' }],
      ['db', 'relational_db', { tier: 'm', region: 'vn', encryption: 'kms', standby: true }],
      ['psp', 'payment_gateway'],
      ['kms', 'kms'],
      ['audit', 'audit_log'],
      ['idp', 'idp'],
      ['mon', 'monitoring'],
    ],
    wires: 'users>waf waf>vault vault>lb lb>app app>cache cache>db app>db app>psp',
  }),
  naive: [
    {
      name: 'Bảo vệ thẻ ở khắp nơi',
      design: example(fixedNodes, {
        nodes: [
          ['waf', 'waf'],
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn', encryption: 'kms', standby: true }],
          ['psp', 'payment_gateway'],
          ['kms', 'kms'],
          ['audit', 'audit_log'],
        ],
        wires: 'users>waf waf>lb lb>app app>db app>psp',
      }),
      mustFail: ['scope'],
    },
    {
      name: 'Không có WAF',
      design: example(fixedNodes, {
        nodes: [
          ['vault', 'tokenization_vault', { region: 'vn', encryption: 'kms' }],
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2, region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn', encryption: 'kms', standby: true }],
          ['psp', 'payment_gateway'],
          ['kms', 'kms'],
          ['audit', 'audit_log'],
        ],
        wires: 'users>vault vault>lb lb>app app>db app>psp',
      }),
      mustFail: ['no_breach', 'waf_all'],
    },
  ],
};

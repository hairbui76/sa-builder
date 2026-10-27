import type { DecisionOption, Level } from '@sa/engine';
import { DEV_MONTHLY_USD, REGIONS, REGION_LATENCY, WORLD1, example, fixed, type LevelExamples } from './common';

const fixedNodes = [fixed('users', 'users', 'Shipper & khách', 520, 60, { region: 'vn' })];

function drOptions(prefix: string, cost: [number, number, number, number]): DecisionOption[] {
  return [
    { id: 'backup', title: 'Backup & restore', summary: `Sao lưu mỗi giờ sang region khác. RTO ~4 giờ, RPO ~60 phút. +$${cost[0]}/tháng.`, effects: { monthlyUsd: cost[0], metrics: { [`rto_${prefix}_min`]: 240, [`rpo_${prefix}_min`]: 60 } } },
    { id: 'pilot', title: 'Pilot light', summary: `Dữ liệu sao chép liên tục, máy chủ chỉ bật khi cần. RTO ~60 phút, RPO ~5 phút. +$${cost[1]}/tháng.`, effects: { monthlyUsd: cost[1], metrics: { [`rto_${prefix}_min`]: 60, [`rpo_${prefix}_min`]: 5 } } },
    { id: 'warm', title: 'Warm standby', summary: `Bản thu nhỏ chạy sẵn ở region khác. RTO ~15 phút, RPO ~1 phút. +$${cost[2]}/tháng.`, effects: { monthlyUsd: cost[2], metrics: { [`rto_${prefix}_min`]: 15, [`rpo_${prefix}_min`]: 1 } } },
    { id: 'active', title: 'Active-active', summary: `Chạy song song hai region. RTO ~1 phút, RPO ~0. +$${cost[3]}/tháng và 3 dev-tháng để xử lý ghi hai nơi.`, effects: { monthlyUsd: cost[3], devMonths: 3, tech: ['multi_region'], metrics: { [`rto_${prefix}_min`]: 1, [`rpo_${prefix}_min`]: 0 } } },
  ];
}

export const level: Level = {
  id: 'how_much_dr',
  worldId: WORLD1,
  order: 3,
  title: 'DR bao nhiêu là đủ',
  client: 'Giao Nhanh Logistics',
  brief: 'Thiết kế hệ thống tracking chịu được hỏng hóc trong zone, và chọn mức DR phù hợp cho từng quy trình.',
  difficulty: 2,
  conceptKeys: ['ha_vs_dr', 'rto_rpo', 'dr_tiers'],
  team: { size: 4, skills: ['java', 'sql', 'redis'], devMonthlyUsd: DEV_MONTHLY_USD, baseMonths: 2 },
  regions: REGIONS,
  defaultRegion: 'sg',
  regionLatencyMs: REGION_LATENCY,
  fixedNodes,
  traffic: {
    ticks: 120,
    usageScale: 0.5,
    kinds: [
      { id: 'track', title: 'Tra cứu đơn', from: 'users', userFacing: true, calls: [{ family: 'sql_read', count: 2 }] },
      {
        id: 'update',
        title: 'Shipper cập nhật trạng thái',
        from: 'users',
        userFacing: true,
        calls: [
          { family: 'sql_read', count: 1 },
          { family: 'sql_write', count: 1 },
        ],
      },
    ],
    phases: [{ from: 0, to: 120, rates: { track: 400, update: 150 } }],
  },
  events: [
    { kind: 'node_down', at: 40, targetType: 'relational_db', text: 'Zone A mất điện: database primary chết.' },
    { kind: 'node_down', at: 80, duration: 30, targetType: 'app_server', instances: 1, text: 'Một App Server bị treo và khởi động lại.' },
  ],
  palette: [
    { type: 'load_balancer' },
    { type: 'app_server', tiers: ['s', 'm'] },
    { type: 'relational_db', tiers: ['s', 'm'], max: 1 },
    { type: 'read_replica', tiers: ['s', 'm'] },
    { type: 'cache', tiers: ['s', 'l'] },
    { type: 'backup_vault' },
    { type: 'monitoring' },
  ],
  limits: { maxNodes: 10, maxEdges: 16 },
  decisions: [
    { id: 'dr_core', title: 'DR cho tracking & điều phối', prompt: 'Khi cả region sập, hệ thống tracking khôi phục thế nào?', conceptKey: 'dr_tiers', options: drOptions('core', [20, 180, 420, 1300]) },
    { id: 'dr_report', title: 'DR cho báo cáo & BI', prompt: 'Khi cả region sập, hệ thống báo cáo khôi phục thế nào?', conceptKey: 'dr_tiers', options: drOptions('report', [10, 90, 210, 650]) },
  ],
  rules: [
    { id: 'track_ok', check: 'metric', metric: 'answered_pct:track', op: '>=', value: 99, unit: '%', text: 'Tra cứu đơn: ít nhất 99% được phản hồi, kể cả khi có sự cố', failText: 'Tra cứu đơn bị rớt khi có sự cố.', pillar: 'reliability', hard: true, conceptKey: 'single_point_of_failure' },
    { id: 'update_ok', check: 'metric', metric: 'answered_pct:update', op: '>=', value: 98, unit: '%', text: 'Cập nhật trạng thái: ít nhất 98% được phản hồi', failText: 'Shipper không cập nhật được trạng thái khi có sự cố.', pillar: 'reliability', hard: true, conceptKey: 'failover' },
    { id: 'track_fast', check: 'metric', metric: 'latency_ms:track', op: '<=', value: 200, unit: 'ms', text: 'Tra cứu đơn: trung bình dưới 200 ms', failText: 'Tra cứu đơn chậm.', pillar: 'performance', hard: true, conceptKey: 'caching' },
    { id: 'rto_core', check: 'metric', metric: 'rto_core_min', op: '<=', value: 30, unit: 'min', text: 'Tracking khôi phục trong 30 phút khi mất region', failText: 'Mức DR của tracking không đạt RTO 30 phút trong hợp đồng với sàn.', pillar: 'reliability', hard: true, conceptKey: 'rto_rpo' },
    { id: 'rpo_core', check: 'metric', metric: 'rpo_core_min', op: '<=', value: 5, unit: 'min', text: 'Tracking mất tối đa 5 phút dữ liệu', failText: 'Mức DR của tracking có thể mất quá 5 phút dữ liệu.', pillar: 'reliability', hard: true, conceptKey: 'rto_rpo' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 1100, unit: '$', text: 'Chi phí tối đa $1.100/tháng kể cả DR', failText: 'Vượt ngân sách: DR đắt nhất không phải lúc nào cũng cần.', pillar: 'cost', hard: true, conceptKey: 'dr_tiers' },
    { id: 'rto_report', check: 'metric', metric: 'rto_report_min', op: '>=', value: 240, unit: 'min', text: 'Báo cáo chỉ cần khôi phục trong 1 ngày: đừng chi quá tay cho DR của nó', failText: 'Báo cáo chỉ cần khôi phục trong một ngày; mức DR cao hơn là tiền bỏ phí.', pillar: 'cost', hard: false, conceptKey: 'rto_rpo' },
    { id: 'backup', check: 'flag', flag: 'backup', present: true, text: 'Có backup tách biệt (chống xoá nhầm, ransomware)', failText: 'Không có Backup Vault: standby và DR không cứu được khi dữ liệu bị xoá nhầm.', pillar: 'reliability', hard: false, conceptKey: 'ha_vs_dr' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo', failText: 'Không có monitoring: sự cố được phát hiện qua điện thoại của sàn.', pillar: 'ops', hard: false, conceptKey: 'observability' },
    { id: 'util', check: 'metric', metric: 'fleet_util_pct', op: '>=', value: 25, unit: '%', text: 'Sử dụng tài nguyên trung bình ≥ 25%', failText: 'Hạ tầng thừa so với tải.', pillar: 'sustainability', hard: false, conceptKey: 'sustainability' },
  ],
  stars: { tco3yUsd: 33000 },
  hints: [
    'HA (trong một region) và DR (khi mất cả region) là hai chuyện khác nhau. Sự cố trong mô phỏng là hỏng trong zone; thẻ DR lo phần mất region.',
    'Database có tuỳ chọn standby. App Server cần N+1 sau Load Balancer.',
    'Mỗi quy trình có RTO/RPO riêng: tracking cần nhanh, báo cáo thì không.',
  ],
};

export const examples: LevelExamples = {
  reference: example(fixedNodes, {
    nodes: [
      ['lb', 'load_balancer'],
      ['app', 'app_server', { tier: 'm', count: 2 }],
      ['cache', 'cache', { tier: 's' }],
      ['db', 'relational_db', { tier: 'm', standby: true }],
      ['bk', 'backup_vault'],
      ['mon', 'monitoring'],
    ],
    wires: 'users>lb lb>app app>cache cache>db app>db',
    decisions: { dr_core: 'warm', dr_report: 'backup' },
  }),
  naive: [
    {
      name: 'Một máy, không standby',
      design: example(fixedNodes, {
        nodes: [
          ['app', 'app_server', { tier: 'm', count: 1 }],
          ['db', 'relational_db', { tier: 'm' }],
        ],
        wires: 'users>app app>db',
        decisions: { dr_core: 'warm', dr_report: 'backup' },
      }),
      mustFail: ['track_ok', 'update_ok'],
    },
    {
      name: 'Active-active cho mọi thứ',
      design: example(fixedNodes, {
        nodes: [
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2 }],
          ['cache', 'cache', { tier: 's' }],
          ['db', 'relational_db', { tier: 'm', standby: true }],
        ],
        wires: 'users>lb lb>app app>cache cache>db app>db',
        decisions: { dr_core: 'active', dr_report: 'active' },
      }),
      mustFail: ['budget'],
    },
    {
      name: 'Backup là đủ',
      design: example(fixedNodes, {
        nodes: [
          ['lb', 'load_balancer'],
          ['app', 'app_server', { tier: 'm', count: 2 }],
          ['cache', 'cache', { tier: 's' }],
          ['db', 'relational_db', { tier: 'm', standby: true }],
        ],
        wires: 'users>lb lb>app app>cache cache>db app>db',
        decisions: { dr_core: 'backup', dr_report: 'backup' },
      }),
      mustFail: ['rto_core', 'rpo_core'],
    },
  ],
};

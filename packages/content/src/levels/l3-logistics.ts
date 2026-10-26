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
  discovery: {
    hours: 4,
    stakeholders: [
      {
        id: 'coo',
        name: 'Anh Phong',
        role: 'Giám đốc vận hành',
        avatar: 'P',
        intro: 'Người bị sàn TMĐT gọi điện lúc 3 giờ sáng năm ngoái.',
        concerns: ['track_ok', 'update_ok', 'rto_core', 'rpo_core'],
        quotes: {
          happy: 'Zone chết mà shipper không hề hay biết. Đúng thứ tôi cần.',
          neutral: 'Ổn, nhưng nếu cả region sập thì tôi vẫn lo.',
          unhappy: 'Sập thêm một lần nữa là mất hợp đồng với sàn.',
        },
      },
      {
        id: 'cfo',
        name: 'Chị Ngân',
        role: 'Giám đốc tài chính',
        avatar: 'N',
        intro: 'Đồng ý chi cho DR, nhưng muốn biết mỗi đồng mua được gì.',
        concerns: ['budget', 'rto_report'],
        quotes: {
          happy: 'Chi đúng chỗ. Báo cáo chậm một ngày cũng chẳng sao.',
          neutral: 'Hơi tốn, nhưng chấp nhận được.',
          unhappy: 'Bạn đang mua bảo hiểm cho cả những thứ không đáng.',
        },
      },
      {
        id: 'data',
        name: 'Anh Quân',
        role: 'Trưởng nhóm dữ liệu & báo cáo',
        avatar: 'Q',
        intro: 'Phụ trách báo cáo vận hành và BI.',
        concerns: ['rto_report', 'backup'],
        quotes: {
          happy: 'Báo cáo có backup đàng hoàng, vậy là đủ.',
          neutral: 'Tạm ổn.',
          unhappy: 'Mất dữ liệu báo cáo là mất số liệu đối soát.',
        },
      },
    ],
    questions: [
      { id: 'q_sla', stakeholder: 'coo', hours: 1, text: 'Hệ thống tracking được phép ngừng tối đa bao lâu?', answer: 'Hợp đồng với sàn: tracking ngừng quá 30 phút là bị phạt 50.000 đô mỗi lần.', reveals: ['sla'] },
      { id: 'q_loss', stakeholder: 'coo', hours: 1, text: 'Mất bao nhiêu phút dữ liệu thì chấp nhận được?', answer: 'Tối đa 5 phút. Mất nhiều hơn là shipper phải gọi lại từng khách để xác nhận.', reveals: ['rpo'] },
      { id: 'q_budget', stakeholder: 'cfo', hours: 1, text: 'Ngân sách hạ tầng hằng tháng là bao nhiêu?', answer: 'Cả hệ thống, tính luôn DR, tối đa 1.100 đô một tháng.', reveals: ['budget'] },
      { id: 'q_report', stakeholder: 'data', hours: 0.5, text: 'Hệ thống báo cáo cần khôi phục nhanh cỡ nào?', answer: 'Báo cáo vận hành dùng cho họp sáng. Chậm một ngày cũng được, miễn không mất dữ liệu quá vài giờ.', reveals: ['report'] },
      { id: 'q_past', stakeholder: 'coo', hours: 0.5, text: 'Sự cố năm ngoái xảy ra thế nào?', answer: 'Cả data center mất điện. Database không có bản dự phòng, phải chờ khôi phục từ backup 6 tiếng.', reveals: ['history'] },
      { id: 'q_multi', stakeholder: 'data', hours: 1, text: 'Có cần chạy active-active nhiều region không?', answer: 'Team chưa ai làm ghi dữ liệu hai region. Nghe nói phức tạp lắm.' },
    ],
    facts: [
      { id: 'sla', text: 'Tracking ngừng quá 30 phút bị phạt $50.000/lần (RTO ≤ 30 phút).', key: true },
      { id: 'rpo', text: 'Mất tối đa 5 phút dữ liệu đơn (RPO ≤ 5 phút).', key: true },
      { id: 'budget', text: 'Ngân sách cả hệ thống kể cả DR: tối đa $1.100/tháng.', key: true },
      { id: 'report', text: 'Báo cáo được phép khôi phục trong 1 ngày.', key: false },
      { id: 'history', text: 'Sự cố cũ: database không có bản dự phòng.', key: false },
    ],
  },
  decisions: [
    { id: 'dr_core', title: 'DR cho tracking & điều phối', prompt: 'Khi cả region sập, hệ thống tracking khôi phục thế nào?', conceptKey: 'dr_tiers', options: drOptions('core', [20, 180, 420, 1300]) },
    { id: 'dr_report', title: 'DR cho báo cáo & BI', prompt: 'Khi cả region sập, hệ thống báo cáo khôi phục thế nào?', conceptKey: 'dr_tiers', options: drOptions('report', [10, 90, 210, 650]) },
  ],
  rules: [
    { id: 'track_ok', check: 'metric', metric: 'answered_pct:track', op: '>=', value: 99, unit: '%', text: 'Tra cứu đơn: ít nhất 99% được phản hồi, kể cả khi có sự cố', failText: 'Tra cứu đơn bị rớt khi có sự cố.', pillar: 'reliability', hard: true, conceptKey: 'single_point_of_failure' },
    { id: 'update_ok', check: 'metric', metric: 'answered_pct:update', op: '>=', value: 98, unit: '%', text: 'Cập nhật trạng thái: ít nhất 98% được phản hồi', failText: 'Shipper không cập nhật được trạng thái khi có sự cố.', pillar: 'reliability', hard: true, conceptKey: 'failover' },
    { id: 'track_fast', check: 'metric', metric: 'latency_ms:track', op: '<=', value: 200, unit: 'ms', text: 'Tra cứu đơn: trung bình dưới 200 ms', failText: 'Tra cứu đơn chậm.', pillar: 'performance', hard: true, conceptKey: 'caching' },
    { id: 'rto_core', check: 'metric', metric: 'rto_core_min', op: '<=', value: 30, unit: 'min', text: 'Tracking khôi phục trong 30 phút khi mất region', failText: 'Mức DR của tracking không đạt RTO 30 phút trong hợp đồng với sàn.', pillar: 'reliability', hard: true, hiddenUntil: 'sla', conceptKey: 'rto_rpo' },
    { id: 'rpo_core', check: 'metric', metric: 'rpo_core_min', op: '<=', value: 5, unit: 'min', text: 'Tracking mất tối đa 5 phút dữ liệu', failText: 'Mức DR của tracking có thể mất quá 5 phút dữ liệu.', pillar: 'reliability', hard: true, hiddenUntil: 'rpo', conceptKey: 'rto_rpo' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 1100, unit: '$', text: 'Chi phí tối đa $1.100/tháng kể cả DR', failText: 'Vượt ngân sách: DR đắt nhất không phải lúc nào cũng cần.', pillar: 'cost', hard: true, hiddenUntil: 'budget', conceptKey: 'dr_tiers' },
    { id: 'rto_report', check: 'metric', metric: 'rto_report_min', op: '>=', value: 240, unit: 'min', text: 'Không chi quá tay cho DR của báo cáo', failText: 'Báo cáo chỉ cần khôi phục trong một ngày; mức DR cao hơn là tiền bỏ phí.', pillar: 'cost', hard: false, hiddenUntil: 'report', conceptKey: 'rto_rpo' },
    { id: 'backup', check: 'flag', flag: 'backup', present: true, text: 'Có backup tách biệt (chống xoá nhầm, ransomware)', failText: 'Không có Backup Vault: standby và DR không cứu được khi dữ liệu bị xoá nhầm.', pillar: 'reliability', hard: false, conceptKey: 'ha_vs_dr' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo', failText: 'Không có monitoring: sự cố được phát hiện qua điện thoại của sàn.', pillar: 'ops', hard: false, conceptKey: 'observability' },
    { id: 'util', check: 'metric', metric: 'fleet_util_pct', op: '>=', value: 25, unit: '%', text: 'Sử dụng tài nguyên trung bình ≥ 25%', failText: 'Hạ tầng thừa so với tải.', pillar: 'sustainability', hard: false, conceptKey: 'sustainability' },
  ],
  stars: { tco3yUsd: 33000 },
  hints: [
    'HA (trong một region) và DR (khi mất cả region) là hai chuyện khác nhau. Sự cố trong mô phỏng là hỏng trong zone; thẻ DR lo phần mất region.',
    'Database có tuỳ chọn standby. App Server cần N+1 sau Load Balancer.',
    'Mỗi quy trình có RTO/RPO riêng. Hỏi xem báo cáo cần khôi phục nhanh cỡ nào.',
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
    asked: ['q_sla', 'q_loss', 'q_budget', 'q_report'],
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

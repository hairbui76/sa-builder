import type { Level } from '@sa/engine';
import { DEV_MONTHLY_USD, REGIONS, REGION_LATENCY, WORLD1, example, fixed, type LevelExamples } from './common';

const fixedNodes = [fixed('users', 'users', 'Bệnh nhân', 520, 60, { region: 'vn' })];

export const level: Level = {
  id: 'ask_before_draw',
  worldId: WORLD1,
  order: 1,
  title: 'Hỏi trước khi vẽ',
  client: 'Chuỗi phòng khám Ánh Dương',
  brief: 'Thiết kế hệ thống đặt lịch khám chạy ổn cả lúc cao điểm, đúng mọi ràng buộc của khách hàng.',
  difficulty: 1,
  conceptKeys: ['requirements_elicitation', 'data_residency', 'queue_buffering'],
  team: { size: 2, skills: ['php', 'sql'], devMonthlyUsd: DEV_MONTHLY_USD, baseMonths: 2 },
  regions: REGIONS,
  defaultRegion: 'sg',
  regionLatencyMs: REGION_LATENCY,
  fixedNodes,
  traffic: {
    ticks: 120,
    usageScale: 0.3,
    kinds: [
      {
        id: 'view_slots',
        title: 'Xem lịch trống',
        from: 'users',
        userFacing: true,
        calls: [{ family: 'sql_read', count: 2 }],
      },
      {
        id: 'book',
        title: 'Đặt lịch',
        from: 'users',
        userFacing: true,
        carries: ['pii'],
        calls: [
          { family: 'sql_read', count: 1 },
          { family: 'sql_write', count: 1 },
          { family: 'job', count: 1 },
        ],
        jobCalls: [{ family: 'notify', count: 1 }],
      },
    ],
    phases: [
      { from: 0, to: 60, rates: { view_slots: 30, book: 2 } },
      { from: 60, to: 90, rates: { view_slots: 120, book: 8 } },
      { from: 90, to: 120, rates: { view_slots: 30, book: 2 } },
    ],
  },
  events: [],
  palette: [
    { type: 'load_balancer' },
    { type: 'app_server', tiers: ['s', 'm'] },
    { type: 'serverless_fn' },
    { type: 'relational_db', tiers: ['s', 'm'], max: 1 },
    { type: 'cache', tiers: ['s'] },
    { type: 'queue' },
    { type: 'worker' },
    { type: 'email_service' },
    { type: 'sms_vn' },
    { type: 'monitoring' },
  ],
  limits: { maxNodes: 10, maxEdges: 16 },
  discovery: {
    hours: 4,
    stakeholders: [
      {
        id: 'owner',
        name: 'BS. Hùng',
        role: 'Giám đốc chuỗi phòng khám',
        avatar: 'H',
        intro: 'Người ký hợp đồng. Quan tâm chi phí và trải nghiệm bệnh nhân.',
        concerns: ['budget', 'book_ok', 'sms'],
        quotes: {
          happy: 'Chi phí trong tầm, bệnh nhân hài lòng. Tôi sẽ giới thiệu bạn cho mấy phòng khám bạn bè.',
          neutral: 'Chạy được, nhưng còn vài chỗ tôi chưa yên tâm.',
          unhappy: 'Đây không phải thứ chúng tôi cần. Bạn đã hỏi chúng tôi đâu?',
        },
      },
      {
        id: 'ops',
        name: 'Chị Mai',
        role: 'Trưởng lễ tân',
        avatar: 'M',
        intro: 'Ngày nào cũng nghe bệnh nhân phàn nàn qua điện thoại.',
        concerns: ['view_ok', 'view_fast', 'sms', 'reminders'],
        quotes: {
          happy: 'Sáng thứ Hai mà điện thoại không reo liên tục, cảm ơn bạn!',
          neutral: 'Đỡ hơn trước, nhưng sẽ vẫn có bệnh nhân gọi lên hỏi.',
          unhappy: 'Bệnh nhân lớn tuổi sẽ lỡ hẹn, và người nghe máy là tôi.',
        },
      },
      {
        id: 'legal',
        name: 'Luật sư Tuấn',
        role: 'Tư vấn pháp lý',
        avatar: 'T',
        intro: 'Được thuê theo giờ. Ít nói nhưng nói câu nào nặng câu đó.',
        concerns: ['residency', 'encrypt'],
        quotes: {
          happy: 'Luồng dữ liệu bệnh nhân rõ ràng và đúng luật. Tôi ký.',
          neutral: 'Về cơ bản ổn, cần bổ sung vài biện pháp bảo vệ.',
          unhappy: 'Dữ liệu sức khoẻ ra nước ngoài là vi phạm Nghị định 13. Không thể go-live.',
        },
      },
      {
        id: 'it',
        name: 'Anh Khoa',
        role: 'Trưởng nhóm IT (2 dev)',
        avatar: 'K',
        intro: 'Sẽ là người vận hành hệ thống sau khi bạn bàn giao.',
        concerns: ['skills'],
        quotes: {
          happy: 'Toàn thứ team mình làm được. Bàn giao xong là chạy.',
          neutral: 'Có vài thứ mới, team sẽ phải học thêm.',
          unhappy: 'Team tôi không vận hành nổi đống này.',
        },
      },
    ],
    questions: [
      { id: 'q_goal', stakeholder: 'owner', hours: 0.5, text: 'Mục tiêu kinh doanh của web đặt lịch là gì?', answer: 'Giảm cuộc gọi đặt lịch cho lễ tân và giảm tỷ lệ bệnh nhân lỡ hẹn, hiện khoảng 20%.' },
      { id: 'q_budget', stakeholder: 'owner', hours: 1, text: 'Ngân sách vận hành hằng tháng cho hệ thống là bao nhiêu?', answer: 'Tối đa 250 đô một tháng cho toàn bộ hạ tầng và dịch vụ. Hơn là tôi không duyệt.', reveals: ['budget'] },
      { id: 'q_noshow', stakeholder: 'ops', hours: 1, text: 'Nhắc lịch bệnh nhân bằng kênh nào thì hiệu quả?', answer: 'Phải là SMS. Phần lớn bệnh nhân trên 50 tuổi, gần như không đọc email.', reveals: ['sms_needed'] },
      { id: 'q_peak', stakeholder: 'ops', hours: 0.5, text: 'Lúc nào đông nhất?', answer: 'Sáng thứ Hai từ 8 giờ: lượng người xem lịch gấp 4 lần ngày thường.', reveals: ['peak'] },
      { id: 'q_data', stakeholder: 'legal', hours: 1, text: 'Có quy định nào về dữ liệu bệnh nhân không?', answer: 'Thông tin sức khoẻ là dữ liệu cá nhân nhạy cảm theo Nghị định 13/2023. Phải lưu và xử lý tại Việt Nam, kể cả khi gửi qua dịch vụ bên thứ ba.', reveals: ['residency'] },
      { id: 'q_audit', stakeholder: 'legal', hours: 1, text: 'Có cần lưu log truy cập hồ sơ bệnh án không?', answer: 'Giai đoạn này chỉ là lịch hẹn, chưa có hồ sơ bệnh án. Chưa bắt buộc.' },
      { id: 'q_team', stakeholder: 'it', hours: 0.5, text: 'Team đang quen công nghệ gì?', answer: 'Hai bạn dev làm PHP và MySQL. Chưa ai làm serverless hay NoSQL.', reveals: ['skills'] },
    ],
    facts: [
      { id: 'budget', text: 'Chi phí hạ tầng + dịch vụ tối đa $250/tháng.', key: true },
      { id: 'sms_needed', text: 'Nhắc lịch phải qua SMS: bệnh nhân lớn tuổi không đọc email.', key: true },
      { id: 'residency', text: 'Dữ liệu bệnh nhân phải lưu và xử lý tại Việt Nam (NĐ 13/2023), kể cả ở bên thứ ba.', key: true },
      { id: 'peak', text: 'Sáng thứ Hai lượng xem lịch gấp 4 lần.', key: false },
      { id: 'skills', text: 'Team 2 dev quen PHP và SQL, chưa làm serverless/NoSQL.', key: false },
    ],
  },
  decisions: [],
  rules: [
    { id: 'view_ok', check: 'metric', metric: 'answered_pct:view_slots', op: '>=', value: 99, unit: '%', text: 'Xem lịch trống: ít nhất 99% được phản hồi', failText: 'Nhiều lượt xem lịch bị rớt.', pillar: 'reliability', hard: true, conceptKey: 'scale_out' },
    { id: 'book_ok', check: 'metric', metric: 'answered_pct:book', op: '>=', value: 99, unit: '%', text: 'Đặt lịch: ít nhất 99% được phản hồi', failText: 'Nhiều lượt đặt lịch bị rớt.', pillar: 'reliability', hard: true, conceptKey: 'request_flow' },
    { id: 'view_fast', check: 'metric', metric: 'latency_ms:view_slots', op: '<=', value: 300, unit: 'ms', text: 'Xem lịch trống: trung bình dưới 300 ms', failText: 'Trang xem lịch quá chậm.', pillar: 'performance', hard: true, conceptKey: 'caching' },
    { id: 'reminders', check: 'metric', metric: 'jobs_done_pct:book', op: '>=', value: 99, unit: '%', text: 'Tin nhắc lịch: ít nhất 99% được gửi', failText: 'Tin nhắc lịch không được gửi đi: lượt đặt lịch cần đẩy job vào queue, worker lấy ra và gửi qua một dịch vụ thông báo.', pillar: 'reliability', hard: true, conceptKey: 'queue_buffering' },
    { id: 'budget', check: 'metric', metric: 'monthly_usd', op: '<=', value: 250, unit: '$', text: 'Chi phí tối đa $250/tháng', failText: 'Vượt ngân sách $250/tháng mà BS. Hùng đã nói rõ.', pillar: 'cost', hard: true, hiddenUntil: 'budget', conceptKey: 'tco' },
    { id: 'residency', check: 'residency', tag: 'pii', regions: ['vn'], text: 'Dữ liệu bệnh nhân lưu và xử lý tại Việt Nam', failText: 'Dữ liệu bệnh nhân nằm ngoài Việt Nam: vi phạm Nghị định 13/2023. Một dịch vụ bên thứ ba ở nước ngoài cũng tính.', pillar: 'security', hard: true, hiddenUntil: 'residency', conceptKey: 'data_residency' },
    { id: 'sms', check: 'flag', flag: 'sms', present: true, text: 'Nhắc lịch bằng SMS', failText: 'Không có SMS: bệnh nhân lớn tuổi sẽ không nhận được nhắc lịch.', pillar: 'business', hard: false, weight: 2, hiddenUntil: 'sms_needed', conceptKey: 'requirements_elicitation' },
    { id: 'encrypt', check: 'encryption', tag: 'pii', level: 'at_rest', text: 'Dữ liệu bệnh nhân được mã hoá khi lưu', failText: 'Store chứa dữ liệu bệnh nhân chưa bật mã hoá at-rest.', pillar: 'security', hard: false, conceptKey: 'encryption_kms' },
    { id: 'skills', check: 'metric', metric: 'unfamiliar_tech', op: '<=', value: 0, text: 'Chỉ dùng công nghệ team đã quen', failText: 'Thiết kế dùng công nghệ team chưa biết vận hành.', pillar: 'delivery', hard: false, hiddenUntil: 'skills', conceptKey: 'delivery_risk' },
    { id: 'ops_watch', check: 'flag', flag: 'monitoring', present: true, text: 'Có giám sát và cảnh báo', failText: 'Không có monitoring: hệ thống hỏng thì lễ tân là người biết đầu tiên.', pillar: 'ops', hard: false, conceptKey: 'observability' },
    { id: 'util', check: 'metric', metric: 'fleet_util_pct', op: '>=', value: 15, unit: '%', text: 'Không để máy chạy không tải (sử dụng trung bình ≥ 15%)', failText: 'Hạ tầng quá thừa so với tải.', pillar: 'sustainability', hard: false, conceptKey: 'sustainability' },
  ],
  stars: { tco3yUsd: 7500 },
  hints: [
    'Mỗi câu hỏi tốn giờ họp. Ưu tiên người nắm ràng buộc: người trả tiền, người chịu trách nhiệm pháp lý, người vận hành hằng ngày.',
    'Region mặc định là Singapore vì rẻ hơn. Bạn có chắc dữ liệu được phép nằm ở đó?',
    'Đặt lịch → Queue → Worker → dịch vụ gửi tin. Dịch vụ gửi tin cũng là nơi dữ liệu đi qua.',
  ],
};

export const examples: LevelExamples = {
  reference: example(fixedNodes, {
    nodes: [
      ['app', 'app_server', { tier: 's', count: 1, region: 'vn' }],
      ['db', 'relational_db', { tier: 's', region: 'vn', encryption: 'at_rest' }],
      ['q', 'queue', { region: 'vn' }],
      ['w', 'worker', { count: 1, region: 'vn' }],
      ['sms', 'sms_vn'],
      ['mon', 'monitoring'],
    ],
    wires: 'users>app app>db app>q q>w w>sms',
    asked: ['q_budget', 'q_noshow', 'q_data', 'q_team'],
  }),
  naive: [
    {
      name: 'Không hỏi gì, dùng region mặc định và email',
      design: example(fixedNodes, {
        nodes: [
          ['app', 'app_server', { tier: 's' }],
          ['db', 'relational_db', { tier: 's' }],
          ['q', 'queue'],
          ['w', 'worker'],
          ['mail', 'email_service'],
        ],
        wires: 'users>app app>db app>q q>w w>mail',
      }),
      mustFail: ['residency'],
    },
    {
      name: 'Serverless cho mọi thứ',
      design: example(fixedNodes, {
        nodes: [
          ['fn', 'serverless_fn', { region: 'vn' }],
          ['db', 'relational_db', { tier: 'm', region: 'vn', standby: true }],
          ['q', 'queue', { region: 'vn' }],
          ['w', 'worker', { region: 'vn' }],
          ['sms', 'sms_vn'],
        ],
        wires: 'users>fn fn>db fn>q q>w w>sms',
      }),
      mustFail: ['budget'],
    },
    {
      name: 'Quên gửi nhắc lịch',
      design: example(fixedNodes, {
        nodes: [
          ['app', 'app_server', { tier: 's', region: 'vn' }],
          ['db', 'relational_db', { tier: 's', region: 'vn' }],
        ],
        wires: 'users>app app>db',
      }),
      mustFail: ['book_ok'],
    },
  ],
};

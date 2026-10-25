export interface World {
  id: string;
  title: string;
  subtitle: string;
  status: 'open' | 'soon';
  provider?: 'neutral' | 'aws' | 'gcp' | 'azure' | 'onprem';
}

export const worlds: World[] = [
  {
    id: 'first_contract',
    title: 'Hợp đồng đầu tiên',
    subtitle: 'Từ Senior Dev lên Solution Architect: 8 khách hàng, 8 bài học mà sơ đồ client-server không dạy bạn.',
    status: 'open',
    provider: 'neutral',
  },
  { id: 'aws_lab', title: 'AWS Lab', subtitle: 'Chỉ dùng dịch vụ AWS: Well-Architected, landing zone, Organizations, chi phí thật.', status: 'soon', provider: 'aws' },
  { id: 'gcp_lab', title: 'Google Cloud Lab', subtitle: 'BigQuery, GKE, Cloud Run và cách GCP tính tiền.', status: 'soon', provider: 'gcp' },
  { id: 'azure_lab', title: 'Azure Lab', subtitle: 'Doanh nghiệp dùng Microsoft: Entra ID, hybrid với Azure Arc, ExpressRoute.', status: 'soon', provider: 'azure' },
  { id: 'onprem_lab', title: 'Data center của bạn', subtitle: 'Mua máy trước 3 tháng, capex vs opex, rack, điện, và không có nút autoscale.', status: 'soon', provider: 'onprem' },
  { id: 'career', title: 'Career mode', subtitle: 'Một công ty qua nhiều năm: quyết định cũ, nợ kỹ thuật và hợp đồng vendor đi theo bạn.', status: 'soon' },
];

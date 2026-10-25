import { catalogList, concepts } from '@sa/content';
import { TopNav } from '@/components/ui/TopNav';
import { ComponentIcon } from '@/lib/icons';

export const metadata = { title: 'Khái niệm · SA Builder' };

export default function ConceptsPage() {
  const components = catalogList.filter((c) => c.behavior !== 'entry');
  return (
    <>
      <TopNav active="concepts" />
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="font-hand text-4xl">Khái niệm</h1>
        <p className="text-ink-2">Mỗi lý do thất bại trong game trỏ về một khái niệm ở đây, kèm câu hỏi một SA nên đặt ra khi đi làm thật.</p>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {concepts.map((c) => (
            <section key={c.key} id={c.key} className="sketch scroll-mt-6 p-4 target:bg-note">
              <h2 className="font-hand text-2xl">{c.title}</h2>
              <p className="mt-1 text-sm">{c.summary}</p>
              <p className="mt-2 rounded-lg bg-mint-soft p-2 text-sm">
                <b>Khi đi làm thật:</b> {c.saTip}
              </p>
              {c.mapping && (
                <table className="mt-2 w-full text-xs">
                  <tbody>
                    {(['aws', 'azure', 'gcp', 'onprem'] as const).map((k) => (
                      <tr key={k} className="border-t border-line">
                        <td className="py-1 pr-2 font-medium uppercase text-muted">{k === 'onprem' ? 'On-prem' : k}</td>
                        <td className="py-1">{c.mapping![k]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          ))}
        </div>

        <h2 className="font-hand mt-12 text-3xl">Thành phần và tương đương trên từng nền tảng</h2>
        <p className="text-ink-2">Game dùng tên trung lập. Đây là dịch vụ tương ứng khi bạn làm trên AWS, Azure, Google Cloud hay data center riêng.</p>
        <div className="sketch mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b-2 border-ink bg-paper-2 text-left">
              <tr>
                <th className="p-2">Thành phần</th>
                <th className="p-2">AWS</th>
                <th className="p-2">Azure</th>
                <th className="p-2">Google Cloud</th>
                <th className="p-2">On-prem</th>
              </tr>
            </thead>
            <tbody>
              {components.map((c) => (
                <tr key={c.type} className="border-t border-line align-top">
                  <td className="p-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <ComponentIcon name={c.icon} className="h-4 w-4" /> {c.title}
                    </span>
                  </td>
                  <td className="p-2">{c.mapping.aws}</td>
                  <td className="p-2">{c.mapping.azure}</td>
                  <td className="p-2">{c.mapping.gcp}</td>
                  <td className="p-2">{c.mapping.onprem}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </>
  );
}

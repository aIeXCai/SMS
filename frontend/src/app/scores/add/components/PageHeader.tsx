import Link from "next/link";

export default function PageHeader() {
  return (
    <div className="page-header">
      <div className="w-full px-4 mx-auto max-w-[1400px]">
        <div className="flex flex-wrap items-center">
          <div className="w-full md:w-2/3">
            <h1><i className="fas fa-plus mr-3"></i>手动新增成绩</h1>
            <nav aria-label="breadcrumb" className="mt-2">
              <ol className="flex flex-wrap list-none p-0 mb-0">
                <li className="flex items-center">
                  <Link href="/scores" className="text-white/50 hover:text-white/80">成绩管理</Link>
                  <span className="mx-2 text-white/50">/</span>
                </li>
                <li className="text-white">手动新增成绩</li>
              </ol>
            </nav>
          </div>
          <div className="w-full md:w-1/3 text-right">
            <Link href="/scores" className="bg-white border border-gray-300 px-4 py-2 rounded hover:bg-gray-50 transition-colors mr-2">
              <i className="fas fa-arrow-left mr-2"></i>返回列表
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import NoticeRegisterForm from "./NoticeRegisterForm";
import UserManagementTable from "./users/UserManagementTable";
import { createClient } from "@/utils/supabase/server";
import DeleteLinkButton from "@/components/DeleteLinkButton";

export default async function AdminView() {
  const [{ data: links }] = await Promise.all([
		(await createClient())
			.from('dashboard_links')
			.select('id, title, url, description, display_order')
			.order('display_order', { ascending: true }),
	]);
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* 상단 네비게이션 */}
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 메인으로 돌아가기
          </Link>
          <h1 className="text-xl font-bold text-slate-900">어드민 관리 센터</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <UserManagementTable />
          <NoticeRegisterForm />
        </div>

		<h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
			링크 목록
		</h2>

		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
			{links && links.length > 0 ? (
				links.map((item) => (
					<a
						key={item.id}
						href={item.url}
						target="_blank"
						rel="noopener noreferrer"
						className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-md transition-all flex flex-col justify-between"
					>
						<div className="flex items-center justify-between">
							<h3 className="font-semibold text-slate-800">
								{item.title}
							</h3>
						</div>
		<div className="flex flex-row justify-between items-start">
		<p className="text-xs text-slate-500 mt-2">
			{item.description}
		</p>
			<DeleteLinkButton linkId={item.id} />
		</div>
					</a>
				))
			) : (
				<div className="col-span-full bg-white p-8 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">
					등록된 링크가 없습니다.
				</div>
			)}
		</div>
      </div>
    </main>
  );
}

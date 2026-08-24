"use client";

import { useState, useTransition, useEffect } from "react";
import {
  updateUserStatus,
  getAllUsers,
  resetUserPassword
} from "./actions";
import {
  ShieldCheck,
  User,
  Ban,
  CheckCircle2,
  Loader2,
  Search,
  UserCheck,
  RotateCcw,
  KeyRound,
  X
} from "lucide-react";
import BulkRegisterForm from "./BulkRegisterForm";

interface Profile {
  username: string;
  role: "super_admin" | "class_admin" | "user" | "song_admin" | "teacher";
  status: "ACTIVE" | "INACTIVE";
  id: string;
}

export default function UserManagementTable() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [loadingName, setLoadingName] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<Profile | null>(null);

  const [isRegisteringBatch, setIsRegisteringBatch] = useState(false);

  // 검색 필터링 (이름/이메일기준)
  const filteredUsers = users.filter(
    (u) =>
      u.username.includes(searchTerm.toLowerCase())
  );

  const fetchUsers = async () => {
    const users = await getAllUsers();
    setUsers(users);
  };
  useEffect(() => {
    // 초기 유저 목록을 가져오는 로직 (예: API 호출)
    fetchUsers();
  }, []);

  // 권한 또는 상태 업데이트 핸들러
  const handleStatusChange = (
    userId: string,
    newRole: "class_admin" | "user" | "song_admin" | "teacher",
    newStatus: "ACTIVE" | "INACTIVE"
  ) => {
    setLoadingName(userId);

    startTransition(async () => {
      try {
        await updateUserStatus(userId, newRole, newStatus);

        // 로컬 State 업데이트
        setUsers((prev) =>
          prev.map((u) =>
            u.id === userId ? { ...u, role: newRole, status: newStatus } : u
          )
        );
      } catch (err: any) {
        alert(`업데이트 실패: ${err.message}`);
      } finally {
        setLoadingName(null);
      }
    });
  };
  const handleResetPasswordSubmit = async () => {
    if (!resetTargetUser) {
      setIsResetting(false);
      setResetTargetUser(null);
      return;
    }
    try {
      await resetUserPassword(resetTargetUser.username, "ssafy16");
      alert(
        `[${resetTargetUser?.username}] 님의 비밀번호가 성공적으로 변경되었습니다.`
      );
    } catch (err: any) {
      alert(`초기화 실패: ${err.message}`);
    } finally {
      setIsResetting(false);
      setResetTargetUser(null);
    }
  };
  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-4 p-6 col-span-1 md:col-span-1">
      {/* 상단 타이틀 & 검색 바 */}
      <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="flex flex-row items-center justify-between gap-2 pr-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-indigo-600" />
              회원 목록 & 권한 관리 ({users.length}명)
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              등록된 회원들의 권한 및 계정 활성화 상태를 관리합니다.
            </p>
          </div>
          <RotateCcw
            className="w-8 h-8 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            onClick={fetchUsers}
          />
        </div>

        {/* 등록버튼 */}
        <div className="flex flex-row items-center justify-between gap-2 pr-4">
          <button
            onClick={() => setIsRegisteringBatch(true)}
            className={`px-3 py-1 text-[11px] font-medium rounded-lg border bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 `}
          >
            회원 일괄 등록
          </button>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="이름으로 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {isRegisteringBatch && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl relative">
              <X
                className="w-5 h-5 text-slate-400 hover:text-slate-600 absolute top-4 right-4 cursor-pointer"
                onClick={() => setIsRegisteringBatch(false)}
              />
              <BulkRegisterForm
                onRegisterSuccess={fetchUsers}
              />
            </div>
          </div>
        )}
      </div>

      {/* 회원 테이블 */}
      <div className="overflow-x-hidden overflow-y-scroll  h-[400px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">이름</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">상태</th>
              <th className="py-3 px-4 text-right">설정 제어</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const isLoading = loadingName === user.username;

                return (
                  <tr
                    key={user.username}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    {/* 이름 */}
                    <td className="py-3 px-1 font-semibold text-sm text-slate-900 items-center min-w-[50px]">
                      {user.username}
                    </td>
                    {/* 권한 뱃지 */}
                    <td className="py-3 px-1">
                      {user.role === "super_admin" ? (
                        <span className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 border border-indigo-200/60 py-0.5 px-1 rounded-full text-[11px] font-semibold">
                          <ShieldCheck className="w-3 h-3 text-indigo-600" />{" "}
                          Admin
                        </span>
                      ) : user.role === "class_admin" ? (
                        <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200/60 py-0.5 px-1 rounded-full text-[11px] font-semibold">
                          <ShieldCheck className="w-3 h-3 text-amber-600" />C
                          Admin
                        </span>
                      ) : user.role === "teacher" ? (
                        <span className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200/60 py-0.5 px-1 rounded-full text-[11px] font-semibold">
                          <User className="w-3 h-3 text-green-600" /> Teacher
                        </span>
                      ) : user.role === "song_admin" ? (
                        <span className="inline-flex items-center gap-1 bg-purple-50 text-purple-700 border border-purple-200/60 py-0.5 px-1 rounded-full text-[11px] font-semibold">
                          <ShieldCheck className="w-3 h-3 text-purple-600" /> Song
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full text-[11px] font-medium">
                          <User className="w-3 h-3 text-slate-400" /> User
                        </span>
                      )}
                    </td>

                    {/* 상태 뱃지 */}
                    <td className="py-3">
                      {user.status === "ACTIVE" ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-md text-[11px] font-medium">
                          <CheckCircle2 className="w-3 h-3" /> 정상
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-rose-50 text-rose-600 px-2 py-0.5 rounded-md text-[11px] font-medium">
                          <Ban className="w-3 h-3" /> 차단됨
                        </span>
                      )}
                    </td>

                    {/* 조작 버튼 영역 */}
                    <td className="py-3 px-2 text-right">
                      {isLoading ? (
                        <div className="flex justify-end">
                          <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          {/* 💡 비밀번호 초기화 버튼 */}
                          <button
                            type="button"
                            onClick={() => {
                              setResetTargetUser(user);
                              setIsResetting(true);
                            }}
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors border border-slate-200"
                            title="비밀번호 초기화"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() =>
                              user.role !== "super_admin" && handleStatusChange(
                                user.id, user.role,
                                user.status === "ACTIVE"
                                  ? "INACTIVE"
                                  : "ACTIVE"
                              )
                            }
                            className={`px-2.5 py-1 text-[11px] font-medium rounded-lg border transition-colors ${
                              user.status === "ACTIVE"
                                ? "bg-white border-rose-200 text-rose-600 hover:bg-rose-50"
                                : "bg-emerald-600 border-emerald-600 text-white hover:bg-emerald-700"
                            } disabled:cursor-not-allowed disabled:opacity-30`}
                            disabled={user.role === "super_admin"}
                          >
                            {user.status === "ACTIVE"
                              ? "차단"
                              : "차단 해제"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              }
              
            )
          ) : (
              <tr>
                <td
                  colSpan={5}
                  className="py-8 text-center text-slate-400 text-xs"
                >
                  검색 결과 또는 등록된 유저가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isResetting && resetTargetUser && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between ">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                {resetTargetUser.username}님의 비밀번호를 초기화 하겠습니까?
              </h3>
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-2 mr-1">
              <button
                type="button"
                onClick={() => setResetTargetUser(null)}
                className="cursor-pointer px-4.5 py-2.25 text-md font-semibold text-slate-500 hover:bg-slate-100 rounded-xl"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleResetPasswordSubmit}
                className="cursor-pointer px-4.5 py-2.25 text-md font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-1 shadow-md shadow-indigo-100"
              >
                초기화
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

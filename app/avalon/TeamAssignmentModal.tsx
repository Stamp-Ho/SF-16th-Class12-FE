'use client';

import { useEffect, useState } from 'react';
import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { GripVertical, LoaderCircle, Plus, Users, X } from 'lucide-react';
import { createAvalonRoomsFromTeams, getUsersForTeamAssignment } from './actions';

type Person = { id: string; name: string };
type Team = { id: string; people: Person[] };

function PersonBadges({ id, people, emptyLabel }: { id: string; people: Person[]; emptyLabel: string }) {
  return <Droppable droppableId={id} direction="horizontal">
    {(provided, snapshot) => <div ref={provided.innerRef} {...provided.droppableProps} className={`flex min-h-24 flex-wrap content-start gap-2 rounded-xl border-2 border-dashed p-3 transition-colors ${snapshot.isDraggingOver ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-slate-50'}`}>
      {people.map((person, index) => <Draggable key={person.id} draggableId={person.id} index={index}>
        {(drag, state) => <span ref={drag.innerRef} {...drag.draggableProps} {...drag.dragHandleProps} className={`inline-flex max-w-full items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-semibold shadow-sm ${state.isDragging ? 'border-violet-300 bg-white text-violet-800 shadow-lg' : 'border-slate-200 bg-white text-slate-700'}`}>
          <GripVertical aria-hidden="true" size={14} className="shrink-0 text-slate-400" />
          <span className="truncate">{person.name}</span>
        </span>}
      </Draggable>)}
      {provided.placeholder}
      {people.length === 0 && <p className="self-center text-xs text-slate-400">{emptyLabel}</p>}
    </div>}
  </Droppable>;
}

export default function TeamAssignmentModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => Promise<void> }) {
  const [pool, setPool] = useState<Person[]>([]);
  const [teams, setTeams] = useState<Team[]>([{ id: 'team-1', people: [] }]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;
    void getUsersForTeamAssignment().then((result) => {
      if (!active) return;
      if (result.ok) setPool(result.data);
      else setLoadError(result.error);
      setLoading(false);
    }).catch(() => {
      if (active) { setLoadError('유저 목록을 불러오지 못했습니다.'); setLoading(false); }
    });
    return () => { active = false; };
  }, []);

  function addTeam() {
    setError('');
    setTeams((current) => current.length >= 5 ? current : [...current, { id: `team-${Date.now()}`, people: [] }]);
  }

  function removeTeam(teamId: string) {
    if (teams.length <= 1) return;
    const removed = teams.find((team) => team.id === teamId);
    if (!removed) return;
    setError('');
    setTeams((current) => current.filter((team) => team.id !== teamId));
    setPool((people) => [...people, ...removed.people].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleDragEnd(result: DropResult) {
    const { source, destination, draggableId } = result;
    if (!destination || (source.droppableId === destination.droppableId && source.index === destination.index)) return;
    const sourceList = source.droppableId === 'pool' ? pool : teams.find((team) => team.id === source.droppableId)?.people ?? [];
    const destinationList = destination.droppableId === 'pool' ? pool : teams.find((team) => team.id === destination.droppableId)?.people ?? [];
    const person = sourceList.find((entry) => entry.id === draggableId);
    if (!person) return;
    setError('');

    if (source.droppableId === destination.droppableId) {
      const reordered = [...sourceList];
      reordered.splice(source.index, 1);
      reordered.splice(destination.index, 0, person);
      if (source.droppableId === 'pool') setPool(reordered);
      else setTeams((current) => current.map((team) => team.id === source.droppableId ? { ...team, people: reordered } : team));
      return;
    }

    const nextSource = [...sourceList];
    nextSource.splice(source.index, 1);
    const nextDestination = [...destinationList];
    nextDestination.splice(destination.index, 0, person);
    if (source.droppableId === 'pool') setPool(nextSource);
    else setTeams((current) => current.map((team) => team.id === source.droppableId ? { ...team, people: nextSource } : team));
    if (destination.droppableId === 'pool') setPool(nextDestination);
    else setTeams((current) => current.map((team) => team.id === destination.droppableId ? { ...team, people: nextDestination } : team));
  }

  const assignedCount = teams.reduce((total, team) => total + team.people.length, 0);
  const oversizedTeam = teams.some((team) => team.people.length > 10);
  const canCreateRooms = !loading && !loadError && !oversizedTeam && teams.every((team) => team.people.length > 0);

  async function createRooms() {
    if (!canCreateRooms || creating) return;
    setCreating(true);
    setError('');
    const result = await createAvalonRoomsFromTeams(teams.map((team) => team.people.map((person) => person.id)));
    if (result.ok) {
      await onCreated();
      onClose();
    } else setError(result.error);
    setCreating(false);
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="team-assignment-title" className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
        <div><div className="flex items-center gap-2 text-violet-700"><Users size={18} /><span className="text-xs font-bold uppercase tracking-wide">관리자 도구</span></div><h2 id="team-assignment-title" className="mt-1 text-xl font-bold text-slate-900">팀 편성</h2><p className="mt-1 text-sm text-slate-500">아래 이름을 끌어 위쪽 팀 영역에 놓아 주세요. 채워진 팀(1~10명)만으로 1~5개 대기실을 만듭니다. 미배치 유저는 이번 편성에서 제외됩니다.</p></div>
        <button type="button" onClick={onClose} aria-label="모달 닫기" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X size={20} /></button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <section aria-label="팀 영역">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-bold text-slate-800">팀 영역 <span className="font-normal text-slate-500">({teams.length}/5)</span></h3><button type="button" onClick={addTeam} disabled={teams.length >= 5} className="inline-flex items-center gap-1 rounded-lg border border-violet-200 px-3 py-2 text-sm font-semibold text-violet-800 disabled:opacity-40"><Plus size={16} /> 팀 추가</button></div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {teams.map((team, index) => <article key={team.id} className="min-w-0 rounded-2xl border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2"><h4 className="text-sm font-bold text-slate-800">팀 {index + 1} <span className={`font-normal ${team.people.length > 10 ? 'text-rose-600' : 'text-slate-500'}`}>· {team.people.length}/10명</span></h4>{teams.length > 1 && <button type="button" onClick={() => removeTeam(team.id)} aria-label={`팀 ${index + 1} 삭제`} className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50">삭제</button>}</div>
                <PersonBadges id={team.id} people={team.people} emptyLabel="이름을 여기에 놓아 주세요" />
              </article>)}
            </div>
          </section>

          <section className="mt-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-slate-800">미배치 유저 <span className="font-normal text-slate-500">({pool.length}명)</span></h3><p className="mt-1 text-xs text-slate-500">전체 유저 {pool.length + assignedCount}명 중 {assignedCount}명 배치됨</p></div></div>
            {loading ? <div className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">유저 목록을 불러오는 중...</div> : loadError ? <p role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">{loadError}</p> : <PersonBadges id="pool" people={pool} emptyLabel="모든 유저가 팀에 배치되었습니다" />}
          </section>
        </DragDropContext>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6"><div><p className="text-sm text-slate-600">배치 {assignedCount}명 · 미배치 {pool.length}명</p>{error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}</div><div className="flex gap-2"><button type="button" onClick={() => void createRooms()} disabled={!canCreateRooms || creating} className="inline-flex items-center gap-2 rounded-xl bg-violet-700 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">{creating && <LoaderCircle size={16} className="animate-spin" />}{creating ? '생성 중...' : '편성'}</button><button type="button" onClick={onClose} disabled={creating} className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-50">취소</button></div></footer>
    </section>
  </div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Network, Table2, X } from "lucide-react";
import { count, names } from "./data";
import { getRelationshipAvatars } from "./actions";

const maximum = Math.max(...count.flat(), 1);

function Face({
  name,
  url,
  x,
  y,
  radius,
}: {
  name: string;
  url?: string;
  x: number;
  y: number;
  radius: number;
}) {
  const [failed, setFailed] = useState(false);
  const id = `face-${names.indexOf(name)}`;
  return (
    <>
      <defs>
        <clipPath id={id}>
          <circle cx={x} cy={y} r={radius} />
        </clipPath>
      </defs>
      <circle
        cx={x}
        cy={y}
        r={radius + 3}
        fill="white"
        stroke="#818cf8"
        strokeWidth="2"
      />
      <circle cx={x} cy={y} r={radius} fill="#e0e7ff" />
      {url && !failed ? (
        <image
          href={url}
          x={x - radius}
          y={y - radius}
          width={radius * 2}
          height={radius * 2}
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${id})`}
          onError={() => setFailed(true)}
        />
      ) : (
        <text x={x} y={y + 5} textAnchor="middle" fontSize="16" fill="#4338ca">
          {name.slice(-2)}
        </text>
      )}
    </>
  );
}

export default function RelationshipModal({
  onClose,
  userName,
}: {
  onClose: () => void;
  userName: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [myIndex, setMyIndex] = useState<number | null>(
    names.indexOf(userName),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>({});
  const [photoStatus, setPhotoStatus] =
    useState("얼굴 사진을 불러오는 중입니다.");
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element?.showModal();
    document.body.style.overflow = "hidden";
    let active = true;
    getRelationshipAvatars()
      .then((urls) => {
        if (!active) return;
        setAvatars(urls);
        setPhotoStatus(
          names.some((name) => !urls[name])
            ? "사진이 없는 사람은 이름으로 표시합니다."
            : "",
        );
      })
      .catch(() => {
        if (active)
          setPhotoStatus("얼굴 사진을 불러오지 못해 이름으로 표시합니다.");
      });
    return () => {
      active = false;
      document.body.style.overflow = overflow;
      element?.close();
      previous?.focus();
    };
  }, []);
  const relations =
    selected === null
      ? []
      : names
          .map((name, index) => ({
            name,
            index,
            value: count[selected][index],
          }))
          .filter((p) => p.index !== selected)
          .sort((a, b) => b.value - a.value || a.index - b.index);
  const met = relations.filter((p) => p.value > 0);
  const nodes: ((typeof met)[number] & {
    x: number;
    y: number;
    radius: number;
  })[] = [];
  for (const person of met) {
    const distance = 315 - (190 * person.value) / maximum;
    const radius = 17 + (19 * person.value) / maximum;
    let best = { x: 400, y: 380 - distance, clearance: -Infinity };
    for (let step = 0; step < 720; step++) {
      const angle = (step / 720) * Math.PI * 2 - Math.PI / 2;
      const x = 400 + Math.cos(angle) * distance;
      const y = 380 + Math.sin(angle) * distance;
      const clearance = Math.min(
        ...nodes.map(
          (node) =>
            Math.hypot(x - node.x, y - node.y) - radius - node.radius - 20,
        ),
      );
      if (clearance > best.clearance) best = { x, y, clearance };
    }
    nodes.push({ ...person, x: best.x, y: best.y, radius });
  }
  return (
    <dialog
      ref={dialog}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby="relationship-title"
      className="fixed inset-0 m-auto h-[94dvh] max-h-none w-[96vw] max-w-[1600px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/60"
    >
      <div className="flex h-full flex-col">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5">
          <div>
            <h2 id="relationship-title" className="text-lg font-bold">
              {selected === null
                ? "우리 반 만남 이력"
                : `${names[selected]}의 관계도`}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {selected === null
                ? "이름을 누르면 개인별 그래프와 관계도를 볼 수 있어요."
                : `만난 사람 ${met.length}명 / 전체 최대 ${maximum}회 기준으로 표시합니다.`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selected !== null && (
              <button
                onClick={() => setSelected(null)}
                className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
              >
                <ArrowLeft size={15} />
                전체 표
              </button>
            )}
            <button
              onClick={() => setSelected(myIndex)}
              className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm"
            >
              내 관계도
            </button>
            <button
              onClick={onClose}
              aria-label="만남 이력 닫기"
              className="rounded-lg p-2 hover:bg-slate-100"
            >
              <X size={22} />
            </button>
          </div>
        </header>
        {selected === null ? (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="border-separate border-l border-spacing-0 text-center text-xs ml-0.5">
              <caption className="sr-only">27명의 쌍별 누적 만남 횟수</caption>
              <thead className="sticky top-0 z-20">
                <tr>
                  <th className="sticky left-0 z-30 min-w-12 border-b border-r bg-slate-100 p-3">
                    <Table2 size={16} className="mx-auto" />
                  </th>
                  {names.map((name, i) => (
                    <th
                      key={name}
                      scope="col"
                      className="min-w-8 border-b bg-slate-100 py-1.75 px-0.25"
                    >
                      <button
                        onClick={() => setSelected(i)}
                        className="rounded px-2.75 py-2 font-semibold text-indigo-700 hover:bg-indigo-100"
                      >
                        {name}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {names.map((name, i) => (
                  <tr key={name} className="group">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-r bg-white px-1 py-1"
                    >
                      <button
                        onClick={() => setSelected(i)}
                        className="rounded px-1 py-2 text-indigo-700 hover:bg-indigo-100"
                      >
                        {name}
                      </button>
                    </th>
                    {count[i].map((value, j) => (
                      <td
                        key={j}
                        title={`${name} ↔ ${names[j]}: ${value}회`}
                        className="border-b border-r border-slate-100 p-1 tabular-nums"
                        style={{
                          backgroundColor:
                            i === j
                              ? "#e2e8f0"
                              : value
                                ? `rgba(99,102,241,${0.08 + (value / maximum) * 0.55})`
                                : "#fff",
                          color: value ? "#312e81" : "#94a3b8",
                        }}
                      >
                        {i === j ? "—" : value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 gap-3 overflow-auto p-3 lg:grid-cols-4 lg:grid-rows-3 lg:overflow-hidden">
            <section className="min-h-0 rounded-xl border border-slate-200 bg-white p-4 lg:col-start-1 lg:row-start-1">
              <h3 className="text-sm font-bold">만남 횟수</h3>
              <div className="h-[180px] overflow-x-auto lg:h-[calc(100%-28px)]">
                <svg
                  role="img"
                  aria-label={`${names[selected]}와 1회 이상 만난 사람별 막대 그래프`}
                  viewBox={`0 0 ${Math.max(260, met.length * 30)} 190`}
                  className="h-full min-h-[130px]"
                  style={{ minWidth: Math.max(260, met.length * 30) }}
                >
                  {Array.from({ length: maximum }, (_, i) => (
                    <g key={i}>
                      <line
                        x1="20"
                        x2={Math.max(260, met.length * 30)}
                        y1={135 - ((i + 1) / maximum) * 110}
                        y2={135 - ((i + 1) / maximum) * 110}
                        stroke="#e2e8f0"
                      />
                      <text
                        x="3"
                        y={139 - ((i + 1) / maximum) * 110}
                        fontSize="10"
                      >
                        {i + 1}
                      </text>
                    </g>
                  ))}
                  {met.map((p, i) => (
                    <g
                      key={p.name}
                      onClick={() => setSelected(p.index)}
                      className="cursor-pointer"
                    >
                      <title>
                        {p.name}: {p.value}회
                      </title>
                      <rect
                        x={28 + i * 30}
                        y={135 - (p.value / maximum) * 110}
                        width="20"
                        height={(p.value / maximum) * 110}
                        rx="3"
                        fill="#818cf8"
                      />
                      <text
                        x={38 + i * 30}
                        y={129 - (p.value / maximum) * 110}
                        textAnchor="middle"
                        fontSize="10"
                      >
                        {p.value}
                      </text>
                      <text
                        x={49 + i * 30}
                        y="153"
                        textAnchor="end"
                        fontSize="8"
                      >
                        {p.name}
                      </text>
                    </g>
                  ))}
                </svg>
              </div>
            </section>
            <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white p-4 lg:col-start-1 lg:row-span-2 lg:row-start-2">
              <h3 className="mb-3 text-sm font-bold">
                전체 관계 목록{" "}
                <span className="font-normal text-slate-400">26명</span>
              </h3>
              <div className="max-h-80 overflow-auto lg:max-h-none">
                {relations.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => setSelected(p.index)}
                    className="flex w-full items-center justify-between rounded-lg px-2 py-2.5 text-sm hover:bg-indigo-50"
                  >
                    <span>{p.name}</span>
                    <span
                      className={
                        p.value
                          ? "font-semibold text-indigo-600"
                          : "text-slate-400"
                      }
                    >
                      {p.value ? `${p.value}회` : "첫 만남 전"}
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="flex min-h-[480px] min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-4 lg:col-span-3 lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:min-h-0">
              <h3 className="flex items-center gap-2 text-sm font-bold">
                <Network size={16} />
                관계도
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                많이 만날수록 중심에 가깝고 얼굴 노드가 커져요. 얼굴을 누르면
                해당 사람으로 전환합니다.
              </p>
              <svg
                viewBox="0 0 800 760"
                role="img"
                aria-label={`${names[selected]} 중심 만남 관계도`}
                className="min-h-0 flex-1"
              >
                <g>
                  {Array.from({ length: maximum }, (_, i) => (
                    <circle
                      key={i}
                      cx="400"
                      cy="380"
                      r={315 - (190 * (i + 1)) / maximum}
                      fill="#6366f1"
                      fillOpacity={0.07}
                      stroke="#a5b4fc"
                      strokeWidth={1}
                      strokeDasharray="4 6"
                    />
                  ))}
                  {nodes.map((p) => (
                    <g key={p.name}>
                      <line
                        x1="400"
                        y1="380"
                        x2={p.x}
                        y2={p.y}
                        stroke="#a5b4fc"
                        strokeWidth={1 + (p.value / maximum) * 4}
                      />
                      <text
                        x={400 + (p.x - 400) * 0.63}
                        y={380 + (p.y - 380) * 0.63}
                        textAnchor="middle"
                        fill="#4f46e5"
                        fontSize="12"
                        stroke="white"
                        strokeWidth="4"
                        paintOrder="stroke"
                      >
                        {p.value}회
                      </text>
                    </g>
                  ))}
                  {nodes.map((p) => (
                    <g
                      key={`${selected}-${p.name}`}
                      role="button"
                      tabIndex={0}
                      aria-label={`${p.name}, ${p.value}회, 관계도 보기`}
                      onClick={() => setSelected(p.index)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelected(p.index);
                        }
                      }}
                      className="cursor-pointer outline-indigo-500"
                    >
                      <title>
                        {p.name}: {p.value}회
                      </title>
                      <Face
                        name={p.name}
                        url={avatars[p.name]}
                        x={p.x}
                        y={p.y}
                        radius={p.radius}
                      />
                      <text
                        x={p.x}
                        y={p.y + p.radius + 20}
                        textAnchor="middle"
                        fontSize="13"
                        fontWeight="600"
                        fill="#334155"
                        stroke="white"
                        strokeWidth="4"
                        paintOrder="stroke"
                      >
                        {p.name}
                      </text>
                    </g>
                  ))}
                  <Face
                    key={selected}
                    name={names[selected]}
                    url={avatars[names[selected]]}
                    x={400}
                    y={380}
                    radius={43}
                  />
                  <text
                    x="400"
                    y="449"
                    textAnchor="middle"
                    fontSize="17"
                    fontWeight="700"
                    fill="#312e81"
                  >
                    {names[selected]}
                  </text>
                </g>
              </svg>
              <p role="status" className="text-xs text-slate-400">
                {photoStatus || "Avalon과 동일한 프로필 사진을 사용합니다."}
              </p>
            </section>
          </div>
        )}
      </div>
    </dialog>
  );
}

import { AlertTriangle, Check, X } from "lucide-react";

interface ConfirmModalProps {
  message: string;
  warning?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  message,
  warning,
  onConfirm,
  onCancel
}: ConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="확인"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-950/20">
        <div className="flex items-start gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 text-left">
            <p className="text-base font-bold leading-6 text-slate-900">
              {message}
            </p>
            {warning && (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm leading-5 text-red-600">
                {warning}
              </p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 bg-slate-50 px-6 py-4">
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300"
            onClick={onCancel}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            취소
          </button>
          <button
            type="button"
            className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md shadow-indigo-200 transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
            onClick={(event) => {
              event.stopPropagation();
              onConfirm();
            }}
          >
            <Check className="h-4 w-4" aria-hidden="true" />
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
//className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 flex items-center gap-1 shadow-md shadow-indigo-200"

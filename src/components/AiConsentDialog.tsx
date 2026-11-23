import React from "react";
import { ShieldAlert } from "lucide-react";

interface AiConsentDialogProps {
  open: boolean;
  purposeDescription: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const AiConsentDialog: React.FC<AiConsentDialogProps> = ({
  open,
  purposeDescription,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-50 p-2.5 text-teal-800 shrink-0">
            <ShieldAlert className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="ai-consent-title"
              className="text-lg font-bold text-slate-950"
            >
              Aviso de processamento externo com IA
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              {purposeDescription}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              O arquivo PDF completo permanece apenas no seu navegador. Apenas o
              trecho ou texto necessário para esta tarefa é enviado ao serviço de
              inteligência artificial, sem compartilhamento com terceiros para
              outros fins.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Manter apenas local
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="min-h-[44px] rounded-lg bg-teal-700 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-800 transition-colors"
          >
            Concordo, usar assistente
          </button>
        </div>
      </div>
    </div>
  );
};

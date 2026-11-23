import React, { useState } from "react";
import { CheckCircle2, HardDrive, Shield, Trash2 } from "lucide-react";

interface PrivacyViewProps {
  documentCount: number;
  aiConsentGiven: boolean;
  onToggleAiConsent: (value: boolean) => void;
  onDeleteAllData: () => void;
  onResetSettings: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({
  documentCount,
  aiConsentGiven,
  onToggleAiConsent,
  onDeleteAllData,
  onResetSettings,
}) => {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipedDone, setWipedDone] = useState(false);

  return (
    <main className="mx-auto max-w-[920px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-bold tracking-wider uppercase text-teal-700">
          Transparência e controle
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Segurança e Privacidade
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Seus documentos são pessoais. O Leitura Acessível foi projetado para priorizar
          o processamento local no seu computador ou celular e dar controle total
          sobre seus dados.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
              <HardDrive className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                O que acontece 100% no seu dispositivo
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 text-teal-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Leitura e extração do PDF:</strong> O arquivo PDF é
                    aberto diretamente no navegador e nunca é enviado para
                    servidores externos.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 text-teal-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>OCR Local para PDFs digitalizados:</strong> O
                    reconhecimento óptico de caracteres em português roda
                    localmente no seu navegador.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 text-teal-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Histórico e preferências:</strong> Seus documentos e
                    ajustes visuais ficam armazenados apenas no banco local do seu
                    navegador (IndexedDB e localStorage).
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Shield className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-slate-950">
                Quando ocorre processamento externo com IA
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Apenas quando você solicita explicitamente um{" "}
                <strong>resumo, explicação de palavra, simplificação, perguntas</strong>
                , <strong>OCR avançado com IA</strong> ou{" "}
                <strong>Voz Natural com IA</strong>, o trecho selecionado (ou imagem
                da página no OCR com IA) é enviado de forma segura ao serviço de
                inteligência artificial para gerar a resposta.
              </p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                Não compartilhamos seus documentos com terceiros e não mantemos
                banco de arquivos PDF no servidor.
              </p>

              <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-900">
                <input
                  type="checkbox"
                  checked={aiConsentGiven}
                  onChange={(e) => onToggleAiConsent(e.target.checked)}
                  className="h-4 w-4 accent-teal-700"
                />
                <span>
                  Autorizar uso dos recursos opcionais de IA neste navegador
                </span>
              </label>
            </div>
          </div>
        </section>

        <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
          <h2 className="text-lg font-bold text-slate-950">
            Controle e exclusão dos seus dados
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 tabular-nums">
            Atualmente há {documentCount} documento(s) armazenado(s) localmente
            neste navegador.
          </p>

          {wipedDone && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
              Todos os documentos e históricos locais foram removidos com sucesso.
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            {!confirmWipe ? (
              <button
                type="button"
                onClick={() => {
                  setWipedDone(false);
                  setConfirmWipe(true);
                }}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-semibold text-red-900 hover:bg-red-100 transition-colors"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Excluir todos os documentos e histórico</span>
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-4 py-2">
                <span className="text-sm font-semibold text-red-900">
                  Confirmar exclusão permanente?
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteAllData();
                    setConfirmWipe(false);
                    setWipedDone(true);
                  }}
                  className="min-h-[38px] rounded-md bg-red-700 px-3.5 text-xs font-semibold text-white hover:bg-red-800"
                >
                  Sim, excluir tudo
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmWipe(false)}
                  className="min-h-[38px] rounded-md bg-white px-3 text-xs font-medium text-slate-700"
                >
                  Cancelar
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={onResetSettings}
              className="min-h-[44px] rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Redefinir configurações visuais
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};

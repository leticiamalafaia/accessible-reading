import React, { useState } from "react";
import {
  CheckCircle2,
  HardDrive,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Shield,
  ShieldCheck,
  Trash2,
  UserCheck,
} from "lucide-react";
import { AuthUser } from "../types/reader";
import { changeAccountPassword } from "../lib/authClient";

interface PrivacyViewProps {
  currentUser: AuthUser | null;
  onUserUpdated: (user: AuthUser) => void;
  onLogout: (allSessions?: boolean) => void;
  documentCount: number;
  aiConsentGiven: boolean;
  onToggleAiConsent: (value: boolean) => void;
  onDeleteAllData: () => void;
  onResetSettings: () => void;
}

export const PrivacyView: React.FC<PrivacyViewProps> = ({
  currentUser,
  onUserUpdated,
  onLogout,
  documentCount,
  aiConsentGiven,
  onToggleAiConsent,
  onDeleteAllData,
  onResetSettings,
}) => {
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [wipedDone, setWipedDone] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (newPassword !== confirmNewPassword) {
      setPwError("A confirmação da nova senha não coincide.");
      return;
    }

    setPwLoading(true);
    try {
      const res = await changeAccountPassword({
        currentPassword,
        newPassword,
      });
      onUserUpdated(res.user);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setPwSuccess(res.message);
    } catch (err) {
      setPwError(
        err instanceof Error ? err.message : "Não foi possível alterar a senha."
      );
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <main className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 lg:py-10">
      <div className="border-b border-slate-200 pb-6">
        <p className="text-xs font-bold tracking-wider uppercase text-teal-700">
          Proteção de acesso e dados
        </p>
        <h1 className="font-display mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Segurança, Conta e Privacidade
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
          Gerencie seu login, atualize sua senha, encerre sessões ativas e
          controle totalmente o uso de IA e o armazenamento local dos seus PDFs.
        </p>
      </div>

      <div className="mt-8 space-y-6">
        {/* Account & Active Session */}
        {currentUser && (
          <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white">
                  <UserCheck className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Sua Conta e Sessão Atual
                  </h2>
                  <p className="mt-1 text-sm text-slate-700">
                    <strong>{currentUser.name}</strong> · {currentUser.email} ·{" "}
                    {currentUser.role === "admin"
                      ? "Administradora"
                      : "Leitor"}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Sessão autenticada em memória (token nunca armazenado em
                    localStorage)
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onLogout(false)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Sair desta sessão</span>
                </button>
                <button
                  type="button"
                  onClick={() => onLogout(true)}
                  className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3.5 text-xs font-semibold text-red-900 hover:bg-red-100 whitespace-nowrap"
                >
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Encerrar todas as sessões</span>
                </button>
              </div>
            </div>

            {/* Password update */}
            <div className="mt-5">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <KeyRound className="h-4 w-4 text-teal-700" aria-hidden="true" />
                <span>Alterar senha de acesso</span>
              </h3>

              {currentUser.managedByEnv ? (
                <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600">
                  A senha desta conta administradora é gerenciada pela variável
                  de ambiente segura <strong>ADMIN_PASSWORD</strong> no servidor.
                  Para alterá-la, atualize o segredo nas configurações do
                  ambiente.
                </p>
              ) : (
                <form
                  onSubmit={handlePasswordSubmit}
                  className="mt-3 space-y-3"
                >
                  {pwError && (
                    <div
                      role="alert"
                      className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-900"
                    >
                      {pwError}
                    </div>
                  )}
                  {pwSuccess && (
                    <div
                      role="status"
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs font-medium text-emerald-900"
                    >
                      {pwSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label
                        htmlFor="sec-current-pw"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Senha atual
                      </label>
                      <input
                        id="sec-current-pw"
                        type="password"
                        autoComplete="current-password"
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="sec-new-pw"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Nova senha
                      </label>
                      <input
                        id="sec-new-pw"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="8+ chars, letras e números"
                        className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="sec-confirm-pw"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Confirmar nova senha
                      </label>
                      <input
                        id="sec-confirm-pw"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        className="mt-1 min-h-[42px] w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={pwLoading}
                    className="inline-flex min-h-[42px] items-center gap-2 rounded-lg bg-teal-700 px-4 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
                  >
                    {pwLoading && (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    )}
                    <span>Atualizar senha e renovar sessão</span>
                  </button>
                </form>
              )}
            </div>
          </section>
        )}

        {/* Active Security Protections */}
        <section className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Proteções de segurança ativas
              </h2>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Senhas criptografadas no servidor:</strong> cada
                    senha é protegida com hash forte e sal exclusivo; nunca
                    guardamos senhas em texto aberto.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Bloqueio contra tentativas repetidas:</strong>{" "}
                    limitação automática de requisições e pausa temporária após
                    tentativas incorretas consecutivas.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 text-emerald-700 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    <strong>Rotas protegidas e validação de PDFs:</strong> todos
                    os recursos de IA exigem sessão válida verificada no
                    servidor, e arquivos enviados passam por verificação de
                    assinatura e tamanho antes da leitura.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

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
                    ajustes visuais ficam armazenados apenas no banco local do
                    seu navegador (IndexedDB e localStorage).
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
                <strong>
                  resumo, esquema visual, explicação de palavra, simplificação,
                  perguntas
                </strong>
                , <strong>OCR avançado com IA</strong> ou{" "}
                <strong>Voz Natural com IA</strong>, o trecho selecionado (ou
                imagem da página no OCR com IA) é enviado de forma autenticada
                para gerar a resposta.
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
            Controle e exclusão dos seus dados locais
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 tabular-nums">
            Atualmente há {documentCount} documento(s) armazenado(s) localmente
            neste navegador.
          </p>

          {wipedDone && (
            <div className="mt-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm font-medium text-teal-900">
              Todos os documentos e históricos locais foram removidos com
              sucesso.
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

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  User,
  UserPlus,
} from "lucide-react";
import { AuthStatusResponse, AuthUser } from "../types/reader";
import {
  loginWithPassword,
  registerAccount,
  setupAdminAccount,
} from "../lib/authClient";
import calmDeskImg from "../assets/images/calm_reading_desk_1794575615148.jpg";

interface AuthGateViewProps {
  authStatus: AuthStatusResponse;
  onAuthenticated: (user: AuthUser) => void;
}

type AuthMode = "setup" | "login" | "register";

function evaluatePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3;
  label: string;
  barClass: string;
  textClass: string;
} {
  if (!password) {
    return {
      score: 0,
      label: "Mínimo 8 caracteres com letras e números",
      barClass: "bg-slate-200",
      textClass: "text-slate-500",
    };
  }
  const hasMinLen = password.length >= 8;
  const hasLongLen = password.length >= 12;
  const hasLetter = /\p{L}/u.test(password);
  const hasNumber = /\d/.test(password);
  const hasSymbolOrUpper =
    /[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(password) || /[^A-Za-z0-9\s]/.test(password);

  if (hasMinLen && hasLetter && hasNumber && (hasLongLen || hasSymbolOrUpper)) {
    return {
      score: 3,
      label: "Senha forte",
      barClass: "bg-emerald-600",
      textClass: "text-emerald-800",
    };
  }
  if (hasMinLen && hasLetter && hasNumber) {
    return {
      score: 2,
      label: "Senha adequada",
      barClass: "bg-teal-600",
      textClass: "text-teal-800",
    };
  }
  return {
    score: 1,
    label: "Use ao menos 8 caracteres com letras e números",
    barClass: "bg-amber-500",
    textClass: "text-amber-800",
  };
}

export const AuthGateView: React.FC<AuthGateViewProps> = ({
  authStatus,
  onAuthenticated,
}) => {
  const [mode, setMode] = useState<AuthMode>(
    authStatus.needsAdminSetup ? "setup" : "login"
  );
  const [name, setName] = useState(
    authStatus.needsAdminSetup ? "Leticia" : ""
  );
  const [email, setEmail] = useState(authStatus.ownerEmail || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (authStatus.needsAdminSetup) {
      setMode("setup");
      setEmail(authStatus.ownerEmail);
      setName("Leticia");
    }
  }, [authStatus.needsAdminSetup, authStatus.ownerEmail]);

  const strength = useMemo(
    () => evaluatePasswordStrength(password),
    [password]
  );

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setPassword("");
    setConfirmPassword("");
    if (nextMode === "setup") {
      setEmail(authStatus.ownerEmail);
      setName("Leticia");
    } else if (nextMode === "login") {
      setEmail((prev) => prev || authStatus.ownerEmail);
    } else if (nextMode === "register") {
      if (email === authStatus.ownerEmail) setEmail("");
      setName("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (mode === "setup") {
      if (password !== confirmPassword) {
        setErrorMessage("As senhas digitadas não coincidem.");
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await setupAdminAccount({
          name: name.trim() || "Leticia",
          password,
        });
        onAuthenticated(result.user);
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : "Não foi possível ativar sua conta."
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "register") {
      if (password !== confirmPassword) {
        setErrorMessage("As senhas digitadas não coincidem.");
        return;
      }
      setIsSubmitting(true);
      try {
        const result = await registerAccount({
          name: name.trim(),
          email: email.trim(),
          password,
        });
        onAuthenticated(result.user);
      } catch (err) {
        setErrorMessage(
          err instanceof Error ? err.message : "Não foi possível criar a conta."
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await loginWithPassword({
        email: email.trim(),
        password,
      });
      onAuthenticated(result.user);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "E-mail ou senha inválidos."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top_right,rgba(13,148,136,0.10),transparent_52%),radial-gradient(ellipse_at_bottom_left,rgba(37,99,235,0.06),transparent_48%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1180px] flex-col justify-center px-4 py-8 sm:px-6 lg:py-12">
        <div className="grid grid-cols-1 items-stretch gap-8 lg:grid-cols-12 lg:gap-10">
          {/* Left Editorial Column */}
          <div className="flex flex-col justify-between gap-6 lg:col-span-6">
            <div>
              <p className="font-display text-xl font-bold tracking-tight text-slate-950">
                Leitura <span className="text-teal-700">Acessível</span>
              </p>
              <h1
                className="font-display mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:leading-[1.15]"
                style={{ textWrap: "balance" }}
              >
                Seu espaço seguro e calmo para ler qualquer PDF no seu ritmo
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-600 sm:text-base">
                Acesse sua biblioteca local, narração sincronizada em voz alta,
                fontes para dislexia, marcações por cores e leitura assistida
                com autenticação protegida.
              </p>
            </div>

            <div className="relative hidden min-h-[250px] flex-1 overflow-hidden rounded-2xl bg-slate-900 shadow-[0_20px_48px_-16px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/10 lg:flex lg:flex-col lg:justify-end">
              <img
                src={calmDeskImg}
                alt="Mesa tranquila iluminada com livro aberto em ambiente acolhedor"
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent"
              />
              <div className="relative z-10 p-6 text-white">
                <p className="font-display text-lg font-semibold leading-snug">
                  Proteção em cada etapa da leitura
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
                  Senhas criptografadas no servidor · Sessão segura em memória ·
                  PDFs processados localmente
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 border-t border-slate-200/90 pt-5 sm:grid-cols-3">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Criptografia forte
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Senhas protegidas com hash criptográfico e proteção contra
                  tentativas repetidas.
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Sessão em memória
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Seu token de acesso nunca é gravado em armazenamento exposto
                  do navegador.
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Privacidade local
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                  Seus PDFs e anotações ficam no seu aparelho; IA só roda se
                  você autorizar.
                </p>
              </div>
            </div>
          </div>

          {/* Right Auth Form Column */}
          <div className="flex flex-col justify-center lg:col-span-6">
            <div className="studio-card rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8">
              {/* Mode selector */}
              {authStatus.needsAdminSetup ? (
                <div className="mb-6 border-b border-slate-200 pb-5">
                  <div className="flex items-center gap-2.5 text-teal-800">
                    <ShieldCheck className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <p className="text-xs font-bold tracking-wider uppercase">
                      Primeiro acesso · Conta da proprietária
                    </p>
                  </div>
                  <h2 className="font-display mt-2 text-2xl font-bold text-slate-950">
                    Ative seu acesso de Administradora
                  </h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                    Sua conta pessoal (
                    <strong className="font-semibold text-slate-900">
                      {authStatus.ownerEmail}
                    </strong>
                    ) já está pré-reservada. Escolha uma senha forte abaixo para
                    ativar e entrar imediatamente.
                  </p>
                </div>
              ) : (
                <div className="mb-6">
                  <div
                    role="tablist"
                    aria-label="Modo de autenticação"
                    className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "login"}
                      onClick={() => switchMode("login")}
                      className={`min-h-[42px] rounded-lg px-3 text-sm font-semibold transition-all whitespace-nowrap ${
                        mode === "login"
                          ? "bg-white text-slate-950 shadow-xs"
                          : "text-slate-600 hover:text-slate-950"
                      }`}
                    >
                      Entrar
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={mode === "register"}
                      onClick={() => switchMode("register")}
                      className={`min-h-[42px] rounded-lg px-3 text-sm font-semibold transition-all whitespace-nowrap ${
                        mode === "register"
                          ? "bg-white text-slate-950 shadow-xs"
                          : "text-slate-600 hover:text-slate-950"
                      }`}
                    >
                      Criar conta
                    </button>
                  </div>

                  <h2 className="font-display mt-5 text-2xl font-bold text-slate-950">
                    {mode === "login"
                      ? "Entrar no Leitura Acessível"
                      : "Criar uma nova conta"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {mode === "login"
                      ? "Informe seu e-mail e senha para acessar seu ambiente de leitura."
                      : "Cadastre-se com seu e-mail e uma senha segura para começar."}
                  </p>
                </div>
              )}

              {errorMessage && (
                <div
                  role="alert"
                  className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-900"
                >
                  {errorMessage}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {(mode === "setup" || mode === "register") && (
                  <div>
                    <label
                      htmlFor="auth-name"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Seu nome
                    </label>
                    <div className="relative mt-1.5">
                      <User
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="auth-name"
                        type="text"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={80}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Como você prefere ser chamada"
                        className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label
                    htmlFor="auth-email"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    E-mail de acesso
                  </label>
                  <div className="relative mt-1.5">
                    <Mail
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-email"
                      type="email"
                      autoComplete="email"
                      required
                      readOnly={mode === "setup"}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="voce@exemplo.com"
                      className={`min-h-[46px] w-full rounded-xl border pl-10 pr-4 text-sm focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20 ${
                        mode === "setup"
                          ? "border-teal-200 bg-teal-50/50 font-semibold text-teal-950"
                          : "border-slate-300 bg-white text-slate-950 placeholder:text-slate-400"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="auth-password"
                    className="block text-sm font-semibold text-slate-800"
                  >
                    {mode === "setup"
                      ? "Defina sua senha de acesso"
                      : "Senha"}
                  </label>
                  <div className="relative mt-1.5">
                    <Lock
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="auth-password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        mode === "login" ? "current-password" : "new-password"
                      }
                      required
                      minLength={mode === "login" ? 1 : 8}
                      maxLength={128}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={
                        mode === "login"
                          ? "Digite sua senha"
                          : "Mínimo 8 caracteres (letras e números)"
                      }
                      className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-12 text-sm text-slate-950 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {(mode === "setup" || mode === "register") && (
                    <div className="mt-2">
                      <div className="grid grid-cols-3 gap-1.5">
                        {[1, 2, 3].map((level) => (
                          <div
                            key={level}
                            className={`h-1.5 rounded-full transition-colors ${
                              strength.score >= level
                                ? strength.barClass
                                : "bg-slate-200"
                            }`}
                          />
                        ))}
                      </div>
                      <p className={`mt-1 text-xs font-medium ${strength.textClass}`}>
                        {strength.label}
                      </p>
                    </div>
                  )}
                </div>

                {(mode === "setup" || mode === "register") && (
                  <div>
                    <label
                      htmlFor="auth-confirm-password"
                      className="block text-sm font-semibold text-slate-800"
                    >
                      Confirmar senha
                    </label>
                    <div className="relative mt-1.5">
                      <KeyRound
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                        aria-hidden="true"
                      />
                      <input
                        id="auth-confirm-password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita a senha escolhida"
                        className="min-h-[46px] w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm text-slate-950 placeholder:text-slate-400 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-600/20"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="mt-2 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:from-teal-700 hover:to-emerald-700 transition-all disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Verificando acesso...</span>
                    </>
                  ) : mode === "setup" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      <span>Ativar minha conta e entrar</span>
                    </>
                  ) : mode === "register" ? (
                    <>
                      <UserPlus className="h-4 w-4" aria-hidden="true" />
                      <span>Criar conta e entrar</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" aria-hidden="true" />
                      <span>Entrar no estúdio</span>
                    </>
                  )}
                </button>
              </form>

              {authStatus.needsAdminSetup && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-4 text-xs text-slate-600">
                  <span>Deseja cadastrar outro e-mail?</span>
                  <button
                    type="button"
                    onClick={() =>
                      switchMode(mode === "setup" ? "register" : "setup")
                    }
                    className="font-semibold text-teal-800 hover:underline"
                  >
                    {mode === "setup"
                      ? "Criar outra conta"
                      : "Voltar para ativação principal"}
                  </button>
                </div>
              )}

              {!authStatus.needsAdminSetup && mode === "login" && (
                <p className="mt-5 border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500">
                  Acesso protegido contra tentativas excessivas. Seus documentos
                  e marcações continuam salvos localmente neste navegador.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

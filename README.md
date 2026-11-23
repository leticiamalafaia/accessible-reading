# Leitura Acessível

Leitor de PDFs focado em acessibilidade cognitiva e visual para pessoas com **dislexia, TDAH e dificuldades de leitura**. Combina tipografia especializada, lentes coloridas suaves, narração em voz alta com destaque sincronizado, marcações coloridas com significados de estudo e apoio opcional de compreensão por IA.

## Principais Recursos

- **Leitura de PDFs e OCR integrado:** extrai texto de PDFs comuns e detecta páginas digitalizadas, oferecendo **OCR local (Tesseract.js)** ou **OCR assistido por IA**.
- **Conforto Visual e Estratégias para Dislexia:**
  - Fontes acessíveis: *OpenDyslexic*, *Lexend*, *Atkinson Hyperlegible*, *IBM Plex Mono (monoespaçada)*, *Plus Jakarta Sans* e *Lora*.
  - Ajustes finos de tamanho da fonte, entrelinha, espaçamento entre letras/palavras, largura da coluna e contraste.
  - Temas suaves (*Papel Suave*, *Creme Dislexia*, *Sálvia Calma*, *Azul Sereno*, *Noturno Suave*, *Alto Contraste* e personalizado) + **Lente colorida translúcida** (*Âmbar*, *Verde-Menta*, *Azul Calmo*, *Rosa Suave*).
  - Modos de visualização (**Por página**, **Por bloco** e **Tudo**), **Régua de Leitura**, **Modo Foco** e **metas por etapa (5, 8 ou 12 blocos)** com lembrete de pausa.
- **Narração em Voz Alta (TTS):**
  - Destaque sincronizado frase a frase e palavra por palavra, com controle de velocidade (`0.6x`–`2.0x`) e ritmo (*Calmo*, *Animado*, *Sério*, *Divertido*, *Pausado*).
  - **Vozes gratuitas e sem limite** do Google/navegador e do sistema, com **8 perfis de timbre** e ajuste fino de tom.
  - **30 Vozes Naturais Gemini** (opcional) com alternância automática para voz local caso a cota da API seja atingida.
- **Marcações, Ponto de Parada e Biblioteca Local:**
  - Botão **Marcar onde parei** para retomar exatamente do bloco salvo.
  - Marca-texto em **5 cores com significados de estudo** (*Amarelo: Essencial*, *Verde: Entendi*, *Azul: Exemplo*, *Rosa: Dúvida ?*, *Roxo: Conceito*).
  - Armazenamento 100% local via IndexedDB e `localStorage` (documentos, progresso, marcações e anotações salvas).
- **Leitura Assistida com IA (Opcional e com Consentimento):**
  - Resumo simples do documento, **Esquema visual / Mapa de ideias**, resumo estruturado para anotações, simplificação de trechos, dicionário acessível, perguntas sugeridas e Q&A contextual.
- **Acesso Protegido e Segurança:**
  - Tela de autenticação com e-mail e senha, ativação segura de primeiro acesso para a conta administradora, criptografia de senhas com `scrypt` + sal único por conta, tokens assinados mantidos apenas em memória e revogação de sessões.
  - Cabeçalhos de segurança HTTP, limite de requisições por janela, bloqueio temporário contra tentativas repetidas de login, validação de assinatura binária (`%PDF-`) e tamanho de arquivos, e proteção de todas as rotas `/api/ai/*`.

## Tecnologias

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, Lucide React
- **PDF & OCR:** `pdfjs-dist`, `tesseract.js`
- **Backend:** Node.js, Express, `tsx`, `@google/genai`

## Estrutura do Projeto

```text
├── server.ts                 # Servidor Express + rotas /api/ai/* + middleware Vite
├── serverAuth.ts             # Autenticação, hashing scrypt, sessões, rate limit e cabeçalhos
├── index.html                # Entrada HTML e fontes acessíveis
├── src/
│   ├── App.tsx               # Estado principal, controle de acesso, abas e consentimento
│   ├── components/           # Interface de login, leitor, controles de voz, sumário e IA
│   ├── hooks/                # Hook de narração sincronizada (useSpeechReader)
│   ├── lib/                  # Cliente de auth, processador de PDF/OCR, IndexedDB e API
│   └── types/                # Tipagens TypeScript do domínio
├── .env.example              # Modelo de variáveis de ambiente
└── package.json
```

## Como Executar Localmente

### Pré-requisitos

- Node.js 20+
- npm (ou bun)

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie `.env.example` para `.env` e preencha sua chave da API Gemini (necessária apenas para os recursos opcionais de Leitura Assistida, OCR com IA e Vozes Naturais IA). Opcionalmente, defina `ADMIN_EMAIL` e `ADMIN_PASSWORD` para gerenciar a conta principal por ambiente:

```bash
cp .env.example .env
```

```env
GEMINI_API_KEY="sua-chave-aqui"
ADMIN_EMAIL=""
ADMIN_PASSWORD=""
```

### 3. Iniciar em modo desenvolvimento

```bash
npm run dev
```

A aplicação estará disponível em `http://localhost:3000`.

### Scripts Disponíveis

- `npm run dev` — inicia o servidor Express + Vite em modo desenvolvimento na porta `3000`
- `npm run build` — gera o build de produção do frontend em `dist/`
- `npm run lint` — executa checagem de tipos TypeScript (`tsc --noEmit`)
- `npm run start` — inicia o servidor de produção (`NODE_ENV=production`)

## Segurança e Privacidade

Os arquivos PDF, histórico de leitura, marcações coloridas e anotações ficam armazenados apenas no navegador do usuário. As senhas de acesso são protegidas no servidor com hash `scrypt` e sal exclusivo (nunca armazenadas em texto puro), os tokens de sessão permanecem somente na memória da aba e os recursos de IA exigem autenticação e consentimento explícito.

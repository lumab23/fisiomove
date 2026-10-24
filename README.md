# FisioMove

Projeto acadêmico de TCC voltado ao apoio à execução de exercícios fisioterapêuticos por meio de tecnologias como visão computacional, feedback e gamificação.

**Status:** em desenvolvimento.

> O backend B01–B09 está implementado tecnicamente. O catálogo de produção
> permanece vazio até a aprovação clínica explícita do primeiro exercício; o
> produto e o mobile continuam em desenvolvimento.

## Stack planejada

- Mobile: React Native e TypeScript
- Backend: Python, FastAPI e Uvicorn
- Qualidade: ESLint, Prettier, Ruff e pytest
- Visão computacional: processamento preferencialmente no dispositivo móvel (implementação futura)

## Estrutura do repositório

```text
FisioMove/
├── mobile/       # aplicação React Native
├── backend/      # API FastAPI
│   ├── app/
│   └── tests/
├── docs/         # documentação do projeto
├── AGENTS.md
└── README.md
```

## Pré-requisitos

- Node.js 22.13 ou mais recente compatível com React Native 0.87
- npm
- Python 3.12 ou mais recente
- Para Android: Android Studio, Android SDK e JDK compatível
- Para iOS (somente macOS): Xcode e CocoaPods

Consulte também a documentação oficial de configuração de ambiente do React Native para as variáveis e SDKs de cada plataforma.

## Mobile

Instale as dependências:

```bash
cd mobile
npm install
```

Inicie o Metro:

```bash
npm start
```

Em outro terminal, execute uma plataforma:

```bash
npm run android
# ou, no macOS, após instalar os pods:
cd ios && bundle install && bundle exec pod install && cd ..
npm run ios
```

Validações do mobile:

```bash
npm run lint
npm run type-check
npm test
npm run format:check
```

## Backend

As instruções completas da fundação do backend estão em [`backend/README.md`](backend/README.md).

Prepare o ambiente local:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e '.[dev]'
cp .env.example .env
```

Configure `DATABASE_URL` no `.env` com uma instância PostgreSQL local e aplique as migrações:

```bash
alembic upgrade head
```

Execute a API:

```bash
uvicorn app.main:app --reload
```

O endpoint técnico de verificação estará em `GET http://127.0.0.1:8000/health`.

Execute lint e testes:

```bash
ruff check .
ruff format --check .
pytest
```

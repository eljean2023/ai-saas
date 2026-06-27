# 🚀 AI Portfolio MasterKit — Production AI SaaS Boilerplate

A multi-tenant, production-grade Software-as-a-Service (SaaS) architecture engineered with **Next.js (App Router)**, **Prisma ORM**, and **PostgreSQL (Neon Cloud Data)**. 

This system enforces strict layer isolation, enterprise-level authentication, secure Role-Based Access Control (RBAC), and a dynamic server-side Multi-Agent AI runtime pipeline.

---

## 🛠️ Core Technology Stack
- **Frontend Framework:** Next.js 14/15 (App Router, Server Actions, Client-Side Streaming Elements)
- **Styling Architecture:** Tailwind CSS (Corporate Deep Steel Blue & Cyber Emerald Production Theme)
- **Database Engine & Access Layer:** Prisma ORM communicating with an elastic cloud **PostgreSQL** instance on **Neon.tech**
- **Security Matrix:** Json Web Tokens (JWT), Cryptographic password hashing, and secure `HttpOnly` browser state cookies
- **Asynchronous Testing Infrastructure:** Jest and React Testing Library

---

## 🧠 Architectural Design & Structural Flow

The codebase strictly decouples system responsibilities under a highly maintainable, enterprise-standard pattern:

```text
[ Browser / UI App ] ──(Secure Cookies)──> [ Next.js API Middleware Router ]
                                                       │
                                        (Validates Permissions/RBAC Matrix)
                                                       │
                                                       ▼
[ Prisma Client Layer ] <── [ Repositories ] <── [ Services / Multi-Agent Engine ]
```

1. **Presentation Layer (`/app`):** Driven by Next.js Server and Client components, fully styled using atomic components under `/components/ui/` and interactive monitoring layouts under `/components/admin/`.
2. **Business Logic Layer (`/services/`):** Contains the underlying software logic (`UserService`, `AIService`) completely disconnected from the raw data access layers.
3. **Multi-Agent Subsystem (`/services/agents/`):**
   - `OrchestratorAgent`: Intercepts client prompts, analyzes search intent, and handles execution pipeline delegating to specialized micro-agents.
   - `RagContextAgent`: Optimizes prompt vectors by retrieving historical records and context boundaries from the database.
   - `AnalyticsAgent`: Translates natural language questions into safe, parameterized Prisma query schemas.
4. **Data Access Layer (`/repositories/`):** Centralizes queries to the database (`UserRepository.ts`, `PostRepository.ts`), ensuring zero duplicate logic and preventing SQL injections.

---

## 🔐 Enterprise Security & Permission Boundaries (RBAC)

Authentication credentials are verified using encrypted hashes. Access paths are strictly governed by an automated session router matching three core permission structures:

| User Role | Dashboard Permissions | Content Management (CMS) | User Registry Powers |
| :--- | :--- | :--- | :--- |
| **`USER`** | Read-Only (Graphs Only) | Read-Only | Denied (Hidden Controls) |
| **`ADMIN`** | Read & Write Actions | Create, Edit, Publish Blog | Denied (Cannot alter Users) |
| **`SUPER_ADMIN`** | Full System Privilege | Full System Privilege | **Granted (Exclusive Account Creation Form)** |

---

## 📡 Cloud Telemetry & Connection Logs (E57P01)

While running the local development server, you may occasionally observe a `SqlState(E57P01)` database log trace flashing inside the terminal environment when the serverless compute layers wake up from their sleep cycles.

The backend architecture implements a robust database retry mechanism wrapper. If any Prisma query catches a connection failure, it halts the crash, waits 1000ms for Neon to fully wake up, and automatically retries the execution up to 3 times before failing, maintaining 100% console resilience.

---

## 💻 Quick Start & Database Initialization

### 1. Environmental Variables
Setup your local `.env` configuration file in the system root (this file is ignored by Git for security):
```env
DATABASE_URL="postgresql://username:password@ep-cool-pool.neon.tech/ai_saas_db?sslmode=require"
JWT_SECRET="YOUR_LONG_32_CHAR_SECRET_SIGNING_KEY"
ANTHROPIC_API_KEY="sk-ant-..."
```

### 2. Dependency Resolution & Schema Deployment
```bash
# Install required Node system packages
npm install

# Push relational schemas directly to your Neon Cloud Database
npx prisma migrate dev --name init

# Automatically seed the database with the testing accounts
npx ts-node prisma/seed.ts
```

### 3. Execution
```bash
# Boot local server environment
npm run dev
```
Open **`http://localhost:3000`** to review marketing elements, or login with your seeded credentials to enter **`http://localhost:3000/admin/dashboard`**.

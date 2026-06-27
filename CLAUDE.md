# CLAUDE.md — Production AI SaaS Rules

Este proyecto es un sistema SaaS en producción. NO es un proyecto de demo.

## ⚠️ REGLAS ABSOLUTAS
- Nunca generar código sin arquitectura clara
- Nunca duplicar lógica
- Nunca usar "any"
- Siempre separar capas: UI, Services, Repository, API
- Todo feature debe ser modular

## 🧱 ARQUITECTURA
Frontend: Next.js (App Router), TailwindCSS
Backend: Next.js API routes, Prisma ORM, PostgreSQL
Auth: JWT, Refresh tokens, HttpOnly cookies

## 👑 ADMIN MODE (CRÍTICO)
Admin system debe incluir:
- RBAC (user, admin, super_admin)
- Admin routes: /admin/dashboard, /admin/users, /admin/content, /admin/analytics, /admin/ai-monitor

## 🗄️ MODELOS DE BASE DE DATOS (PRISMA)
- **User**: id (String, PK), email (String, Unique), passwordHash (String), role (Enum: USER, ADMIN, SUPER_ADMIN), status (Enum: ACTIVE, BANNED), createdAt, updatedAt, deletedAt (DateTime, nullable).
- **Session**: id, userId (FK), refreshToken (String), expiresAt, isValid (Boolean).
- **BlogPost**: id, title (String), slug (String, Unique), content (Text), status (Enum: DRAFT, PUBLISHED), authorId (FK a User).
- **AILog**: id, userId (FK), prompt (Text), response (Text), tokensUsed (Int), endpoint (String).
- **SystemMetric**: id, cpuUsage (Float), memoryUsage (Float), activeUsers (Int).

## 📂 ESTRUCTURA REQUERIDA (/app)
/app
  ├── admin/ (dashboard, users, content, analytics, ai-monitor)
  ├── api/ (auth, admin, ai)
  ├── components/ (ui, admin)
  ├── services/ (UserService, AIService)
  └── repositories/ (UserRepository, PostRepository)


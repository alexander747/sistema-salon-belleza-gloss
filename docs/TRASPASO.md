# Traspaso del proyecto — POS salón (Gloss)

> Documento para retomar el proyecto en **otra PC** (con opencode + gentle-ai).
> Fecha de este traspaso: **2026-10-02**.
> Este archivo + `AGENTS.md` + `openspec/` + `docs/engram/` son la fuente de verdad.
> La memoria de Engram es **local** y NO viaja en el repo → se restaura importando `docs/engram/`.

---

## 0. TL;DR (lo mínimo para arrancar)

- **Repo**: https://github.com/alexander747/sistema-salon-belleza-gloss (rama `main`).
- **Producción**: https://uniongloss.com — VPS `ubuntu@51.161.113.43`, rama `produccion`.
- **Último deploy**: commit **`f3791b0`** (main y produccion).
- **Memoria de la IA**: importar `docs/engram/sistema-salon-belleza-gloss.json` con `engram import`.
- **NO está en el repo** (copiar a mano o regenerar): `apps/api/.env`, datos locales de MySQL, config global de opencode/gentle-ai/codegraph.

---

## 1. Qué es el proyecto

Monorepo de un **SaaS de gestión para salón de belleza** ("Gloss"). Backend hexagonal (Clean Architecture) en Express + TypeORM, y dos frontends React + Vite (dashboard de la dueña y superadmin).

```
apps/
  api/               Express + TypeORM + tsyringe (hexagonal: modules/{domain,application,infrastructure,presentation})
  pos-dashboard/     React + Vite + MUI + framer-motion (dashboard del salón)
  superadmin/        React + Vite (admin cross-tenant)
packages/
  types/             Interfaces TS compartidas
  validation/        Schemas Zod (¡se importa desde dist/, no de .ts!)
  ui/                Componentes React compartidos
  config/            Config compartida
```

### Puertos
| Servicio | Local | Producción |
|---|---|---|
| API | 3001 | interno (nginx) |
| Dashboard | 5174 | https://uniongloss.com |
| Superadmin | 5173 | https://admin.uniongloss.com |
| MySQL | **3307** | interno |
| n8n | 5678 | https://n8n.uniongloss.com |

### Credenciales de prueba (seed local)
- Dashboard: `duena@test.com` / `duena123`
- Superadmin: `eder@gmail.com` / `Eder123`

---

## 2. Puesta en marcha en la PC nueva (paso a paso)

```bash
# 1. Clonar
git clone https://github.com/alexander747/sistema-salon-belleza-gloss.git
cd sistema-salon-belleza-gloss

# 2. Node (v22 LTS instalada; .nvmrc dice 20 pero usar 22)
nvm use 22

# 3. Levantar MySQL (3307) y n8n (5678)
docker compose up -d

# 4. Crear el .env de la API (ver sección 3) y sembrar la base
cd apps/api && npx tsx src/infrastructure/persistence/seed.ts

# 5. Levantar los servicios
bash start.sh          # o cada uno manual:
# API:        cd apps/api && npx tsx src/server.ts
# Dashboard:  cd apps/pos-dashboard && npx vite --port 5174 --host
# Superadmin: cd apps/superadmin && npx vite --port 5173 --host
```

### Tests
```bash
cd apps/api && npx vitest run && npx tsc --noEmit
cd apps/pos-dashboard && npx vitest run && npx tsc --noEmit
```
> **Baseline de fallas pre-existentes (no son regresiones):**
> - API: 5 fallas date-dependent en `NominaPendienteUseCase.test.ts`; `tsc` con 1 error pre-existente en `seed.ts`.
> - Dashboard: fallas en `mobileBottomSheet.test.ts` y a veces `FinanzasPage`/`AgendaPage` (flakes por fecha/paralelo).

---

## 3. Qué NO viaja en el repo (copiar/crear a mano)

| Cosa | Qué es | Cómo |
|---|---|---|
| `apps/api/.env` | Credenciales de la BD local y flags | Copiar desde la PC vieja (o `/tmp`), o basarse en `apps/api/.env.example`. Claves: `DB_HOST=localhost`, `DB_PORT=3307`, `DB_USERNAME=posfinal`, `DB_PASSWORD`, `DB_DATABASE=salon_saas`, `DB_SYNCHRONIZE=true` |
| `.env` raíz (opcional) | `MYSQL_ROOT_PASSWORD`, `MYSQL_PASSWORD` para Docker | Si no está, Docker usa defaults (`posfinal123` / `posfinal`) |
| Datos de MySQL local | La base de datos | Regenerar con el seed, o cargar un dump (ver sección 6) |
| Config global de opencode | Agentes `gentle-orchestrator`, `sdd-*`, skills, MCPs | `~/.config/opencode/` — la PC nueva tiene gentle-ai, debería traerlo |
| Config de codegraph | Entrada MCP en opencode | Ver sección 8 |
| Índice de codegraph | `.codegraph/` (28 MB, gitignored) | Correr `codegraph init` |

---

## 4. Memoria de la IA (Engram) — restaurar

Engram guarda el historial de decisiones/bugs/contexto y es **local** (SQLite). No viaja por git. Para restaurarlo en la PC nueva:

```bash
# desde la raíz del repo
engram import docs/engram/sistema-salon-belleza-gloss.json
```

- El proyecto se llama **`sistema-salon-belleza-gloss`** (se detecta del remoto de git). Como vas a clonar el mismo repo, coincide solo.
- El export contiene **52 sesiones, 870 observaciones y 1446 prompts** de este proyecto únicamente.
- Verificar con: `engram search "deploy"` o `engram search "tipoPrecio"`.
- Si el MCP de Engram no aparece en opencode, revisá `~/.config/opencode/opencode.jsonc` (bloque `mcp.engram`).

---

## 5. Sistema SDD (gentle-ai) — cómo está configurado

El proyecto usa **Spec-Driven Development** con gentle-ai:
- **`openspec/config.yaml`** — config de OpenSpec (incluye `strict_tdd: true`).
- **`openspec/specs/`** — specs vigentes por dominio (24 dominios).
- **`openspec/changes/<cambio>/`** — cambios SDD (proposal / specs / design / tasks / verify-report).
- **`.atl/skill-registry.md`** — registro de skills del proyecto.

**En la PC nueva**:
1. Correr `/sdd-init` (detecta stack, testing capabilities, activa Strict TDD).
2. El **preflight** que venimos usando: `A2` (auto) · `B3` (OpenSpec + Engram) · `C4` (auto-forecast) · `D2` (budget 800 líneas).

**Topic keys de Engram** (convención):
`sdd-init/{project}`, `sdd/{change}/explore|proposal|spec|design|tasks|apply-progress|verify-report|archive-report`.

> `openspec/` **sí está en git**, así que los specs y cambios viajan solos. Engram es el complemento.

---

## 6. Infraestructura y deploy

### Deploy (automático)
```
push/merge a rama `produccion`  →  GitHub Actions  →  SSH a la VPS  →  git pull + docker compose -f docker-compose.prod.yml up -d --build
```
**Los cambios en `main` NO despliegan** — solo `produccion`. El workflow está en `.github/workflows/deploy.yml`.

Flujo típico:
```bash
git checkout main && git pull
git checkout produccion && git merge main && git push origin produccion
```

### VPS
- `ssh ubuntu@51.161.113.43` (clave SSH ya autorizada, sin password)
- Código en `~/sistema-salon-belleza-gloss`; contenedores `posfinal-api`, `posfinal-dashboard`, `posfinal-mysql`, `posfinal-caddy`, `posfinal-n8n`, `posfinal-superadmin`.
- phpMyAdmin solo por túnel SSH: `ssh -L 8082:localhost:8082 ubuntu@51.161.113.43`

### Backup de la BD de producción
```bash
ssh ubuntu@51.161.113.43 "docker exec posfinal-mysql bash -c 'mysqldump -u root -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction --routines --triggers --databases salon_saas'" > backup_$(date +%Y%m%d).sql
```

### Cargar un dump en local
```bash
docker exec posfinal-mysql mysql -u root -pposfinal123 -e "DROP DATABASE IF EXISTS salon_saas; CREATE DATABASE salon_saas CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
docker exec -i posfinal-mysql mysql -u root -pposfinal123 salon_saas < backup.sql
docker restart posfinal-api
```

> **`gh` CLI local está roto → usar `git` + `ssh` directo.**

---

## 7. Estado actual (dónde quedamos) — 2026-10-02

### Desplegado en producción (`f3791b0`)
1. **`insumo-por-gramo-y-cantidad-servicios`** (PR1–PR6) — costo de insumo por gramo configurable + cantidad de servicios.
2. **`insumos-en-resumen-reportes-nomina`** (PR1–PR6) — gating por rol de insumos/comisiones; reportes solo para roles privilegiados; tarjeta "Entró a caja"/"Ventas del día" + **tira de reconciliación** con `TU CAJA REAL = Entró a caja − Propinas`; nuevo campo `cobrosDeudaAnterior`.
3. **`permisos-rol-empleados-finanzas`** — Manicurista/Recepcionista NO ven Dashboard/Empleados/Productos/Categorías/Préstamos/Horarios; en Finanzas solo **Registros**; caen en Finanzas. Backend 403 en gastos/devoluciones/caja para esos roles.
4. **`fix-restock-precio-configurado`** — se persistió el modo de precio del producto **`tipoPrecio` (FIJO | MARGEN)**; el re-stock ahora lo respeta (no pisa el precio fijo). Backfill en prod: **178 productos → FIJO, 25 → MARGEN**.
5. **`citas-hora-am-pm`** — los horarios de "Nueva cita" se muestran en 12h (AM/PM); el valor enviado sigue 24h.
6. **`productos-acciones-y-reporte-excel`** — acciones de la tabla en menú "⋮" (responsive, sin scroll en celular/tablet); **reporte Excel de productos** (2 hojas) con botón gated a roles privilegiados.

### Pendientes / próximos pasos
- **`sdd-archive`** de los cambios ya desplegados (sincronizar specs delta a `openspec/specs/`). Falta para: `insumos-en-resumen-reportes-nomina`, `permisos-rol-empleados-finanzas`, `fix-restock-precio-configurado`, `citas-hora-am-pm`, `productos-acciones-y-reporte-excel`.
- Rama **`feat/nomina-config-vigencias`** intacta, **sin desplegar** (revisar qué contiene).
- Mejoras menores surgidas: etiquetas viejas (`Cobrado`/`TOTAL INGRESOS`) siguen en Reportes P&L y ROI; unificar con el nuevo naming.
- Warning aceptado: el backfill de `tipoPrecio` podría re-clasificar como FIJO a un producto futuro de MARGEN con costo 0 y precio fijo.

### Worktrees temporales (en la PC vieja, no en el repo)
Se usaron worktrees en `/home/hellhammer/Escritorio/proyectos/pos-final-wt/` para paralelizar. En la PC nueva no hacen falta.

---

## 8. codegraph (índice de código para la IA)

Instalado como MCP local de opencode:
```bash
npm i -g @colbymchenry/codegraph    # o: curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh
cd <repo> && codegraph init          # construye .codegraph/ (gitignored)
```
Entrada en `~/.config/opencode/opencode.jsonc` (forma válida para opencode 1.18):
```jsonc
"mcp": {
  "codegraph": { "type": "local", "command": ["codegraph", "serve", "--mcp"], "enabled": true }
}
```
> ⚠️ NO usar `codegraph install` a ciegas: escribe la forma de OpenCode 2 (`mcp.servers.*` con `disabled`/`codemode`) que **rompe** opencode 1.18. Usar la forma de arriba.

---

## 9. Gotchas críticos (leer antes de tocar código)

Ver **`AGENTS.md`** (secciones "Critical gotchas" y "Common workflows"). Resumen de los más peligrosos:

- **ESM/dotenv**: usar `dotenv.config()` y luego **dynamic imports** en entrypoints (`server.ts`, `seed.ts`).
- **`packages/validation`**: se importa desde `dist/` → tras cambiar un schema hay que `cd packages/validation && npx tsc` y reiniciar la API.
- **Prod sin migraciones**: `DB_SYNCHRONIZE=true`; las migraciones de TypeORM **no corren** en prod. Los cambios de schema se aplican por synchronize, y los **backfills de datos** deben ir en un hook/runtime idempotente.
- **Timezone**: nunca armar ISO con concatenación + `Z`; usar `new Date(`${fecha}T${hora}:00`).toISOString()`.
- **Horarios comerciales**: por defecto todo cerrado; configurar o los slots vuelven vacíos.
- **Glob de entidades TypeORM**: excluir `*.test`/`*.spec` (`database.ts`) — si no, un test dentro de `entities/` rompe el arranque de la API.
- **Nombres de columnas**: la tabla viva es `citas_servicios(citasId, serviciosId, cantidad)`.
- **Roles** (`packages/types/src/user.ts`): SUPERADMIN=1, DUEÑA=2, ADMINISTRADOR=3, MANICURISTA=4, RECEPCIONISTA=5, CONTADOR=6.
- **Regla del owner**: NO agregar tarjetas al resumen sin pedirlo; preferir tooltips + líneas condicionales; métricas sensibles solo a roles privilegiados.
- **No commitear/pushear sin pedirlo**; nunca force-push.

---

## 10. Checklist para la PC nueva

- [ ] `git clone` del repo y `git checkout main`.
- [ ] `nvm use 22` + `npm install` (raíz, workspaces).
- [ ] Copiar `apps/api/.env`.
- [ ] `docker compose up -d` + seed.
- [ ] `engram import docs/engram/sistema-salon-belleza-gloss.json`.
- [ ] Instalar + inicializar codegraph (sección 8).
- [ ] Reiniciar opencode.
- [ ] Correr `/sdd-init` (opcional, re-detecta el stack).
- [ ] Verificar: `cd apps/api && npx vitest run` (baseline conocido).

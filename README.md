# Sistema Pro — POS Salon SaaS

Sistema de gestión para salones de belleza: citas, ventas, caja, nómina, inventario y reportes.

## URLs de producción (VPS)

| Servicio | URL |
|---|---|
| **Dashboard** (salón) | http://51.161.113.43:8080 |
| **Superadmin** | http://51.161.113.43:8081 |
| **n8n** | http://51.161.113.43:5678 |
| **phpMyAdmin** | http://51.161.113.43:8082 |

## Despliegue continuo

El repo tiene CI/CD con GitHub Actions (`.github/workflows/deploy.yml`):
- **Disparador**: push a `main`
- **Acción**: hace SSH a la VPS, hace `git pull`, y levanta con `docker compose -f docker-compose.prod.yml up -d --build`
- **Secrets necesarios** (configurados en Settings → Secrets → Actions): `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`

## Desarrollo local

```bash
nvm use 22
docker compose up -d          # MySQL en 3307, n8n en 5678
cd apps/api && npx tsx src/infrastructure/persistence/seed.ts
bash start.sh
```

Ver `docker-dev.md` para más detalles.

## Arquitectura

```
apps/
  api/               Express + TypeORM + tsyringe (hexagonal)
  pos-dashboard/     React + Vite (salón)
  superadmin/        React + Vite (admin multi-tenant)
packages/
  types/             Tipos compartidos
  validation/        Schemas Zod
  ui/                Componentes React compartidos
  config/            Config base
```

# Guía de Despliegue — VPS + CI/CD

Documento explicativo de cómo quedó configurada la VPS y el despliegue continuo del proyecto, para entender qué se hizo, cómo funciona y cómo mantenerlo.

---

## 1. Qué tenemos

### El flujo de despliegue continuo

```
Tu PC                          GitHub                          VPS (OVH)
  │                              │                              │
  │ git push (a produccion)      │                              │
  ├─────────────────────────────►│                              │
  │                              │ GitHub Actions detecta el    │
  │                              │ push y ejecuta el workflow   │
  │                              │ (.github/workflows/deploy.yml│
  │                              │                              │
  │                              │ Se conecta por SSH           │
  │                              ├─────────────────────────────►│
  │                              │ 1. git pull origin produccion│
  │                              │ 2. docker compose up -d      │
  │                              │    --build                   │
  │                              │                              │
  │                              │◄─────────────────────────────┤
  │                              │ (listo, actualizado)         │
```

**En criollo**: cada vez que hacés push o merge a la rama `produccion`, GitHub se conecta a tu VPS, baja el código y actualiza los contenedores automáticamente. **Los cambios en `main` NO despliegan** — solo `produccion`.

### Flujo de trabajo recomendado

1. Trabajás y subís cambios a `main` (o ramas) — no pasa nada en producción
2. Cuando querés publicar los cambios: hacés merge de `main` → `produccion`
3. GitHub Actions despliega automáticamente

```bash
git checkout main
git pull origin main
git checkout produccion
git merge main
git push origin produccion
```

### Qué corre en la VPS (con dominio uniongloss.com)

| Servicio | URL |
|---|---|
| **Dashboard** (el salón) | https://uniongloss.com |
| **Superadmin** | https://admin.uniongloss.com |
| **n8n** | https://n8n.uniongloss.com |
| **phpMyAdmin** | https://pma.uniongloss.com |

Todas con **HTTPS automático** (Caddy + Let's Encrypt, se renuevan solos).

---

## 2. Archivos que se crearon para producción

Estos archivos están en el repo (en `main`), así que viajan solos con cada push:

| Archivo | Para qué sirve |
|---|---|
| `docker-compose.prod.yml` | Define los servicios en producción (versión "de verdad", no la de desarrollo) |
| `apps/api/Dockerfile.prod` | Cómo se construye la imagen del backend |
| `apps/pos-dashboard/Dockerfile.prod` | Cómo se construye el dashboard |
| `apps/superadmin/Dockerfile.prod` | Cómo se construye el superadmin |
| `apps/api/tsconfig.build.json` | Compila solo el código de producción (excluye tests) |
| `docker/nginx/default.conf` | Config del nginx que sirve el dashboard |
| `docker/nginx/superadmin.conf` | Config del nginx que sirve el superadmin |
| `docker/caddy/Caddyfile` | (Futuro) reverse proxy con HTTPS cuando tengas dominio |
| `.env.production.example` | Plantilla de variables secretas |
| `.github/workflows/deploy.yml` | El workflow de despliegue automático |
| `README.md` | Info general con las URLs |

---

## 3. Cómo acceder a la VPS

### Por SSH (sin contraseña)

```bash
ssh ubuntu@51.161.113.43
```

Tu clave pública (`~/.ssh/id_ed25519.pub`) está autorizada, así que entra directo sin pedir contraseña.

### Dónde está el código en la VPS

```bash
cd ~/sistema-salon-belleza-gloss
```

Ahí está clonado el repo. El archivo `.env` (con las contraseñas reales) también está ahí — **no se sube a GitHub** (está en `.gitignore`).

---

## 4. Comandos útiles para mantener la VPS

### Ver el estado de los contenedores

```bash
cd ~/sistema-salon-belleza-gloss
docker compose -f docker-compose.prod.yml ps
```

### Ver los logs de un servicio

```bash
docker logs posfinal-api        # backend
docker logs posfinal-dashboard  # dashboard
docker logs posfinal-mysql      # base de datos
```

### Reiniciar un servicio

```bash
docker restart posfinal-api
```

### Actualizar a mano (sin esperar el merge)

```bash
cd ~/sistema-salon-belleza-gloss
git checkout produccion
git pull origin produccion
docker compose -f docker-compose.prod.yml up -d --build
```

### Hacer backup de la base de datos

```bash
# Desde tu PC:
ssh ubuntu@51.161.113.43 "docker exec posfinal-mysql mysqldump -u root -p'LA_CONTRASEÑA_ROOT' salon_saas" > backup_$(date +%Y%m%d).sql

# O desde la VPS directamente:
docker exec posfinal-mysql mysqldump -u root -p'LA_CONTRASEÑA_ROOT' salon_saas > ~/backup_$(date +%Y%m%d).sql
```

> La contraseña root está en el archivo `.env` de la VPS (variable `MYSQL_ROOT_PASSWORD`).

---

## 5. Los secretos de GitHub (cómo funciona la conexión)

GitHub Actions necesita "llaves" para entrar a tu VPS. Se guardan como **secrets** en el repo (Settings → Secrets and variables → Actions), encriptados — nadie los ve.

| Secret | Valor | Qué es |
|---|---|---|
| `VPS_HOST` | `51.161.113.43` | La IP de tu VPS |
| `VPS_USER` | `ubuntu` | El usuario con el que entra |
| `VPS_SSH_KEY` | (tu clave privada) | La llave que autoriza la entrada |

Estos ya están configurados. Si algún día cambiás de VPS o de clave, hay que actualizarlos.

---

## 6. Cómo se ve un despliegue (paso a paso)

1. Hacés `git add` + `git commit` + `git push origin main` en tu PC
2. GitHub recibe el push
3. GitHub Actions arranca el workflow "Deploy to VPS" automáticamente
4. El workflow:
   - Se conecta por SSH a la VPS usando los secrets
   - Hace `git pull origin main` (baja tu código nuevo)
   - Si el `.env` no existe, lo crea desde la plantilla
   - Ejecuta `docker compose -f docker-compose.prod.yml up -d --build` (reconstruye lo que cambió)
   - Limpia imágenes viejas
5. Podés ver el estado en GitHub → pestaña **Actions** (verde = ok, rojo = falló; click para ver el log)

---

## 7. Problemas que encontramos y cómo se resolvieron

| Problema | Causa | Solución |
|---|---|---|
| La API no arrancaba (crash loop) | Las migraciones viejas de TypeORM tienen SQL inválido para MySQL 8 (`DEFAULT CURRENT_DATE` en columna DATE) | No correr migraciones cuando `DB_SYNCHRONIZE=true` (el schema se crea solo desde el código) |
| El build de la API fallaba | Compilaba tests y archivos de seed con errores | Crear `tsconfig.build.json` que excluye tests y seeds |
| Los packages no compilaban en orden | `@pos-final/types` y `@pos-final/validation` necesitan su `dist/` antes de compilar lo que los importa | Compilar `types` → `validation` primero en el Dockerfile |
| Los secrets de GitHub daban error | GitHub usa encriptación libsodium (no Fernet) | Usar `pynacl` SealedBox |

---

## 8. Próximos pasos recomendados

1. **Backup automático** de la BD en la VPS (cron diario) — tus datos reales viven ahí
2. **Proteger phpMyAdmin** (está en pma.uniongloss.com — agregale contraseña o restringilo)
3. **Cambiar/deshabilitar el acceso por contraseña** a la VPS (ya se puede con clave SSH)
4. Cuando quieras, migrar a PostgreSQL/Redis (hoy usa MySQL, que es lo que ya funciona con tus datos)

---

## 9. Notas de seguridad importantes ⚠️

- El `.env` de la VPS tiene contraseñas reales — **nunca lo subas a GitHub**
- La contraseña de la VPS que te dio OVH (`Edereder-747`) deberías cambiarla o deshabilitar el acceso por password
- phpMyAdmin expuesto en internet es un riesgo — cuando tengas dominio, ponelo detrás de Caddy con contraseña o no lo expongas
- Hacé backups regulares de la BD (tus datos reales viven ahí ahora)

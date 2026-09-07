# Notas de Aprendizaje — Cómo funciona tu sistema en producción

Notas para leer tranquilo y entender qué se hizo, cómo funciona tu sistema "por dentro" y qué conceptos estudiar para ir dominándolo. Está escrito simple, sin vueltas técnicas de más. Si algo no se entiende, es porque falta una base — al final de cada sección te digo qué estudiar para cerrar ese hueco.

> Complementa a `DEPLOY.md` (el "manual de operación") y a `README.md` (cómo correr el proyecto en tu PC).

---

## 1. La gran idea: qué es "producción"

Tu sistema tiene DOS mundos:

| | **Tu PC (desarrollo)** | **La VPS (producción)** |
|---|---|---|
| Dónde corre | Local, `localhost` | En un servidor de OVH, IP `51.161.113.43` |
| Para qué | Probar cambios sin riesgo | Los datos reales del salón, siempre prendido |
| Cómo lo ves | `http://localhost:5174` | `https://uniongloss.com` |

**Producción** = el sistema "de verdad", el que usan en el salón. Ahí viven tus datos reales (clientes, ventas, caja). Por eso los cambios no llegan directo: primero se prueban, y solo se publican cuando vos decidís.

**Qué estudiar**: diferencia entre desarrollo y producción en software (buscá "dev vs prod environment").

---

## 2. De qué está hecho tu sistema (la "receta")

Tu app es una **aplicación web de 3 pisos**:

```
[ Navegador ]  →  [ API ]  →  [ Base de datos MySQL ]
   (la interfaz     (el "cerebro":   (el "archivo":
    que se ve)       reglas, cobros)  los datos guardados)
```

- **Frontend (React)**: lo que se ve en la pantalla — `apps/pos-dashboard` y `apps/superadmin`.
- **Backend/API (Express + TypeORM)**: recibe los pedidos del navegador, hace las cuentas y guarda/lee datos — `apps/api`.
- **Base de datos (MySQL)**: las tablas con toda la información.

Cuando hacés clic en "Cobrar", el navegador **no** guarda nada solo: le pide al API que lo haga, y el API escribe en la base de datos.

**Qué estudiar**: "cómo funciona una aplicación web" (cliente-servidor), qué es una API REST, qué es una base de datos relacional.

---

## 3. Docker: por qué tu sistema va "en cajas"

Para no tener que instalar MySQL, Node, etc. a mano en cada máquina, cada pieza vive en un **contenedor** ("caja" con todo adentro: el programa + sus dependencias). Docker es el que arma y corre esas cajas.

```
docker-compose.prod.yml  ← la "receta" que dice qué cajas corren y cómo se conectan
        │
        ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   caddy      │  │     api      │  │    mysql     │  │   n8n / etc  │
│  (puertas     │→ │  (cerebro)   │→ │  (datos)     │  │              │
│   80 y 443)  │  │              │  │              │  │              │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

Conceptos clave que aparecen todo el tiempo:

- **Imagen**: el "molde/plano" de una caja. Se construye con un `Dockerfile`.
- **Contenedor**: una caja corriendo, hecha a partir de una imagen.
- **`docker compose up -d --build`**: "levantá las cajas; si cambió el código, reconstruí las imágenes".
- **Recrear un contenedor** (`--force-recreate`): "tirá la caja vieja y armala de nuevo". A veces es necesario porque docker **no** se da cuenta de que un archivo de configuración cambió por dentro (como nos pasó con Caddy).
- **`docker logs <contenedor>`**: los "diarios" de lo que le pasa a cada caja. Ahí vimos el error de hoy.

**Qué estudiar**: "Docker para principiantes" (qué es un contenedor, imagen vs contenedor, docker compose, comandos básicos: `up`, `down`, `logs`, `ps`, `restart`).

---

## 4. Internet: dominio, DNS y HTTPS

Para que `uniongloss.com` funcione hacen falta 3 cosas:

1. **Dominio** (lo compraste en Hostinger): el "nombre" que la gente escribe.
2. **DNS**: la "guía telefónica" de internet. Decís "uniongloss.com → 51.161.113.43" y cuando alguien escribe el nombre, internet sabe a qué servidor ir. En Hostinger se configuran los **registros tipo A**.
3. **HTTPS** (el candado 🔒): los datos viajan cifrados. El certificado lo emite **Let's Encrypt** (gratis) y lo renueva solo **Caddy**.

**Caddy** es un "reverse proxy": es la puerta de entrada. Recibe el pedido de internet y lo manda a la caja correcta:
- `uniongloss.com` → dashboard
- `admin.uniongloss.com` → superadmin
- `n8n.uniongloss.com` → n8n

Y de paso maneja todo el HTTPS automáticamente. Por eso, cuando cambiamos la config de Caddy (ej: sacar phpMyAdmin de internet), hay que **recrear** la caja de Caddy: si no, sigue funcionando con la config vieja. Ese fue el motivo del ajuste de hoy al deploy automático.

**Qué estudiar**: qué es un nombre de dominio, qué es DNS y un registro A, qué es HTTPS/TLS, qué es un reverse proxy, qué hace Caddy. (La página de Cloudflare tiene explicaciones muy simples en español.)

---

## 5. El bug de hoy: la columna que faltaba (¡esto es ORO para entender!)

**Qué pasó (lo que viste vos):** al querer agregar un servicio/venta desde la web, el sistema decía *"Error al cargar datos, cerrá el formulario e intentá de nuevo"*.

**Qué pasaba por dentro (lo que encontramos):**
1. El sistema tiene una función reciente: **código de barras** en los productos.
2. Esa función agrega una **columna nueva** (`codigoBarras`) a la tabla `productos` de la base de datos.
3. Pero la base de datos de producción se armó **restaurando un backup viejo** (del 28 de agosto, antes de esa función). O sea: el código ya sabía de la columna, pero la tabla real no la tenía.
4. Cuando el navegador pedía los productos, la base contestaba: *"no conozco esa columna"* (`Unknown column 'codigoBarras'`). El API fallaba y el formulario mostraba ese error genérico.

**La lección grande:** tu **código** y tu **base de datos** son dos cosas distintas que tienen que estar siempre sincronizadas. Cuando el código cambia para usar una tabla/columna nueva, la base también tiene que cambiar.

**Cómo se arregló:**
1. Agregamos la columna que faltaba directo en la base (`ALTER TABLE ... ADD COLUMN`).
2. Reiniciamos el API para que se sincronizara.
3. Probamos en la web real: ya funciona.

**Qué estudiar** (esto te va a destrabar muchísimo): qué es una **tabla**, una **columna** y un **registro** en SQL; comandos básicos (`SELECT`, `ALTER TABLE`, `SHOW COLUMNS`); y qué es un **ORM** (TypeORM) — una herramienta que deja que el código "hable" con la base. También conviene saber qué es un **backup** y por qué restaurar uno viejo puede "atrasar" la base respecto al código.

---

## 6. Git y GitHub: el "control de versiones"

Cada cambio en tu código queda **guardado como un punto en la historia** (un *commit*). Eso te permite volver atrás si algo se rompe, y trabajar ordenado.

Tu repo tiene un flujo especial:
- `main` = el código en desarrollo. Subir acá NO toca producción.
- `produccion` = el código que está publicado. **Solo cuando hacés merge de `main` a `produccion`** se dispara el deploy.

```
Tu PC ──push──► main ──merge──► produccion ──► GitHub Actions ──► VPS (se actualiza solo)
```

**GitHub Actions** es el "robot" que ejecuta el deploy automáticamente cuando algo llega a `produccion`. El guion del robot está en `.github/workflows/deploy.yml`: se conecta por SSH a la VPS, baja el código y reconstruye las cajas de Docker.

**Qué estudiar**: qué es Git (commit, push, pull, branch/rama, merge), qué es GitHub, qué es CI/CD y GitHub Actions. (GitHub tiene tutoriales gratis muy buenos: "GitHub Skills".)

---

## 7. Dónde mirar cuando algo falla (tu "kit de diagnóstico")

1. **¿Qué error exacto te muestra la pantalla?** Anotalo tal cual.
2. **Mirá los registros del API**: `docker logs posfinal-api` (desde la VPS). Ahí el sistema "confiesa" qué le pasó — hoy el error real estaba ahí.
3. **Fijate si el problema es del código o de los datos** (la lección de la sección 5).
4. Recién después de saber eso se toca algo.

**Qué estudiar**: cómo leer un mensaje de error y un "stack trace" (la lista de pasos que muestra el error), y qué es un log.

---

## 8. Cómo entrar a ver tu base de datos (phpMyAdmin)

Tu base de datos (donde están clientes, ventas, caja) está **guardada en la VPS** y NO se puede entrar desde internet por seguridad. Para verla usás **phpMyAdmin** (una página para manejar la base con botones) a través de un **túnel SSH** — un "pasadizo privado" entre tu PC y el servidor.

**Paso a paso:**
1. Abrí una terminal en tu PC y corré este comando (dejalo abierto):
   ```bash
   ssh -L 8082:localhost:8082 ubuntu@51.161.113.43
   ```
   (Te va a pedir confirmar la huella la primera vez; y si tu clave no está cargada, tu contraseña.)

2. Con la terminal abierta, entrá en tu navegador a: **http://localhost:8082**

3. Ahí te aparece phpMyAdmin. Te va a pedir **usuario y contraseña** — son los que están en el archivo `.env` de la VPS (variables `MYSQL_USER`/`MYSQL_PASSWORD` o similar; en `DEPLOY.md` está anotado dónde mirar).

> ⚠️ **Regla de oro**: entrá solo a **mirar**. Si tocás algo en phpMyAdmin (borrar, editar) podés romper datos reales del salón. Si hay que cambiar algo, avisame y lo hacemos con cuidado.

**Qué estudiar**: qué es SSH, y qué es un "puerto" (el `8082` es la puertita del pasadizo).

---

## 9. Orden sugerido para estudiar (de lo más simple a lo más profundo)

Si querés construir la base en orden, sin frustrarte:

1. **Cómo funciona la web** — cliente, servidor, navegador, API. *(Base de todo.)*
2. **Bases de datos / SQL básico** — tablas, columnas, `SELECT`. *(Te explica el bug de hoy y la mitad de tu sistema.)*
3. **Docker básico** — contenedores, imágenes, `docker compose`, `logs`. *(Entenderás la VPS.)*
4. **Git y GitHub** — commits, ramas, merge. *(Entenderás por qué `main` ≠ `produccion`.)*
5. **DNS + HTTPS + reverse proxy** — dominio, registros A, Caddy. *(Entenderás el uniongloss.com.)*
6. **CI/CD (GitHub Actions)** — el deploy automático. *(Ya con todo lo anterior, esto es "simple": un robot que ejecuta comandos.)*

Buenos puntos de partida gratuitos:
- **GitHub Skills** (skills.github.com) — Git y Actions jugando, en el navegador.
- **Cloudflare Learning Center** — explica DNS y HTTPS con dibujitos, en español.
- **Documentación oficial de Docker** ("Get started") y de **TypeORM** (para el ORM).
- **W3Schools (sección SQL)** — para practicar consultas a la base.

---

*Documento vivo: se actualiza cada vez que aprendemos algo nuevo que valga la pena dejar anotado.*

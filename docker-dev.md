# Desarrollo con Docker

## Iniciar todo

```bash
docker compose up -d
```

## Ver logs

```bash
docker compose logs -f api
docker compose logs -f dashboard
docker compose logs -f superadmin
```

## URLs

| Servicio    | URL                          |
|-------------|------------------------------|
| API         | http://localhost:3001        |
| Dashboard   | http://localhost:5174        |
| Superadmin  | http://localhost:5173        |
| n8n         | http://localhost:5678        |

## Hot reload

Los cambios en el código se reflejan automáticamente sin rebuild:

- **API**: `tsx watch` reinicia el servidor al detectar cambios en `src/`
- **Dashboard/Superadmin**: Vite HMR recarga los módulos modificados al instante

## Parar todo

```bash
docker compose down
```

## Reconstruir imágenes

```bash
docker compose build --no-cache api
docker compose build --no-cache dashboard
docker compose build --no-cache superadmin
```

## Notas

- La base de datos MySQL persiste en el volumen `mysql_data`
- Los datos de n8n persisten en el volumen `n8n_data`
- El código fuente se monta como volumen (`:delegated`), no se copia en la imagen
- Los `node_modules` del contenedor se aíslan con volúmenes anónimos para evitar conflictos con el host

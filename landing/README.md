# Landing Compuservicios — kit de plantillas

Landing page responsive construida con **Tailwind CSS** (play CDN) + **Inter**, replicando el look de Compuservicios (paleta azul + acentos tricolor, tarjetas redondeadas, sombras suaves, animaciones sutiles). Pensada para reutilizar sus secciones en otras páginas.

## Archivos

- `index.html` — la landing completa (autocontenida salvo el logo).
- `logo-compuservicios.png` — logo oficial (debe ir junto al HTML).

## Cómo verla / desplegarla

Es un sitio **estático**. Opciones:

```bash
# Previsualizar local
cd landing && python3 -m http.server 8099   # abre http://localhost:8099

# Desplegar en tu servidor con Caddy (añade un bloque al Caddyfile):
#   compuservicios.com {
#       root * /opt/landing
#       file_server
#   }
```

## Secciones reutilizables

Cada sección está delimitada con un comentario `<!-- SECCIÓN: ... -->` y es independiente. Para una página nueva: copia las secciones que quieras y cambia el texto.

| Sección | Para qué |
|---|---|
| NAVBAR | Barra superior con logo, enlaces y CTA (sticky, menú móvil) |
| HERO | Encabezado principal: título, subtítulo, botones y tarjeta visual |
| SERVICIOS | Grid de tarjetas de servicio (duplica una `<article>` para añadir más) |
| NOSOTROS / STATS | Banda azul con texto + mosaico de indicadores |
| PROCESO | 4 pasos numerados |
| TESTIMONIOS | Tarjetas de reseña |
| CTA | Llamado a la acción en banda con degradado |
| CONTACTO + FOOTER | Datos de contacto, enlaces, WhatsApp |

## Personalización rápida

- **Colores:** edita `tailwind.config` al inicio del `<head>` (tokens `primary.*` y acentos `brand*`).
- **Tipografía:** cambia la familia en `fontFamily.sans` (ahora Inter).
- **Logo:** reemplaza `logo-compuservicios.png`.
- **Contacto / redes:** teléfono, WhatsApp (`wa.me/5219516463845`) y horario están en la sección CONTACTO.
- **Textos (copy):** son un borrador; ajústalos a tu gusto.

## Animaciones

Revelado sutil al hacer scroll (IntersectionObserver), con el contenido **visible por defecto** y respeto a `prefers-reduced-motion`. No requiere librerías externas.

---
name: JDClinic Visual Design System
description: Sistema visual clínico cálido, riguroso y humano para expediente clínico electrónico
colors:
  clinic-canvas: "#F8F5F0"
  clinic-surface: "#FFFCF8"
  clinic-soft: "#F1EAF4"
  clinic-line: "#E7DEE7"
  clinic-ink: "#282638"
  clinic-muted: "#756E7C"
  clinic-brand: "#59456D"
  clinic-deep: "#423251"
  clinic-accent: "#D8634C"
  clinic-accent-soft: "#FFF0E9"
  clinic-success: "#059669"
  clinic-success-bg: "#ECFDF5"
  clinic-error: "#DC2626"
  clinic-error-bg: "#FEF2F2"
  clinic-warn: "#D97706"
  clinic-warn-bg: "#FFFBEB"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontWeight: 600
    letterSpacing: "-0.03em"
    lineHeight: 1.15
  body:
    fontFamily: "DM Sans, system-ui, -apple-system, sans-serif"
    fontWeight: 400
    letterSpacing: "-0.01em"
    lineHeight: 1.5
  data:
    fontFamily: "IBM Plex Mono, monospace"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.clinic-brand}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.clinic-deep}"
  button-accent:
    backgroundColor: "{colors.clinic-accent}"
    textColor: "#FFFFFF"
    rounded: "{rounded.md}"
    padding: "10px 20px"
    height: "44px"
---

## Overview

JDClinic acompaña una jornada real de clínica ambulatoria. Su interfaz se construye con vidrio clínico predominantemente blanco y transparente, tinta ciruela (`#282638`) y refracciones ambientales muy difusas en violeta, azul cobalto y coral. El morado profundo (`#59456D`) queda reservado para identidad, foco y acciones principales. La transparencia comunica continuidad entre módulos sin competir con los datos clínicos.

## Colors

- **Lienzo (`clinic-canvas` #F8F5F0):** Fondo base del entorno clínico.
- **Superficie (`clinic-surface` #FFFCF8):** Contenedores de lectura, fichas y formularios clínicos.
- **Tinta principal (`clinic-ink` #282638):** Texto primario con relación de contraste mínima de 7:1 sobre marfil.
- **Tinta secundaria (`clinic-muted` #756E7C):** Metadatos, etiquetas auxiliares y marcas de tiempo (contraste ≥ 4.5:1).
- **Identidad de marca (`clinic-brand` #59456D):** Encabezados institucionales y botones principales.
- **Acento de acción (`clinic-accent` #D8634C):** Acciones destacadas como altas, registros o emisión de folios.
- **Semánticos clínicos:** Verde (`#059669`) exclusivo para condiciones estables/favorables; Rojo (`#DC2626`) para alertas, alergias y errores críticos; Ámbar (`#D97706`) para estados pendientes.

## Typography

- **Títulos y encabezados mayores:** `Fraunces` (serif clínica, óptica ajustada, peso 600-700). Transmite dignidad médica y calidez humana.
- **Cuerpo, controles y etiquetas:** `DM Sans` (sans-serif geométrica legible, peso 400 a 600).
- **Folios, fechas, CIE-10 y mediciones:** `IBM Plex Mono` (monoespaciada precisa, números tabulares).

## Layout

- Superficie máxima de lectura clínica: 960–1160px centrado.
- Rejilla responsiva: formulación en 2-3 columnas en escritorio, columna única fluida en móvil.
- Altura táctil mínima de 44px para cualquier control interactivo.

## Elevation & Depth

- Superficies principales: blanco translúcido entre 52% y 74%, `backdrop-filter` de 18–34px y saturación moderada.
- Bordes especulares blancos de 1px y sombras suaves con desplazamiento natural; nunca halos sin profundidad.
- Las superficies de lectura prolongada usan mayor opacidad que las métricas, navegación o controles.
- La luz ambiental siempre permanece detrás del contenido, con baja saturación y sin atravesar texto clínico crítico.

## Shapes

- Radios consistentes: 10–12px para campos e inputs, 14–16px para tarjetas y tablas, 20–24px para la navegación y modales.
- Sin bordes laterales gruesos en tarjetas ni píldoras exageradas en controles primarios.

## Components

- **Campos de entrada (`clinical-input`):** Altura 44px, fondo `#FFFCF8`, borde `#E7DEE7`, foco en `clinic-brand`.
- **Botones primarios y secundarios:** Texto con peso 600, micro-transiciones suaves sin rebotes exagerados.
- **Folio y cinta del paciente:** Barra persistente con datos de filiación, alergias destacadas y constantes vitales.
- **Discos de identidad:** Avatares e iconos de resumen usan discos circulares de vidrio de 44–48px; los datos horarios conservan contenedores rectangulares.
- **Modales:** Superficie blanca translúcida de alta opacidad sobre backdrop ciruela desenfocado.
- **Login:** Dos zonas funcionales dentro de una sola lámina de vidrio; no usar paneles morados sólidos.

## Do's and Don'ts

- **DO:** Usar `Fraunces` en los títulos de vistas y `IBM Plex Mono` para folios como `EXP-2026-0042`.
- **DO:** Respetar un contraste mínimo de 4.5:1 en placeholders y textos secundarios.
- **DO:** Emplear `text-wrap: pretty` para evitar palabras huérfanas en párrafos y títulos.
- **DON'T:** No usar kickers o "eyebrows" diminutos arriba de los encabezados (están prohibidos por la regla de craft).
- **DON'T:** No usar gradientes de texto ni sombras duras estilo neobrutalista sin difuminar.
- **DON'T:** No usar formas líquidas definidas, blobs protagonistas ni refracciones que crucen texto o datos clínicos.
- **DO:** Usar campos de luz amplios y muy difusos para que el vidrio sea perceptible sin perder formalidad clínica.

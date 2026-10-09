# Checklist — Cuotas en curso

- [x] 1. Esqueleto: `index.html` con pestañas (Resumen, Compras, Simular, Ajustes), estilos mobile-first con modo oscuro, `manifest.json` y `sw.js` mínimos. Verificar con `node --check` y carga headless sin errores de consola.
- [x] 2. `logica.js`: modelo, meses como índice entero, `cuotasDe(compra)`, `cuotasPorMes(compras, desde, cantidad)`, `resumenMes`, `valorPresente`, estado por defecto y migración. Tests con `node --test cuotas-en-curso/tests/*.test.js`.
- [x] 3. Persistencia en `localStorage` con try/catch, aviso si no se puede guardar, y carga inicial.
- [x] 4. Formulario de alta y edición de compra con validaciones, `inputmode` numérico, primera cuota por defecto y sugerencias de tarjeta.
- [x] 5. Lista de compras: cuotas pagadas/restantes, saldo pendiente, editar, eliminar con confirmación, terminadas aparte.
- [x] 6. Resumen del mes: total, desglose por tarjeta, tope con barra y semáforo.
- [x] 7. Calendario de 12 meses en SVG, barras apiladas por tarjeta, detalle al tocar un mes, línea de tope.
- [x] 8. Pesos de hoy: inflación configurable, saldo nominal vs. presente por compra y total.
- [x] 9. Simulador: compra hipotética sobre el calendario real, meses en que pasaría el tope.
- [x] 10. Exportar e importar JSON (reemplazar o agregar) y exportar CSV de cuotas.
- [x] 11. Ajustes: tope, inflación, borrar todo con confirmación, textos de ayuda.
- [x] 12. Prueba de extremo a extremo con Playwright en Chromium headless: alta, resumen, calendario, simulador, export, recarga.
- [x] 13. Pulido en el celular: 360 px sin scroll horizontal, botones de 44 px, safe areas, foco visible.
- [x] 14. README del proyecto (qué es, por qué, cómo se usa, cómo se prueba) y fila en la tabla del README de la raíz.

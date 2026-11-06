# Cuánto sale el viaje

Cargás kilómetros, personas, consumo del auto, precio del litro, peajes, estacionamiento y desgaste, y te dice
cuánto cuesta el viaje en total, por persona y por km, separando lo que sale del bolsillo hoy del desgaste.
Si cargás lo que costaría otro medio (micro, tren), te dice cuál conviene y desde cuántas personas el auto empata.

**Estado:** terminado. **Probar:** https://fnguerrero.github.io/working-folder-auto/apps/cuanto-sale-el-viaje/

- Sin precios incluidos, sin red, sin guardar nada: todo lo carga quien lo usa.
- El desgaste por km es una estimación tuya (se sugiere un orden de magnitud, no un dato).
- Tests: `node --test apps/cuanto-sale-el-viaje/tests/logica.test.js` y e2e con Playwright (`apps/cuanto-sale-el-viaje/tests/e2e.js`, `EDGE=1` usa el Edge del sistema).
- No probado en un celular real, solo a 360 px de ancho.

# Costos estimados de Google Maps Platform

**Proyecto:** App para Magdiel · **Fecha:** 23 de noviembre de 2026 · Precios en USD, lista global (aplica a Honduras)

Google Maps cobra **por uso**. Cada servicio (SKU) tiene una **cuota gratuita mensual propia**: cuando un mes no la supera, ese servicio sale gratis. Este documento estima cuánto costaría la plataforma en tres tamaños de operación.

## Caso real: 3 conductores y 60 pasajeros

Con 20 pasajeros por sala, confirman unos **14 por recorrido**. Son **132 recorridos al mes** (3 conductores × 44).

| Servicio | Sin cuidar costos | Diseño optimizado | Gratis al mes |
|---|---|---|---|
| Route Optimization | 3 802 envíos | 1 521 envíos | 5 000 |
| Routes Pro (ETA) | 4 092 | 1 584 | 5 000 |
| Dynamic Maps (PWA) | 4 182 cargas | 1 901 cargas | 10 000 |
| **Total mensual** | **$0** | **$0** | |

- Con el diseño optimizado se usa **menos de un tercio** de la cuota gratuita: hay margen para crecer hasta **unos 9 conductores (≈180 pasajeros) sin pagar nada** a Google Maps.
- Aun sin optimizar saldría gratis, pero quedaría justo al borde: con un cuarto conductor ya empezaría a cobrar.
- Igual conviene activar la facturación con una **alerta de presupuesto de $5** y límites diarios, por si algún error en el código dispara llamadas de más.

## 1. Precios que usa la plataforma

| Servicio (SKU) | Para qué lo usamos | Gratis al mes | Precio después (por 1 000) |
|---|---|---|---|
| Maps SDK (Android) | Mapa en la app del conductor | Ilimitado | Gratis |
| Dynamic Maps (web) | Mapa en la PWA del viajero (cada vez que se carga) | 10 000 cargas | $7.00 |
| Route Optimization — Single Vehicle | Ruta óptima de un bus (se cobra **por pasajero/parada** en la solicitud) | 5 000 envíos | $10.00 |
| Route Optimization — Fleet Routing | Ruta óptima con **2 o más buses** a la vez | 1 000 envíos | $30.00 |
| Routes: Compute Routes Pro | ETA con tráfico y ruta con muchas paradas | 5 000 | $10.00 |
| Routes: Compute Routes Essentials | Ruta simple sin tráfico | 10 000 | $5.00 |
| Autocomplete (sesión) | Buscador de direcciones | Ilimitado si termina en Place Details | Gratis |
| Place Details Essentials | Coordenadas de la dirección elegida | 10 000 | $5.00 |
| Geocoding | Dirección ↔ coordenadas | 10 000 | $5.00 |

## 2. Supuestos del cálculo

- **22 días de servicio al mes**, con **2 recorridos por día** por conductor (ida y regreso) = 44 recorridos al mes por conductor.
- **25 pasajeros por sala**, de los cuales confirman **18 en promedio** por recorrido.
- Recorrido de **60 minutos**.
- Cada pasajero registra sus direcciones **unas 2 veces al mes** (alta y algún cambio).

| Escenario | Conductores | Pasajeros | Recorridos al mes |
|---|---|---|---|
| **Piloto** | 1 | 25 | 44 |
| **Pequeño** | 10 | 250 | 440 |
| **Mediano** | 50 | 1 250 | 2 200 |

## 3. Escenario A — diseño "sin cuidar costos"

Uso por recorrido: **2 optimizaciones** (sugerida + recálculo) × 18 pasajeros = 36 envíos; **ETA con tráfico cada 2 minutos** = 31 llamadas; **40 cargas de mapa** en la PWA (cada viajero abre el mapa varias veces).

| Servicio | Piloto | Pequeño | Mediano |
|---|---|---|---|
| Route Optimization | $0 (1 584 envíos) | $108.40 (15 840) | $742.00 (79 200) |
| Routes Pro (ETA) | $0 (1 364) | $86.40 (13 640) | $632.00 (68 200) |
| Dynamic Maps (PWA) | $0 (1 760) | $53.20 (17 600) | $546.00 (88 000) |
| Direcciones | $0 | $0 | $0 |
| **Total mensual** | **$0** | **$248** | **$1 920** |

## 4. Escenario B — diseño optimizado (el que vamos a programar)

| Medida | Ahorro |
|---|---|
| **Optimizar una sola vez por recorrido** y **reutilizar la ruta guardada** si los pasajeros confirmados no cambiaron (en salas recurrentes casi siempre se repiten). Se estima que solo el 80 % de los recorridos necesita optimizarse. | ~60 % en Route Optimization |
| **ETA con tráfico cada 5 minutos**; entre llamadas, el servidor estima la llegada con la posición GPS y la velocidad del bus sobre la ruta ya calculada. Una sola llamada devuelve la ETA de **todas** las paradas restantes. | ~60 % en Routes |
| **Mapa a demanda en la PWA:** por defecto se muestra la tarjeta "El bus llega en 7 min"; el mapa se carga solo si el viajero toca "Ver en el mapa", y no se recarga al navegar dentro de la app. | ~55 % en Dynamic Maps |
| **Caché de direcciones:** una dirección ya geocodificada no se vuelve a consultar. | Direcciones siempre gratis |
| **Un bus por solicitud** (Single Vehicle, $10) y no Fleet Routing ($30), salvo cuando la sala supere la capacidad y haya que repartir entre varios buses. | 3 veces más barato |

| Servicio | Piloto | Pequeño | Mediano |
|---|---|---|---|
| Route Optimization | $0 (634 envíos) | $13.36 (6 336) | $266.80 (31 680) |
| Routes Pro (ETA) | $0 (528) | $2.80 (5 280) | $214.00 (26 400) |
| Dynamic Maps (PWA) | $0 (792) | $0 (7 920) | $207.20 (39 600) |
| Direcciones | $0 | $0 | $0 |
| **Total mensual** | **$0** | **≈ $16** | **≈ $688** |
| **Costo por pasajero al mes** | $0 | ≈ $0.06 | ≈ $0.55 |

## 5. Opción para bajar aún más en escenarios grandes

- **Mapa de la PWA con MapLibre + OpenStreetMap** (gratis o de muy bajo costo con un proveedor de mosaicos). Se pierde el estilo de Google en la web, pero en el escenario mediano ahorra unos $207 al mes. La app del conductor seguiría con Google Maps, que es gratis en Android.
- **Algoritmo de respaldo propio** para salas pequeñas (menos de 8 paradas): ahí el orden óptimo se puede calcular en el servidor sin pagar Route Optimization.
- Con ambas medidas, el escenario mediano bajaría a unos **$250–$350 al mes**.

## 6. Cómo evitar sorpresas en la factura

1. **Alertas de presupuesto** en Google Cloud (por ejemplo, avisos al 50 %, 90 % y 100 % de $20 al mes durante el piloto).
2. **Cuotas diarias por API** en *Google Maps Platform → Cuotas*. Al llegar al límite, Google deja de responder en vez de seguir cobrando, y la app usa el respaldo ("ruta aproximada", "ETA aproximada").
3. **Claves restringidas** por dominio, por paquete Android o por servidor, para que nadie más pueda usarlas y generar cobros.
4. Un **panel interno** en el backend que cuente las llamadas por servicio y por sala.

## 7. Conclusión

- **Durante el piloto (1 conductor) el costo es $0**: todo cabe en las cuotas gratuitas.
- Con **10 conductores** el diseño optimizado cuesta unos **$16 al mes**.
- Con **50 conductores**, unos **$690 al mes**, o **$250–$350** con las medidas extra. Para ese tamaño conviene revisar los **planes de suscripción** de Google Maps Platform, que pueden salir más baratos que el pago por uso.

*Nota:* son estimaciones. El costo real depende de cuántas veces los viajeros abran el mapa y de cuánto duren los recorridos. Google puede cambiar sus precios: hay que revisar la lista oficial antes de lanzar. No incluye servidor ni base de datos (en el piloto, gratis o menos de $25 al mes). **Fuente:** developers.google.com/maps/billing-and-pricing/pricing

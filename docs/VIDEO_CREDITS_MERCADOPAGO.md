# Video Studio — Créditos IA + Mercado Pago + modelos premium

## Objetivo

Video Studio conserva el router gratuito/reutilizable de EduAI y agrega una experiencia premium completamente administrada por EduAI. El usuario no crea cuentas externas, no pega API keys y no recibe secretos de proveedor.

Flujo premium:

1. El usuario compra Créditos IA desde Video Studio.
2. Mercado Pago procesa el medio de pago mediante Payment Brick.
3. EduAI verifica el pago server-side y acredita el ledger.
4. Antes de una generación premium, EduAI calcula un costo estimado y reserva créditos.
5. El backend usa la API key central de fal.ai sin exponerla al navegador.
6. Si el video finaliza, la reserva se captura; si la generación falla antes de consumirse, la reserva se libera.
7. El resultado se persiste en `eduai-assets` privado y queda disponible para reutilización.

## Variables de entorno

No colocar valores reales en el repositorio.

```env
# Mercado Pago — Public Key puede ser leída por el navegador.
NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY=

# Mercado Pago — SOLO servidor.
MERCADOPAGO_ACCESS_TOKEN=
MERCADOPAGO_WEBHOOK_SECRET=

# fal.ai central de EduAI — SOLO servidor.
FAL_KEY=
```

Para pruebas usar las credenciales TEST de Mercado Pago. No reemplazar por credenciales productivas hasta completar pruebas de pagos aprobados, rechazados, webhook duplicado, reembolso y contracargo.

## Webhook

Ruta implementada:

```text
/api/webhooks/mercadopago
```

La ruta valida `x-signature` con HMAC-SHA256 y `MERCADOPAGO_WEBHOOK_SECRET`, consulta el pago directamente a Mercado Pago y no confía en montos enviados por el navegador.

Eventos relevantes:

- Payment aprobado: acredita una sola vez.
- Payment rechazado/cancelado: no acredita.
- Refund: revierte los créditos de la compra.
- Chargeback: revierte los créditos de la compra.

Si un usuario ya gastó créditos y luego ocurre una reversa, el saldo puede quedar negativo. En ese estado no puede iniciar nuevas generaciones premium hasta recuperar saldo. Esto evita regalar consumo por contracargos.

## Ledger Supabase

Tablas:

- `ai_wallets`
- `ai_credit_transactions`
- `ai_payment_orders`
- `ai_generation_charges`
- `ai_billing_settings`

Las tablas tienen RLS y el usuario autenticado tiene lectura owner-scoped. Los movimientos de dinero y conciliación se realizan con funciones server-side/service-role; el navegador no puede incrementar su saldo.

Configuración inicial de prueba en `ai_billing_settings`:

- `credits_per_clp = 1`
- `usd_to_clp = 1000`
- `markup_multiplier = 1.30`
- `min_generation_credits = 100`

Estos valores son parámetros de prueba/negocio, no una tasa de cambio en tiempo real. Deben revisarse antes de producción para cubrir tipo de cambio, comisión de pago, impuestos, infraestructura y margen.

## Catálogo inicial de Video Studio

- EduAI Auto — reutilización + WAN/HF/Google según router existente.
- Kling 3 Standard — fal.ai.
- Wan 2.7 — fal.ai.
- LTX 2.3 Fast — fal.ai.
- Veo 3.1 Fast — fal.ai.
- Seedance 2.0 Fast — fal.ai.

El cliente recibe nombres, capacidades y disponibilidad, pero no recibe endpoints privados ni credenciales.

## Seguridad

- `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` y `FAL_KEY` nunca deben usar prefijo `NEXT_PUBLIC_`.
- El monto de cada paquete se valida contra una lista permitida en el servidor.
- El `transaction_amount` enviado a Mercado Pago proviene de la orden server-side, no del formulario del cliente.
- Cada orden tiene `idempotency_key` y cada `mp_payment_id` es único.
- El webhook vuelve a consultar la API de Mercado Pago antes de acreditar/revertir.
- La generación premium reserva créditos de forma atómica antes de ponerse en cola.
- Reutilizar un video equivalente evita una nueva reserva/captura.

## Checklist antes de producción

- [ ] Agregar `MERCADOPAGO_WEBHOOK_SECRET` al entorno correspondiente.
- [ ] Registrar la URL real del webhook en Mercado Pago y habilitar Payment + Chargebacks.
- [ ] Confirmar que `FAL_KEY` existe y que la cuenta central tiene saldo/capacidad suficiente.
- [ ] Ejecutar pago aprobado con tarjeta de prueba y comprobar una sola acreditación.
- [ ] Ejecutar pago rechazado y confirmar 0 créditos.
- [ ] Reenviar webhook y confirmar idempotencia.
- [ ] Probar reembolso y contracargo.
- [ ] Probar generación premium exitosa: reserva → captura → asset privado.
- [ ] Probar generación premium fallida: reserva → liberación.
- [ ] Probar mismo prompt/config dos veces: reutilización sin nuevo cargo.
- [ ] Revisar `usd_to_clp`, `markup_multiplier`, comisiones, impuestos y política comercial.
- [ ] Sustituir credenciales TEST de Mercado Pago por producción solo al final.

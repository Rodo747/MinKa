# MinKa — Documento maestro del proyecto

> **Cobra hoy, cosecha mañana.**

| Campo | Valor |
|---|---|
| Proyecto | MinKa |
| Competencia | National Startups Hackathon by Stellar (Bolivia, 2026) |
| Autor | Rodolfo Melvin Soliz Barrientos ("Rodo") |
| Versión del documento | 1.2 (actualizado: MinKa y Fondo Solidario de Emergencia) |
| Fecha | 18 de noviembre de 2026 |
| Idioma | Español |
| Estado | Idea validada conceptualmente; construcción por iniciar |

---

## 0. Cómo leer este documento

Este archivo está escrito para que **una persona o un agente de IA que llegue sin contexto** entienda:

1. De qué trata la competencia, sus fechas, reglas y criterios de evaluación (sección 1).
2. Qué es el proyecto, a quién ayuda y cómo funciona (sección 2).
3. Cómo se maximiza el puntaje (sección 3).
4. Cómo se construye: tecnología, arquitectura y diseño (sección 4).
5. Referencias técnicas de las herramientas externas (sección 5).
6. El plan de ejecución día por día (sección 6).
7. El pitch, la demo y las preguntas esperadas (sección 7).
8. El plan de 30 días posterior (sección 8).
9. Lo que falta por verificar (sección 9).
10. Glosario y fuentes (secciones 10 y 11).

### 0.1 Convenciones de trabajo (importante para agentes)

- **Datos reales, nunca inventados.** Precios, umbrales, tasas, cifras y nombres deben venir de fuentes reales o de conversaciones reales. Todo lo que sea simulado debe estar **rotulado como "simulado"** en la interfaz y en el pitch.
- **Solo testnet.** Ninguna operación con dinero real en esta etapa.
- **Secretos fuera del código.** API keys y claves secretas van en variables de entorno, nunca en el frontend ni en el repositorio.
- **Verificar antes de programar.** Los endpoints y campos de Trustless Work deben confirmarse en su Swagger de testnet (la documentación tiene versiones V1 y V2 y pueden diferir).
- **Entregables completos.** Cuando se entregue código, debe ser el archivo completo, con su nombre exacto y los comandos de terminal necesarios para ejecutarlo.
- **Respuestas directas, en español, tono informal.** El usuario prefiere comunicación clara y sin rodeos.
- **No crear documentos o archivos adicionales sin que el usuario lo pida.** Las modificaciones se explican en el chat.
- **Honestidad sobre limitaciones.** Si algo es una simplificación del MVP (por ejemplo, arbitraje centralizado de evidencias de siniestro), se declara abiertamente.

---

## 1. La competencia

### 1.1 Qué es
**National Startups Hackathon by Stellar** es una hackathon para que nazcan nuevas startups bolivianas, construidas sobre **Stellar**, una red blockchain usada para mover dinero de forma rápida y barata. Está abierta a personas de todo el país, con o sin equipo y con o sin experiencia técnica.

**Organizan:** BAF, Vaquita, Stellar, Buidlers Bolivia y Pollar.

### 1.2 Calendario
| Etapa | Fecha | Detalle |
|---|---|---|
| Kickoff virtual | lunes 9 de noviembre, 7 a 8 pm | El enlace llegó por correo |
| Eventos presenciales | 9 al 14 de noviembre | En varias ciudades |
| Hackathon online | 9 al 22 de noviembre | Con mentores durante las dos semanas |
| Cierre de inscripciones | 20 de noviembre | Formulario en Tally |
| Selección de finalistas | 22 y 23 de noviembre | Se eligen 10 proyectos |
| Final presencial | 27 de noviembre, Santa Cruz | Pitch en vivo ante jurados nacionales e internacionales; se eligen 2 ganadores |

- Para la final se paga el pasaje de **un representante por equipo finalista**.
- Equipos de **1 a 5 personas**. Se puede participar solo.
- **Supuesto de trabajo:** la primera entrega es el **domingo 22 de noviembre** (fin de la hackathon online). La hora exacta y el formato de entrega no están confirmados. Existe además una "segunda entrega" (se menciona en el criterio de equipo y compromiso).

### 1.3 Estado de inscripción
Rodo ya está **inscrito y confirmado** (correo de Stellar Bolivia · BAF del 17 de noviembre). Ya puede construir. Existe una comunidad de WhatsApp para dudas y para conectar con otros participantes. Las novedades salen en Instagram y TikTok: @stellar_bolivia y @buidlersbo (también @vaquitaprotocol y @pollar_xyz).

### 1.4 Premios
- **USD 10.000 en total** para los 2 equipos ganadores, **hasta USD 5.000 por proyecto**.
- Se entregan como **Instant Awards de la Stellar Development Foundation (SDF)**. **No es un premio de libre uso:** es financiamiento para seguir desarrollando el proyecto, sujeto a:
  - sesiones de incubación,
  - **3 entregables técnicos en el mes siguiente**,
  - acompañamiento del equipo de BAF.
- Si el proyecto avanza, puede postular al **Stellar Community Fund** (hasta USD 150.000 por proyecto).

### 1.5 Requisito mínimo
El proyecto debe **funcionar con Stellar, aunque sea en testnet**. **No hace falta un smart contract propio.**

### 1.6 Criterios de evaluación

El recap oficial del kickoff (PDF) indica **100 puntos** así:

| Criterio | Peso (recap) | Qué se mira |
|---|---|---|
| Problema y usuario | 25 % | Un problema real y claro quién lo usaría |
| Producto funcionando | 20 % | Una demo que se puede usar |
| Uso de Stellar | 20 % | Stellar es parte central del producto |
| Plan de 30 días | 20 % | Qué construyen después de la hackathon |
| Equipo y compromiso | 15 % | Avance entre la primera y la segunda entrega |

> **Discrepancia detectada:** la diapositiva de criterios muestra números distintos (30 / 25 / 25 / 20 / 20, que suman 120) y parece tener un error de diseño. **Se toma el recap como referencia** (suma 100). En ambos casos, el criterio más pesado es **Problema y usuario** y los cinco importan.

**Evaluación con IA:** antes del cierre, los equipos pueden recibir evaluaciones de su proyecto mediante una plataforma con inteligencia artificial. Conviene usarla pronto y corregir.

### 1.7 Infraestructura disponible (no obligatoria, puede sumar puntos)
- **Pollar:** para cobrar, pagar o mover dinero.
- **Trustless Work:** para **escrow o pagos condicionados**.

No es obligatorio integrarse; se puede crear infraestructura propia, aunque aprovechar la existente puede sumar puntos. Hay documentación y personas de cada proyecto respondiendo dudas.

### 1.8 Ideas de partida que sugirieron los organizadores
- **Préstamos y crédito:** microcréditos sin garantía (Lendoor, Argentina), crédito para pequeños productores (Microvault, Kenia), adelanto de facturas para pymes (BorderDollar, Singapur), préstamos entre personas (Lenme).
- **Privacidad y tokenización:** pagos privados (Moonlight, Francia), sueldos privados (Zarf, EAU), votaciones anónimas (Stellot), inmuebles por partes (BWB, Brasil), bonos tokenizados (Etherfuse), energía solar financiada por varios (EnerDAO).

Son puntos de partida: se puede desarrollar cualquier otra idea.

**Lectura estratégica:** los organizadores esperan muchos proyectos de crédito. MinKa se diferencia porque es una **venta anticipada (no un préstamo)**, con protección mediante Fondo Solidario de Emergencia y para productores pequeños y grandes.

### 1.9 Contexto sobre Stellar
Stellar es una red blockchain abierta, creada en 2014, enfocada en pagos: transacciones rápidas y de costo muy bajo, stablecoins como USDC y "anchors" que conectan la red con dinero local. Soporta contratos inteligentes (Soroban). La Stellar Development Foundation (SDF) es la organización sin fines de lucro que la impulsa. Hay precedentes de ayuda humanitaria en efectivo con USDC sobre Stellar (ACNUR en Ucrania).

---

## 2. La propuesta

### 2.1 Resumen
**MinKa** es una plataforma digital que conecta a productores, pequeños y grandes, con compradores. El agricultor vende parte de su cosecha antes de sembrar y cobra hoy, sin endeudarse. El pago del comprador queda protegido en un contrato en Stellar (escrow), se libera por etapas y está respaldado por un Fondo Solidario de Emergencia Agrícola contra desastres naturales. Cada entrega cumplida construye un historial que facilita el acceso a crédito formal.

**Descripción corta (formulario / pitch en 3 líneas):**

> MinKa conecta a productores, pequeños y grandes, con compradores: el agricultor vende su cosecha antes de sembrar y cobra hoy, sin endeudarse. El pago, protegido por una red blockchain de contratos inteligentes, se libera por etapas, con un Fondo Solidario de Emergencia ante desastres naturales.

### 2.2 El problema
- El productor necesita dinero **ahora** (semillas, fertilizantes, mano de obra), pero cobra **al cosechar**, meses después.
- El crédito agrícola formal es escaso y suele concentrarse en grandes productores; muchos pequeños recurren al financiamiento informal o a vender barato por necesidad.
- El comprador (restaurante, procesador, exportador, diáspora) no puede asegurar producto a futuro sin riesgo: ¿entregará? ¿qué pasa si hay helada o sequía?
- Bolivia vive eventos climáticos extremos (sequía severa en el Altiplano, nevadas inusuales, inundaciones en 2026), lo que vuelve el riesgo climático un problema real y actual.

### 2.3 Usuarios

| Usuario | Necesidad | Qué recibe |
|---|---|---|
| Productor pequeño / cooperativa | Dinero para insumos sin endeudarse | Anticipo inmediato, precio claro, historial de cumplimiento |
| Productor mediano / grande | Preventa de volúmenes mayores | Contratos de mayor monto con compradores institucionales |
| Comprador B2B / exportador | Asegurar producto y precio | Pago protegido, liberación por etapas, reembolso en siniestro |
| Comprador de la diáspora o consumidor | Apoyar y comprar producto de origen | Transparencia total sobre el uso del dinero |

### 2.4 Cómo funciona (flujo de negocio)
1. **Publicar la oferta.** El productor indica cultivo, cantidad, fecha de entrega, ubicación (coordenadas), precio de referencia y descuento. La plataforma calcula y muestra el **costo anual equivalente** del descuento.
2. **Comprar.** El comprador elige una oferta y **fondea el contrato en USDC**. El dinero queda bloqueado en un escrow.
3. **Tramos.** El pago se libera en tres etapas (ejemplo a calibrar con productores reales, p. ej. 40/30/30):
   - **Tramo 1 — Anticipo para insumos:** se aprueba y libera al fondear. Es el "cobra hoy".
   - **Tramo 2 — Avance verificado:** el productor marca el hito "para revisión" con evidencia (foto o enlace a reporte); el comprador aprueba.
   - **Tramo 3 — Entrega:** el comprador confirma la recepción y se libera el saldo.
4. **Siniestro y Fondo Solidario de Emergencia.** Ante un desastre natural (helada, sequía, inundación), el productor reporta la emergencia subiendo evidencia (fotos/acta comunitaria). Se inicia una disputa en el contrato; la plataforma (árbitro) verifica la evidencia y resuelve: el comprador recupera los tramos aún no ejecutados y el **Fondo Solidario de Emergencia** ejecuta un pago directo de alivio en Stellar (USDC) al productor. El productor no es penalizado y el hash de la transacción queda registrado en el panel público de transparencia.
5. **Historial.** Cada contrato cumplido suma al **historial de cumplimiento** del productor.

### 2.5 Alcance

**MVP (se construye y se demuestra):**
- Crear y listar ofertas con cálculo del costo anual equivalente.
- Compra y escrow **multi-release** (tres tramos) en Stellar testnet.
- Evidencia de avance y aprobación por el comprador.
- Fondo Solidario de Emergencia activado por reporte de evidencia del productor (fotos/acta comunitaria) y verificación de la plataforma.
- Disputa y resolución por siniestro, con devolución de tramos no ejecutados al comprador y pago de auxilio desde el **Fondo Solidario** (cuenta de testnet en Stellar) al productor.
- Panel público de transparencia con enlaces a transacciones y desembolsos del fondo.
- Historial básico de cumplimiento.

**Roadmap (se cuenta, no se construye ahora):**
- Cooperativa como garante (responsabilidad solidaria y reserva).
- Niveles de verificación: técnico agrónomo, satélite e IoT (a mayor verificación, menor descuento).
- Reparto de alza (precio piso + bono si el mercado sube mucho).
- Pago en bolivianos con una vía local (banco, QR, fintech como Pollar).
- Fondo Solidario con aportes reales (primas por contrato, cooperación, ONG).
- Mercado secundario / división de paquetes.
- Validación comunitaria colegiada o peritaje descentralizado para la verificación de siniestros.

### 2.6 Diferenciadores
- Es una **compraventa**, no un préstamo: el productor no se endeuda ni paga intereses.
- **Escrow por tramos + Fondo Solidario de Emergencia** en el mismo flujo.
- Un solo motor para **pequeños y grandes**.
- Construye **historial** que hoy el productor no tiene.
- **Transparencia** pública del uso del dinero.

No se promete "innovación mundial": existen proyectos que cubren partes (p. ej. tokenización de granos como Agrotoken, microcréditos agrícolas). El valor está en **la combinación y el foco en Bolivia**.

### 2.7 Modelo de negocio (a validar)
- **Comisión de plataforma** por contrato. Trustless Work cobra **0,3 % de comisión de protocolo** en mainnet, que la comisión propia debe cubrir con margen.
- **Servicios** para cooperativas y compradores grandes (verificación técnica, reportes).
- La **prima del fondo no es ingreso**: se queda en el fondo para pagar siniestros.
- Los porcentajes se definen con datos reales tras hablar con productores y compradores.

### 2.8 Enfoque legal (no es asesoría legal)
- Se plantea como **compraventa a plazo** de producto que se entrega después.
- Evitar términos como "inversión", "rendimiento" o "interés".
- El dinero queda en escrow; la salida a bolivianos debe pasar por entidades reguladas.
- Preguntar a los mentores por el marco aplicable. Un abogado debe revisarlo antes de operar con dinero real.

### 2.9 Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El productor incumple | Tramos con evidencia; roadmap: cooperativa garante e historial |
| Desastre natural / siniestro | Fondo Solidario de Emergencia activado por reporte de evidencia del productor y verificación de la plataforma |
| Verificación centralizada en el MVP | Declararlo; roadmap: validación comunitaria colegiada o peritaje descentralizado |
| Evidencia falsa o dudosa en siniestros | Fotos georreferenciadas y/o acta comunitaria; validación previa al desembolso |
| Precio de descuento injusto | Precio de referencia, tope de descuento y costo anual visible |
| Productores con poca conectividad | Roadmap: técnicos y cooperativas como intermediarios, WhatsApp |
| Dependencia de terceros (Trustless Work) | Plan B: cuenta multifirma o saldos reclamables nativos de Stellar |
| Riesgo legal | Compraventa a plazo; consulta con mentores y abogado |

---

## 3. Estrategia para maximizar el puntaje

| Criterio | Qué hacer para puntuar alto |
|---|---|
| **Problema y usuario** | Hablar esta semana con 2-3 productores o cooperativas y 1-2 compradores; usar sus datos y frases reales; mostrar el costo anual equivalente frente a lo que pagan hoy |
| **Producto funcionando** | URL pública (no localhost), flujo completo sin trabas, video de respaldo |
| **Uso de Stellar** | Escrow multi-release en Stellar como corazón del producto; enlaces a transacciones en el explorador; USDC de testnet |
| **Plan de 30 días** | Tabla clara (sección 8) alineada a los 3 entregables del Instant Award |
| **Equipo y compromiso** | Commits frecuentes, README claro, avances visibles entre entregas, usar la evaluación con IA |

Otros principios:
- **Construir poco, contar mucho:** el MVP es un solo flujo completo; el resto va al roadmap.
- **Honestidad como ventaja:** rotular lo simulado y declarar limitaciones.
- **No depender de Pollar:** si se puede integrar, suma; si no, queda como roadmap.

---

## 4. Diseño técnico

### 4.1 Arquitectura
```
Frontend (React)  <->  Backend (FastAPI)  <->  Trustless Work API (testnet)
     |                      |                         |
  Wallet (firma)       Base de datos / Evidencias Stellar (testnet / pagos del Fondo)
                       (fotos / actas)           Horizon (saldo y transacciones del Fondo)
```

**Patrón de firma:** la mayoría de las llamadas de escritura de Trustless Work devuelven una **transacción sin firmar (XDR)** que debe firmar el usuario. Por eso:
1. El backend (que guarda el API key) pide la transacción a Trustless Work.
2. El frontend la entrega a la wallet para firmar.
3. El backend envía la transacción firmada (helper de envío).

### 4.2 Stack
| Capa | Tecnología |
|---|---|
| Frontend | React + Vite + TypeScript + Tailwind |
| Wallet | Stellar Wallets Kit + Freighter en testnet (confirmar nombre exacto del paquete en npm) |
| Backend | FastAPI (Python) + httpx + SQLModel |
| Stellar desde Python | `stellar-sdk` (pagos del Fondo Solidario, consultas a Horizon) |
| Base de datos | SQLite en desarrollo; Postgres (Railway) en producción |
| Fondo de Emergencia | Cuenta auditable en Stellar Testnet + pagos directos en USDC |
| Despliegue | Vercel (frontend) y Railway (backend) |

### 4.3 Escrow: diseño con Trustless Work
Se usa un escrow **multi-release**: cada hito tiene su propio monto y su propio pago.

| Rol en Trustless Work | Quién lo ocupa |
|---|---|
| `serviceProvider` y `receiver` | Productor |
| `approver` | Comprador |
| `releaseSigner` | Plataforma (libera automáticamente tras la aprobación) |
| `disputeResolver` | Plataforma (árbitro / resolución de siniestros) |
| `platformAddress` | Plataforma (cobra su comisión) |

Flujo documentado: **inicializar → fondear → actualizar hito → aprobar → liberar**; vía alternativa: **disputar → resolver**. Estado, aprobación y liberación son pasos **separados**. Cada hito puede tener un campo opcional de **evidencia**, que se usa para enlaces a fotos o reportes.

### 4.4 Fondo Solidario de Emergencia y Resolución de Siniestros
- **Cuenta auditable en Stellar Testnet:** creada específicamente para desembolsar ayuda económica directa e inmediata al productor en caso de desastres o problemas naturales (heladas, sequías, inundaciones).
- **Flujo del siniestro:**
  1. **Reporte de emergencia:** El productor reporta el siniestro en la plataforma subiendo evidencia del desastre natural (fotos georreferenciadas, acta comunitaria o reporte local).
  2. **Apertura de disputa:** Se abre la disputa formal sobre el contrato de escrow en Trustless Work.
  3. **Verificación y resolución:** La plataforma (árbitro) verifica la evidencia y resuelve el escrow, devolviendo al comprador los tramos aún no ejecutados.
  4. **Desembolso del Fondo:** El Fondo Solidario ejecuta un pago directo en Stellar (USDC) como alivio/compensación de emergencia al productor, dejando el hash de la transacción registrado en el panel público de transparencia.
- **Modo demostración:** un botón de «Simular Reporte de Emergencia Natural» con evidencia precargada (fotos de helada/inundación y acta modelo) para mostrar el desembolso del fondo en vivo durante el pitch.

### 4.5 Modelo de datos (tablas)
- `users`: wallet, rol (productor / comprador).
- `offers`: cultivo, cantidad, fecha de entrega, latitud, longitud, precio de referencia, descuento, costo anual equivalente, estado.
- `contracts`: oferta, comprador, `escrow_contract_id`, estado.
- `milestones`: espejo de los hitos (descripción, monto, estado, evidencia).
- `emergency_claims`: contrato, motivo del desastre, url_evidencia, estado, monto_solicitado.
- `fund_events`: pagos del fondo (contrato, monto, hash).
- `track_record`: historial de cumplimiento por productor.

### 4.6 API del backend
| Método y ruta | Función |
|---|---|
| `POST /offers` | Crear oferta (calcula costo anual equivalente) |
| `GET /offers` | Listar ofertas |
| `POST /contracts` | Preparar escrow (devuelve transacción a firmar) |
| `POST /tx/submit` | Enviar transacción firmada |
| `POST /milestones/{id}/evidence` | Productor marca avance con evidencia |
| `POST /milestones/{id}/approve` | Aprobación y liberación |
| `POST /emergencies/report` | Productor reporta desastre con evidencia |
| `POST /emergencies/{id}/approve-payout` | Aprobar y desembolsar ayuda desde el fondo en Stellar |
| `POST /disputes/{id}/resolve` | Resolver escrow y registrar resolución |
| `GET /public/overview` | Panel público (contratos, estado del fondo, transacciones) |

### 4.7 Pantallas del frontend
1. **Inicio** con el pitch.
2. **Mercado de ofertas.**
3. **Crear oferta** (productor).
4. **Detalle y compra** (comprador).
5. **Mi contrato** (vista de tramos).
6. **Panel público** (transparencia, saldo y pagos del Fondo Solidario, siniestros atendidos, enlaces a transacciones).
7. **Panel de demo** (simulador de reporte de emergencia y desembolso del fondo).

La identidad es la **wallet conectada + un selector de rol**. No se implementa login complejo.

### 4.8 Estructura del repositorio
```
minka/
├── frontend/                 (Vite + React + TypeScript)
│   └── src/
│       ├── pages/
│       ├── components/
│       └── lib/{stellar.ts, api.ts}
├── backend/                  (FastAPI)
│   └── app/
│       ├── main.py
│       ├── config.py
│       ├── models.py
│       ├── routers/
│       └── services/{trustless.py, fund.py}
├── docs/                     (pitch, guion de demo, plan de 30 días)
├── MinKa.md                  (este documento)
└── README.md
```

### 4.9 Seguridad mínima
- Solo **testnet**.
- Ninguna clave secreta en el frontend ni en el repositorio.
- Variables de entorno para el API key y claves del backend.
- Datos simulados siempre rotulados como tales.

---

## 5. Referencias técnicas externas

> **Advertencia:** lo siguiente proviene de la documentación pública consultada el 17 de noviembre de 2026. **Confirmar siempre en el Swagger de testnet** antes de programar.

### 5.1 Trustless Work
- Es "Escrow-as-a-Service" para stablecoins, no custodial, con hitos, aprobaciones y disputas, sobre Stellar (Soroban). Se maneja por API REST o SDK.
- **URLs base:** mainnet `https://api.trustlesswork.com`; testnet `https://dev.api.trustlesswork.com`.
- **Swagger testnet:** `https://dev.api.trustlesswork.com/docs`.
- **Herramientas de apoyo:** demo (`demo.trustlesswork.com`), visor de escrows (`viewer.trustlesswork.com`), GitHub (`github.com/Trustless-Work`).
- **Autenticación:** encabezado `Authorization: Bearer <API_KEY>`. El API key se solicita en su dApp (sección "Request API Key").
- **Tipos de escrow:** single-release (un pago al completar todo) y **multi-release** (cada hito libera su propio pago).
- **Endpoints multi-release (según repositorio de referencia; verificar):**
  - `POST /deployer/multi-release`
  - `POST /escrow/multi-release/fund-escrow`
  - `POST /escrow/multi-release/change-milestone-status`
  - `POST /escrow/multi-release/approve-milestone`
  - `POST /escrow/multi-release/release-milestone`
  - `POST /escrow/multi-release/dispute-escrow`
  - `POST /escrow/multi-release/resolve-dispute`
  - `PUT /escrow/multi-release/update-escrow`
  - `POST /escrow/multi-release/withdraw-remaining-funds`
- **Helpers:** consulta de escrows por contrato o por firmante, configuración de trustline y envío de transacciones firmadas.
- **Ejemplo de cuerpo de despliegue:** incluye `platformFee`, una lista de `milestones` (cada una con `description` y `amount`), `trustline` y `roles`. En los ejemplos `platformFee` aparece como `"50"`; **verificar la unidad**.
- **SDKs:** React SDK, JavaScript SDK (`@trustless-work/escrow-js`) y Escrow Blocks (componentes de interfaz).
- **Comisión:** 0,3 % de protocolo en mainnet.

### 5.2 Pollar (opcional)
- Plataforma Stellar con login (Google, GitHub, correo) y wallets, con SDK de JavaScript/TypeScript (`@pollar/core`, `@pollar/react`). Útil para que el usuario no necesite una wallet externa.
- **No verificado:** si puede firmar las transacciones de Trustless Work. Por eso queda como **opcional**: plan A, Freighter en testnet.

---

## 6. Plan de ejecución (17 al 22 de noviembre)

### 6.1 Día por día
| Día | Objetivo | Listo cuando... |
|---|---|---|
| **Mar 17 (noche)** | API key de Trustless Work, revisar Swagger y demo, crear repo, cuentas de testnet con USDC | Se puede crear un escrow de prueba |
| **Mié 18** | Backend: crear, fondear, aprobar y liberar un escrow multi-release | Flujo completo probado (Swagger / curl) |
| **Jue 19** | Frontend: ofertas, compra, tramos, panel público | Un usuario completa el flujo en la web |
| **Vie 20** | Fondo Solidario de Emergencia, módulo de reporte de siniestro con evidencia, disputa y resolución con desembolso en Stellar; conversaciones con productores y compradores | El flujo de emergencia y desembolso del fondo funciona de punta a punta |
| **Sáb 21** | Despliegue público, pulido, evaluación con IA, video de respaldo, deck, plan de 30 días | URL pública y video listos |
| **Dom 22** | Entrega con margen y ensayo del pitch | Todo enviado a tiempo |

### 6.2 Línea de corte
Si falta tiempo, **recortar de abajo hacia arriba**:
1. Pago real desde el fondo (dejarlo simulado y explicado).
2. Historial de cumplimiento.
3. Simulador de reporte de emergencia con evidencia precargada.
4. Panel público avanzado.

**Intocable:** compra, escrow por tramos y panel básico.

### 6.3 Definición de "hecho" del MVP
- Un usuario puede crear una oferta, un comprador puede fondearla, y se pueden aprobar y liberar los tramos.
- Cada acción deja una transacción verificable en el explorador de Stellar.
- El reporte de emergencia y el desembolso transparente del Fondo Solidario se pueden demostrar en vivo.
- Hay una URL pública y un video de respaldo.
- Todo lo simulado está rotulado como tal.

### 6.4 Plan B
- Si Trustless Work falla o se demora: escrow simple con cuenta multifirma o saldos reclamables nativos de Stellar (a validar).
- Si el login/wallet da problemas: usar solo Freighter en testnet.
- Si la demo en vivo es riesgosa: video de respaldo grabado de antemano.

---

## 7. Pitch, demo y preguntas esperadas

### 7.1 Estructura del pitch (aprox. 5 minutos)
1. **Problema:** el productor cobra meses después de necesitar el dinero.
2. **Usuario:** historia real recogida en las conversaciones.
3. **Solución:** MinKa en una frase.
4. **Demo en vivo** (ver 7.2).
5. **Por qué Stellar.**
6. **Modelo de negocio y plan de 30 días.**
7. **Equipo y visión** (roadmap).

### 7.2 Guion de demo (aprox. 3 minutos)
1. El productor publica una oferta (datos de ejemplo rotulados como simulados).
2. El comprador la fondea; se muestra el escrow en el explorador.
3. Se libera el anticipo: "cobra hoy".
4. Se aprueba el tramo de avance con evidencia.
5. Reporte de emergencia con evidencia: disputa en escrow, resolución (reembolso al comprador de tramos no ejecutados) y desembolso inmediato del Fondo Solidario al productor en Stellar.
6. Panel público e historial del productor.

### 7.3 Preguntas probables y respuestas
- **¿Por qué Stellar?** Escrow por tramos programable y auditable; pagos en USDC desde el exterior en segundos, con costos muy bajos.
- **¿Por qué no una transferencia bancaria?** Una transferencia mueve el dinero una vez; aquí el dinero queda bloqueado y se libera solo al cumplirse condiciones, con auditoría pública.
- **¿Quién decide el siniestro?** En el MVP, la plataforma actúa como árbitro verificando la evidencia (fotos/acta comunitaria); en el roadmap, validación comunitaria colegiada o peritaje descentralizado.
- **¿Cómo se evitan fraudes en los reportes de emergencia?** En el MVP se exige evidencia gráfica georreferenciada o actas de autoridades locales; en el roadmap se integran peritos y comités locales de validación.
- **¿Es legal?** Se plantea como compraventa a plazo; se validará con mentores y asesoría legal.
- **¿Quién financia el fondo?** Primas por contrato y, a futuro, aportes de cooperación o ONG.
- **¿En qué se diferencia de un crédito?** No hay deuda ni intereses: es una venta anticipada.

---

## 8. Plan de 30 días posteriores (propuesta)

Alineado a los tres entregables técnicos del Instant Award (las condiciones exactas de la SDF deben confirmarse).

| Semana | Foco | Resultado esperado |
|---|---|---|
| 1 | Validación | Conversaciones con 3 cooperativas y 3 compradores; cultivo y zona piloto elegidos |
| 2 | Mainnet y salida a bolivianos | Escrow en mainnet con montos pequeños; vía de salida a bolivianos definida |
| 3 | Fondo Solidario v1 y gobernanza | Reglas claras de elegibilidad de siniestros, protocolo de peritaje y fondeo automatizado |
| 4 | Piloto real | Primera preventa con una cooperativa y métricas (contratos, monto, cumplimiento) |

**Entregables técnicos propuestos:** (1) escrow en mainnet + salida a bolivianos; (2) Fondo Solidario de Emergencia auditable + módulo de siniestros; (3) piloto real con métricas.

---

## 9. Pendientes, supuestos y decisiones abiertas

### 9.1 Supuestos
- La primera entrega es el domingo 22 de noviembre (hora y formato sin confirmar).
- El plan de tramos (40/30/30) es un ejemplo; se calibra con productores.
- Las reglas y montos de desembolso del Fondo Solidario son parámetros iniciales que se calibrarán con cooperativas.

### 9.2 Por verificar
- Endpoints y campos exactos de Trustless Work (V1 vs V2) en el Swagger de testnet.
- Unidad de `platformFee`.
- Emisor y trustline del USDC de testnet que usa Trustless Work.
- Si el árbitro puede dividir fondos en la resolución de disputas multi-release.
- Compatibilidad de Pollar con la firma de transacciones de Trustless Work.
- Pesos oficiales de los criterios (recap vs diapositiva).
- Marco legal de la preventa en Bolivia.

### 9.3 Decisiones abiertas
- **Cultivo y zona de la demo.** Sugerencia: un cultivo del Altiplano con riesgo de helada o sequía (por ejemplo quinua o papa), usando precios de referencia reales de fuente oficial o de conversaciones.
- **Equipo:** ir solo o sumar 1-2 personas (pitch, validación con productores, diseño).
- **Pollar:** integrarlo solo si queda tiempo.

---

## 10. Glosario

- **Blockchain:** registro digital compartido y difícil de alterar.
- **Stellar:** red blockchain enfocada en pagos rápidos y baratos.
- **Soroban:** plataforma de contratos inteligentes de Stellar.
- **Contrato inteligente:** programa en la blockchain que ejecuta reglas de forma automática.
- **Escrow:** dinero retenido por un tercero neutral (aquí, un contrato) hasta que se cumplan condiciones.
- **Multi-release:** escrow donde cada hito libera su propio pago.
- **Hito (milestone):** etapa con condición y monto propios.
- **Trustline:** autorización en una cuenta Stellar para manejar un activo (por ejemplo USDC).
- **USDC:** stablecoin atada al dólar.
- **Testnet:** red de pruebas sin dinero real.
- **XDR:** formato de transacción de Stellar; "sin firmar" significa que falta la firma del usuario.
- **Horizon:** servicio para consultar cuentas y transacciones en Stellar.
- **Fondo Solidario de Emergencia:** cuenta auditable en Stellar para auxilio económico directo al productor en caso de desastres naturales.
- **Reporte de siniestro / emergencia:** reclamo con evidencia (fotos georreferenciadas, actas comunitarias) que activa la resolución del escrow y el auxilio del fondo.
- **Preventa:** compraventa anticipada de producto que se entrega después.
- **Instant Award:** financiamiento de la SDF para continuar el desarrollo del proyecto.
- **SCF:** Stellar Community Fund, financiamiento de la comunidad Stellar para proyectos que avanzan.

---

## 11. Fuentes

- Recap del kickoff de la National Startups Hackathon by Stellar (PDF oficial) y diapositivas de la hackathon.
- Correo de confirmación de inscripción (Stellar Bolivia · BAF), 17 de noviembre de 2026.
- Formulario de inscripción: https://tally.so/r/2jj26A
- Trustless Work (documentación): https://docs.trustlesswork.com/ · Swagger testnet: https://dev.api.trustlesswork.com/docs · Repositorio de referencia: https://github.com/Trustless-Work/trustless-work-dev-skill
- Pollar (SDK): https://github.com/pollar-xyz/pollar/releases
- Contexto Bolivia 2026: sequía extrema (Mongabay), nevadas inusuales (AFP), lluvias y desastres (Los Tiempos).
- Precedente de ayuda humanitaria sobre Stellar (ACNUR en Ucrania): https://fortune.com/2022/12/15/un-crypto-aid-ukrainian-refugees-stablecoin-usdc-stellar/

*Fin del documento.*


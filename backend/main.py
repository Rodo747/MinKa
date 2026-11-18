"""
main.py — API principal de MinKa (FastAPI).

Organización por secciones:
    0. Configuración e inicio
    1. Salud
    2. Usuarios
    3. Ofertas
    4. Contratos y Tramos
    5. Emergencias y Fondo Solidario
    6. Transparencia Pública
"""

from datetime import date, datetime
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, delete
from pydantic import BaseModel

from database import (
    crear_bd_y_tablas,
    obtener_sesion,
    validar_transicion_estado,
)
from models import (
    Usuario,
    Oferta,
    Contrato,
    Tramo,
    ReporteEmergencia,
    MovimientoFondo,
)
from stellar_service import (
    crear_escrow_trustless,
    fondear_escrow,
    subir_evidencia_tramo,
    aprobar_y_liberar_tramo,
    disputar_y_resolver_tramo,
    desembolsar_fondo_emergencia,
    saldo_fondo,
    consultar_saldo_usdc,
    FONDO_PUBLIC_KEY,
    MODO_DEMO,
    CLAVE_PRODUCTOR_DEMO,
    CLAVE_COMPRADOR_DEMO,
)


# ══════════════════════════════════════════════════════════════════
# 0. Configuración e inicio
# ══════════════════════════════════════════════════════════════════

app = FastAPI(
    title="MinKa API",
    description=(
        "Backend de MinKa: preventa de cosechas con escrow en Stellar "
        "y Fondo Solidario de Emergencia Agrícola."
    ),
    version="0.2.0",
)

# CORS abierto para desarrollo; restringir en producción
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def al_iniciar():
    """Crea las tablas en SQLite la primera vez que arranca el servidor."""
    crear_bd_y_tablas()


# ══════════════════════════════════════════════════════════════════
# 1. Salud
# ══════════════════════════════════════════════════════════════════

@app.get("/salud", tags=["salud"])
def salud():
    """Verificación rápida de que el servidor está en pie."""
    return {"estado": "ok", "proyecto": "MinKa"}


# ══════════════════════════════════════════════════════════════════
# 2. Usuarios
# ══════════════════════════════════════════════════════════════════

class CrearUsuarioBody(BaseModel):
    billetera: str
    nombre: Optional[str] = None
    rol: str = "productor"  # "productor" | "comprador" | "admin"


@app.post("/usuarios", tags=["usuarios"])
def crear_usuario(
    body: CrearUsuarioBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Crea un usuario nuevo o devuelve el existente si la billetera ya está registrada.
    La billetera Stellar actúa como identidad única.
    """
    usuario_existente = sesion.exec(
        select(Usuario).where(Usuario.billetera == body.billetera)
    ).first()

    if usuario_existente:
        return {"creado": False, "usuario": usuario_existente}

    nuevo_usuario = Usuario(
        billetera=body.billetera,
        nombre=body.nombre,
        rol=body.rol,
    )
    sesion.add(nuevo_usuario)
    sesion.commit()
    sesion.refresh(nuevo_usuario)
    return {"creado": True, "usuario": nuevo_usuario}


@app.get("/usuarios", tags=["usuarios"])
def listar_usuarios(sesion: Session = Depends(obtener_sesion)):
    """Lista todos los usuarios registrados en la plataforma."""
    return sesion.exec(select(Usuario)).all()


# ══════════════════════════════════════════════════════════════════
# 3. Ofertas
# ══════════════════════════════════════════════════════════════════

class CrearOfertaBody(BaseModel):
    productor_id: int
    cultivo: str
    cantidad_kg: float
    fecha_entrega: date          # YYYY-MM-DD
    ubicacion: str
    precio_referencia_usdc: float
    porcentaje_descuento: float  # 0–100


def _calcular_precio_y_cae(
    precio_referencia: float,
    porcentaje_descuento: float,
    fecha_entrega: date,
) -> tuple[float, float]:
    """
    Calcula el precio final y el costo anual equivalente (CAE) del descuento.

    precio_final = precio_referencia × (1 - descuento/100)

    CAE = ((precio_referencia / precio_final) ^ (365 / dias_hasta_entrega) - 1) × 100

    El CAE expresa el costo del descuento como tasa anual, para que el productor
    lo pueda comparar con un crédito bancario.
    """
    precio_final = precio_referencia * (1 - porcentaje_descuento / 100)

    dias_hasta_entrega = (fecha_entrega - date.today()).days
    if dias_hasta_entrega <= 0:
        # Si la fecha ya pasó o es hoy, el CAE no tiene sentido; usamos 1 día
        dias_hasta_entrega = 1

    if precio_final <= 0:
        raise HTTPException(
            status_code=400,
            detail="El precio final no puede ser cero o negativo.",
        )

    cae = ((precio_referencia / precio_final) ** (365 / dias_hasta_entrega) - 1) * 100

    return round(precio_final, 6), round(cae, 2)


@app.post("/ofertas", tags=["ofertas"])
def crear_oferta(
    body: CrearOfertaBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Crea una oferta de preventa de cosecha.
    Calcula automáticamente el precio final y el costo anual equivalente del descuento.
    """
    # Verificar que el productor existe
    productor = sesion.get(Usuario, body.productor_id)
    if not productor:
        raise HTTPException(status_code=404, detail="Productor no encontrado.")

    precio_final, cae = _calcular_precio_y_cae(
        precio_referencia=body.precio_referencia_usdc,
        porcentaje_descuento=body.porcentaje_descuento,
        fecha_entrega=body.fecha_entrega,
    )

    nueva_oferta = Oferta(
        productor_id=body.productor_id,
        cultivo=body.cultivo,
        cantidad_kg=body.cantidad_kg,
        fecha_entrega=body.fecha_entrega,
        ubicacion=body.ubicacion,
        precio_referencia_usdc=body.precio_referencia_usdc,
        porcentaje_descuento=body.porcentaje_descuento,
        precio_final_usdc=precio_final,
        costo_anual_equivalente=cae,
    )
    sesion.add(nueva_oferta)
    sesion.commit()
    sesion.refresh(nueva_oferta)
    return nueva_oferta


@app.get("/ofertas", tags=["ofertas"])
def listar_ofertas(sesion: Session = Depends(obtener_sesion)):
    """Lista todas las ofertas, en cualquier estado."""
    return sesion.exec(select(Oferta)).all()


@app.get("/ofertas/{oferta_id}", tags=["ofertas"])
def obtener_oferta(oferta_id: int, sesion: Session = Depends(obtener_sesion)):
    """Devuelve el detalle de una oferta por su ID."""
    oferta = sesion.get(Oferta, oferta_id)
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada.")
    return oferta


# ══════════════════════════════════════════════════════════════════
# 4. Contratos y Tramos
# ══════════════════════════════════════════════════════════════════

# Distribución fija de los 3 tramos: 40% / 30% / 30%
TRAMOS_CONFIG = [
    {"numero": 1, "titulo": "Anticipo Insumos 40%",   "porcentaje": 0.40},
    {"numero": 2, "titulo": "Avance Verificado 30%",  "porcentaje": 0.30},
    {"numero": 3, "titulo": "Entrega Final 30%",      "porcentaje": 0.30},
]


class CrearContratoBody(BaseModel):
    oferta_id: int
    comprador_id: int
    monto_total_usdc: float


@app.post("/contratos", tags=["contratos"])
def crear_contrato(
    body: CrearContratoBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Crea un contrato de compraventa y sus 3 tramos automáticamente (40/30/30).
    Despliega el contrato de escrow multi-release en Stellar vía Trustless Work
    y guarda el id_contrato_escrow devuelto. El estado queda 'pendiente_fondeo'.
    """
    # Verificar oferta
    oferta = sesion.get(Oferta, body.oferta_id)
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada.")

    if oferta.estado != "abierta":
        raise HTTPException(
            status_code=400,
            detail=f"La oferta no está en estado 'abierta' (estado actual: '{oferta.estado}').",
        )

    # Verificar comprador y productor
    comprador = sesion.get(Usuario, body.comprador_id)
    if not comprador:
        raise HTTPException(status_code=404, detail="Comprador no encontrado.")

    productor = sesion.get(Usuario, oferta.productor_id)
    if not productor:
        raise HTTPException(status_code=404, detail="Productor no encontrado.")

    # Crear el contrato en estado pendiente_fondeo
    nuevo_contrato = Contrato(
        oferta_id=body.oferta_id,
        comprador_id=body.comprador_id,
        monto_total_usdc=body.monto_total_usdc,
        estado="pendiente_fondeo",
    )
    sesion.add(nuevo_contrato)
    sesion.flush()  # Para obtener nuevo_contrato.id antes del escrow

    # Crear los 3 tramos automáticamente
    tramos_creados = []
    for cfg in TRAMOS_CONFIG:
        tramo = Tramo(
            contrato_id=nuevo_contrato.id,
            numero_tramo=cfg["numero"],
            titulo=cfg["titulo"],
            monto_usdc=round(body.monto_total_usdc * cfg["porcentaje"], 6),
        )
        sesion.add(tramo)
        tramos_creados.append(tramo)

    # Desplegar escrow multi-release en Stellar
    try:
        contract_id = crear_escrow_trustless(nuevo_contrato, tramos_creados, productor, comprador)
    except Exception as e:
        sesion.rollback()
        raise HTTPException(
            status_code=502,
            detail=f"Error en Stellar al crear el escrow: {e}",
        )

    nuevo_contrato.id_contrato_escrow = contract_id
    sesion.commit()
    sesion.refresh(nuevo_contrato)

    return {
        "contrato": nuevo_contrato,
        "tramos": [
            {
                "id": t.id,
                "numero_tramo": t.numero_tramo,
                "titulo": t.titulo,
                "monto_usdc": t.monto_usdc,
                "estado": t.estado,
            }
            for t in tramos_creados
        ],
    }


@app.post("/contratos/{contrato_id}/fondear", tags=["contratos"])
def fondear_contrato(
    contrato_id: int,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Fondea el escrow en Stellar con la clave del comprador.
    Solo aplica si el contrato está en 'pendiente_fondeo'.
    Pasa el contrato a 'activo' y la oferta a 'fondeada'.
    Luego libera automáticamente el tramo 1 ('Anticipo automático' / 'cobra hoy').
    """
    contrato = sesion.get(Contrato, contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado.")

    if contrato.estado != "pendiente_fondeo":
        raise HTTPException(
            status_code=400,
            detail=f"El contrato no está en estado 'pendiente_fondeo' (estado actual: '{contrato.estado}').",
        )

    if not contrato.id_contrato_escrow:
        raise HTTPException(
            status_code=400,
            detail="El contrato no tiene un ID de escrow de Trustless Work asignado.",
        )

    oferta = sesion.get(Oferta, contrato.oferta_id)
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta asociada no encontrada.")

    validar_transicion_estado("contrato", contrato.estado, "activo")
    validar_transicion_estado("oferta", oferta.estado, "fondeada")

    # 1. Fondear escrow en Stellar
    try:
        fondear_escrow(contrato.id_contrato_escrow, contrato.monto_total_usdc)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error en Stellar al fondear el escrow: {e}",
        )

    # 2. Liberar automáticamente el tramo 1 (anticipo para insumos)
    tramo_1 = sesion.exec(
        select(Tramo)
        .where(Tramo.contrato_id == contrato.id, Tramo.numero_tramo == 1)
    ).first()

    if not tramo_1:
        raise HTTPException(status_code=404, detail="Tramo 1 no encontrado en el contrato.")

    validar_transicion_estado("tramo", tramo_1.estado, "liberado")

    try:
        subir_evidencia_tramo(contrato.id_contrato_escrow, 0, "Anticipo automático")
        tx_hash_liberacion = aprobar_y_liberar_tramo(contrato.id_contrato_escrow, 0)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error en Stellar al liberar el anticipo automático (tramo 1): {e}",
        )

    # Actualizar estados en base de datos tras éxito en Stellar
    contrato.estado = "activo"
    oferta.estado = "fondeada"
    tramo_1.url_evidencia = "Anticipo automático"
    tramo_1.estado = "liberado"
    tramo_1.hash_transaccion = tx_hash_liberacion

    sesion.commit()
    sesion.refresh(contrato)
    sesion.refresh(tramo_1)

    tramos = sesion.exec(
        select(Tramo)
        .where(Tramo.contrato_id == contrato_id)
        .order_by(Tramo.numero_tramo)
    ).all()

    return {
        "contrato": contrato,
        "tramo_1_liberado": tramo_1,
        "hash_transaccion": tx_hash_liberacion,
        "tramos": tramos,
    }


@app.get("/contratos", tags=["contratos"])
def listar_contratos(sesion: Session = Depends(obtener_sesion)):
    """Lista todos los contratos."""
    return sesion.exec(select(Contrato)).all()


@app.get("/contratos/{contrato_id}", tags=["contratos"])
def obtener_contrato(contrato_id: int, sesion: Session = Depends(obtener_sesion)):
    """Devuelve el contrato con sus 3 tramos y enlaces auditables."""
    contrato = sesion.get(Contrato, contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado.")

    tramos = sesion.exec(
        select(Tramo)
        .where(Tramo.contrato_id == contrato_id)
        .order_by(Tramo.numero_tramo)
    ).all()

    contrato_dict = contrato.model_dump()
    contrato_dict["enlace_trustless_work"] = (
        f"https://viewer.trustlesswork.com/{contrato.id_contrato_escrow}"
        if contrato.id_contrato_escrow
        else None
    )

    tramos_data = []
    for t in tramos:
        item = t.model_dump()
        item["enlace_stellar_expert"] = (
            f"https://stellar.expert/explorer/testnet/tx/{t.hash_transaccion}"
            if t.hash_transaccion
            else None
        )
        tramos_data.append(item)

    return {"contrato": contrato_dict, "tramos": tramos_data}


class EvidenciaTramoBody(BaseModel):
    url_evidencia: str


@app.post("/tramos/{tramo_id}/evidencia", tags=["contratos"])
def registrar_evidencia_tramo(
    tramo_id: int,
    body: EvidenciaTramoBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    El productor sube la evidencia de avance de un tramo.
    Valida que el tramo esté 'pendiente' antes de pasar a 'en_revision'
    y llama a subir_evidencia_tramo en Stellar.
    """
    tramo = sesion.get(Tramo, tramo_id)
    if not tramo:
        raise HTTPException(status_code=404, detail="Tramo no encontrado.")

    validar_transicion_estado("tramo", tramo.estado, "en_revision")

    contrato = sesion.get(Contrato, tramo.contrato_id)
    if not contrato or not contrato.id_contrato_escrow:
        raise HTTPException(status_code=400, detail="El contrato no tiene un escrow asignado en Stellar.")

    # Registrar evidencia en el escrow (índice 0-based)
    try:
        subir_evidencia_tramo(
            contrato.id_contrato_escrow,
            tramo.numero_tramo - 1,
            body.url_evidencia,
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error en Stellar al subir evidencia: {e}",
        )

    tramo.url_evidencia = body.url_evidencia
    tramo.estado = "en_revision"
    sesion.commit()
    sesion.refresh(tramo)
    return tramo


@app.post("/tramos/{tramo_id}/aprobar", tags=["contratos"])
def aprobar_tramo(
    tramo_id: int,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Aprueba y libera un tramo que ha presentado evidencia y está en revisión.
    Llama a aprobar_y_liberar_tramo en Stellar, guarda hash_transaccion y estado 'liberado'.
    Si era el tramo 3, pasa el contrato a 'completado', la oferta a 'completada'
    y suma 1 a contratos_cumplidos del productor.
    """
    tramo = sesion.get(Tramo, tramo_id)
    if not tramo:
        raise HTTPException(status_code=404, detail="Tramo no encontrado.")

    validar_transicion_estado("tramo", tramo.estado, "liberado")

    contrato = sesion.get(Contrato, tramo.contrato_id)
    if not contrato or not contrato.id_contrato_escrow:
        raise HTTPException(status_code=400, detail="El contrato no tiene un escrow asignado en Stellar.")

    try:
        tx_hash = aprobar_y_liberar_tramo(contrato.id_contrato_escrow, tramo.numero_tramo - 1)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error en Stellar al aprobar y liberar tramo: {e}",
        )

    tramo.hash_transaccion = tx_hash
    tramo.estado = "liberado"

    # Si era el tramo 3, completar contrato y oferta
    if tramo.numero_tramo == 3:
        validar_transicion_estado("contrato", contrato.estado, "completado")
        contrato.estado = "completado"
        sesion.add(contrato)

        oferta = sesion.get(Oferta, contrato.oferta_id)
        if oferta:
            validar_transicion_estado("oferta", oferta.estado, "completada")
            oferta.estado = "completada"
            sesion.add(oferta)

            productor = sesion.get(Usuario, oferta.productor_id)
            if productor:
                productor.contratos_cumplidos += 1
                sesion.add(productor)

    sesion.commit()
    sesion.refresh(tramo)
    return tramo


# ══════════════════════════════════════════════════════════════════
# 5. Emergencias y Fondo Solidario
# ══════════════════════════════════════════════════════════════════

class CrearEmergenciaBody(BaseModel):
    contrato_id: int
    productor_id: int
    motivo: str
    url_evidencia: str
    monto_solicitado_usdc: float


@app.post("/emergencias", tags=["emergencias"])
def reportar_emergencia(
    body: CrearEmergenciaBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    El productor reporta un desastre natural con evidencia.
    Registra el ReporteEmergencia y pasa el contrato al estado 'en_disputa'.

    Próximo paso (cuando el API key esté listo):
        Llamar a Trustless Work para abrir la disputa formal en el escrow.
    """
    contrato = sesion.get(Contrato, body.contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado.")

    validar_transicion_estado("contrato", contrato.estado, "en_disputa")

    productor = sesion.get(Usuario, body.productor_id)
    if not productor:
        raise HTTPException(status_code=404, detail="Productor no encontrado.")

    reporte = ReporteEmergencia(
        contrato_id=body.contrato_id,
        productor_id=body.productor_id,
        motivo=body.motivo,
        url_evidencia=body.url_evidencia,
        monto_solicitado_usdc=body.monto_solicitado_usdc,
    )
    sesion.add(reporte)

    # Pasa el contrato a "en_disputa"
    contrato.estado = "en_disputa"

    sesion.commit()
    sesion.refresh(reporte)
    return reporte


@app.get("/emergencias", tags=["emergencias"])
def listar_emergencias(sesion: Session = Depends(obtener_sesion)):
    """Lista todos los reportes de emergencia."""
    return sesion.exec(select(ReporteEmergencia)).all()


@app.post("/emergencias/{emergencia_id}/aprobar", tags=["emergencias"])
def aprobar_emergencia(
    emergencia_id: int,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Aprueba un reporte de emergencia verificado por la plataforma.
    - Por cada tramo no liberado, disputa y resuelve el tramo reembolsando al comprador.
    - Verifica saldo disponible en el Fondo Solidario de Emergencia.
    - Desembolsa auxilio al productor desde el Fondo Solidario vía Stellar.
    - Registra el MovimientoFondo, pasa el reporte a 'aprobado' y el contrato a 'resuelto_emergencia'.
    """
    reporte = sesion.get(ReporteEmergencia, emergencia_id)
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte de emergencia no encontrado.")

    validar_transicion_estado("reporte_emergencia", reporte.estado, "aprobado")

    contrato = sesion.get(Contrato, reporte.contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato asociado no encontrado.")

    validar_transicion_estado("contrato", contrato.estado, "resuelto_emergencia")

    # Verificar saldo disponible en el Fondo Solidario
    saldo_actual = saldo_fondo()
    if saldo_actual < reporte.monto_solicitado_usdc:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Saldo insuficiente en el Fondo Solidario. "
                f"Disponible: {saldo_actual:.2f} USDC, Solicitado: {reporte.monto_solicitado_usdc:.2f} USDC."
            ),
        )

    # Disputar y reembolsar en Stellar los tramos no liberados
    tramos = sesion.exec(
        select(Tramo).where(Tramo.contrato_id == contrato.id).order_by(Tramo.numero_tramo)
    ).all()

    for tramo in tramos:
        if tramo.estado != "liberado":
            validar_transicion_estado("tramo", tramo.estado, "reembolsado")
            if contrato.id_contrato_escrow:
                try:
                    _, tx_res = disputar_y_resolver_tramo(
                        contrato.id_contrato_escrow,
                        tramo.numero_tramo - 1,
                        tramo.monto_usdc,
                    )
                    tramo.hash_transaccion = tx_res
                except Exception as e:
                    raise HTTPException(
                        status_code=502,
                        detail=f"Error en Stellar al disputar y reembolsar tramo #{tramo.numero_tramo}: {e}",
                    )
            tramo.estado = "reembolsado"
            sesion.add(tramo)

    # Desembolsar auxilio desde el Fondo Solidario hacia el productor
    productor = sesion.get(Usuario, reporte.productor_id)
    if not productor:
        raise HTTPException(status_code=404, detail="Productor no encontrado.")

    try:
        tx_pago = desembolsar_fondo_emergencia(productor.billetera, reporte.monto_solicitado_usdc)
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error en Stellar al desembolsar el Fondo Solidario: {e}",
        )

    reporte.hash_pago_fondo = tx_pago
    reporte.estado = "aprobado"
    contrato.estado = "resuelto_emergencia"

    # Registrar el movimiento auditable en el fondo
    movimiento = MovimientoFondo(
        tipo="desembolso_emergencia",
        monto_usdc=reporte.monto_solicitado_usdc,
        billetera_origen=FONDO_PUBLIC_KEY,
        billetera_destino=productor.billetera,
        contrato_id=contrato.id,
        hash_transaccion=tx_pago,
    )
    sesion.add(movimiento)
    sesion.add(reporte)
    sesion.add(contrato)

    sesion.commit()
    sesion.refresh(reporte)
    sesion.refresh(contrato)

    return {
        "reporte": reporte,
        "contrato": contrato,
        "tramos": tramos,
        "hash_desembolso": tx_pago,
    }


@app.post("/emergencias/{emergencia_id}/rechazar", tags=["emergencias"])
def rechazar_emergencia(
    emergencia_id: int,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Rechaza un reporte de emergencia si la evidencia no es concluyente o no procede.
    - Pasa el reporte a 'rechazado'.
    - Vuelve el contrato al estado 'activo'.
    """
    reporte = sesion.get(ReporteEmergencia, emergencia_id)
    if not reporte:
        raise HTTPException(status_code=404, detail="Reporte de emergencia no encontrado.")

    validar_transicion_estado("reporte_emergencia", reporte.estado, "rechazado")

    contrato = sesion.get(Contrato, reporte.contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato asociado no encontrado.")

    validar_transicion_estado("contrato", contrato.estado, "activo")

    reporte.estado = "rechazado"
    contrato.estado = "activo"

    sesion.commit()
    sesion.refresh(reporte)
    sesion.refresh(contrato)

    return {
        "reporte": reporte,
        "contrato": contrato,
    }


class AportarFondoBody(BaseModel):
    monto_usdc: float
    billetera_origen: Optional[str] = None
    contrato_id: Optional[int] = None
    hash_transaccion: Optional[str] = None


@app.post("/fondo/aportar", tags=["fondo"])
def aportar_al_fondo(
    body: AportarFondoBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Registra un aporte al Fondo Solidario de Emergencia.
    Por ahora registra el movimiento en base de datos; en la siguiente
    fase se verificará la transacción en Horizon.
    """
    movimiento = MovimientoFondo(
        tipo="aporte",
        monto_usdc=body.monto_usdc,
        billetera_origen=body.billetera_origen,
        billetera_destino=None,
        contrato_id=body.contrato_id,
        hash_transaccion=body.hash_transaccion,
    )
    sesion.add(movimiento)
    sesion.commit()
    sesion.refresh(movimiento)
    return movimiento


@app.get("/fondo/saldo", tags=["fondo"])
def consultar_saldo_fondo():
    """
    Devuelve el saldo real de USDC en la cuenta del Fondo Solidario de Emergencia
    consultado directamente desde Horizon con saldo_fondo().
    """
    saldo = saldo_fondo()
    return {
        "saldo_fondo_usdc": saldo,
    }


# ══════════════════════════════════════════════════════════════════
# 6. Transparencia Pública
# ══════════════════════════════════════════════════════════════════

@app.get("/transparencia", tags=["transparencia"])
def panel_transparencia(sesion: Session = Depends(obtener_sesion)):
    """
    Resumen público auditable del estado de MinKa:
    - Total de ofertas publicadas.
    - Contratos activos.
    - Saldo real del Fondo Solidario desde Horizon.
    - Últimos 10 movimientos del fondo con enlaces a Stellar Expert.
    - Últimos contratos con enlaces al visor de Trustless Work.
    - Últimos tramos con enlaces a Stellar Expert.
    - Últimos 5 reportes de emergencia.
    """
    # Totales
    total_ofertas = len(sesion.exec(select(Oferta)).all())
    contratos_activos = len(
        sesion.exec(select(Contrato).where(Contrato.estado == "activo")).all()
    )

    # Saldo real del Fondo Solidario en Horizon
    saldo_real = saldo_fondo()

    # Últimos 10 movimientos del fondo con enlaces auditables
    ultimos_movimientos = sesion.exec(
        select(MovimientoFondo).order_by(MovimientoFondo.fecha_creacion.desc()).limit(10)
    ).all()
    movimientos_data = []
    for m in ultimos_movimientos:
        item = m.model_dump()
        item["enlace_stellar_expert"] = (
            f"https://stellar.expert/explorer/testnet/tx/{m.hash_transaccion}"
            if m.hash_transaccion
            else None
        )
        movimientos_data.append(item)

    # Últimos contratos con enlaces al visor de Trustless Work
    ultimos_contratos = sesion.exec(
        select(Contrato).order_by(Contrato.fecha_creacion.desc()).limit(10)
    ).all()
    contratos_data = []
    for c in ultimos_contratos:
        item = c.model_dump()
        item["enlace_trustless_work"] = (
            f"https://viewer.trustlesswork.com/{c.id_contrato_escrow}"
            if c.id_contrato_escrow
            else None
        )
        contratos_data.append(item)

    # Últimos tramos con enlaces a Stellar Expert
    ultimos_tramos = sesion.exec(
        select(Tramo).order_by(Tramo.id.desc()).limit(15)
    ).all()
    tramos_data = []
    for t in ultimos_tramos:
        item = t.model_dump()
        item["enlace_stellar_expert"] = (
            f"https://stellar.expert/explorer/testnet/tx/{t.hash_transaccion}"
            if t.hash_transaccion
            else None
        )
        tramos_data.append(item)

    # Últimos 5 reportes de emergencia
    ultimas_emergencias = sesion.exec(
        select(ReporteEmergencia).order_by(ReporteEmergencia.fecha_creacion.desc()).limit(5)
    ).all()
    emergencias_data = []
    for e in ultimas_emergencias:
        item = e.model_dump()
        item["enlace_stellar_expert"] = (
            f"https://stellar.expert/explorer/testnet/tx/{e.hash_pago_fondo}"
            if e.hash_pago_fondo
            else None
        )
        emergencias_data.append(item)

    return {
        "modo_demo": MODO_DEMO,
        "total_ofertas": total_ofertas,
        "contratos_activos": contratos_activos,
        "saldo_fondo_usdc": saldo_real,
        "ultimos_movimientos_fondo": movimientos_data,
        "ultimos_contratos": contratos_data,
        "ultimos_tramos": tramos_data,
        "ultimas_emergencias": emergencias_data,
    }


# ══════════════════════════════════════════════════════════════════
# 7. Modo Demostración
# ══════════════════════════════════════════════════════════════════

def _verificar_modo_demo():
    """Valida que MODO_DEMO=true esté configurado en .env; si no, responde 404."""
    if not MODO_DEMO:
        raise HTTPException(
            status_code=404,
            detail="El modo demostración no está habilitado en este entorno.",
        )


@app.get("/demo/cuentas", tags=["demo"], dependencies=[Depends(_verificar_modo_demo)])
def obtener_cuentas_demo():
    """
    Devuelve las billeteras PÚBLICAS de Productor Demo, Comprador Demo y Fondo Solidario,
    junto con sus saldos USDC reales consultados en Horizon.
    Nunca devuelve claves secretas.
    """
    billetera_prod = CLAVE_PRODUCTOR_DEMO.public_key if CLAVE_PRODUCTOR_DEMO else None
    billetera_comp = CLAVE_COMPRADOR_DEMO.public_key if CLAVE_COMPRADOR_DEMO else None

    return {
        "productor_demo": {
            "billetera": billetera_prod,
            "saldo_usdc": consultar_saldo_usdc(billetera_prod) if billetera_prod else 0.0,
        },
        "comprador_demo": {
            "billetera": billetera_comp,
            "saldo_usdc": consultar_saldo_usdc(billetera_comp) if billetera_comp else 0.0,
        },
        "fondo_solidario": {
            "billetera": FONDO_PUBLIC_KEY,
            "saldo_usdc": saldo_fondo(),
        },
    }


class IniciarSesionDemoBody(BaseModel):
    rol: str  # "productor" | "comprador"


@app.post("/demo/iniciar-sesion", tags=["demo"], dependencies=[Depends(_verificar_modo_demo)])
def iniciar_sesion_demo(
    body: IniciarSesionDemoBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Crea (o devuelve) el Usuario demo con su billetera pública y nombre según el rol.
    """
    if body.rol not in ("productor", "comprador"):
        raise HTTPException(
            status_code=400,
            detail="Rol inválido. Se espera 'productor' o 'comprador'.",
        )

    if body.rol == "productor":
        if not CLAVE_PRODUCTOR_DEMO:
            raise HTTPException(status_code=500, detail="Clave de productor demo no configurada.")
        billetera = CLAVE_PRODUCTOR_DEMO.public_key
        nombre = "Productor Demo"
    else:
        if not CLAVE_COMPRADOR_DEMO:
            raise HTTPException(status_code=500, detail="Clave de comprador demo no configurada.")
        billetera = CLAVE_COMPRADOR_DEMO.public_key
        nombre = "Comprador Demo"

    usuario = sesion.exec(select(Usuario).where(Usuario.billetera == billetera)).first()
    if not usuario:
        usuario = Usuario(billetera=billetera, nombre=nombre, rol=body.rol)
        sesion.add(usuario)
        sesion.commit()
        sesion.refresh(usuario)
    else:
        if usuario.nombre != nombre or usuario.rol != body.rol:
            usuario.nombre = nombre
            usuario.rol = body.rol
            sesion.add(usuario)
            sesion.commit()
            sesion.refresh(usuario)

    return usuario


@app.post("/demo/reiniciar", tags=["demo"], dependencies=[Depends(_verificar_modo_demo)])
def reiniciar_demo(sesion: Session = Depends(obtener_sesion)):
    """
    Borra los registros de ofertas, contratos, tramos, emergencias y movimientos
    de la base de datos (NO toca la blockchain) y crea una oferta de ejemplo de 1 USDC,
    de un cultivo del Altiplano (quinua), con ubicacion='Altiplano (dato simulado)'.
    """
    from datetime import timedelta

    # Borrado en orden de dependencias de clave foránea
    sesion.exec(delete(Tramo))
    sesion.exec(delete(ReporteEmergencia))
    sesion.exec(delete(MovimientoFondo))
    sesion.exec(delete(Contrato))
    sesion.exec(delete(Oferta))
    sesion.commit()

    # Asegurar la existencia del productor demo
    if not CLAVE_PRODUCTOR_DEMO:
        raise HTTPException(status_code=500, detail="Clave de productor demo no configurada.")
    billetera_prod = CLAVE_PRODUCTOR_DEMO.public_key
    productor = sesion.exec(select(Usuario).where(Usuario.billetera == billetera_prod)).first()
    if not productor:
        productor = Usuario(billetera=billetera_prod, nombre="Productor Demo", rol="productor")
        sesion.add(productor)
        sesion.commit()
        sesion.refresh(productor)

    # Crear oferta de ejemplo de 1 USDC
    fecha_entrega = date.today() + timedelta(days=90)
    precio_final, cae = _calcular_precio_y_cae(
        precio_referencia=1.0,
        porcentaje_descuento=0.0,
        fecha_entrega=fecha_entrega,
    )

    oferta_ejemplo = Oferta(
        productor_id=productor.id,
        cultivo="Quinua Real",
        cantidad_kg=10.0,
        fecha_entrega=fecha_entrega,
        ubicacion="Altiplano (dato simulado)",
        precio_referencia_usdc=1.0,
        porcentaje_descuento=0.0,
        precio_final_usdc=precio_final,
        costo_anual_equivalente=cae,
        estado="abierta",
    )
    sesion.add(oferta_ejemplo)
    sesion.commit()
    sesion.refresh(oferta_ejemplo)

    return {
        "mensaje": "Base de datos demo reiniciada con éxito.",
        "registros_eliminados": ["tramos", "reportes_emergencia", "movimientos_fondo", "contratos", "ofertas"],
        "oferta_creada": oferta_ejemplo,
    }

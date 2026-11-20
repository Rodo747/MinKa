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

import os
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select, delete
from pydantic import BaseModel
import bcrypt
import jwt

from database import (
    crear_bd_y_tablas,
    obtener_sesion,
    validar_transicion_estado,
    engine,
)
from models import (
    Usuario,
    Oferta,
    Contrato,
    Tramo,
    ReporteEmergencia,
    MovimientoFondo,
)
from stellar_sdk import Server, StrKey
from stellar_service import (
    crear_escrow_trustless,
    fondear_escrow,
    subir_evidencia_tramo,
    aprobar_y_liberar_tramo,
    disputar_y_resolver_tramo,
    desembolsar_fondo_emergencia,
    saldo_fondo,
    consultar_saldo_usdc,
    consultar_saldos_cuenta,
    consultar_movimientos_usdc,
    enviar_pago_usdc,
    obtener_clave_usuario,
    FONDO_PUBLIC_KEY,
    PLATAFORMA_PUBLIC_KEY,
    CLAVE_PLATAFORMA,
    MODO_DEMO,
    HORIZON_URL,
    USDC_EMISOR,
    CLAVE_PRODUCTOR_DEMO,
    CLAVE_COMPRADOR_DEMO,
)

# Constantes de demostración para recarga de prueba
RECARGA_USDC = 1.0
TOPE_SALDO_RECARGA = 5.0


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

# CORS restringido al puerto 5173 para localhost, 127.0.0.1 y redes locales
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):5173$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

portador_seguridad = HTTPBearer(auto_error=False)


def _hashear_clave(clave: str) -> str:
    """Genera hash seguro bcrypt para almacenar contraseñas."""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(clave.encode("utf-8"), salt).decode("utf-8")


def _verificar_clave(clave: str, clave_hash: str) -> bool:
    """Compara una contraseña en texto plano con su hash bcrypt."""
    try:
        return bcrypt.checkpw(clave.encode("utf-8"), clave_hash.encode("utf-8"))
    except Exception:
        return False


def _generar_token_jwt(usuario_id: int) -> str:
    """Genera un token JWT firmado con JWT_SECRET y expiración de 12 horas."""
    secreto = os.getenv("JWT_SECRET", "secreto-minka-desarrollo")
    ahora = datetime.now(timezone.utc)
    expiracion = ahora + timedelta(hours=12)
    payload = {
        "sub": str(usuario_id),
        "exp": expiracion,
        "iat": ahora,
    }
    return jwt.encode(payload, secreto, algorithm="HS256")


def _obtener_usuario_actual(
    credenciales: Optional[HTTPAuthorizationCredentials] = Depends(portador_seguridad),
    sesion: Session = Depends(obtener_sesion),
) -> Usuario:
    """Valida el token Bearer y devuelve el Usuario activo."""
    if not credenciales or not credenciales.credentials:
        raise HTTPException(status_code=401, detail="Token no proporcionado o inválido")

    secreto = os.getenv("JWT_SECRET", "secreto-minka-desarrollo")
    try:
        payload = jwt.decode(credenciales.credentials, secreto, algorithms=["HS256"])
        usuario_id = int(payload.get("sub", 0))
    except Exception:
        raise HTTPException(status_code=401, detail="Token no proporcionado o inválido")

    usuario = sesion.get(Usuario, usuario_id)
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    return usuario


def _asegurar_cuentas_demo(sesion: Session) -> tuple[Usuario, Usuario]:
    """
    Crea o actualiza las cuentas demo 'productor_demo' y 'comprador_demo'
    con sus contraseñas hasheadas con bcrypt desde .env y sus wallets Stellar.
    """
    clave_prod = os.getenv("DEMO_PRODUCTOR_CLAVE", "")
    clave_comp = os.getenv("DEMO_COMPRADOR_CLAVE", "")

    billetera_prod = CLAVE_PRODUCTOR_DEMO.public_key if CLAVE_PRODUCTOR_DEMO else "BILLETERA_PRODUCTOR_DEMO_TEMP"
    hash_prod = _hashear_clave(clave_prod) if clave_prod else None

    productor = sesion.exec(
        select(Usuario).where(
            (Usuario.nombre_usuario == "productor_demo") | (Usuario.billetera == billetera_prod)
        )
    ).first()

    if not productor:
        productor = Usuario(
            billetera=billetera_prod,
            nombre_usuario="productor_demo",
            nombre="Productor Demo",
            rol="productor",
            clave_hash=hash_prod,
        )
        sesion.add(productor)
    else:
        productor.nombre_usuario = "productor_demo"
        productor.nombre = "Productor Demo"
        productor.rol = "productor"
        productor.billetera = billetera_prod
        if hash_prod:
            productor.clave_hash = hash_prod
        sesion.add(productor)

    billetera_comp = CLAVE_COMPRADOR_DEMO.public_key if CLAVE_COMPRADOR_DEMO else "BILLETERA_COMPRADOR_DEMO_TEMP"
    hash_comp = _hashear_clave(clave_comp) if clave_comp else None

    comprador = sesion.exec(
        select(Usuario).where(
            (Usuario.nombre_usuario == "comprador_demo") | (Usuario.billetera == billetera_comp)
        )
    ).first()

    if not comprador:
        comprador = Usuario(
            billetera=billetera_comp,
            nombre_usuario="comprador_demo",
            nombre="Comprador Demo",
            rol="comprador",
            clave_hash=hash_comp,
        )
        sesion.add(comprador)
    else:
        comprador.nombre_usuario = "comprador_demo"
        comprador.nombre = "Comprador Demo"
        comprador.rol = "comprador"
        comprador.billetera = billetera_comp
        if hash_comp:
            comprador.clave_hash = hash_comp
        sesion.add(comprador)

    sesion.commit()
    sesion.refresh(productor)
    sesion.refresh(comprador)
    return productor, comprador


@app.on_event("startup")
def al_iniciar():
    """Crea las tablas en SQLite y asegura las cuentas demo al arrancar el servidor."""
    crear_bd_y_tablas()
    with Session(engine) as sesion:
        _asegurar_cuentas_demo(sesion)


# ══════════════════════════════════════════════════════════════════
# 1. Salud
# ══════════════════════════════════════════════════════════════════

@app.get("/salud", tags=["salud"])
def salud():
    """Verificación rápida de que el servidor está en pie."""
    return {"estado": "ok", "proyecto": "MinKa"}


# ══════════════════════════════════════════════════════════════════
# 2. Autenticación y Usuarios
# ══════════════════════════════════════════════════════════════════

class EntrarAuthBody(BaseModel):
    usuario: str
    clave: str


@app.post("/auth/entrar", tags=["autenticacion"])
def entrar(
    body: EntrarAuthBody,
    sesion: Session = Depends(obtener_sesion),
):
    """
    Inicia sesión con nombre de usuario y contraseña.
    Responde con token JWT y datos de usuario (sin secretos).
    Error 401 genérico: 'Usuario o contraseña incorrectos'.
    """
    usuario = sesion.exec(
        select(Usuario).where(Usuario.nombre_usuario == body.usuario)
    ).first()

    if not usuario or not usuario.clave_hash:
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    if not _verificar_clave(body.clave, usuario.clave_hash):
        raise HTTPException(status_code=401, detail="Usuario o contraseña incorrectos")

    token = _generar_token_jwt(usuario.id)
    return {
        "token": token,
        "usuario": {
            "id": usuario.id,
            "nombre": usuario.nombre,
            "nombre_usuario": usuario.nombre_usuario,
            "perfil_por_defecto": usuario.rol,
        },
    }


@app.get("/auth/yo", tags=["autenticacion"])
def obtener_yo(
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
):
    """
    Devuelve los datos del usuario autenticado a partir del token Bearer,
    incluyendo su dirección pública en Stellar y contratos cumplidos.
    """
    return {
        "id": usuario_actual.id,
        "nombre": usuario_actual.nombre,
        "nombre_usuario": usuario_actual.nombre_usuario,
        "perfil_por_defecto": usuario_actual.rol,
        "direccion_stellar": usuario_actual.billetera,
        "contratos_cumplidos": usuario_actual.contratos_cumplidos,
    }


# ══════════════════════════════════════════════════════════════════
# 2.1 Gestión de Cuenta, Saldo y Movimientos
# ══════════════════════════════════════════════════════════════════

@app.get("/cuenta/saldo", tags=["cuenta"])
def obtener_saldo_cuenta(
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
):
    """
    Devuelve {direccion, saldo_usdc, saldo_xlm} consultado en Horizon para la cuenta Stellar del usuario.
    """
    return consultar_saldos_cuenta(usuario_actual.billetera)


@app.get("/cuenta/movimientos", tags=["cuenta"])
def obtener_movimientos_cuenta(
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
):
    """
    Devuelve los últimos 10 pagos en USDC de la cuenta desde Horizon.
    """
    return consultar_movimientos_usdc(usuario_actual.billetera, limite=10)


@app.post("/cuenta/recargar", tags=["cuenta"])
def recargar_saldo_prueba(
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
):
    """
    Envía una cantidad fija de USDC (RECARGA_USDC=1) desde la cuenta PLATAFORMA a la cuenta del usuario.
    Solo disponible si MODO_DEMO=true.
    """
    if not MODO_DEMO:
        raise HTTPException(
            status_code=404,
            detail="La recarga de prueba solo está disponible en modo demostración.",
        )

    saldo_actual = consultar_saldo_usdc(usuario_actual.billetera)
    if saldo_actual >= TOPE_SALDO_RECARGA:
        raise HTTPException(
            status_code=400,
            detail="Ya tienes saldo suficiente para probar",
        )

    if not CLAVE_PLATAFORMA:
        raise HTTPException(
            status_code=503,
            detail="La recarga de prueba no está disponible por ahora",
        )

    saldo_plataforma = consultar_saldo_usdc(PLATAFORMA_PUBLIC_KEY)
    if saldo_plataforma < RECARGA_USDC:
        raise HTTPException(
            status_code=503,
            detail="La recarga de prueba no está disponible por ahora",
        )

    try:
        tx_hash = enviar_pago_usdc(
            clave_origen=CLAVE_PLATAFORMA,
            billetera_destino=usuario_actual.billetera,
            monto_usdc=RECARGA_USDC,
            memo="Recarga Demo MinKa",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al enviar recarga en Stellar: {e}",
        )

    return {
        "hash": tx_hash,
        "monto_usdc": RECARGA_USDC,
    }


class RetirarBody(BaseModel):
    direccion: str
    monto: float


@app.post("/cuenta/retirar", tags=["cuenta"])
def retirar_fondos(
    body: RetirarBody,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
):
    """
    Envía USDC desde la cuenta del usuario a una dirección Stellar, firmando con su clave.
    """
    # 1. Dirección Stellar válida
    if not StrKey.is_valid_ed25519_public_key(body.direccion):
        raise HTTPException(
            status_code=400,
            detail="Dirección Stellar inválida.",
        )

    # 2. Destino igual a la propia cuenta
    if body.direccion == usuario_actual.billetera:
        raise HTTPException(
            status_code=400,
            detail="La cuenta de destino no puede ser tu propia cuenta.",
        )

    # 3. Monto no positivo
    if body.monto <= 0:
        raise HTTPException(
            status_code=400,
            detail="El monto a retirar debe ser mayor a cero.",
        )

    # 4. Saldo suficiente
    saldo_actual = consultar_saldo_usdc(usuario_actual.billetera)
    if body.monto > saldo_actual:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente. Tu saldo actual es de {saldo_actual:.2f} USDC.",
        )

    # 5. Destino existe y tiene trustline de USDC
    try:
        servidor = Server(HORIZON_URL)
        cuenta_destino = servidor.load_account(body.direccion)
    except Exception:
        raise HTTPException(
            status_code=400,
            detail="La cuenta de destino no existe en la red Stellar.",
        )

    tiene_trustline = any(
        b.get("asset_code") == "USDC" and b.get("asset_issuer") == USDC_EMISOR
        for b in cuenta_destino.raw_data.get("balances", [])
    )
    if not tiene_trustline:
        raise HTTPException(
            status_code=400,
            detail="La cuenta de destino no puede recibir USDC",
        )

    # 6. Clave del usuario
    clave_usuario = obtener_clave_usuario(usuario_actual)
    if not clave_usuario:
        raise HTTPException(
            status_code=400,
            detail="No se dispone de la clave para firmar la transacción en este entorno.",
        )

    try:
        tx_hash = enviar_pago_usdc(
            clave_origen=clave_usuario,
            billetera_destino=body.direccion,
            monto_usdc=body.monto,
            memo="Retiro MinKa",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error en Stellar al procesar el retiro: {e}",
        )

    return {
        "hash": tx_hash,
        "monto_usdc": body.monto,
    }


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
    cultivo: str
    cantidad_kg: float
    fecha_entrega: date          # YYYY-MM-DD
    ubicacion: str
    precio_referencia_usdc: float
    porcentaje_descuento: float  # 0–100
    productor_id: Optional[int] = None


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
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Crea una oferta de preventa de cosecha.
    Calcula automáticamente el precio final y el costo anual equivalente del descuento.
    La identidad del productor se toma siempre del token de autenticación.
    """
    productor_id = usuario_actual.id

    precio_final, cae = _calcular_precio_y_cae(
        precio_referencia=body.precio_referencia_usdc,
        porcentaje_descuento=body.porcentaje_descuento,
        fecha_entrega=body.fecha_entrega,
    )

    nueva_oferta = Oferta(
        productor_id=productor_id,
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
    monto_total_usdc: float
    comprador_id: Optional[int] = None


@app.post("/contratos", tags=["contratos"])
def crear_contrato(
    body: CrearContratoBody,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Crea un contrato de compraventa y sus 3 tramos automáticamente (40/30/30).
    Despliega el contrato de escrow multi-release en Stellar vía Trustless Work
    y guarda el id_contrato_escrow devuelto. El estado queda 'pendiente_fondeo'.
    El comprador_id se toma siempre del usuario autenticado en el token.
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

    # Identidad del comprador desde el token
    comprador_id = usuario_actual.id

    # Prohibición de comprar la propia oferta
    if comprador_id == oferta.productor_id:
        raise HTTPException(
            status_code=400,
            detail="Un productor no puede comprar su propia oferta.",
        )

    # Verificar productor
    productor = sesion.get(Usuario, oferta.productor_id)
    if not productor:
        raise HTTPException(status_code=404, detail="Productor no encontrado.")

    comprador = usuario_actual

    # Crear el contrato en estado pendiente_fondeo
    nuevo_contrato = Contrato(
        oferta_id=body.oferta_id,
        comprador_id=comprador_id,
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
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Fondea el escrow en Stellar con la clave del comprador.
    Solo aplica si el contrato está en 'pendiente_fondeo'.
    Solo el comprador del contrato puede fondearlo.
    Pasa el contrato a 'activo' y la oferta a 'fondeada'.
    Luego libera automáticamente el tramo 1 ('Anticipo automático' / 'cobra hoy').
    """
    contrato = sesion.get(Contrato, contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado.")

    if contrato.comprador_id != usuario_actual.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el comprador del contrato puede fondearlo.",
        )

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
def listar_contratos(
    como: Optional[str] = Query(None, description="Filtrar por rol: 'productor' o 'comprador'"),
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Lista los contratos del usuario autenticado según el rol ('como=productor' o 'como=comprador').
    Devuelve datos enriquecidos con cultivo y tramo actual.
    """
    if como == "productor":
        query = (
            select(Contrato)
            .join(Oferta, Contrato.oferta_id == Oferta.id)
            .where(Oferta.productor_id == usuario_actual.id)
            .order_by(Contrato.fecha_creacion.desc())
        )
    elif como == "comprador":
        query = (
            select(Contrato)
            .where(Contrato.comprador_id == usuario_actual.id)
            .order_by(Contrato.fecha_creacion.desc())
        )
    else:
        query = (
            select(Contrato)
            .outerjoin(Oferta, Contrato.oferta_id == Oferta.id)
            .where(
                (Contrato.comprador_id == usuario_actual.id)
                | (Oferta.productor_id == usuario_actual.id)
            )
            .order_by(Contrato.fecha_creacion.desc())
        )

    contratos = sesion.exec(query).all()
    resultado = []
    for c in contratos:
        oferta = sesion.get(Oferta, c.oferta_id)
        tramos = sesion.exec(
            select(Tramo).where(Tramo.contrato_id == c.id).order_by(Tramo.numero_tramo)
        ).all()

        tramo_actual = None
        for t in tramos:
            if t.estado not in ("liberado", "reembolsado"):
                tramo_actual = f"Tramo {t.numero_tramo}: {t.titulo}"
                break
        if not tramo_actual and tramos:
            tramo_actual = f"Tramo {tramos[-1].numero_tramo}: {tramos[-1].titulo} (finalizado)"

        c_dict = c.model_dump()
        c_dict["cultivo"] = oferta.cultivo if oferta else "Desconocido"
        c_dict["ubicacion"] = oferta.ubicacion if oferta else ""
        c_dict["fecha_entrega"] = str(oferta.fecha_entrega) if oferta else None
        c_dict["productor_id"] = oferta.productor_id if oferta else None
        c_dict["tramo_actual"] = tramo_actual
        resultado.append(c_dict)

    return resultado


@app.get("/contratos/{contrato_id}", tags=["contratos"])
def obtener_contrato(
    contrato_id: int,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """Devuelve el contrato con sus 3 tramos y enlaces verificables. Solo participantes."""
    contrato = sesion.get(Contrato, contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado.")

    oferta = sesion.get(Oferta, contrato.oferta_id)
    es_comprador = contrato.comprador_id == usuario_actual.id
    es_productor = oferta is not None and oferta.productor_id == usuario_actual.id

    if not es_comprador and not es_productor:
        raise HTTPException(status_code=403, detail="No tienes permiso para ver este contrato.")

    tramos = sesion.exec(
        select(Tramo)
        .where(Tramo.contrato_id == contrato_id)
        .order_by(Tramo.numero_tramo)
    ).all()

    contrato_dict = contrato.model_dump()
    contrato_dict["cultivo"] = oferta.cultivo if oferta else "Desconocido"
    contrato_dict["ubicacion"] = oferta.ubicacion if oferta else ""
    contrato_dict["fecha_entrega"] = str(oferta.fecha_entrega) if oferta else None
    contrato_dict["productor_id"] = oferta.productor_id if oferta else None
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

    reporte_emergencia = sesion.exec(
        select(ReporteEmergencia)
        .where(ReporteEmergencia.contrato_id == contrato_id)
        .order_by(ReporteEmergencia.fecha_creacion.desc())
    ).first()

    reporte_dict = None
    if reporte_emergencia:
        reporte_dict = reporte_emergencia.model_dump()
        reporte_dict["enlace_stellar_expert"] = (
            f"https://stellar.expert/explorer/testnet/tx/{reporte_emergencia.hash_pago_fondo}"
            if reporte_emergencia.hash_pago_fondo
            else None
        )

    return {"contrato": contrato_dict, "tramos": tramos_data, "reporte_emergencia": reporte_dict}


class EvidenciaTramoBody(BaseModel):
    url_evidencia: str


@app.post("/tramos/{tramo_id}/evidencia", tags=["contratos"])
def registrar_evidencia_tramo(
    tramo_id: int,
    body: EvidenciaTramoBody,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    El productor sube la evidencia de avance de un tramo.
    Valida que el tramo esté 'pendiente' antes de pasar a 'en_revision'
    y llama a subir_evidencia_tramo en Stellar.
    Solo el productor del contrato puede subir evidencia.
    """
    tramo = sesion.get(Tramo, tramo_id)
    if not tramo:
        raise HTTPException(status_code=404, detail="Tramo no encontrado.")

    url = body.url_evidencia.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(
            status_code=400,
            detail="La URL de evidencia no es válida. Debe comenzar con http:// o https://",
        )

    contrato = sesion.get(Contrato, tramo.contrato_id)
    if not contrato or not contrato.id_contrato_escrow:
        raise HTTPException(status_code=400, detail="El contrato no tiene un escrow asignado en Stellar.")

    oferta = sesion.get(Oferta, contrato.oferta_id)
    if not oferta or oferta.productor_id != usuario_actual.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el productor del contrato puede subir evidencia.",
        )

    validar_transicion_estado("tramo", tramo.estado, "en_revision")

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
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Aprueba y libera un tramo que ha presentado evidencia y está en revisión.
    Llama a aprobar_y_liberar_tramo en Stellar, guarda hash_transaccion y estado 'liberado'.
    Solo el comprador del contrato puede aprobar este tramo.
    Si era el tramo 3, pasa el contrato a 'completado', la oferta a 'completada'
    y suma 1 a contratos_cumplidos del productor.
    """
    tramo = sesion.get(Tramo, tramo_id)
    if not tramo:
        raise HTTPException(status_code=404, detail="Tramo no encontrado.")

    contrato = sesion.get(Contrato, tramo.contrato_id)
    if not contrato or not contrato.id_contrato_escrow:
        raise HTTPException(status_code=400, detail="El contrato no tiene un escrow asignado en Stellar.")

    if contrato.comprador_id != usuario_actual.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el comprador del contrato puede aprobar este tramo.",
        )

    validar_transicion_estado("tramo", tramo.estado, "liberado")

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
    motivo: str
    url_evidencia: str
    monto_solicitado_usdc: float
    productor_id: Optional[int] = None


@app.post("/emergencias", tags=["emergencias"])
def reportar_emergencia(
    body: CrearEmergenciaBody,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    El productor reporta un desastre natural con evidencia.
    Registra el ReporteEmergencia y pasa el contrato al estado 'en_disputa'.
    Solo el productor del contrato puede reportar una emergencia.
    """
    contrato = sesion.get(Contrato, body.contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado.")

    oferta = sesion.get(Oferta, contrato.oferta_id)
    if not oferta or oferta.productor_id != usuario_actual.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el productor del contrato puede reportar una emergencia.",
        )

    validar_transicion_estado("contrato", contrato.estado, "en_disputa")

    url = body.url_evidencia.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        raise HTTPException(
            status_code=400,
            detail="La URL de evidencia no es válida. Debe comenzar con http:// o https://",
        )

    reporte = ReporteEmergencia(
        contrato_id=body.contrato_id,
        productor_id=usuario_actual.id,
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
    """
    Lista todos los reportes de emergencia enriquecidos con datos del contrato,
    cultivo, evidencia, monto y enlaces para el panel de administración /demo.
    """
    reportes = sesion.exec(
        select(ReporteEmergencia).order_by(ReporteEmergencia.id.desc())
    ).all()
    resultado = []
    for r in reportes:
        contrato = sesion.get(Contrato, r.contrato_id)
        oferta = sesion.get(Oferta, contrato.oferta_id) if contrato else None
        item = r.model_dump()
        item["contrato"] = r.contrato_id
        item["cultivo"] = oferta.cultivo if oferta else "Cultivo no especificado"
        item["tipo_desastre"] = r.motivo
        item["descripcion"] = r.motivo
        item["enlace_evidencia"] = r.url_evidencia
        item["monto_solicitado"] = r.monto_solicitado_usdc
        item["fecha"] = r.fecha_creacion.isoformat() if r.fecha_creacion else None
        item["enlace_stellar_expert"] = (
            f"https://stellar.expert/explorer/testnet/tx/{r.hash_pago_fondo}"
            if r.hash_pago_fondo
            else None
        )
        resultado.append(item)
    return resultado


@app.post("/emergencias/{emergencia_id}/aprobar", tags=["emergencias"], dependencies=[Depends(_verificar_modo_demo)])
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

    # Registrar el movimiento verificable en el fondo
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


@app.post("/emergencias/{emergencia_id}/rechazar", tags=["emergencias"], dependencies=[Depends(_verificar_modo_demo)])
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
    Resumen público verificable del estado de MinKa:
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

    # Últimos 10 movimientos del fondo con enlaces verificables
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
        "billetera_fondo": FONDO_PUBLIC_KEY,
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

    productor, comprador = _asegurar_cuentas_demo(sesion)
    return productor if body.rol == "productor" else comprador


@app.post("/demo/reiniciar", tags=["demo"], dependencies=[Depends(_verificar_modo_demo)])
def reiniciar_demo(sesion: Session = Depends(obtener_sesion)):
    """
    Borra los registros de ofertas, contratos, tramos, emergencias y movimientos
    de la base de datos (NO toca la blockchain) y siembra 3 ofertas de ejemplo de productor_demo:
    1. Quinua Real (Altiplano, 2027-05-15, 15% desc)
    2. Café (Yungas, La Paz, 2027-08-15, 18% desc)
    3. Sésamo (Chiquitania, Santa Cruz, 2027-05-30, 12% desc)
    """
    # Borrado en orden de dependencias de clave foránea
    sesion.exec(delete(Tramo))
    sesion.exec(delete(ReporteEmergencia))
    sesion.exec(delete(MovimientoFondo))
    sesion.exec(delete(Contrato))
    sesion.exec(delete(Oferta))
    sesion.commit()

    # Asegurar la existencia de ambas cuentas demo con sus credenciales
    productor, _ = _asegurar_cuentas_demo(sesion)

    # Configuración de las 3 ofertas de ejemplo (orden de magnitud ~ 1 USDC total)
    config_ofertas = [
        {
            "cultivo": "Quinua Real",
            "ubicacion": "Altiplano (dato simulado)",
            "fecha_entrega": date(2027, 5, 15),
            "porcentaje_descuento": 15.0,
            "cantidad_kg": 1.0,
            "precio_referencia_usdc": 1.0,
        },
        {
            "cultivo": "Café",
            "ubicacion": "Yungas, La Paz (dato simulado)",
            "fecha_entrega": date(2027, 8, 15),
            "porcentaje_descuento": 18.0,
            "cantidad_kg": 0.5,
            "precio_referencia_usdc": 2.0,
        },
        {
            "cultivo": "Sésamo",
            "ubicacion": "Chiquitania, Santa Cruz (dato simulado)",
            "fecha_entrega": date(2027, 5, 30),
            "porcentaje_descuento": 12.0,
            "cantidad_kg": 1.0,
            "precio_referencia_usdc": 1.0,
        },
    ]

    ofertas_creadas = []
    for cfg in config_ofertas:
        precio_final, cae = _calcular_precio_y_cae(
            precio_referencia=cfg["precio_referencia_usdc"],
            porcentaje_descuento=cfg["porcentaje_descuento"],
            fecha_entrega=cfg["fecha_entrega"],
        )
        oferta = Oferta(
            productor_id=productor.id,
            cultivo=cfg["cultivo"],
            cantidad_kg=cfg["cantidad_kg"],
            fecha_entrega=cfg["fecha_entrega"],
            ubicacion=cfg["ubicacion"],
            precio_referencia_usdc=cfg["precio_referencia_usdc"],
            porcentaje_descuento=cfg["porcentaje_descuento"],
            precio_final_usdc=precio_final,
            costo_anual_equivalente=cae,
            estado="abierta",
        )
        sesion.add(oferta)
        ofertas_creadas.append(oferta)

    sesion.commit()
    for o in ofertas_creadas:
        sesion.refresh(o)

    return {
        "mensaje": "Base de datos demo reiniciada con éxito.",
        "registros_eliminados": ["tramos", "reportes_emergencia", "movimientos_fondo", "contratos", "ofertas"],
        "oferta_creada": ofertas_creadas[0],
        "ofertas_creadas": ofertas_creadas,
    }


@app.get("/demo/estado", tags=["demo"], dependencies=[Depends(_verificar_modo_demo)])
def estado_demo():
    """
    Devuelve los saldos en USDC y direcciones públicas de la Plataforma y del Fondo Solidario,
    leídos de Horizon en la red Stellar Testnet. Sin claves secretas.
    """
    saldos_plat = consultar_saldos_cuenta(PLATAFORMA_PUBLIC_KEY)
    saldos_fondo = consultar_saldos_cuenta(FONDO_PUBLIC_KEY)
    return {
        "saldo_plataforma_usdc": saldos_plat["saldo_usdc"],
        "direccion_plataforma": PLATAFORMA_PUBLIC_KEY,
        "saldo_fondo_usdc": saldos_fondo["saldo_usdc"],
        "direccion_fondo": FONDO_PUBLIC_KEY,
    }

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
import json
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, Depends, HTTPException, Query, UploadFile, File
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select, delete
from sqlalchemy import func
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
    Resena,
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

# Parámetro inicial, a calibrar con cooperativas
PORCENTAJE_MAXIMO_AUXILIO = 50


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

# Carpeta de archivos subidos y servicio estático
RUTA_SUBIDAS = os.path.join(os.path.dirname(__file__), "subidas")
os.makedirs(RUTA_SUBIDAS, exist_ok=True)
app.mount("/subidas", StaticFiles(directory=RUTA_SUBIDAS), name="subidas")

DEPARTAMENTOS_BOLIVIA = {
    "Beni", "Chuquisaca", "Cochabamba", "La Paz", "Oruro", "Pando", "Potosí", "Santa Cruz", "Tarija"
}
FORMAS_ENTREGA = {"retiro_en_finca", "entrega_en_ciudad", "a_convenir"}


def _validar_y_guardar_imagen(archivo_bytes: bytes) -> str:
    """
    Verifica que el archivo no supere 5 MB y que sea JPEG, PNG o WEBP
    a través de los primeros bytes del archivo (magic bytes).
    Guarda con nombre aleatorio uuid y devuelve la ruta '/subidas/<archivo>'.
    """
    if len(archivo_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="El archivo excede el tamaño máximo permitido de 5 MB.",
        )

    if archivo_bytes.startswith(b"\xff\xd8\xff"):
        ext = ".jpg"
    elif archivo_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
        ext = ".png"
    elif archivo_bytes.startswith(b"RIFF") and len(archivo_bytes) >= 12 and archivo_bytes[8:12] == b"WEBP":
        ext = ".webp"
    else:
        raise HTTPException(
            status_code=400,
            detail="Formato de imagen no permitido. Solo se aceptan JPEG, PNG o WEBP.",
        )

    nombre_archivo = f"{uuid.uuid4().hex}{ext}"
    ruta_destino = os.path.join(RUTA_SUBIDAS, nombre_archivo)
    with open(ruta_destino, "wb") as f:
        f.write(archivo_bytes)

    return f"/subidas/{nombre_archivo}"


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


def _verificar_modo_demo():
    """Valida que MODO_DEMO=true esté configurado en .env; si no, responde 404."""
    if not MODO_DEMO:
        raise HTTPException(
            status_code=404,
            detail="El modo demostración no está habilitado en este entorno.",
        )


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
            biografia="Perfil de demostración (dato simulado)",
            foto_perfil=None,
            whatsapp=None,
            departamento="Potosí",
        )
        sesion.add(productor)
    else:
        productor.nombre_usuario = "productor_demo"
        productor.nombre = "Productor Demo"
        productor.rol = "productor"
        productor.billetera = billetera_prod
        productor.biografia = "Perfil de demostración (dato simulado)"
        productor.foto_perfil = None
        productor.whatsapp = None
        productor.departamento = "Potosí"
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
            biografia="Perfil de demostración (dato simulado)",
            foto_perfil=None,
            whatsapp=None,
        )
        sesion.add(comprador)
    else:
        comprador.nombre_usuario = "comprador_demo"
        comprador.nombre = "Comprador Demo"
        comprador.rol = "comprador"
        comprador.billetera = billetera_comp
        comprador.biografia = "Perfil de demostración (dato simulado)"
        comprador.foto_perfil = None
        comprador.whatsapp = None
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
# 1.1 Subida de Archivos
# ══════════════════════════════════════════════════════════════════

@app.post("/subidas", tags=["archivos"])
async def subir_archivo(
    archivo: UploadFile = File(...),
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
):
    """
    Subida de imágenes autenticada. Acepta solo JPEG, PNG o WEBP hasta 5 MB.
    Verifica el tipo real por los primeros bytes y guarda con nombre aleatorio.
    """
    contenido = await archivo.read()
    ruta = _validar_y_guardar_imagen(contenido)
    return {"ruta": ruta}


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
    incluyendo su dirección pública en Stellar, contratos cumplidos y datos de perfil.
    """
    return {
        "id": usuario_actual.id,
        "nombre": usuario_actual.nombre,
        "nombre_usuario": usuario_actual.nombre_usuario,
        "perfil_por_defecto": usuario_actual.rol,
        "direccion_stellar": usuario_actual.billetera,
        "contratos_cumplidos": usuario_actual.contratos_cumplidos,
        "biografia": usuario_actual.biografia,
        "departamento": usuario_actual.departamento,
        "foto_perfil": usuario_actual.foto_perfil,
        "cultivos": usuario_actual.cultivos,
        "anios_experiencia": usuario_actual.anios_experiencia,
        "whatsapp": usuario_actual.whatsapp,
    }


class ActualizarPerfilBody(BaseModel):
    biografia: Optional[str] = None
    departamento: Optional[str] = None
    foto_perfil: Optional[str] = None
    cultivos: Optional[str] = None
    anios_experiencia: Optional[int] = None
    whatsapp: Optional[str] = None


@app.put("/cuenta/perfil", tags=["cuenta"])
def actualizar_perfil(
    body: ActualizarPerfilBody,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Actualiza el perfil público del usuario autenticado.
    El WhatsApp se valida como 8 dígitos locales que comiencen con 6 o 7,
    y se almacena con el prefijo internacional 591.
    """
    if body.biografia is not None:
        if len(body.biografia) > 600:
            raise HTTPException(
                status_code=400,
                detail="La biografía no puede superar los 600 caracteres.",
            )
        usuario_actual.biografia = body.biografia.strip() if body.biografia.strip() else None

    if body.departamento is not None:
        dep = body.departamento.strip()
        if dep:
            if dep not in DEPARTAMENTOS_BOLIVIA:
                raise HTTPException(
                    status_code=400,
                    detail="Departamento inválido. Debe ser uno de los 9 departamentos oficiales de Bolivia.",
                )
            usuario_actual.departamento = dep
        else:
            usuario_actual.departamento = None

    if body.foto_perfil is not None:
        usuario_actual.foto_perfil = body.foto_perfil.strip() if body.foto_perfil.strip() else None

    if body.cultivos is not None:
        usuario_actual.cultivos = body.cultivos.strip() if body.cultivos.strip() else None

    if body.anios_experiencia is not None:
        if body.anios_experiencia < 0:
            raise HTTPException(
                status_code=400,
                detail="Los años de experiencia deben ser mayores o iguales a cero.",
            )
        usuario_actual.anios_experiencia = body.anios_experiencia

    if body.whatsapp is not None:
        limpio = body.whatsapp.strip().replace(" ", "").replace("-", "").replace("+", "")
        if limpio == "":
            usuario_actual.whatsapp = None
        elif len(limpio) == 8 and limpio.isdigit() and limpio[0] in ("6", "7"):
            usuario_actual.whatsapp = f"591{limpio}"
        elif len(limpio) == 11 and limpio.startswith("591") and limpio[3] in ("6", "7") and limpio.isdigit():
            usuario_actual.whatsapp = limpio
        else:
            raise HTTPException(
                status_code=400,
                detail="El número de WhatsApp debe tener 8 dígitos locales y comenzar con 6 o 7.",
            )

    sesion.add(usuario_actual)
    sesion.commit()
    sesion.refresh(usuario_actual)

    return {
        "id": usuario_actual.id,
        "nombre": usuario_actual.nombre,
        "nombre_usuario": usuario_actual.nombre_usuario,
        "perfil_por_defecto": usuario_actual.rol,
        "direccion_stellar": usuario_actual.billetera,
        "contratos_cumplidos": usuario_actual.contratos_cumplidos,
        "biografia": usuario_actual.biografia,
        "departamento": usuario_actual.departamento,
        "foto_perfil": usuario_actual.foto_perfil,
        "cultivos": usuario_actual.cultivos,
        "anios_experiencia": usuario_actual.anios_experiencia,
        "whatsapp": usuario_actual.whatsapp,
    }


@app.get("/productores/{productor_id}", tags=["productores"])
def obtener_perfil_productor(
    productor_id: int,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Devuelve los datos del perfil público de un productor.
    Nunca expone nombre_usuario, claves ni datos de Stellar.
    """
    productor = sesion.get(Usuario, productor_id)
    if not productor:
        raise HTTPException(status_code=404, detail="Productor no encontrado.")

    perfil = {
        "id": productor.id,
        "nombre": productor.nombre or "Productor MinKa",
        "departamento": productor.departamento,
        "biografia": productor.biografia,
        "foto_perfil": productor.foto_perfil,
        "cultivos": productor.cultivos,
        "anios_experiencia": productor.anios_experiencia,
        "en_minka_desde": productor.fecha_creacion.isoformat() if productor.fecha_creacion else None,
        "contratos_cumplidos": productor.contratos_cumplidos,
    }
    if productor.whatsapp:
        perfil["whatsapp"] = productor.whatsapp

    # Reseñas del productor (Prompt 8.5)
    resenas_query = (
        select(Resena, Usuario.nombre)
        .join(Usuario, Resena.comprador_id == Usuario.id)
        .where(Resena.productor_id == productor_id)
        .order_by(Resena.fecha_creacion.desc())
    )
    resenas_todas = sesion.exec(resenas_query).all()
    resenas_cantidad = len(resenas_todas)
    if resenas_cantidad > 0:
        suma_estrellas = sum(r[0].estrellas for r in resenas_todas)
        calificacion_promedio = round(suma_estrellas / resenas_cantidad, 1)
    else:
        calificacion_promedio = None

    ultimas_resenas = []
    for r, comp_nombre in resenas_todas[:10]:
        ultimas_resenas.append({
            "id": r.id,
            "estrellas": r.estrellas,
            "comentario": r.comentario,
            "fecha": r.fecha_creacion.isoformat() if r.fecha_creacion else None,
            "comprador_nombre": comp_nombre or "Comprador MinKa",
        })

    perfil["calificacion_promedio"] = calificacion_promedio
    perfil["resenas_cantidad"] = resenas_cantidad
    perfil["resenas"] = ultimas_resenas

    return perfil


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

TIPOS_CERTIFICACION_VALIDOS = {
    "organico",
    "comercio_justo",
    "buenas_practicas",
    "sanitario",
    "otra",
}


class CrearOfertaBody(BaseModel):
    cultivo: str
    cantidad_kg: float
    fecha_entrega: date          # YYYY-MM-DD
    precio_referencia_usdc: float
    porcentaje_descuento: float  # 0–100
    departamento: str            # Uno de los 9 oficiales de Bolivia
    provincia: str
    descripcion: str             # Máx. 1000 caracteres
    forma_entrega: str           # "retiro_en_finca" | "entrega_en_ciudad" | "a_convenir"
    comunidad: Optional[str] = None
    variedad: Optional[str] = None
    superficie_ha: Optional[float] = None
    fecha_siembra: Optional[date] = None
    lugar_entrega: Optional[str] = None
    practicas_cultivo: Optional[str] = None
    fotos: Optional[list[str]] = []
    certificaciones: Optional[list[dict]] = None
    ubicacion: Optional[str] = None
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


def _formatear_oferta_dict(
    oferta: Oferta,
    sesion: Session,
    mapa_calificaciones: Optional[dict[int, tuple[Optional[float], int]]] = None,
) -> dict:
    """Deserializa fotos a lista y agrega metadatos del productor a la respuesta."""
    productor = sesion.get(Usuario, oferta.productor_id)
    fotos_lista = []
    if oferta.fotos:
        try:
            fotos_lista = json.loads(oferta.fotos)
            if not isinstance(fotos_lista, list):
                fotos_lista = []
        except Exception:
            fotos_lista = []

    res = oferta.model_dump()
    res["fotos"] = fotos_lista
    res["productor_nombre"] = productor.nombre if productor else "Productor MinKa"
    res["productor_foto"] = productor.foto_perfil if productor else None
    if productor and productor.whatsapp:
        res["productor_whatsapp"] = productor.whatsapp

    if mapa_calificaciones is not None:
        promedio, cantidad = mapa_calificaciones.get(oferta.productor_id, (None, 0))
    else:
        stats = sesion.exec(
            select(func.avg(Resena.estrellas), func.count(Resena.id))
            .where(Resena.productor_id == oferta.productor_id)
        ).first()
        promedio = round(float(stats[0]), 1) if stats and stats[0] is not None else None
        cantidad = int(stats[1]) if stats and stats[1] is not None else 0

    res["productor_calificacion_promedio"] = promedio
    res["productor_resenas_cantidad"] = cantidad

    cert_lista = []
    if getattr(oferta, "certificaciones", None):
        try:
            cert_lista = json.loads(oferta.certificaciones)
            if not isinstance(cert_lista, list):
                cert_lista = []
        except Exception:
            cert_lista = []
    res["certificaciones"] = cert_lista
    return res


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

    # Validaciones Prompt 7
    dep = body.departamento.strip()
    if dep not in DEPARTAMENTOS_BOLIVIA:
        raise HTTPException(
            status_code=400,
            detail="Departamento inválido. Debe ser uno de los 9 departamentos de Bolivia.",
        )

    prov = body.provincia.strip()
    if not prov:
        raise HTTPException(status_code=400, detail="La provincia es requerida.")

    desc = body.descripcion.strip()
    if not desc:
        raise HTTPException(status_code=400, detail="La descripción es requerida.")
    if len(desc) > 1000:
        raise HTTPException(
            status_code=400,
            detail="La descripción no puede exceder los 1000 caracteres.",
        )

    if body.forma_entrega not in FORMAS_ENTREGA:
        raise HTTPException(
            status_code=400,
            detail="Forma de entrega no válida. Debe ser 'retiro_en_finca', 'entrega_en_ciudad' o 'a_convenir'.",
        )

    fotos_validas = body.fotos or []
    if len(fotos_validas) > 6:
        raise HTTPException(
            status_code=400,
            detail="Se permite un máximo de 6 fotos por oferta.",
        )
    for ruta_f in fotos_validas:
        if not ruta_f.startswith("/subidas/"):
            raise HTTPException(
                status_code=400,
                detail=f"La ruta de foto '{ruta_f}' no es válida. Debe iniciar con '/subidas/'.",
            )

    # Validaciones de certificaciones declaradas (Prompt 8.6 A2)
    certificaciones_raw = body.certificaciones or []
    if len(certificaciones_raw) > 5:
        raise HTTPException(
            status_code=400,
            detail="Se permite un máximo de 5 certificaciones por oferta.",
        )

    certificaciones_validadas = []
    for c in certificaciones_raw:
        c_dict = c if isinstance(c, dict) else {}
        tipo = c_dict.get("tipo")
        if not tipo or tipo not in TIPOS_CERTIFICACION_VALIDOS:
            raise HTTPException(
                status_code=400,
                detail=f"Tipo de certificación '{tipo}' no válido. Debe ser: organico, comercio_justo, buenas_practicas, sanitario u otra.",
            )

        nombre_otra = c_dict.get("nombre_otra")
        if tipo == "otra":
            if not nombre_otra or not str(nombre_otra).strip():
                raise HTTPException(
                    status_code=400,
                    detail="El nombre de la certificación es obligatorio cuando el tipo es 'otra'.",
                )
            nombre_otra = str(nombre_otra).strip()
            if len(nombre_otra) > 60:
                raise HTTPException(
                    status_code=400,
                    detail="El nombre de la certificación no puede superar los 60 caracteres.",
                )
        else:
            nombre_otra = str(nombre_otra).strip() if nombre_otra and str(nombre_otra).strip() else None

        entidad = c_dict.get("entidad")
        if entidad:
            entidad = str(entidad).strip()
            if len(entidad) > 80:
                raise HTTPException(
                    status_code=400,
                    detail="La entidad certificadora no puede superar los 80 caracteres.",
                )
            if not entidad:
                entidad = None
        else:
            entidad = None

        documento = c_dict.get("documento")
        if documento:
            documento = str(documento).strip()
            if not documento.startswith("/subidas/"):
                raise HTTPException(
                    status_code=400,
                    detail=f"La ruta del documento '{documento}' no es válida. Debe iniciar con '/subidas/'.",
                )
        else:
            documento = None

        certificaciones_validadas.append({
            "tipo": tipo,
            "nombre_otra": nombre_otra,
            "entidad": entidad,
            "documento": documento,
        })

    precio_final, cae = _calcular_precio_y_cae(
        precio_referencia=body.precio_referencia_usdc,
        porcentaje_descuento=body.porcentaje_descuento,
        fecha_entrega=body.fecha_entrega,
    )

    comunidad_limpia = body.comunidad.strip() if body.comunidad and body.comunidad.strip() else None
    if comunidad_limpia:
        ubicacion_compuesta = f"{comunidad_limpia}, {prov}, {dep}"
    else:
        ubicacion_compuesta = f"{prov}, {dep}"

    nueva_oferta = Oferta(
        productor_id=productor_id,
        cultivo=body.cultivo.strip(),
        cantidad_kg=body.cantidad_kg,
        fecha_entrega=body.fecha_entrega,
        ubicacion=ubicacion_compuesta,
        precio_referencia_usdc=body.precio_referencia_usdc,
        porcentaje_descuento=body.porcentaje_descuento,
        precio_final_usdc=precio_final,
        costo_anual_equivalente=cae,
        departamento=dep,
        provincia=prov,
        comunidad=comunidad_limpia,
        descripcion=desc,
        variedad=body.variedad.strip() if body.variedad and body.variedad.strip() else None,
        superficie_ha=body.superficie_ha,
        fecha_siembra=body.fecha_siembra,
        forma_entrega=body.forma_entrega,
        lugar_entrega=body.lugar_entrega.strip() if body.lugar_entrega and body.lugar_entrega.strip() else None,
        practicas_cultivo=body.practicas_cultivo.strip() if body.practicas_cultivo and body.practicas_cultivo.strip() else None,
        fotos=json.dumps(fotos_validas),
        certificaciones=json.dumps(certificaciones_validadas),
        estado="abierta",
    )
    sesion.add(nueva_oferta)
    sesion.commit()
    sesion.refresh(nueva_oferta)
    return _formatear_oferta_dict(nueva_oferta, sesion)


@app.get("/ofertas", tags=["ofertas"])
def listar_ofertas(
    productor_id: Optional[int] = Query(None, description="Filtrar por ID del productor"),
    sesion: Session = Depends(obtener_sesion),
):
    """Lista todas las ofertas, opcionalmente filtradas por productor_id."""
    consulta = select(Oferta)
    if productor_id is not None:
        consulta = consulta.where(Oferta.productor_id == productor_id)
    ofertas = sesion.exec(consulta).all()

    # Consulta agregada de calificaciones para no hacer N consultas (Prompt 8.5 A4)
    stats_agregadas = sesion.exec(
        select(
            Resena.productor_id,
            func.avg(Resena.estrellas),
            func.count(Resena.id),
        ).group_by(Resena.productor_id)
    ).all()
    mapa_calificaciones = {
        row[0]: (round(float(row[1]), 1) if row[1] is not None else None, int(row[2]))
        for row in stats_agregadas
    }

    return [_formatear_oferta_dict(o, sesion, mapa_calificaciones) for o in ofertas]


@app.get("/ofertas/{oferta_id}", tags=["ofertas"])
def obtener_oferta(oferta_id: int, sesion: Session = Depends(obtener_sesion)):
    """Devuelve el detalle de una oferta por su ID."""
    oferta = sesion.get(Oferta, oferta_id)
    if not oferta:
        raise HTTPException(status_code=404, detail="Oferta no encontrada.")
    return _formatear_oferta_dict(oferta, sesion)


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
        c_dict["auxilio_maximo_usdc"] = round(c.monto_total_usdc * (PORCENTAJE_MAXIMO_AUXILIO / 100), 2)
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

    auxilio_maximo = round(contrato.monto_total_usdc * (PORCENTAJE_MAXIMO_AUXILIO / 100), 2)

    contrato_dict = contrato.model_dump()
    contrato_dict["cultivo"] = oferta.cultivo if oferta else "Desconocido"
    contrato_dict["ubicacion"] = oferta.ubicacion if oferta else ""
    contrato_dict["fecha_entrega"] = str(oferta.fecha_entrega) if oferta else None
    contrato_dict["productor_id"] = oferta.productor_id if oferta else None
    contrato_dict["auxilio_maximo_usdc"] = auxilio_maximo
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

    # Reseña del contrato (Prompt 8.5 A3)
    resena = sesion.exec(
        select(Resena).where(Resena.contrato_id == contrato_id)
    ).first()
    resena_dict = None
    if resena:
        resena_dict = resena.model_dump()
        if resena.fecha_creacion:
            resena_dict["fecha_creacion"] = resena.fecha_creacion.isoformat()

    puede_calificar = bool(
        es_comprador and contrato.estado == "completado" and resena is None
    )

    return {
        "contrato": contrato_dict,
        "tramos": tramos_data,
        "reporte_emergencia": reporte_dict,
        "auxilio_maximo_usdc": auxilio_maximo,
        "resena": resena_dict,
        "puede_calificar": puede_calificar,
    }


class CrearResenaBody(BaseModel):
    estrellas: int
    comentario: Optional[str] = None


@app.post("/contratos/{contrato_id}/resena", tags=["contratos"])
def crear_resena_contrato(
    contrato_id: int,
    body: CrearResenaBody,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Registra la calificación y comentario del comprador para un contrato completado.
    Solo el comprador del contrato puede calificar, y solo una vez por contrato.
    """
    contrato = sesion.get(Contrato, contrato_id)
    if not contrato:
        raise HTTPException(status_code=404, detail="Contrato no encontrado.")

    # 403 si no es el comprador del contrato
    if contrato.comprador_id != usuario_actual.id:
        raise HTTPException(
            status_code=403,
            detail="Solo el comprador del contrato puede calificar al productor.",
        )

    # 400 si el contrato no está completado
    if contrato.estado != "completado":
        raise HTTPException(
            status_code=400,
            detail="Solo se pueden calificar contratos que hayan sido completados.",
        )

    # 400 si ya existe una reseña para este contrato
    resena_existente = sesion.exec(
        select(Resena).where(Resena.contrato_id == contrato_id)
    ).first()
    if resena_existente:
        raise HTTPException(
            status_code=400,
            detail="Este contrato ya tiene una reseña registrada.",
        )

    # 400 si las estrellas no son un entero de 1 a 5
    if not isinstance(body.estrellas, int) or body.estrellas < 1 or body.estrellas > 5:
        raise HTTPException(
            status_code=400,
            detail="Las estrellas deben ser un número entero entre 1 y 5.",
        )

    # 400 si el comentario supera 500 caracteres
    comentario_limpio = None
    if body.comentario:
        comentario_limpio = body.comentario.strip()
        if len(comentario_limpio) > 500:
            raise HTTPException(
                status_code=400,
                detail="El comentario no puede superar los 500 caracteres.",
            )
        if not comentario_limpio:
            comentario_limpio = None

    oferta = sesion.get(Oferta, contrato.oferta_id)
    productor_id = oferta.productor_id if oferta else None
    if not productor_id:
        raise HTTPException(status_code=404, detail="Productor asociado no encontrado.")

    nueva_resena = Resena(
        contrato_id=contrato.id,
        productor_id=productor_id,
        comprador_id=usuario_actual.id,
        estrellas=body.estrellas,
        comentario=comentario_limpio,
    )
    sesion.add(nueva_resena)
    sesion.commit()
    sesion.refresh(nueva_resena)
    return nueva_resena


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
    monto_solicitado_usdc: Optional[float] = None
    monto_solicitado: Optional[float] = None
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
    El auxilio solicitado no puede superar el PORCENTAJE_MAXIMO_AUXILIO (50%).
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

    auxilio_maximo = round(contrato.monto_total_usdc * (PORCENTAJE_MAXIMO_AUXILIO / 100), 2)
    monto_solicitado = body.monto_solicitado_usdc if body.monto_solicitado_usdc is not None else body.monto_solicitado

    if monto_solicitado is None or monto_solicitado <= 0:
        monto_final = auxilio_maximo
    elif monto_solicitado > auxilio_maximo:
        raise HTTPException(
            status_code=400,
            detail=f"El auxilio máximo para este contrato es {auxilio_maximo} USDC",
        )
    else:
        monto_final = round(monto_solicitado, 2)

    reporte = ReporteEmergencia(
        contrato_id=body.contrato_id,
        productor_id=usuario_actual.id,
        motivo=body.motivo,
        url_evidencia=body.url_evidencia,
        monto_solicitado_usdc=monto_final,
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
    monto: Optional[float] = None
    monto_usdc: Optional[float] = None


@app.post("/fondo/aportar", tags=["fondo"])
def aportar_al_fondo(
    body: AportarFondoBody,
    usuario_actual: Usuario = Depends(_obtener_usuario_actual),
    sesion: Session = Depends(obtener_sesion),
):
    """
    Envía USDC reales desde la cuenta Stellar del usuario a la cuenta del Fondo Solidario.
    Requiere token de autenticación.
    Valida monto positivo, mínimo 0.01 USDC, no mayor al saldo disponible.
    Devuelve {hash, monto_usdc}.
    """
    monto = body.monto if body.monto is not None else body.monto_usdc
    if monto is None or monto <= 0:
        raise HTTPException(
            status_code=400,
            detail="El monto a aportar debe ser mayor a cero.",
        )
    if monto < 0.01:
        raise HTTPException(
            status_code=400,
            detail="El monto mínimo para aportar es 0.01 USDC.",
        )

    saldo_actual = consultar_saldo_usdc(usuario_actual.billetera)
    if monto > saldo_actual:
        raise HTTPException(
            status_code=400,
            detail=f"Saldo insuficiente. Tu saldo actual es de {saldo_actual:.2f} USDC.",
        )

    clave_usuario = obtener_clave_usuario(usuario_actual)
    if not clave_usuario:
        raise HTTPException(
            status_code=400,
            detail="No se encontró la clave de firma para esta cuenta en modo demostración.",
        )

    try:
        tx_hash = enviar_pago_usdc(
            clave_origen=clave_usuario,
            billetera_destino=FONDO_PUBLIC_KEY,
            monto_usdc=monto,
            memo="Aporte Fondo MinKa",
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,
            detail=f"Error al enviar aporte en Stellar: {e}",
        )

    movimiento = MovimientoFondo(
        tipo="aporte",
        monto_usdc=monto,
        billetera_origen=usuario_actual.billetera,
        billetera_destino=FONDO_PUBLIC_KEY,
        hash_transaccion=tx_hash,
    )
    sesion.add(movimiento)
    sesion.commit()

    return {
        "hash": tx_hash,
        "monto_usdc": monto,
    }


@app.get("/fondo/historial", tags=["fondo"])
def obtener_historial_fondo(sesion: Session = Depends(obtener_sesion)):
    """
    Devuelve los últimos 20 pagos en USDC de la cuenta del Fondo Solidario leídos directamente de Horizon.
    Público, sin token.
    Cada uno: {fecha, tipo ('aporte' si el Fondo recibe, 'auxilio' si envía), monto_usdc, contraparte, hash}.
    Contraparte usa alias si coincide con Plataforma o un usuario en BD; si no, dirección abreviada.
    Devuelve además total de auxilios pagados (cantidad y suma en USDC) calculado de esos mismos pagos.
    """
    if not FONDO_PUBLIC_KEY or not USDC_EMISOR:
        return {
            "movimientos": [],
            "total_auxilios_cantidad": 0,
            "total_auxilios_usdc": 0.0,
        }

    try:
        servidor = Server(HORIZON_URL)
        resp = servidor.payments().for_account(FONDO_PUBLIC_KEY).order(desc=True).limit(50).call()
        records = resp.get("_embedded", {}).get("records", [])
    except Exception:
        records = []

    # Mapeo de billeteras conocidas para alias
    usuarios = sesion.exec(select(Usuario)).all()
    mapa_alias = {u.billetera: u.nombre for u in usuarios if u.billetera}
    if PLATAFORMA_PUBLIC_KEY:
        mapa_alias[PLATAFORMA_PUBLIC_KEY] = "Plataforma"

    movimientos = []
    for r in records:
        if (
            r.get("type") == "payment"
            and r.get("asset_code") == "USDC"
            and r.get("asset_issuer") == USDC_EMISOR
        ):
            remitente = r.get("from")
            destinatario = r.get("to")
            monto = float(r.get("amount", "0.0"))
            tx_hash = r.get("transaction_hash")
            fecha = r.get("created_at")

            if destinatario == FONDO_PUBLIC_KEY:
                tipo = "aporte"
                contraparte_raw = remitente
            else:
                tipo = "auxilio"
                contraparte_raw = destinatario

            if contraparte_raw in mapa_alias:
                contraparte = mapa_alias[contraparte_raw]
            elif contraparte_raw:
                contraparte = f"{contraparte_raw[:6]}...{contraparte_raw[-6:]}"
            else:
                contraparte = "Desconocido"

            movimientos.append({
                "fecha": fecha,
                "tipo": tipo,
                "monto_usdc": monto,
                "contraparte": contraparte,
                "hash": tx_hash,
            })
            if len(movimientos) >= 20:
                break

    auxilios = [m for m in movimientos if m["tipo"] == "auxilio"]
    total_auxilios_cantidad = len(auxilios)
    total_auxilios_usdc = round(sum(m["monto_usdc"] for m in auxilios), 2)

    return {
        "movimientos": movimientos,
        "total_auxilios_cantidad": total_auxilios_cantidad,
        "total_auxilios_usdc": total_auxilios_usdc,
    }


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
    sesion.exec(delete(Resena))
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
            "departamento": "Potosí",
            "provincia": "Daniel Campos",
            "comunidad": "(dato simulado)",
            "variedad": "Real Blanca",
            "descripcion": "Oferta de ejemplo para la demostración (dato simulado).",
            "forma_entrega": "a_convenir",
            "fecha_entrega": date(2027, 5, 15),
            "porcentaje_descuento": 15.0,
            "cantidad_kg": 1.0,
            "precio_referencia_usdc": 1.0,
            "fotos": "[]",
        },
        {
            "cultivo": "Café",
            "departamento": "La Paz",
            "provincia": "Caranavi",
            "comunidad": "(dato simulado)",
            "variedad": "Típica",
            "descripcion": "Oferta de ejemplo para la demostración (dato simulado).",
            "forma_entrega": "a_convenir",
            "fecha_entrega": date(2027, 8, 15),
            "porcentaje_descuento": 18.0,
            "cantidad_kg": 0.5,
            "precio_referencia_usdc": 2.0,
            "fotos": "[]",
        },
        {
            "cultivo": "Sésamo",
            "departamento": "Santa Cruz",
            "provincia": "Ñuflo de Chávez",
            "comunidad": "(dato simulado)",
            "variedad": "Negro",
            "descripcion": "Oferta de ejemplo para la demostración (dato simulado).",
            "forma_entrega": "a_convenir",
            "fecha_entrega": date(2027, 5, 30),
            "porcentaje_descuento": 12.0,
            "cantidad_kg": 1.0,
            "precio_referencia_usdc": 1.0,
            "fotos": "[]",
        },
    ]

    ofertas_creadas = []
    for cfg in config_ofertas:
        precio_final, cae = _calcular_precio_y_cae(
            precio_referencia=cfg["precio_referencia_usdc"],
            porcentaje_descuento=cfg["porcentaje_descuento"],
            fecha_entrega=cfg["fecha_entrega"],
        )
        comunidad_str = cfg.get("comunidad")
        ubicacion = (
            f"{comunidad_str}, {cfg['provincia']}, {cfg['departamento']}"
            if comunidad_str
            else f"{cfg['provincia']}, {cfg['departamento']}"
        )
        oferta = Oferta(
            productor_id=productor.id,
            cultivo=cfg["cultivo"],
            cantidad_kg=cfg["cantidad_kg"],
            fecha_entrega=cfg["fecha_entrega"],
            ubicacion=ubicacion,
            precio_referencia_usdc=cfg["precio_referencia_usdc"],
            porcentaje_descuento=cfg["porcentaje_descuento"],
            precio_final_usdc=precio_final,
            costo_anual_equivalente=cae,
            departamento=cfg["departamento"],
            provincia=cfg["provincia"],
            comunidad=comunidad_str,
            descripcion=cfg["descripcion"],
            variedad=cfg.get("variedad"),
            forma_entrega=cfg["forma_entrega"],
            fotos=cfg["fotos"],
            certificaciones="[]",
            estado="abierta",
        )
        sesion.add(oferta)
        ofertas_creadas.append(oferta)

    sesion.commit()
    for o in ofertas_creadas:
        sesion.refresh(o)

    ofertas_formateadas = [_formatear_oferta_dict(o, sesion) for o in ofertas_creadas]

    return {
        "mensaje": "Base de datos demo reiniciada con éxito.",
        "registros_eliminados": ["tramos", "reportes_emergencia", "movimientos_fondo", "contratos", "ofertas"],
        "oferta_creada": ofertas_formateadas[0],
        "ofertas_creadas": ofertas_formateadas,
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

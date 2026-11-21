"""
models.py — Tablas de la base de datos de MinKa.
Todos los nombres de tablas, columnas y tipos de datos están en español,
salvo las palabras reservadas de Python y SQLModel.
"""

from datetime import date, datetime, timezone
from typing import Optional
from sqlmodel import Field, SQLModel


# ══════════════════════════════════════════════════════════════════
# Usuario
# ══════════════════════════════════════════════════════════════════

class Usuario(SQLModel, table=True):
    """Representa a un productor, comprador o administrador de la plataforma."""

    __tablename__ = "usuario"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Dirección pública de la wallet Stellar (clave de identidad en la plataforma)
    billetera: str = Field(unique=True, index=True)

    # Nombre de usuario único para inicio de sesión en plataforma
    nombre_usuario: Optional[str] = Field(default=None, unique=True, index=True)

    # Hash bcrypt de la contraseña de acceso (opcional para usuarios solo-wallet)
    clave_hash: Optional[str] = Field(default=None)

    nombre: Optional[str] = Field(default=None)

    # Valores válidos: "productor" | "comprador" | "admin"
    rol: str = Field(default="productor")

    # Se incrementa con cada contrato completado exitosamente
    contratos_cumplidos: int = Field(default=0)

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # Perfil público y datos de contacto (Prompt 7)
    biografia: Optional[str] = Field(default=None)  # Máximo 600 caracteres
    departamento: Optional[str] = Field(default=None)
    foto_perfil: Optional[str] = Field(default=None)
    cultivos: Optional[str] = Field(default=None)  # Texto libre
    anios_experiencia: Optional[int] = Field(default=None)
    whatsapp: Optional[str] = Field(default=None)  # Solo dígitos con prefijo 591


# ══════════════════════════════════════════════════════════════════
# Oferta
# ══════════════════════════════════════════════════════════════════

class Oferta(SQLModel, table=True):
    """
    Publicación de una cosecha futura por parte de un productor.
    El precio final y el costo anual equivalente se calculan en main.py
    al momento de crear la oferta.
    """

    __tablename__ = "oferta"

    id: Optional[int] = Field(default=None, primary_key=True)

    productor_id: int = Field(foreign_key="usuario.id")

    cultivo: str  # Ej: "Quinua", "Papa", "Maíz"
    cantidad_kg: float
    fecha_entrega: date  # Formato YYYY-MM-DD
    ubicacion: str  # Coordenadas o descripción compuesta: "Comunidad, Provincia, Departamento"

    precio_referencia_usdc: float  # Precio de mercado actual sin descuento
    porcentaje_descuento: float    # Descuento ofrecido al comprador (0–100)
    precio_final_usdc: float       # Calculado: precio_referencia * (1 - descuento/100)
    costo_anual_equivalente: float # Calculado: tasa efectiva anual del descuento

    # Campos ampliados de ubicación y cultivo (Prompt 7)
    departamento: str
    provincia: str
    comunidad: Optional[str] = Field(default=None)
    descripcion: str  # Máximo 1000 caracteres
    variedad: Optional[str] = Field(default=None)
    superficie_ha: Optional[float] = Field(default=None)
    fecha_siembra: Optional[date] = Field(default=None)
    forma_entrega: str  # "retiro_en_finca" | "entrega_en_ciudad" | "a_convenir"
    lugar_entrega: Optional[str] = Field(default=None)
    practicas_cultivo: Optional[str] = Field(default=None)
    fotos: str = Field(default="[]")  # Texto JSON con lista de rutas [/subidas/...]

    # Valores válidos: "abierta" | "fondeada" | "completada" | "cancelada"
    estado: str = Field(default="abierta")

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ══════════════════════════════════════════════════════════════════
# Contrato
# ══════════════════════════════════════════════════════════════════

class Contrato(SQLModel, table=True):
    """
    Acuerdo de compraventa entre productor y comprador.
    El campo id_contrato_escrow se llena con el ID que devuelve Trustless Work
    al desplegar el escrow multi-release en Stellar.
    """

    __tablename__ = "contrato"

    id: Optional[int] = Field(default=None, primary_key=True)

    oferta_id: int = Field(foreign_key="oferta.id")
    comprador_id: int = Field(foreign_key="usuario.id")

    # ID externo del escrow en Trustless Work (se llena al fondear)
    id_contrato_escrow: Optional[str] = Field(default=None)

    monto_total_usdc: float

    # Valores válidos:
    # "pendiente_fondeo" | "activo" | "en_disputa" | "completado" | "resuelto_emergencia"
    estado: str = Field(default="pendiente_fondeo")

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ══════════════════════════════════════════════════════════════════
# Tramo
# ══════════════════════════════════════════════════════════════════

class Tramo(SQLModel, table=True):
    """
    Uno de los 3 pagos parciales de un contrato (40% / 30% / 30%).
    Se crean automáticamente al crear el contrato.
    """

    __tablename__ = "tramo"

    id: Optional[int] = Field(default=None, primary_key=True)

    contrato_id: int = Field(foreign_key="contrato.id")

    # 1 = Anticipo Insumos 40%, 2 = Avance Verificado 30%, 3 = Entrega Final 30%
    numero_tramo: int

    # Título descriptivo del tramo, fijado al crear el contrato
    titulo: str  # Ej: "Anticipo Insumos 40%"

    monto_usdc: float

    # Valores válidos: "pendiente" | "en_revision" | "aprobado" | "liberado" | "reembolsado"
    estado: str = Field(default="pendiente")

    # URL a foto, video o documento que certifica el avance
    url_evidencia: Optional[str] = Field(default=None)

    # Hash de la transacción en Stellar cuando el tramo se libera o reembolsa
    hash_transaccion: Optional[str] = Field(default=None)


# ══════════════════════════════════════════════════════════════════
# ReporteEmergencia
# ══════════════════════════════════════════════════════════════════

class ReporteEmergencia(SQLModel, table=True):
    """
    Reporte de un desastre natural (helada, sequía, inundación) iniciado
    por el productor. Activa la disputa del escrow y el proceso de desembolso
    del Fondo Solidario de Emergencia.
    """

    __tablename__ = "reporte_emergencia"

    id: Optional[int] = Field(default=None, primary_key=True)

    contrato_id: int = Field(foreign_key="contrato.id")
    productor_id: int = Field(foreign_key="usuario.id")

    motivo: str  # Descripción del desastre: "helada", "sequía", "inundación", etc.
    url_evidencia: str  # Foto georreferenciada, acta comunitaria o reporte local

    monto_solicitado_usdc: float

    # Valores válidos: "pendiente" | "aprobado" | "rechazado"
    estado: str = Field(default="pendiente")

    # Hash de la transacción cuando el Fondo Solidario desembolsa el auxilio
    hash_pago_fondo: Optional[str] = Field(default=None)

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ══════════════════════════════════════════════════════════════════
# Resena
# ══════════════════════════════════════════════════════════════════

class Resena(SQLModel, table=True):
    """
    Calificación y reseña con estrellas (1 a 5) y comentario opcional
    dejada por el comprador al completarse un contrato.
    Una sola reseña permitida por contrato.
    """

    __tablename__ = "resena"

    id: Optional[int] = Field(default=None, primary_key=True)

    contrato_id: int = Field(foreign_key="contrato.id", unique=True, index=True)
    productor_id: int = Field(foreign_key="usuario.id", index=True)
    comprador_id: int = Field(foreign_key="usuario.id", index=True)

    # 1 a 5 estrellas
    estrellas: int

    # Comentario opcional de hasta 500 caracteres
    comentario: Optional[str] = Field(default=None)

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


# ══════════════════════════════════════════════════════════════════
# MovimientoFondo
# ══════════════════════════════════════════════════════════════════

class MovimientoFondo(SQLModel, table=True):
    """
    Registro verificable de cada entrada y salida del Fondo Solidario de Emergencia.
    Permite calcular el saldo actual del fondo en /transparencia.
    """

    __tablename__ = "movimiento_fondo"

    id: Optional[int] = Field(default=None, primary_key=True)

    # Valores válidos: "aporte" | "desembolso_emergencia"
    tipo: str

    monto_usdc: float

    # Billetera que aportó (en tipo "aporte") o la del fondo (en tipo "desembolso")
    billetera_origen: Optional[str] = Field(default=None)

    # Billetera que recibe (productor, en tipo "desembolso_emergencia")
    billetera_destino: Optional[str] = Field(default=None)

    # Referencia al contrato relacionado (si aplica)
    contrato_id: Optional[int] = Field(default=None, foreign_key="contrato.id")

    # Hash de la transacción en Stellar que respalda este movimiento
    hash_transaccion: Optional[str] = Field(default=None)

    fecha_creacion: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


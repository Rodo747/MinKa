"""
database.py — Configuración de la base de datos SQLite para MinKa.
Carga las variables de entorno, define las transiciones válidas de estados
y expone las funciones que usa main.py.
"""

from pathlib import Path
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text

# Carga las variables definidas en .env (ignoradas por .gitignore)
ruta_env = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ruta_env)
load_dotenv()

# Base de datos SQLite local en la carpeta backend
ruta_db = Path(__file__).resolve().parent / "minka.db"
DATABASE_URL = f"sqlite:///{ruta_db.as_posix()}"

# connect_args requerido solo para SQLite (evita errores de hilo cruzado)
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


# ══════════════════════════════════════════════════════════════════
# Reglas de transición de estados válidas
# ══════════════════════════════════════════════════════════════════

TRANSICIONES_VALIDAS: dict[str, dict[str, list[str]]] = {
    "tramo": {
        "pendiente": ["en_revision", "liberado", "reembolsado"],
        "en_revision": ["aprobado", "liberado", "reembolsado"],
        "aprobado": ["liberado", "reembolsado"],
        "liberado": [],
        "reembolsado": [],
    },
    "contrato": {
        "pendiente_fondeo": ["activo", "cancelado"],
        "activo": ["en_disputa", "completado"],
        "en_disputa": ["activo", "resuelto_emergencia"],
        "resuelto_emergencia": [],
        "completado": [],
    },
    "reporte_emergencia": {
        "pendiente": ["aprobado", "rechazado"],
        "aprobado": [],
        "rechazado": [],
    },
    "oferta": {
        "abierta": ["fondeada", "cancelada"],
        "fondeada": ["completada", "cancelada"],
        "completada": [],
        "cancelada": [],
    },
}


def validar_transicion_estado(entidad: str, estado_actual: str, nuevo_estado: str) -> None:
    """
    Valida que la transición entre estados sea permitida para una entidad dada.
    Lanza HTTPException con código 400 y mensaje en español si es inválida.
    """
    from fastapi import HTTPException

    mapa_entidad = TRANSICIONES_VALIDAS.get(entidad)
    if not mapa_entidad:
        raise HTTPException(
            status_code=400,
            detail=f"Entidad '{entidad}' no reconocida para validación de estado.",
        )

    transiciones_permitidas = mapa_entidad.get(estado_actual, [])
    if nuevo_estado not in transiciones_permitidas:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Transición no permitida para {entidad}: "
                f"no se puede cambiar de '{estado_actual}' a '{nuevo_estado}'."
            ),
        )


def crear_bd_y_tablas() -> None:
    """Crea todas las tablas definidas en models.py si aún no existen."""
    # La importación aquí evita importaciones circulares
    import models  # noqa: F401
    SQLModel.metadata.create_all(engine)

    # Migración segura para la columna 'certificaciones' en la tabla 'oferta' (Prompt 8.6)
    with engine.connect() as conn:
        columnas = [row[1] for row in conn.execute(text("PRAGMA table_info(oferta)")).fetchall()]
        if "certificaciones" not in columnas:
            conn.execute(text("ALTER TABLE oferta ADD COLUMN certificaciones TEXT DEFAULT '[]'"))
            conn.commit()


def obtener_sesion():
    """Dependencia de FastAPI que provee una sesión de base de datos por request."""
    with Session(engine) as sesion:
        yield sesion

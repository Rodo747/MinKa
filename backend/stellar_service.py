"""
stellar_service.py — Funciones de integración con Stellar y Trustless Work para MinKa.

Maneja el ciclo de vida completo de escrows multi-release (despliegue, fondeo,
evidencia, aprobación/liberación y resolución de siniestros) y pagos directos
del Fondo Solidario de Emergencia Agrícola.
"""

import os
import httpx
from pathlib import Path
from dotenv import load_dotenv
from stellar_sdk import Server, Keypair, Network, TransactionEnvelope, TransactionBuilder, Asset

# Carga de variables de entorno desde backend/.env
ruta_env = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=ruta_env)
load_dotenv()

# ── Configuración general ────────────────────────────────────────────────────────
TRUSTLESS_WORK_API_KEY  = os.getenv("TRUSTLESS_WORK_API_KEY", "")
TRUSTLESS_WORK_BASE_URL = os.getenv("TRUSTLESS_WORK_BASE_URL", "https://dev.api.trustlesswork.com").rstrip("/")
HORIZON_URL             = os.getenv("HORIZON_URL", "https://horizon-testnet.stellar.org").rstrip("/")
STELLAR_NETWORK         = os.getenv("STELLAR_NETWORK", "TESTNET")
USDC_EMISOR             = os.getenv("USDC_EMISOR", "")
MODO_DEMO               = os.getenv("MODO_DEMO", "true").lower() == "true"

# Claves de la plataforma (árbitro / releaseSigner)
PLATAFORMA_PUBLIC_KEY   = os.getenv("PLATAFORMA_PUBLIC_KEY", "")
PLATAFORMA_SECRET_KEY   = os.getenv("PLATAFORMA_SECRET_KEY", "")
CLAVE_PLATAFORMA        = Keypair.from_secret(PLATAFORMA_SECRET_KEY) if PLATAFORMA_SECRET_KEY else None

# Claves del Fondo Solidario de Emergencia
FONDO_PUBLIC_KEY        = os.getenv("FONDO_PUBLIC_KEY", "")
FONDO_SECRET_KEY        = os.getenv("FONDO_SECRET_KEY", "")
CLAVE_FONDO             = Keypair.from_secret(FONDO_SECRET_KEY) if FONDO_SECRET_KEY else None

# Claves para modo demostración
DEMO_PRODUCTOR_SECRET   = os.getenv("DEMO_PRODUCTOR_SECRET", "")
DEMO_COMPRADOR_SECRET   = os.getenv("DEMO_COMPRADOR_SECRET", "")
CLAVE_PRODUCTOR_DEMO    = Keypair.from_secret(DEMO_PRODUCTOR_SECRET) if DEMO_PRODUCTOR_SECRET else None
CLAVE_COMPRADOR_DEMO    = Keypair.from_secret(DEMO_COMPRADOR_SECRET) if DEMO_COMPRADOR_SECRET else None


# ══════════════════════════════════════════════════════════════════
# 1. Auxiliares internos
# ══════════════════════════════════════════════════════════════════

def _extraer_billetera(usuario_o_billetera) -> str:
    """Extrae la dirección pública si recibe un objeto Usuario o un string."""
    if hasattr(usuario_o_billetera, "billetera"):
        return str(usuario_o_billetera.billetera)
    return str(usuario_o_billetera)


def _ejecutar_firmar_y_enviar(
    metodo: str,
    ruta: str,
    payload: dict,
    clave_firmante: Keypair,
) -> tuple[str, dict]:
    """
    Auxiliar interno:
    1. Llama al endpoint de Trustless Work indicado con autenticación x-api-key.
    2. Obtiene unsignedTransaction y la firma con stellar-sdk con la clave del firmante.
    3. Envía la transacción firmada a POST /helper/send-transaction.
    Devuelve una tupla (hash_transaccion, respuesta_send_transaction).
    """
    if not TRUSTLESS_WORK_API_KEY:
        raise ValueError("TRUSTLESS_WORK_API_KEY no está configurada en .env.")

    url = f"{TRUSTLESS_WORK_BASE_URL}/{ruta.lstrip('/')}"
    headers = {
        "x-api-key": TRUSTLESS_WORK_API_KEY,
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=30.0) as cliente:
        if metodo.upper() == "POST":
            resp = cliente.post(url, json=payload, headers=headers)
        elif metodo.upper() == "PUT":
            resp = cliente.put(url, json=payload, headers=headers)
        else:
            raise ValueError(f"Método HTTP no soportado: {metodo}")

        if resp.status_code not in (200, 201):
            raise RuntimeError(
                f"Error al llamar a Trustless Work ({ruta}) [HTTP {resp.status_code}]: {resp.text}"
            )

        data = resp.json()
        unsigned_xdr = data.get("unsignedTransaction")
        if not unsigned_xdr:
            raise RuntimeError(
                f"Trustless Work no devolvió 'unsignedTransaction' en {ruta}: {resp.text}"
            )

        red = (
            Network.TESTNET_NETWORK_PASSPHRASE
            if STELLAR_NETWORK == "TESTNET"
            else Network.PUBLIC_NETWORK_PASSPHRASE
        )
        sobre = TransactionEnvelope.from_xdr(unsigned_xdr, red)
        sobre.sign(clave_firmante)
        signed_xdr = sobre.to_xdr()
        tx_hash = sobre.hash_hex()

        url_send = f"{TRUSTLESS_WORK_BASE_URL}/helper/send-transaction"
        resp_send = cliente.post(url_send, json={"signedXdr": signed_xdr}, headers=headers)

        if resp_send.status_code not in (200, 201):
            raise RuntimeError(
                f"Error al enviar la transacción firmada a Stellar [HTTP {resp_send.status_code}]: {resp_send.text}"
            )

        return tx_hash, resp_send.json()


# ══════════════════════════════════════════════════════════════════
# 2. Despliegue de Escrow
# ══════════════════════════════════════════════════════════════════

def crear_escrow_trustless(
    contrato,
    tramos,
    productor,
    comprador,
) -> str:
    """
    Despliega un contrato de escrow multi-release en Trustless Work con los 3 hitos.
    Firmado por PLATAFORMA.
    Devuelve el contractId del escrow en Stellar.
    """
    if not CLAVE_PLATAFORMA:
        raise ValueError("PLATAFORMA_SECRET_KEY no está configurada para firmar el despliegue.")
    if not USDC_EMISOR:
        raise ValueError("USDC_EMISOR no está configurado en .env.")

    billetera_prod = _extraer_billetera(productor)
    billetera_comp = _extraer_billetera(comprador)
    contrato_id = getattr(contrato, "id", None) or "DEMO"

    import time
    engagement_id = f"MINKA_{contrato_id}_{int(time.time())}"

    lista_milestones = []
    for t in tramos:
        titulo = getattr(t, "titulo", None) or (t.get("titulo") if isinstance(t, dict) else "Hito")
        monto = float(getattr(t, "monto_usdc", None) or (t.get("monto_usdc") if isinstance(t, dict) else 0.0))
        lista_milestones.append({
            "description": str(titulo),
            "amount": monto,
            "receiver": billetera_prod,
        })

    payload = {
        "signer": PLATAFORMA_PUBLIC_KEY,
        "engagementId": engagement_id,
        "title": f"MinKa Contrato #{contrato_id}",
        "description": "Contrato de preventa de cosecha en MinKa",
        "roles": {
            "approver": billetera_comp,
            "serviceProvider": billetera_prod,
            "platformAddress": PLATAFORMA_PUBLIC_KEY,
            "releaseSigner": PLATAFORMA_PUBLIC_KEY,
            "disputeResolver": PLATAFORMA_PUBLIC_KEY,
        },
        "platformFee": 1,
        "milestones": lista_milestones,
        "trustline": {
            "symbol": "USDC",
            "address": USDC_EMISOR,
        },
    }

    _, respuesta = _ejecutar_firmar_y_enviar("POST", "/deployer/multi-release", payload, CLAVE_PLATAFORMA)
    contract_id = respuesta.get("contractId")
    if not contract_id:
        raise RuntimeError(f"No se recibió contractId al desplegar el escrow: {respuesta}")

    return contract_id


# ══════════════════════════════════════════════════════════════════
# 3. Fondeo de Escrow
# ══════════════════════════════════════════════════════════════════

def fondear_escrow(
    id_contrato_escrow: str,
    monto: float,
    comprador=None,
) -> tuple[str, dict]:
    """
    Fondea el contrato de escrow multi-release con la clave del comprador.
    En MODO_DEMO usa DEMO_COMPRADOR_SECRET.
    Devuelve (tx_hash, respuesta).
    """
    clave = None
    if isinstance(comprador, Keypair):
        clave = comprador
    elif MODO_DEMO and CLAVE_COMPRADOR_DEMO:
        clave = CLAVE_COMPRADOR_DEMO

    if not clave:
        raise ValueError("No se dispone de la clave secreta del comprador para firmar el fondeo.")

    payload = {
        "contractId": id_contrato_escrow,
        "signer": clave.public_key,
        "amount": float(monto),
    }

    return _ejecutar_firmar_y_enviar("POST", "/escrow/multi-release/fund-escrow", payload, clave)


# ══════════════════════════════════════════════════════════════════
# 4. Evidencia de Avance
# ══════════════════════════════════════════════════════════════════

def subir_evidencia_tramo(
    id_contrato_escrow: str,
    indice: int | str,
    url_evidencia: str,
) -> tuple[str, dict]:
    """
    Cambia el estado de un hito a 'Completed' adjuntando la evidencia de avance.
    Firmado por el productor (en MODO_DEMO con DEMO_PRODUCTOR_SECRET).
    Devuelve (tx_hash, respuesta).
    """
    if not CLAVE_PRODUCTOR_DEMO:
        raise ValueError("No se dispone de la clave secreta del productor para firmar la evidencia.")

    payload = {
        "contractId": id_contrato_escrow,
        "milestoneIndex": str(indice),
        "newEvidence": str(url_evidencia),
        "newStatus": "Completed",
        "serviceProvider": CLAVE_PRODUCTOR_DEMO.public_key,
    }

    return _ejecutar_firmar_y_enviar("POST", "/escrow/multi-release/change-milestone-status", payload, CLAVE_PRODUCTOR_DEMO)


# ══════════════════════════════════════════════════════════════════
# 5. Aprobación y Liberación
# ══════════════════════════════════════════════════════════════════

def aprobar_y_liberar_tramo(
    id_contrato_escrow: str,
    indice: int | str,
) -> str:
    """
    1. Ejecuta approve-milestone firmado por el comprador (DEMO_COMPRADOR_SECRET).
    2. Ejecuta release-milestone-funds firmado por PLATAFORMA.
    Devuelve el hash de la transacción de liberación.
    """
    if not CLAVE_COMPRADOR_DEMO:
        raise ValueError("No se dispone de la clave secreta del comprador para aprobar el hito.")
    if not CLAVE_PLATAFORMA:
        raise ValueError("PLATAFORMA_SECRET_KEY no está configurada para liberar el hito.")

    # 1. Aprobar hito por el comprador
    payload_aprobar = {
        "contractId": id_contrato_escrow,
        "milestoneIndex": str(indice),
        "approver": CLAVE_COMPRADOR_DEMO.public_key,
    }
    _ejecutar_firmar_y_enviar("POST", "/escrow/multi-release/approve-milestone", payload_aprobar, CLAVE_COMPRADOR_DEMO)

    # 2. Liberar fondos del hito por la plataforma
    payload_liberar = {
        "contractId": id_contrato_escrow,
        "milestoneIndex": str(indice),
        "releaseSigner": PLATAFORMA_PUBLIC_KEY,
    }
    tx_hash_liberacion, _ = _ejecutar_firmar_y_enviar(
        "POST", "/escrow/multi-release/release-milestone-funds", payload_liberar, CLAVE_PLATAFORMA
    )

    return tx_hash_liberacion


# ══════════════════════════════════════════════════════════════════
# 6. Disputa y Resolución de Siniestros
# ══════════════════════════════════════════════════════════════════

def disputar_y_resolver_tramo(
    id_contrato_escrow: str,
    indice: int | str,
    monto_tramo: float,
) -> tuple[str, str]:
    """
    1. Ejecuta dispute-milestone firmado por el productor.
    2. Ejecuta resolve-milestone-dispute firmado por PLATAFORMA con distributions
       asignando el monto bruto completo al comprador (reembolso directo).
    Devuelve (tx_hash_disputa, tx_hash_resolucion).
    """
    if not CLAVE_PRODUCTOR_DEMO:
        raise ValueError("No se dispone de la clave del productor para disputar el hito.")
    if not CLAVE_PLATAFORMA:
        raise ValueError("PLATAFORMA_SECRET_KEY no está configurada para resolver la disputa.")
    if not CLAVE_COMPRADOR_DEMO:
        raise ValueError("No se dispone de la clave del comprador para la distribución del reembolso.")

    # 1. Disputar hito por el productor
    payload_disputa = {
        "contractId": id_contrato_escrow,
        "milestoneIndex": str(indice),
        "signer": CLAVE_PRODUCTOR_DEMO.public_key,
    }
    tx_hash_disputa, _ = _ejecutar_firmar_y_enviar(
        "POST", "/escrow/multi-release/dispute-milestone", payload_disputa, CLAVE_PRODUCTOR_DEMO
    )

    # 2. Resolver disputa devolviendo el monto bruto del hito al comprador
    payload_resolucion = {
        "contractId": id_contrato_escrow,
        "disputeResolver": PLATAFORMA_PUBLIC_KEY,
        "milestoneIndex": str(indice),
        "distributions": [
            {
                "address": CLAVE_COMPRADOR_DEMO.public_key,
                "amount": float(monto_tramo),
            }
        ],
    }
    tx_hash_resolucion, _ = _ejecutar_firmar_y_enviar(
        "POST", "/escrow/multi-release/resolve-milestone-dispute", payload_resolucion, CLAVE_PLATAFORMA
    )

    return tx_hash_disputa, tx_hash_resolucion


# ══════════════════════════════════════════════════════════════════
# 7. Desembolso del Fondo Solidario de Emergencia
# ══════════════════════════════════════════════════════════════════

def desembolsar_fondo_emergencia(
    billetera_productor: str,
    monto_usdc: float,
    memo: str = "Fondo Solidario MinKa",
) -> str:
    """
    Ejecuta un pago directo de USDC (emisor USDC_EMISOR) desde la cuenta del Fondo
    hacia la billetera del productor afectado usando stellar-sdk.
    Devuelve el hash de la transacción en Stellar.
    """
    if not CLAVE_FONDO:
        raise ValueError("FONDO_SECRET_KEY no está configurada para firmar el desembolso.")
    if not USDC_EMISOR:
        raise ValueError("USDC_EMISOR no está configurado en .env.")

    servidor = Server(HORIZON_URL)
    red = (
        Network.TESTNET_NETWORK_PASSPHRASE
        if STELLAR_NETWORK == "TESTNET"
        else Network.PUBLIC_NETWORK_PASSPHRASE
    )

    cuenta_origen = servidor.load_account(FONDO_PUBLIC_KEY)
    activo_usdc = Asset("USDC", USDC_EMISOR)

    tx = (
        TransactionBuilder(
            source_account=cuenta_origen,
            network_passphrase=red,
            base_fee=100,
        )
        .add_text_memo(memo[:28])
        .append_payment_op(
            destination=billetera_productor,
            asset=activo_usdc,
            amount=f"{monto_usdc:.7f}",
        )
        .set_timeout(30)
        .build()
    )
    tx.sign(CLAVE_FONDO)
    respuesta = servidor.submit_transaction(tx)
    return respuesta.get("hash") or tx.hash_hex()


# ══════════════════════════════════════════════════════════════════
# 8. Consulta de Saldos en Horizon
# ══════════════════════════════════════════════════════════════════

def consultar_saldo_usdc(billetera: str) -> float:
    """
    Lee con Horizon el saldo real de USDC de una billetera dada.
    Devuelve el monto en USDC como float.
    """
    if not billetera or not USDC_EMISOR:
        return 0.0
    try:
        servidor = Server(HORIZON_URL)
        cuenta = servidor.load_account(billetera)
        for balance in cuenta.raw_data.get("balances", []):
            if balance.get("asset_code") == "USDC" and balance.get("asset_issuer") == USDC_EMISOR:
                return float(balance.get("balance", "0.0"))
    except Exception:
        return 0.0
    return 0.0


def saldo_fondo() -> float:
    """
    Lee con Horizon el saldo real de USDC de la cuenta del Fondo Solidario.
    Devuelve el monto en USDC como float.
    """
    if not FONDO_PUBLIC_KEY:
        raise ValueError("FONDO_PUBLIC_KEY no está configurada en .env.")
    return consultar_saldo_usdc(FONDO_PUBLIC_KEY)

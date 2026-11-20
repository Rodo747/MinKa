/**
 * api.ts — Llamadas al backend de MinKa y tipos de datos.
 * Maneja la URL base dinámica, ofertas, contratos, tramos, emergencias y autenticación /auth.
 */

export interface Oferta {
  id: number;
  productor_id: number;
  cultivo: string;
  cantidad_kg: number;
  fecha_entrega: string; // Formato YYYY-MM-DD
  ubicacion: string;
  precio_referencia_usdc: number;
  porcentaje_descuento: number;
  precio_final_usdc: number;
  costo_anual_equivalente: number;
  estado: 'abierta' | 'fondeada' | 'completada' | 'cancelada';
  fecha_creacion: string;
}

export interface CrearOfertaDatos {
  cultivo: string;
  cantidad_kg: number;
  fecha_entrega: string;
  ubicacion: string;
  precio_referencia_usdc: number;
  porcentaje_descuento: number;
}

export interface Contrato {
  id: number;
  oferta_id: number;
  comprador_id: number;
  id_contrato_escrow?: string | null;
  monto_total_usdc: number;
  estado: 'pendiente_fondeo' | 'activo' | 'en_disputa' | 'completado' | 'resuelto_emergencia';
  fecha_creacion: string;
}

export interface Tramo {
  id: number;
  contrato_id: number;
  numero_tramo: number;
  titulo: string;
  monto_usdc: number;
  estado: 'pendiente' | 'en_revision' | 'aprobado' | 'liberado' | 'reembolsado';
  url_evidencia?: string | null;
  hash_transaccion?: string | null;
  enlace_stellar_expert?: string | null;
}

export interface ReporteEmergencia {
  id: number;
  contrato_id: number;
  productor_id: number;
  motivo: string;
  url_evidencia: string;
  monto_solicitado_usdc: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  hash_pago_fondo?: string | null;
  enlace_stellar_expert?: string | null;
  fecha_creacion: string;
}

export interface ContratoResumen extends Contrato {
  cultivo: string;
  ubicacion?: string;
  fecha_entrega?: string;
  productor_id?: number;
  tramo_actual?: string;
}

export interface DetalleContratoRespuesta {
  contrato: ContratoResumen & { enlace_trustless_work?: string | null };
  tramos: Tramo[];
  reporte_emergencia?: ReporteEmergencia | null;
}

export interface CrearEmergenciaDatos {
  contrato_id: number;
  motivo: string;
  url_evidencia: string;
  monto_solicitado_usdc: number;
}

export interface UsuarioAuth {
  id: number;
  nombre: string;
  nombre_usuario: string;
  perfil_por_defecto: 'productor' | 'comprador';
  direccion_stellar?: string;
  contratos_cumplidos?: number;
}

export interface SaldoCuenta {
  direccion: string;
  saldo_usdc: number;
  saldo_xlm: number;
}

export interface MovimientoPago {
  fecha: string;
  tipo: 'recibido' | 'enviado';
  monto_usdc: number;
  contraparte: string;
  hash: string;
}

export interface RespuestaRecarga {
  hash: string;
  monto_usdc: number;
}

export interface RespuestaRetiro {
  hash: string;
  monto_usdc: number;
}

export interface DatosTransparencia {
  modo_demo: boolean;
  billetera_fondo?: string;
  total_ofertas: number;
  contratos_activos: number;
  saldo_fondo_usdc: number;
  ultimos_movimientos_fondo: Array<{
    id: number;
    tipo: string;
    monto_usdc: number;
    billetera_origen?: string | null;
    billetera_destino?: string | null;
    contrato_id?: number | null;
    hash_transaccion?: string | null;
    fecha_creacion: string;
    enlace_stellar_expert?: string | null;
  }>;
  ultimos_contratos: Array<{
    id: number;
    oferta_id: number;
    monto_total_usdc: number;
    estado: string;
    id_contrato_escrow?: string | null;
    fecha_creacion: string;
    enlace_trustless_work?: string | null;
  }>;
  ultimos_tramos: Array<{
    id: number;
    contrato_id: number;
    numero_tramo: number;
    titulo: string;
    monto_usdc: number;
    estado: string;
    hash_transaccion?: string | null;
    enlace_stellar_expert?: string | null;
  }>;
  ultimas_emergencias: Array<{
    id: number;
    contrato_id: number;
    productor_id: number;
    motivo: string;
    monto_solicitado_usdc: number;
    estado: string;
    hash_pago_fondo?: string | null;
    fecha_creacion: string;
    enlace_stellar_expert?: string | null;
  }>;
}

export interface RespuestaLogin {
  token: string;
  usuario: UsuarioAuth;
}

export interface RespuestaFondeo {
  contrato: Contrato;
  tramo_1_liberado: Tramo;
  hash_transaccion: string;
  tramos: Tramo[];
}

/**
 * Determina la URL base del backend:
 * Usa VITE_API_URL si está definida; si no, http://${window.location.hostname}:8000
 */
export function obtenerUrlBase(): string {
  if (import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== '') {
    return import.meta.env.VITE_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:8000`;
  }
  return 'http://localhost:8000';
}

/**
 * Helper para realizar peticiones HTTP con encabezado de autorización opcional.
 */
async function realizarPeticion<T>(
  ruta: string,
  opciones: RequestInit = {},
  token?: string | null
): Promise<T> {
  const urlBase = obtenerUrlBase();
  const headers = new Headers(opciones.headers || {});
  headers.set('Accept', 'application/json');

  if (opciones.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const respuesta = await fetch(`${urlBase}${ruta}`, {
      ...opciones,
      headers,
    });

    if (!respuesta.ok) {
      let mensajeError = `Error ${respuesta.status}: ${respuesta.statusText}`;
      try {
        const cuerpo = await respuesta.json();
        if (cuerpo && cuerpo.detail) {
          mensajeError = Array.isArray(cuerpo.detail)
            ? cuerpo.detail.map((d: { msg?: string }) => d.msg || '').join(', ')
            : cuerpo.detail;
        }
      } catch {
        // Usa el mensaje HTTP por defecto si no hay JSON
      }
      throw new Error(mensajeError);
    }

    return (await respuesta.json()) as T;
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      throw new Error('No fue posible conectarse con el servidor. Verifica tu conexión de red.');
    }
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Ocurrió un error inesperado al comunicarse con el servidor.');
  }
}

/* ══════════════════════════════════════════════════════════════════
   AUTENTICACIÓN
   ══════════════════════════════════════════════════════════════════ */

export async function entrar(usuario: string, clave: string): Promise<RespuestaLogin> {
  return realizarPeticion<RespuestaLogin>('/auth/entrar', {
    method: 'POST',
    body: JSON.stringify({ usuario, clave }),
  });
}

export async function yo(token: string): Promise<UsuarioAuth> {
  return realizarPeticion<UsuarioAuth>('/auth/yo', { method: 'GET' }, token);
}

/* ══════════════════════════════════════════════════════════════════
   OFERTAS
   ══════════════════════════════════════════════════════════════════ */

export async function obtenerOfertas(): Promise<Oferta[]> {
  return realizarPeticion<Oferta[]>('/ofertas');
}

export async function obtenerOfertaPorId(id: number): Promise<Oferta> {
  return realizarPeticion<Oferta>(`/ofertas/${id}`);
}

export async function publicarOferta(datos: CrearOfertaDatos, token: string): Promise<Oferta> {
  return realizarPeticion<Oferta>(
    '/ofertas',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
    token
  );
}

/* ══════════════════════════════════════════════════════════════════
   CONTRATOS Y TRAMOS
   ══════════════════════════════════════════════════════════════════ */

export async function crearContrato(
  oferta_id: number,
  monto_total_usdc: number,
  token: string
): Promise<{ contrato: Contrato; tramos: Tramo[] }> {
  return realizarPeticion<{ contrato: Contrato; tramos: Tramo[] }>(
    '/contratos',
    {
      method: 'POST',
      body: JSON.stringify({ oferta_id, monto_total_usdc }),
    },
    token
  );
}

export async function fondearContrato(contrato_id: number, token: string): Promise<RespuestaFondeo> {
  return realizarPeticion<RespuestaFondeo>(
    `/contratos/${contrato_id}/fondear`,
    {
      method: 'POST',
    },
    token
  );
}

export async function obtenerContratos(
  como: 'productor' | 'comprador',
  token: string
): Promise<ContratoResumen[]> {
  return realizarPeticion<ContratoResumen[]>(`/contratos?como=${como}`, { method: 'GET' }, token);
}

export async function obtenerContratoPorId(
  id: number,
  token: string
): Promise<DetalleContratoRespuesta> {
  return realizarPeticion<DetalleContratoRespuesta>(`/contratos/${id}`, { method: 'GET' }, token);
}

export async function subirEvidenciaTramo(
  tramo_id: number,
  url_evidencia: string,
  token: string
): Promise<Tramo> {
  return realizarPeticion<Tramo>(
    `/tramos/${tramo_id}/evidencia`,
    {
      method: 'POST',
      body: JSON.stringify({ url_evidencia }),
    },
    token
  );
}

export async function aprobarTramo(tramo_id: number, token: string): Promise<Tramo> {
  return realizarPeticion<Tramo>(
    `/tramos/${tramo_id}/aprobar`,
    {
      method: 'POST',
    },
    token
  );
}

/* ══════════════════════════════════════════════════════════════════
   EMERGENCIAS Y DEMO
   ══════════════════════════════════════════════════════════════════ */

export async function reportarEmergencia(
  datos: CrearEmergenciaDatos,
  token: string
): Promise<ReporteEmergencia> {
  return realizarPeticion<ReporteEmergencia>(
    '/emergencias',
    {
      method: 'POST',
      body: JSON.stringify(datos),
    },
    token
  );
}

export async function reiniciarDemo(): Promise<unknown> {
  return realizarPeticion<unknown>('/demo/reiniciar', {
    method: 'POST',
  });
}

/* ══════════════════════════════════════════════════════════════════
   GESTIÓN DE SALDO, MOVIMIENTOS Y TRANSPARENCIA
   ══════════════════════════════════════════════════════════════════ */

export interface EstadoDemo {
  saldo_plataforma_usdc: number;
  direccion_plataforma: string;
  saldo_fondo_usdc: number;
  direccion_fondo: string;
}

export interface ReporteEmergenciaDetallado {
  id: number;
  contrato_id: number;
  contrato?: number;
  productor_id: number;
  motivo: string;
  tipo_desastre?: string;
  descripcion?: string;
  url_evidencia: string;
  enlace_evidencia?: string;
  monto_solicitado_usdc: number;
  monto_solicitado?: number;
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  hash_pago_fondo?: string | null;
  fecha_creacion: string;
  fecha?: string;
  cultivo?: string;
  enlace_stellar_expert?: string | null;
}

export interface ResultadoAprobacionEmergencia {
  mensaje: string;
  reporte: ReporteEmergenciaDetallado;
  pago_auxilio?: {
    monto_usdc: number;
    hash: string;
  } | null;
  contrato?: unknown;
}

export async function obtenerSaldo(token: string): Promise<SaldoCuenta> {
  return realizarPeticion<SaldoCuenta>('/cuenta/saldo', { method: 'GET' }, token);
}

export async function obtenerMovimientos(token: string): Promise<MovimientoPago[]> {
  return realizarPeticion<MovimientoPago[]>('/cuenta/movimientos', { method: 'GET' }, token);
}

export async function recargarSaldo(token: string): Promise<RespuestaRecarga> {
  return realizarPeticion<RespuestaRecarga>('/cuenta/recargar', { method: 'POST' }, token);
}

export async function retirarSaldo(
  direccion: string,
  monto: number,
  token: string
): Promise<RespuestaRetiro> {
  return realizarPeticion<RespuestaRetiro>(
    '/cuenta/retirar',
    {
      method: 'POST',
      body: JSON.stringify({ direccion, monto }),
    },
    token
  );
}

export async function obtenerTransparencia(): Promise<DatosTransparencia> {
  return realizarPeticion<DatosTransparencia>('/transparencia', { method: 'GET' });
}

export async function obtenerSaldoFondo(): Promise<{ saldo_fondo_usdc: number }> {
  return realizarPeticion<{ saldo_fondo_usdc: number }>('/fondo/saldo', { method: 'GET' });
}

export async function obtenerEstadoDemo(): Promise<EstadoDemo> {
  return realizarPeticion<EstadoDemo>('/demo/estado', { method: 'GET' });
}

export async function obtenerEmergencias(): Promise<ReporteEmergenciaDetallado[]> {
  return realizarPeticion<ReporteEmergenciaDetallado[]>('/emergencias', { method: 'GET' });
}

export async function aprobarEmergencia(id: number): Promise<ResultadoAprobacionEmergencia> {
  return realizarPeticion<ResultadoAprobacionEmergencia>(`/emergencias/${id}/aprobar`, {
    method: 'POST',
  });
}

export async function rechazarEmergencia(id: number): Promise<ReporteEmergenciaDetallado> {
  return realizarPeticion<ReporteEmergenciaDetallado>(`/emergencias/${id}/rechazar`, {
    method: 'POST',
  });
}

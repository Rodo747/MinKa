/**
 * Demo.tsx — Panel de administración y pruebas de la plataforma ("/demo").
 * Pantalla oculta sin barra de navegación estándar, con etiqueta noindex.
 * Permite supervisar saldos de Plataforma y Fondo en Horizon, revisar y
 * resolver emergencias climáticas y reiniciar la base de datos de prueba.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  FileText,
  Building2,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import {
  obtenerEstadoDemo,
  obtenerEmergencias,
  aprobarEmergencia,
  rechazarEmergencia,
  reiniciarDemo,
  type EstadoDemo,
  type ReporteEmergenciaDetallado
} from '../api';

export const Demo: React.FC = () => {
  // Configurar meta noindex dinámicamente
  useEffect(() => {
    let meta = document.querySelector('meta[name="robots"]') as HTMLMetaElement | null;
    const yaExistia = Boolean(meta);
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'robots';
      document.head.appendChild(meta);
    }
    meta.content = 'noindex, nofollow';

    return () => {
      if (!yaExistia && meta && meta.parentNode) {
        meta.parentNode.removeChild(meta);
      } else if (meta) {
        meta.content = 'all';
      }
    };
  }, []);

  const [estado, setEstado] = useState<EstadoDemo | null>(null);
  const [emergencias, setEmergencias] = useState<ReporteEmergenciaDetallado[]>([]);
  const [cargandoEstado, setCargandoEstado] = useState<boolean>(true);
  const [cargandoEmergencias, setCargandoEmergencias] = useState<boolean>(true);
  const [modoDemoInactivo, setModoDemoInactivo] = useState<boolean>(false);

  // Estados de copiado
  const [copiadoPlat, setCopiadoPlat] = useState(false);
  const [copiadoFondo, setCopiadoFondo] = useState(false);

  // Estados para acciones de emergencia
  const [emergenciaSeleccionada, setEmergenciaSeleccionada] = useState<ReporteEmergenciaDetallado | null>(null);
  const [tipoAccionEmergencia, setTipoAccionEmergencia] = useState<'aprobar' | 'rechazar' | null>(null);
  const [procesandoEmergencia, setProcesandoEmergencia] = useState<boolean>(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [resultadoExitoso, setResultadoExitoso] = useState<{
    mensaje: string;
    hash?: string;
  } | null>(null);

  // Modal para reinicio de base de datos
  const [mostrarModalReinicio, setMostrarModalReinicio] = useState<boolean>(false);
  const [reiniciando, setReiniciando] = useState<boolean>(false);
  const [mensajeReinicio, setMensajeReinicio] = useState<string | null>(null);

  // Cargar estado de plataforma y fondo
  const cargarEstado = async () => {
    try {
      setCargandoEstado(true);
      const res = await obtenerEstadoDemo();
      setEstado(res);
      setModoDemoInactivo(false);
    } catch (err: any) {
      if (err?.message?.includes('404') || err?.message?.includes('no está habilitado')) {
        setModoDemoInactivo(true);
      } else {
        console.error('Error al cargar estado de demo:', err);
      }
    } finally {
      setCargandoEstado(false);
    }
  };

  // Cargar lista de reportes de emergencia
  const cargarEmergencias = async () => {
    try {
      setCargandoEmergencias(true);
      const res = await obtenerEmergencias();
      setEmergencias(res);
    } catch (err) {
      console.error('Error al cargar emergencias:', err);
    } finally {
      setCargandoEmergencias(false);
    }
  };

  useEffect(() => {
    cargarEstado();
    cargarEmergencias();
  }, []);

  const copiarTexto = (texto: string, esPlat: boolean) => {
    navigator.clipboard.writeText(texto);
    if (esPlat) {
      setCopiadoPlat(true);
      setTimeout(() => setCopiadoPlat(false), 2500);
    } else {
      setCopiadoFondo(true);
      setTimeout(() => setCopiadoFondo(false), 2500);
    }
  };

  const ejecutarAccionEmergencia = async () => {
    if (!emergenciaSeleccionada || !tipoAccionEmergencia) return;
    try {
      setProcesandoEmergencia(true);
      setErrorAccion(null);
      setResultadoExitoso(null);

      if (tipoAccionEmergencia === 'aprobar') {
        const res: any = await aprobarEmergencia(emergenciaSeleccionada.id);
        setResultadoExitoso({
          mensaje: 'Emergencia aprobada y auxilio desembolsado con éxito desde el Fondo Solidario.',
          hash: res?.hash_desembolso || res?.reporte?.hash_pago_fondo || undefined
        });
      } else {
        await rechazarEmergencia(emergenciaSeleccionada.id);
        setResultadoExitoso({
          mensaje: 'Reporte de emergencia rechazado formalmente.'
        });
      }

      // Recargar datos en vivo
      await Promise.all([cargarEmergencias(), cargarEstado()]);
      setEmergenciaSeleccionada(null);
      setTipoAccionEmergencia(null);
    } catch (err: any) {
      setErrorAccion(err?.message || 'Error al procesar la emergencia.');
    } finally {
      setProcesandoEmergencia(false);
    }
  };

  const ejecutarReinicio = async () => {
    try {
      setReiniciando(true);
      setMensajeReinicio(null);
      await reiniciarDemo();
      setMensajeReinicio('Base de datos reiniciada. Se crearon las 3 ofertas de ejemplo.');
      await Promise.all([cargarEmergencias(), cargarEstado()]);
      setMostrarModalReinicio(false);
    } catch (err: any) {
      setMensajeReinicio(`Error al reiniciar: ${err?.message || 'Fallo desconocido'}`);
    } finally {
      setReiniciando(false);
    }
  };

  const formatearMonto = (monto?: number) => {
    if (monto === undefined || monto === null) return '0,00 USDC';
    return (
      monto.toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' USDC'
    );
  };

  const formatearFecha = (fechaStr?: string) => {
    if (!fechaStr) return '';
    try {
      const f = new Date(fechaStr);
      return f.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return fechaStr;
    }
  };

  if (modoDemoInactivo) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="font-titulo text-2xl font-bold text-[#14221B]">
          El modo demo no está activo
        </h1>
        <p className="text-xs sm:text-sm text-[#5B6B63] mt-2 max-w-sm">
          Esta función de administración requiere que la variable MODO_DEMO esté habilitada en el backend.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#14221B]">
      {/* ── CABECERA INDEPENDIENTE (Sin la barra de navegación de la app) ── */}
      <header className="bg-[#0A2E1F] text-white border-b border-[#0F3D2E] px-4 sm:px-8 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="MinKa" className="h-8 w-auto object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-titulo text-lg font-bold text-white tracking-tight">
                  Panel de la plataforma
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-[#EA580C] text-white">
                  Red de pruebas
                </span>
              </div>
              <p className="text-[11px] text-emerald-300/80">
                Herramientas administrativas internas de demostración y liquidación en Stellar
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              cargarEstado();
              cargarEmergencias();
            }}
            disabled={cargandoEstado || cargandoEmergencias}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-semibold text-emerald-100 active:scale-[0.97] transition-all"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                cargandoEstado || cargandoEmergencias ? 'animate-spin' : ''
              }`}
            />
            <span>Actualizar datos</span>
          </button>
        </div>
      </header>

      {/* Notificaciones globales */}
      {mensajeReinicio && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{mensajeReinicio}</span>
            </div>
            <button
              onClick={() => setMensajeReinicio(null)}
              className="text-xs font-bold underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {resultadoExitoso && (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 mt-6">
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{resultadoExitoso.mensaje}</span>
            </div>
            {resultadoExitoso.hash && (
              <a
                href={`https://stellar.expert/explorer/testnet/tx/${resultadoExitoso.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-bold text-[#1F6B45] hover:underline"
              >
                <span>Ver en Stellar Expert</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ── CUERPO DE PANELES ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-10">
        {/* ── BLOQUE 1: ESTADO (PLATAFORMA Y FONDO) ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45]">
                Reservas y liquidez en Horizon
              </span>
              <h2 className="font-titulo text-xl font-bold text-[#14221B] mt-0.5">
                Estado del sistema
              </h2>
            </div>
            <p className="text-xs text-[#5B6B63] max-w-sm">
              La Plataforma entrega las recargas de prueba. Recárgala en{' '}
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-[#EA580C] hover:underline"
              >
                faucet.circle.com
              </a>{' '}
              cuando se agote.
            </p>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Tarjeta Plataforma */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5B6B63] flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-[#1F6B45]" />
                    <span>Cuenta Plataforma</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-[#1F6B45] font-bold">
                    Dispensadora
                  </span>
                </div>

                <div className="mt-3">
                  <span className="font-titulo text-3xl font-black text-[#0A2E1F]">
                    {cargandoEstado ? '...' : formatearMonto(estado?.saldo_plataforma_usdc)}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60">
                  <span className="text-[11px] text-[#5B6B63] block mb-1">
                    Dirección pública Stellar:
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-[#14221B] bg-white px-2 py-1 rounded border border-slate-200 truncate flex-1 select-all">
                      {estado?.direccion_plataforma || 'Cargando...'}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        estado?.direccion_plataforma &&
                        copiarTexto(estado.direccion_plataforma, true)
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium hover:bg-slate-100 shrink-0"
                    >
                      {copiadoPlat ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#5B6B63]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${estado?.direccion_plataforma}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B45] hover:underline"
                >
                  <span>Ver en Stellar Expert</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {/* Tarjeta Fondo Solidario */}
            <div className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#5B6B63] flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#EA580C]" />
                    <span>Fondo Solidario de Emergencia</span>
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-[#EA580C] font-bold">
                    Contingencias
                  </span>
                </div>

                <div className="mt-3">
                  <span className="font-titulo text-3xl font-black text-[#0A2E1F]">
                    {cargandoEstado ? '...' : formatearMonto(estado?.saldo_fondo_usdc)}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/60">
                  <span className="text-[11px] text-[#5B6B63] block mb-1">
                    Dirección pública Stellar:
                  </span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-[#14221B] bg-white px-2 py-1 rounded border border-slate-200 truncate flex-1 select-all">
                      {estado?.direccion_fondo || 'Cargando...'}
                    </code>
                    <button
                      type="button"
                      onClick={() =>
                        estado?.direccion_fondo &&
                        copiarTexto(estado.direccion_fondo, false)
                      }
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-medium hover:bg-slate-100 shrink-0"
                    >
                      {copiadoFondo ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#5B6B63]" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <a
                  href={`https://stellar.expert/explorer/testnet/account/${estado?.direccion_fondo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B45] hover:underline"
                >
                  <span>Ver en Stellar Expert</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ── BLOQUE 2: EMERGENCIAS (VERIFICACIÓN Y RESOLUCIÓN) ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#EA580C]">
                Árbitro centralizado de contingencias (MVP)
              </span>
              <h2 className="font-titulo text-xl font-bold text-[#14221B] mt-0.5">
                Reportes de emergencia
              </h2>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-[#5B6B63]">
              {emergencias.length} reportes registrados
            </span>
          </div>

          {errorAccion && (
            <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorAccion}</span>
              </div>
              <button
                onClick={() => setErrorAccion(null)}
                className="font-bold underline"
              >
                Cerrar
              </button>
            </div>
          )}

          <div className="mt-6">
            {cargandoEmergencias ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-20 bg-slate-50 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : emergencias.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
                <ShieldAlert className="w-10 h-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-[#14221B]">
                  No hay reportes de emergencia pendientes ni registrados
                </p>
                <p className="text-xs text-[#5B6B63] mt-1 max-w-sm">
                  Cuando un productor reporta una helada, sequía o desastre desde su contrato, aparecerá aquí para su verificación y desembolso.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {emergencias.map((em) => {
                  const esPendiente = em.estado === 'pendiente';
                  return (
                    <div
                      key={em.id}
                      className="p-5 rounded-2xl bg-slate-50/80 border border-slate-200 flex flex-col gap-4 text-xs"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-titulo text-base font-bold text-[#14221B]">
                              Reporte #{em.id} · {em.cultivo || 'Cosecha agrícola'}
                            </span>
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                                em.estado === 'aprobado'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : em.estado === 'rechazado'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {em.estado}
                            </span>
                          </div>

                          <div className="mt-2 space-y-1 text-[#5B6B63]">
                            <p>
                              <strong>Desastre:</strong> {em.tipo_desastre || em.motivo}
                            </p>
                            <p>
                              <strong>Contrato:</strong> #{em.contrato_id || em.contrato}
                            </p>
                            <p className="flex items-center gap-1 text-[11px]">
                              <Clock className="w-3 h-3" />
                              <span>{formatearFecha(em.fecha || em.fecha_creacion)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="sm:text-right shrink-0">
                          <span className="text-[11px] text-[#5B6B63] block">
                            Monto de auxilio solicitado:
                          </span>
                          <span className="font-titulo text-lg font-extrabold text-[#1F6B45]">
                            {formatearMonto(em.monto_solicitado || em.monto_solicitado_usdc)}
                          </span>
                        </div>
                      </div>

                      {/* Evidencia y acciones */}
                      <div className="pt-3 border-t border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          {em.url_evidencia || em.enlace_evidencia ? (
                            <a
                              href={em.url_evidencia || em.enlace_evidencia}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B45] hover:underline"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              <span>Ver evidencia georreferenciada</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-slate-400 italic">Sin enlace de evidencia</span>
                          )}

                          {em.enlace_stellar_expert && (
                            <a
                              href={em.enlace_stellar_expert}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B45] hover:underline"
                            >
                              <span>Ver desembolso en Stellar</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>

                        {esPendiente && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEmergenciaSeleccionada(em);
                                setTipoAccionEmergencia('rechazar');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-red-700 font-titulo font-bold text-xs active:scale-[0.97] transition-all"
                            >
                              Rechazar
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEmergenciaSeleccionada(em);
                                setTipoAccionEmergencia('aprobar');
                              }}
                              className="px-4 py-1.5 rounded-xl bg-[#1F6B45] hover:bg-[#0A2E1F] text-white font-titulo font-bold text-xs active:scale-[0.97] transition-all shadow-xs"
                            >
                              Aprobar y desembolsar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── BLOQUE 3: DATOS Y REINICIO DE PRUEBAS ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-rose-600">
                Zona de pruebas y mantenimiento
              </span>
              <h2 className="font-titulo text-xl font-bold text-[#14221B] mt-0.5">
                Reiniciar base de datos de demostración
              </h2>
              <p className="text-xs text-[#5B6B63] mt-1 max-w-xl">
                Limpia las tablas locales de contratos, ofertas, tramos y reportes, restableciendo las
                cuentas de Productor Demo y Comprador Demo con las 3 ofertas de ejemplo (Quinua Real, Café y Sésamo).
              </p>
            </div>

            <button
              type="button"
              onClick={() => setMostrarModalReinicio(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-titulo font-bold text-xs active:scale-[0.97] transition-all shrink-0 shadow-xs"
            >
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>Reiniciar datos de la demo</span>
            </button>
          </div>
        </section>
      </main>

      {/* ── MODAL DE CONFIRMACIÓN PARA ACCIÓN DE EMERGENCIA ── */}
      {emergenciaSeleccionada && tipoAccionEmergencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  tipoAccionEmergencia === 'aprobar'
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'bg-red-50 text-red-700'
                }`}
              >
                {tipoAccionEmergencia === 'aprobar' ? (
                  <ShieldCheck className="w-6 h-6" />
                ) : (
                  <XCircle className="w-6 h-6" />
                )}
              </div>
              <div>
                <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                  {tipoAccionEmergencia === 'aprobar'
                    ? 'Aprobar emergencia y desembolsar'
                    : 'Rechazar reporte de emergencia'}
                </h3>
                <p className="text-xs text-[#5B6B63]">
                  Reporte #{emergenciaSeleccionada.id} · {emergenciaSeleccionada.cultivo}
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#5B6B63] mt-4 leading-relaxed">
              {tipoAccionEmergencia === 'aprobar' ? (
                <>
                  Se resolverá el contrato en Stellar, se cancelarán los tramos no liberados y se
                  desembolsará{' '}
                  <strong className="text-[#1F6B45]">
                    {formatearMonto(
                      emergenciaSeleccionada.monto_solicitado ||
                        emergenciaSeleccionada.monto_solicitado_usdc
                    )}
                  </strong>{' '}
                  directamente desde el Fondo Solidario a la billetera del productor.
                </>
              ) : (
                <>
                  ¿Confirmas que deseas rechazar este reporte? El contrato continuará su curso
                  habitual y no se emitirá auxilio del fondo.
                </>
              )}
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={procesandoEmergencia}
                onClick={() => {
                  setEmergenciaSeleccionada(null);
                  setTipoAccionEmergencia(null);
                  setErrorAccion(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#14221B] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoEmergencia}
                onClick={ejecutarAccionEmergencia}
                className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-white font-titulo font-bold text-xs active:scale-[0.97] transition-all ${
                  tipoAccionEmergencia === 'aprobar'
                    ? 'bg-[#1F6B45] hover:bg-[#0A2E1F]'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {procesandoEmergencia ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Confirmando en Stellar…</span>
                  </>
                ) : (
                  <span>
                    {tipoAccionEmergencia === 'aprobar'
                      ? 'Confirmar desembolso'
                      : 'Confirmar rechazo'}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE CONFIRMACIÓN DE REINICIO ── */}
      {mostrarModalReinicio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xl max-w-md w-full animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                  ¿Reiniciar base de datos de la demo?
                </h3>
                <span className="text-xs text-rose-600 font-semibold">
                  Acción de mantenimiento local
                </span>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-[#5B6B63] mt-4 leading-relaxed">
              Se borrarán los contratos, ofertas y reportes y se volverán a crear las 3 ofertas de
              ejemplo (Quinua Real, Café y Sésamo). Las cuentas demo conservarán sus credenciales.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={reiniciando}
                onClick={() => setMostrarModalReinicio(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-[#14221B] transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={reiniciando}
                onClick={ejecutarReinicio}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-titulo font-bold text-xs active:scale-[0.97] transition-all shadow-xs"
              >
                {reiniciando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reiniciando base de datos...</span>
                  </>
                ) : (
                  <span>Sí, reiniciar ahora</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Demo;

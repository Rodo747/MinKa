/**
 * Respaldo.tsx — Vista pública de transparencia y Fondo Solidario de Emergencia.
 * Muestra el saldo real del Fondo en Horizon, dirección verificable en Stellar Expert,
 * sección explicativa "¿Cómo funciona el Fondo?", botón interactivo "Aportar al Fondo"
 * y listado unificado de "Movimientos del Fondo" (GET /fondo/historial).
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  HeartHandshake,
  Loader2,
  AlertTriangle,
  Coins,
  ShieldAlert,
  Send,
  FileText,
} from 'lucide-react';
import {
  obtenerTransparencia,
  obtenerHistorialFondo,
  aportarAlFondo,
  type DatosTransparencia,
  type HistorialFondoRespuesta,
} from '../api';
import { usarSesion } from '../sesion';

export const Respaldo: React.FC = () => {
  const { token, perfilActivo } = usarSesion();

  const [datos, setDatos] = useState<DatosTransparencia | null>(null);
  const [historial, setHistorial] = useState<HistorialFondoRespuesta | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  // Modal de Aporte al Fondo
  const [modalAporteAbierto, setModalAporteAbierto] = useState<boolean>(false);
  const [montoAporte, setMontoAporte] = useState<string>('1.0');
  const [cargandoAporte, setCargandoAporte] = useState<boolean>(false);
  const [errorAporte, setErrorAporte] = useState<string | null>(null);
  const [exitoAporte, setExitoAporte] = useState<{ hash: string; monto_usdc: number } | null>(null);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const [resTransparencia, resHistorial] = await Promise.all([
        obtenerTransparencia(),
        obtenerHistorialFondo(),
      ]);
      setDatos(resTransparencia);
      setHistorial(resHistorial);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No fue posible cargar los datos de transparencia del fondo.');
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, []);

  const copiarDireccion = (direccion: string) => {
    navigator.clipboard.writeText(direccion);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const formatearMonto = (monto: number) => {
    return (
      monto.toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + ' USDC'
    );
  };

  const formatearFecha = (fechaStr: string) => {
    try {
      const f = new Date(fechaStr);
      return f.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return fechaStr;
    }
  };

  const handleConfirmarAporte = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    const montoNum = parseFloat(montoAporte);
    if (isNaN(montoNum) || montoNum < 0.01) {
      setErrorAporte('El monto mínimo para aportar es 0.01 USDC.');
      return;
    }

    setCargandoAporte(true);
    setErrorAporte(null);
    try {
      const res = await aportarAlFondo(montoNum, token);
      setExitoAporte(res);
      // Recargar saldo e historial del Fondo
      await cargarDatos();
    } catch (err) {
      if (err instanceof Error) {
        setErrorAporte(err.message);
      } else {
        setErrorAporte('Ocurrió un error al procesar el aporte en Stellar.');
      }
    } finally {
      setCargandoAporte(false);
    }
  };

  const cerrarModalAporte = () => {
    setModalAporteAbierto(false);
    setErrorAporte(null);
    setExitoAporte(null);
    setMontoAporte('1.0');
  };

  const billeteraFondo =
    datos?.billetera_fondo ||
    'GBUQSZ7IYKUVXJEKR7ZA7IJBSKLHQFVGZXUYZ7GOZ2KEZ6F4X4RVD4T2';

  const totalAuxiliosCant = historial?.total_auxilios_cantidad ?? 0;
  const totalAuxiliosSuma = historial?.total_auxilios_usdc ?? 0;

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-in fade-in duration-300 space-y-10">
      
      {/* ── ENCABEZADO PRINCIPAL ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-[#1F6B45] text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4 text-[#1F6B45]" />
            <span>Fondo Solidario de Emergencia</span>
          </div>
          <h1 className="font-titulo text-3xl sm:text-4xl text-[#0A2E1F] tracking-tight font-extrabold">
            Fondo Solidario de Emergencia
          </h1>
          <p className="text-sm sm:text-base text-[#5B6B63] mt-2 max-w-2xl leading-relaxed">
            Cada movimiento es público y verificable en Stellar. Mecanismo de auxilio solidario para pequeños productores agrícolas ante siniestros climáticos validados.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarDatos}
          disabled={cargando}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-titulo font-semibold text-[#14221B] hover:bg-slate-50 active:scale-[0.97] transition-all shadow-xs cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#5B6B63] ${cargando ? 'animate-spin' : ''}`} />
          <span>Actualizar libro</span>
        </button>
      </div>

      {/* Manejo de error de carga */}
      {error && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={cargarDatos}
            className="text-xs font-bold underline hover:text-amber-800 cursor-pointer"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* ── TARJETA PRINCIPAL DE SALDO Y ACCIONES ── */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-[#5B6B63]">
              Saldo actual en reserva
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-titulo text-4xl sm:text-5xl font-black text-[#0A2E1F] tracking-tight">
                {cargando ? (
                  <span className="inline-block w-48 h-10 bg-slate-100 rounded-xl animate-pulse" />
                ) : (
                  formatearMonto(datos?.saldo_fondo_usdc ?? 0)
                )}
              </span>
            </div>
            <p className="text-xs text-[#5B6B63] mt-2">
              Fondos apartados para contingencias agrícolas validadas en la red Stellar Testnet.
            </p>

            {/* BOTONES DE ACCIÓN (B3) */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {token ? (
                <button
                  type="button"
                  onClick={() => setModalAporteAbierto(true)}
                  className="interaccion-tactil sombra-naranja-brillo inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs cursor-pointer transition-all"
                >
                  <Coins className="w-4 h-4" />
                  <span>Aportar al Fondo</span>
                </button>
              ) : (
                <Link
                  to="/entrar"
                  className="interaccion-tactil inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#0A2E1F] font-titulo font-bold text-xs transition-colors"
                >
                  <HeartHandshake className="w-4 h-4 text-[#1F6B45]" />
                  <span>Inicia sesión para aportar</span>
                </Link>
              )}

              {token && perfilActivo === 'productor' && (
                <Link
                  to="/mi-cuenta?pestana=contratos"
                  className="interaccion-tactil inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-titulo font-bold text-xs transition-colors"
                >
                  <ShieldAlert className="w-4 h-4 text-red-600" />
                  <span>Reportar una emergencia</span>
                </Link>
              )}
            </div>
          </div>

          {/* Dirección Stellar y Enlaces */}
          <div className="flex flex-col gap-3 bg-slate-50/80 p-4 sm:p-5 rounded-2xl border border-slate-200/80 max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6B63]">
              Billetera pública del fondo
            </span>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono text-[#0A2E1F] bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 break-all select-all flex-1">
                {billeteraFondo}
              </code>
              <button
                type="button"
                onClick={() => copiarDireccion(billeteraFondo)}
                title="Copiar dirección Stellar"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-[#14221B] hover:bg-slate-100 active:scale-[0.97] transition-all shrink-0 shadow-2xs cursor-pointer"
              >
                {copiado ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 font-bold">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-[#5B6B63]" />
                    <span>Copiar</span>
                  </>
                )}
              </button>
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <a
                href={`https://stellar.expert/explorer/testnet/account/${billeteraFondo}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B45] hover:text-[#0A2E1F] hover:underline"
              >
                <span>Ver cuenta en Stellar Expert</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Métricas secundarias */}
        <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <span className="text-xs text-[#5B6B63]">Auxilios pagados</span>
            <p className="font-titulo text-xl font-bold text-[#14221B] mt-0.5">
              {cargando ? '...' : `${totalAuxiliosCant} (${formatearMonto(totalAuxiliosSuma)})`}
            </p>
          </div>
          <div>
            <span className="text-xs text-[#5B6B63]">Contratos en marcha</span>
            <p className="font-titulo text-xl font-bold text-[#14221B] mt-0.5">
              {cargando ? '...' : (datos?.contratos_activos ?? 0)}
            </p>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <span className="text-xs text-[#5B6B63]">Red de liquidación</span>
            <p className="font-titulo text-xl font-bold text-[#1F6B45] mt-0.5">
              Stellar Testnet
            </p>
          </div>
        </div>
      </div>

      {/* ── SECCIÓN: ¿CÓMO FUNCIONA EL FONDO? (B3) ── */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
        <div className="max-w-2xl pb-6 border-b border-slate-100">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45]">
            Mecanismo honesto y verificable
          </span>
          <h2 className="font-titulo text-2xl font-bold text-[#14221B] mt-1">
            ¿Cómo funciona el Fondo?
          </h2>
          <p className="text-xs sm:text-sm text-[#5B6B63] mt-2 leading-relaxed">
            Un esquema solidario de contingencia diseñado para amortiguar pérdidas climáticas sin promesas desmedidas.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Paso 1 */}
          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 relative flex flex-col justify-between group hover:border-[#1F6B45]/40 transition-colors">
            <div>
              <span className="font-titulo text-3xl font-black text-[#1F6B45]/25">01</span>
              <h3 className="font-titulo text-base font-bold text-[#14221B] mt-2">
                Reporte con evidencia
              </h3>
              <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                Un productor con un contrato activo reporta un desastre natural con evidencia.
              </p>
            </div>
          </div>

          {/* Paso 2 */}
          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 relative flex flex-col justify-between group hover:border-[#1F6B45]/40 transition-colors">
            <div>
              <span className="font-titulo text-3xl font-black text-[#EA580C]/25">02</span>
              <h3 className="font-titulo text-base font-bold text-[#14221B] mt-2">
                Revisión y reembolso
              </h3>
              <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                La plataforma revisa la evidencia. Si la aprueba, el comprador recupera los tramos pendientes.
              </p>
            </div>
          </div>

          {/* Paso 3 */}
          <div className="p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 relative flex flex-col justify-between group hover:border-[#1F6B45]/40 transition-colors">
            <div>
              <span className="font-titulo text-3xl font-black text-[#1F6B45]/25">03</span>
              <h3 className="font-titulo text-base font-bold text-[#14221B] mt-2">
                Auxilio parcial al productor
              </h3>
              <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                El Fondo paga un auxilio parcial al productor, de hasta el 50 % del valor del contrato (parámetro inicial). Hoy el Fondo se financia con USDC de la red de pruebas; en el futuro, con aportes y primas por contrato.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── SECCIÓN: MOVIMIENTOS DEL FONDO (B3) ── */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="font-titulo text-xl font-bold text-[#14221B]">
                Movimientos del Fondo
              </h2>
            </div>
            <p className="text-xs text-[#5B6B63] mt-1">
              Registro real de aportes y pagos de auxilio leídos directamente de Horizon en Stellar Testnet.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-[#14221B]">
              Auxilios pagados: <strong className="text-[#1F6B45]">{totalAuxiliosCant}</strong> ({formatearMonto(totalAuxiliosSuma)})
            </span>
          </div>
        </div>

        <div className="mt-6">
          {cargando ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : !historial?.movimientos || historial.movimientos.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center p-6 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
              <FileText className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-[#14221B]">
                Aún no hay movimientos registrados en el Fondo
              </p>
              <p className="text-xs text-[#5B6B63] mt-1 max-w-sm">
                Los aportes solidarios y los auxilios pagados se registrarán aquí en tiempo real con su transacción en Stellar.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {historial.movimientos.map((m) => {
                const esAporte = m.tipo === 'aporte';
                return (
                  <div
                    key={m.hash}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${
                          esAporte
                            ? 'bg-emerald-50 text-[#1F6B45]'
                            : 'bg-orange-50 text-[#EA580C]'
                        }`}
                      >
                        {esAporte ? (
                          <ArrowDownLeft className="w-5 h-5" />
                        ) : (
                          <ArrowUpRight className="w-5 h-5" />
                        )}
                      </div>

                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-titulo text-sm font-bold text-[#14221B]">
                            {esAporte ? 'Aporte al Fondo' : 'Auxilio por siniestro'}
                          </span>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                              esAporte
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-orange-100 text-orange-800'
                            }`}
                          >
                            {m.tipo}
                          </span>
                        </div>
                        <span className="text-xs text-[#5B6B63] mt-0.5">
                          Contraparte: <strong className="text-[#14221B]">{m.contraparte}</strong> • {formatearFecha(m.fecha)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 pl-13 sm:pl-0">
                      <span
                        className={`font-cifras font-bold text-sm sm:text-base ${
                          esAporte ? 'text-[#1F6B45]' : 'text-[#EA580C]'
                        }`}
                      >
                        {esAporte ? '+' : '-'}{formatearMonto(m.monto_usdc)}
                      </span>

                      <a
                        href={`https://stellar.expert/explorer/testnet/tx/${m.hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F6B45] hover:underline shrink-0"
                      >
                        <span>Ver en Stellar Expert</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── MODAL INTERACTIVO: APORTAR AL FONDO (B3) ── */}
      {modalAporteAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200">
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
                <Coins className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                  Aportar al Fondo Solidario
                </h3>
                <span className="text-[11px] text-[#5B6B63]">
                  Transferencia real de USDC en Stellar Testnet
                </span>
              </div>
            </div>

            {exitoAporte ? (
              <div className="flex flex-col gap-4 py-2">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-col gap-2">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
                    <Check className="w-5 h-5 text-emerald-600" />
                    <span>¡Aporte completado con éxito!</span>
                  </div>
                  <p>
                    Se transfirieron <strong>{formatearMonto(exitoAporte.monto_usdc)}</strong> directamente a la billetera pública del Fondo Solidario.
                  </p>
                  <a
                    href={`https://stellar.expert/explorer/testnet/tx/${exitoAporte.hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-bold text-[#1F6B45] hover:underline pt-1"
                  >
                    <span>Ver transacción en Stellar Expert</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>

                <button
                  type="button"
                  onClick={cerrarModalAporte}
                  className="interaccion-tactil w-full py-2.5 rounded-xl bg-[#0A2E1F] text-white font-titulo font-bold text-xs cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmarAporte} className="flex flex-col gap-4">
                {errorAporte && (
                  <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {errorAporte}
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-[#14221B]">Monto a aportar (USDC)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={montoAporte}
                    onChange={(e) => setMontoAporte(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs font-cifras font-semibold text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white"
                    placeholder="0.05"
                    required
                  />
                  <span className="text-[11px] text-[#5B6B63]">
                    Mínimo: 0.01 USDC. Los fondos se descontarán de tu saldo de cuenta en Stellar.
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>Esta acción no se puede deshacer. Los fondos pasarán al balance público del Fondo Solidario.</span>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    disabled={cargandoAporte}
                    onClick={cerrarModalAporte}
                    className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={cargandoAporte}
                    className="interaccion-tactil sombra-naranja-brillo w-1/2 py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all disabled:opacity-50"
                  >
                    {cargandoAporte ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Confirmando en Stellar…</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Confirmar aporte</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default Respaldo;

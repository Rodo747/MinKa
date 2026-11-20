/**
 * Respaldo.tsx — Vista pública de transparencia y Fondo Solidario de Emergencia.
 * Muestra el saldo real del Fondo en Horizon, dirección verificable en Stellar Expert,
 * emergencias atendidas y desembolsos registrados con evidencia verificable.
 */

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  AlertCircle,
  FileText,
  Clock,
  ArrowUpRight,
  TrendingUp,
  RefreshCw,
  FolderLock
} from 'lucide-react';
import { obtenerTransparencia, type DatosTransparencia } from '../api';

export const Respaldo: React.FC = () => {
  const [datos, setDatos] = useState<DatosTransparencia | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<boolean>(false);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const res = await obtenerTransparencia();
      setDatos(res);
    } catch (err: any) {
      setError(err?.message || 'No fue posible cargar los datos de transparencia del fondo.');
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
        maximumFractionDigits: 2
      }) + ' USDC'
    );
  };

  const formatearFecha = (fechaStr: string) => {
    try {
      const f = new Date(fechaStr);
      return f.toLocaleDateString('es-BO', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return fechaStr;
    }
  };

  const billeteraFondo =
    datos?.billetera_fondo ||
    'GBUQSZ7IYKUVXJEKR7ZA7IJBSKLHQFVGZXUYZ7GOZ2KEZ6F4X4RVD4T2';

  const emergenciasAtendidas =
    datos?.ultimas_emergencias.filter(
      (e) => e.estado === 'aprobado' || e.estado === 'aprobada'
    ) || [];

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 animate-in fade-in duration-300">
      {/* Encabezado con estilo recibo público */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-8 border-b border-slate-200/80">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-[#1F6B45] text-xs font-semibold mb-3">
            <ShieldCheck className="w-4 h-4 text-[#1F6B45]" />
            <span>Fondo Solidario de Emergencia</span>
          </div>
          <h1 className="font-titulo text-3xl sm:text-4xl text-[#0A2E1F] tracking-tight font-extrabold">
            Fondo Solidario de Emergencia
          </h1>
          <p className="text-sm sm:text-base text-[#5B6B63] mt-2 max-w-2xl">
            Cada movimiento es público y verificable. Registro de respaldo para productores ante contingencias climáticas y desastres verificados.
          </p>
        </div>

        <button
          onClick={cargarDatos}
          disabled={cargando}
          className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-titulo font-semibold text-[#14221B] hover:bg-slate-50 active:scale-[0.97] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#5B6B63] ${cargando ? 'animate-spin' : ''}`} />
          <span>Actualizar libro</span>
        </button>
      </div>

      {/* Manejo de error */}
      {error && (
        <div className="mt-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={cargarDatos}
            className="text-xs font-bold underline hover:text-amber-800"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Tarjeta principal de saldo del fondo */}
      <div className="mt-8 bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] relative overflow-hidden">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-medium text-[#14221B] hover:bg-slate-100 active:scale-[0.97] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] shrink-0 shadow-2xs"
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
            <span className="text-xs text-[#5B6B63]">Ofertas registradas</span>
            <p className="font-titulo text-xl font-bold text-[#14221B] mt-0.5">
              {cargando ? '...' : (datos?.total_ofertas ?? 0)}
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

      {/* Grilla de secciones: Emergencias atendidas y Desembolsos */}
      <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Sección: Emergencias atendidas */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h2 className="font-titulo text-lg font-bold text-[#14221B]">
                Emergencias atendidas
              </h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-[#5B6B63]">
              {emergenciasAtendidas.length} aprobadas
            </span>
          </div>

          <div className="mt-4 flex-1">
            {cargando ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : emergenciasAtendidas.length === 0 ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
                <ShieldCheck className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-[#14221B]">
                  Aún no hay emergencias atendidas
                </p>
                <p className="text-xs text-[#5B6B63] mt-1 max-w-xs">
                  Los reportes de contingencia validados y compensados se mostrarán aquí con su transacción verificable.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {emergenciasAtendidas.map((em) => (
                  <div
                    key={em.id}
                    className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-titulo font-bold text-sm text-[#14221B]">
                            {em.motivo}
                          </span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800">
                            Aprobado
                          </span>
                        </div>
                        <span className="text-xs text-[#5B6B63] flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3" />
                          {formatearFecha(em.fecha_creacion)}
                        </span>
                      </div>
                      <span className="font-titulo text-sm font-bold text-[#1F6B45]">
                        {formatearMonto(em.monto_solicitado_usdc)}
                      </span>
                    </div>

                    {em.enlace_stellar_expert && (
                      <div className="pt-2 border-t border-slate-200/50 flex justify-end">
                        <a
                          href={em.enlace_stellar_expert}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F6B45] hover:underline"
                        >
                          <span>Ver pago en Stellar Expert</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sección: Últimos desembolsos */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] flex flex-col">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
              <h2 className="font-titulo text-lg font-bold text-[#14221B]">
                Últimos desembolsos
              </h2>
            </div>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-[#5B6B63]">
              {datos?.ultimos_movimientos_fondo?.length ?? 0} registros
            </span>
          </div>

          <div className="mt-4 flex-1">
            {cargando ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
                ))}
              </div>
            ) : (!datos?.ultimos_movimientos_fondo || datos.ultimos_movimientos_fondo.length === 0) ? (
              <div className="h-44 flex flex-col items-center justify-center text-center p-4 rounded-2xl bg-slate-50/60 border border-dashed border-slate-200">
                <FileText className="w-8 h-8 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-[#14221B]">
                  Sin movimientos registrados
                </p>
                <p className="text-xs text-[#5B6B63] mt-1 max-w-xs">
                  Aún no se han ejecutado desembolsos desde el Fondo Solidario.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {datos.ultimos_movimientos_fondo.map((mov) => (
                  <div
                    key={mov.id}
                    className="p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-titulo font-bold text-[#14221B] capitalize">
                          {mov.tipo}
                        </span>
                        <span className="text-[11px] text-[#5B6B63]">
                          {formatearFecha(mov.fecha_creacion)}
                        </span>
                      </div>
                      {mov.billetera_destino && (
                        <p className="text-[11px] text-[#5B6B63] font-mono mt-0.5 truncate max-w-[200px] sm:max-w-xs">
                          Destino: {mov.billetera_destino.slice(0, 6)}...{mov.billetera_destino.slice(-6)}
                        </p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-titulo font-bold text-[#14221B]">
                        {formatearMonto(mov.monto_usdc)}
                      </span>
                      <div>
                        {mov.enlace_stellar_expert ? (
                          <a
                            href={mov.enlace_stellar_expert}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#1F6B45] font-semibold hover:underline"
                          >
                            <span>Ver en Stellar Expert</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-400">Sin hash</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sección adicional: Contratos con Escrow verificables */}
      {datos?.ultimos_contratos && datos.ultimos_contratos.length > 0 && (
        <div className="mt-8 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-slate-100 text-[#0A2E1F] flex items-center justify-center">
                <FolderLock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-titulo text-lg font-bold text-[#14221B]">
                  Contratos y Escrow
                </h2>
                <p className="text-xs text-[#5B6B63]">
                  Contratos desplegados en Stellar con enlace directo al visor de Trustless Work.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {datos.ultimos_contratos.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col justify-between gap-3 text-xs"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-titulo font-bold text-[#14221B]">
                      Contrato #{c.id}
                    </span>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-md bg-slate-200/60 text-[#14221B]">
                      {c.estado}
                    </span>
                  </div>
                  <p className="text-xs text-[#5B6B63] mt-1">
                    Monto total: <strong className="text-[#14221B]">{formatearMonto(c.monto_total_usdc)}</strong>
                  </p>
                  <p className="text-[11px] text-[#5B6B63] mt-0.5">
                    {formatearFecha(c.fecha_creacion)}
                  </p>
                </div>

                {c.enlace_trustless_work ? (
                  <a
                    href={c.enlace_trustless_work}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#1F6B45] hover:bg-slate-50 active:scale-[0.97] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-2xs"
                  >
                    <span>Visor Trustless Work</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ) : (
                  <span className="text-[11px] text-slate-400 italic">
                    Sin contrato de escrow asignado
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Respaldo;

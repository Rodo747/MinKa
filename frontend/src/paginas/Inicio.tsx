/**
 * Inicio.tsx — Pantalla de inicio personalizada para usuarios autenticados ("/inicio").
 * Cabecera verde profundo #0A2E1F con saludo, etiqueta de perfil y destello sutil.
 * Accesos rápidos contextuales por perfil, resumen real de contratos y próximo tramo,
 * mini tarjeta del Fondo Solidario y guía "Cómo funciona" compacta.
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  FileText,
  Store,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Layers
} from 'lucide-react';
import { usarSesion } from '../sesion';
import {
  obtenerContratos,
  obtenerSaldoFondo,
  type ContratoResumen
} from '../api';

export const Inicio: React.FC = () => {
  const { usuario, token, perfilActivo } = usarSesion();

  const [contratos, setContratos] = useState<ContratoResumen[]>([]);
  const [saldoFondo, setSaldoFondo] = useState<number | null>(null);
  const [cargando, setCargando] = useState<boolean>(true);

  useEffect(() => {
    let montado = true;

    async function cargarDatosInicio() {
      if (!token) return;
      try {
        setCargando(true);
        const rolActual = perfilActivo === 'productor' ? 'productor' : 'comprador';
        const [resContratos, resFondo] = await Promise.allSettled([
          obtenerContratos(rolActual, token),
          obtenerSaldoFondo()
        ]);

        if (montado) {
          if (resContratos.status === 'fulfilled') {
            setContratos(resContratos.value);
          }
          if (resFondo.status === 'fulfilled') {
            setSaldoFondo(resFondo.value.saldo_fondo_usdc);
          }
        }
      } catch (err) {
        console.error('Error cargando datos de inicio:', err);
      } finally {
        if (montado) setCargando(false);
      }
    }

    cargarDatosInicio();

    return () => {
      montado = false;
    };
  }, [token, perfilActivo]);

  // Contratos activos
  const contratosActivos = contratos.filter(
    (c) => c.estado === 'activo' || c.estado === 'en_disputa'
  );

  // Determinar próximo tramo pendiente
  const contratoConTramo = contratos.find((c) => c.estado === 'activo' || c.estado === 'pendiente_fondeo');
  const proximoTramoPendiente = contratoConTramo
    ? {
        contratoId: contratoConTramo.id,
        cultivo: contratoConTramo.cultivo || 'Cosecha agrícola',
        titulo: contratoConTramo.tramo_actual || 'Anticipo Insumos 40%',
        monto: contratoConTramo.monto_total_usdc * 0.40
      }
    : null;

  const formatearMonto = (monto: number) => {
    return (
      monto.toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }) + ' USDC'
    );
  };

  const nombreUsuario = usuario?.nombre || 'Productor';
  const esProductor = perfilActivo === 'productor';

  return (
    <div className="w-full min-h-screen bg-[#F8FAFC]">
      {/* ── CABECERA VERDE PROFUNDO CON DESTELLO SUTIL ── */}
      <section className="relative bg-[#0A2E1F] text-white overflow-hidden py-10 sm:py-14 px-4 sm:px-6 lg:px-8 border-b border-[#0F3D2E]">
        {/* Destello sutil react-bits / halo de luz orgánico */}
        <div
          aria-hidden="true"
          className="absolute -top-24 right-1/4 w-96 h-96 bg-gradient-to-br from-[#1F6B45]/40 via-[#FF7A18]/15 to-transparent rounded-full blur-3xl pointer-events-none animate-pulse duration-1000"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-20 -left-20 w-80 h-80 bg-emerald-700/20 rounded-full blur-2xl pointer-events-none"
        />

        <div className="relative z-10 max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/70 border border-emerald-500/30 text-emerald-300 text-xs font-semibold mb-3">
              <span className="w-2 h-2 rounded-full bg-[#EA580C] animate-ping" />
              <span>Perfil activo:</span>
              <strong className="text-white uppercase tracking-wider font-titulo text-[11px]">
                {esProductor ? 'Productor' : 'Comprador'}
              </strong>
            </div>

            <h1 className="font-titulo text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span>Hola, {nombreUsuario}</span>
              <Sparkles className="w-6 h-6 text-[#FF7A18] hidden sm:inline-block shrink-0" />
            </h1>
            <p className="text-sm sm:text-base text-slate-300 mt-2 max-w-xl">
              {esProductor
                ? 'Gestiona la preventa de tus cosechas, cobra anticipos por hitos y respalda tu producción.'
                : 'Asegura cosechas de calidad con agricultores bolivianos respaldadas por contratos inteligentes en Stellar.'}
            </p>
          </div>

          {/* Mini tarjeta de acceso directo a Saldo */}
          <Link
            to="/mi-cuenta?pestana=saldo"
            className="self-start md:self-auto inline-flex items-center gap-3 px-5 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md active:scale-[0.97] transition-all duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] group"
          >
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300/80">
                Mi billetera
              </span>
              <p className="font-titulo text-sm font-bold text-white group-hover:text-emerald-200 transition-colors">
                Ver saldo y movimientos
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-emerald-300 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </section>

      {/* ── CUERPO PRINCIPAL ── */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-10">
        {/* ── ACCESOS RÁPIDOS ── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-titulo text-xl font-bold text-[#14221B]">
              Accesos rápidos
            </h2>
            <span className="text-xs text-[#5B6B63]">
              Acciones directas para tu cuenta
            </span>
          </div>

          <div
            className={`grid grid-cols-1 ${
              esProductor ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
            } gap-4`}
          >
            {esProductor ? (
              <>
                {/* 1. Publicar oferta */}
                <Link
                  to="/publicar"
                  className="interaccion-tactil p-6 rounded-3xl bg-white border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] hover:border-[#1F6B45]/40 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center group-hover:bg-[#1F6B45] group-hover:text-white transition-colors">
                      <PlusCircle className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#1F6B45] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                      Publicar oferta
                    </h3>
                    <p className="text-xs text-[#5B6B63] mt-1">
                      Publica tu próxima cosecha con descuento por preventa y recibe anticipos.
                    </p>
                  </div>
                </Link>

                {/* 2. Mis contratos */}
                <Link
                  to="/mi-cuenta?pestana=contratos"
                  className="interaccion-tactil p-6 rounded-3xl bg-white border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] hover:border-[#1F6B45]/40 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#EA580C] flex items-center justify-center group-hover:bg-[#EA580C] group-hover:text-white transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#EA580C] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                      Mis contratos
                    </h3>
                    <p className="text-xs text-[#5B6B63] mt-1">
                      Supervisa los contratos en curso, sube evidencias de hitos y cobra tus tramos.
                    </p>
                  </div>
                </Link>

                {/* 3. Reportar emergencia */}
                <Link
                  to="/mi-cuenta?pestana=contratos"
                  className="interaccion-tactil p-6 rounded-3xl bg-white border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] hover:border-red-300 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-colors">
                      <ShieldAlert className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-red-600 group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                      Reportar emergencia
                    </h3>
                    <p className="text-xs text-[#5B6B63] mt-1">
                      Reporta heladas, sequías o inundaciones para activar auxilio del Fondo Solidario.
                    </p>
                  </div>
                </Link>
              </>
            ) : (
              <>
                {/* 1. Ver ofertas (Comprador) */}
                <Link
                  to="/mercado"
                  className="interaccion-tactil p-6 rounded-3xl bg-white border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] hover:border-[#1F6B45]/40 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center group-hover:bg-[#1F6B45] group-hover:text-white transition-colors">
                      <Store className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#1F6B45] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                      Ver ofertas
                    </h3>
                    <p className="text-xs text-[#5B6B63] mt-1">
                      Explora cosechas bolivianas en preventa con descuentos competitivos.
                    </p>
                  </div>
                </Link>

                {/* 2. Mis contratos (Comprador) */}
                <Link
                  to="/mi-cuenta?pestana=contratos"
                  className="interaccion-tactil p-6 rounded-3xl bg-white border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] hover:border-[#EA580C]/40 hover:shadow-md transition-all flex flex-col justify-between group"
                >
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 text-[#EA580C] flex items-center justify-center group-hover:bg-[#EA580C] group-hover:text-white transition-colors">
                      <FileText className="w-6 h-6" />
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-[#EA580C] group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div className="mt-6">
                    <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                      Mis contratos
                    </h3>
                    <p className="text-xs text-[#5B6B63] mt-1">
                      Revisa entregas pendientes, verifica evidencias y autoriza desembolsos en escrow.
                    </p>
                  </div>
                </Link>
              </>
            )}
          </div>
        </section>

        {/* ── RESUMEN REAL Y MINI TARJETA DE RESPALDO ── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Tarjeta 1 y 2: Resumen de contratos y próximo tramo */}
          <div className="lg:col-span-2 bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                    Resumen de contratos activos
                  </h3>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-[#14221B]">
                  {cargando ? '...' : `${contratosActivos.length} activos`}
                </span>
              </div>

              <div className="mt-5">
                {cargando ? (
                  <div className="space-y-3">
                    <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
                    <div className="h-16 bg-slate-50 rounded-2xl animate-pulse" />
                  </div>
                ) : contratos.length === 0 ? (
                  <div className="py-8 flex flex-col items-center justify-center text-center">
                    <FileText className="w-10 h-10 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-[#14221B]">
                      No tienes contratos registrados
                    </p>
                    <p className="text-xs text-[#5B6B63] mt-1 max-w-sm mb-4">
                      {esProductor
                        ? 'Comienza publicando tu primera cosecha en preventa para recibir ofertas de compra.'
                        : 'Explora el mercado de productores y fondea tu primera compraventa garantizada.'}
                    </p>
                    {esProductor ? (
                      <Link
                        to="/publicar"
                        className="interaccion-tactil px-4 py-2 rounded-xl bg-[#1F6B45] text-white text-xs font-titulo font-bold hover:bg-[#0A2E1F] transition-all"
                      >
                        Publicar primera oferta
                      </Link>
                    ) : (
                      <Link
                        to="/mercado"
                        className="interaccion-tactil px-4 py-2 rounded-xl bg-[#EA580C] text-white text-xs font-titulo font-bold hover:bg-[#FF7A18] transition-all"
                      >
                        Ir al Mercado
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6B63]">
                          Próximo tramo pendiente
                        </span>
                        {proximoTramoPendiente ? (
                          <div className="mt-1">
                            <p className="font-titulo text-base font-bold text-[#14221B]">
                              {proximoTramoPendiente.cultivo}
                            </p>
                            <p className="text-xs text-[#5B6B63]">
                              {proximoTramoPendiente.titulo} (Contrato #{proximoTramoPendiente.contratoId})
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs font-semibold text-emerald-700 mt-1">
                            Todos los tramos vigentes han sido aprobados o liberados
                          </p>
                        )}
                      </div>

                      {proximoTramoPendiente && (
                        <div className="sm:text-right shrink-0">
                          <span className="font-titulo text-base font-extrabold text-[#1F6B45]">
                            {formatearMonto(proximoTramoPendiente.monto)}
                          </span>
                          <div className="mt-1">
                            <Link
                              to={`/mi-cuenta?contrato=${proximoTramoPendiente.contratoId}`}
                              className="text-xs font-bold text-[#EA580C] hover:underline inline-flex items-center gap-1"
                            >
                              <span>Ver en mis contratos</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[#5B6B63]">Total contratos:</span>
                        <p className="font-titulo text-lg font-bold text-[#14221B] mt-0.5">
                          {contratos.length}
                        </p>
                      </div>
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100">
                        <span className="text-[#5B6B63]">Completados con éxito:</span>
                        <p className="font-titulo text-lg font-bold text-[#1F6B45] mt-0.5">
                          {contratos.filter((c) => c.estado === 'completado').length}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 flex justify-end">
              <Link
                to="/mi-cuenta?pestana=contratos"
                className="text-xs font-bold text-[#1F6B45] hover:underline inline-flex items-center gap-1"
              >
                <span>Administrar todos los contratos</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          {/* Mini tarjeta de Respaldo */}
          <div className="bg-gradient-to-br from-[#0A2E1F] to-[#1F6B45] text-white rounded-3xl p-6 sm:p-7 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.2)] flex flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-44 h-44 bg-white/5 rounded-full blur-2xl pointer-events-none" />

            <div className="relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-300 mb-4 border border-white/10">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
                Fondo Solidario
              </span>
              <h3 className="font-titulo text-xl font-bold text-white mt-1">
                Respaldo ante contingencias
              </h3>
              <p className="text-xs text-slate-200 mt-2 leading-relaxed">
                Cada preventa aparta reservas automáticas para compensar desastres climáticos verificados en Stellar.
              </p>

              <div className="mt-5 p-4 rounded-2xl bg-black/20 border border-white/10">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/80">
                  Saldo en reserva pública
                </span>
                <p className="font-titulo text-2xl font-black text-white mt-1">
                  {cargando
                    ? '...'
                    : saldoFondo !== null
                    ? formatearMonto(saldoFondo)
                    : '19,44 USDC'}
                </p>
              </div>
            </div>

            <div className="relative z-10 mt-6 pt-4 border-t border-white/10">
              <Link
                to="/respaldo"
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white text-[#0A2E1F] font-titulo font-bold text-xs hover:bg-emerald-50 active:scale-[0.97] transition-all shadow-xs"
              >
                <span>Ver libro de Respaldo</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── CÓMO FUNCIONA (VERSIÓN COMPACTA EN 3 PASOS) ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-6 border-b border-slate-100">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45]">
                Mecanismo transparente
              </span>
              <h3 className="font-titulo text-xl sm:text-2xl font-bold text-[#14221B]">
                ¿Cómo funciona MinKa?
              </h3>
            </div>
            <p className="text-xs text-[#5B6B63] max-w-xs">
              Mismos principios seguros de preventa con liquidación en Stellar Testnet.
            </p>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Paso 1 */}
            <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 relative flex flex-col justify-between">
              <div>
                <span className="font-titulo text-2xl font-black text-[#1F6B45]/30">01</span>
                <h4 className="font-titulo text-base font-bold text-[#14221B] mt-2">
                  Acuerda la preventa
                </h4>
                <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                  El productor publica su cosecha futura con descuento. El comprador asegura precio y volumen de calidad.
                </p>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 relative flex flex-col justify-between">
              <div>
                <span className="font-titulo text-2xl font-black text-[#EA580C]/30">02</span>
                <h4 className="font-titulo text-base font-bold text-[#14221B] mt-2">
                  Bloquea fondos con escrow
                </h4>
                <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                  El comprador fondea el contrato inteligente multi-release en Stellar. Cero riesgo de incumplimiento sin respaldo.
                </p>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="p-5 rounded-2xl bg-slate-50/70 border border-slate-100 relative flex flex-col justify-between">
              <div>
                <span className="font-titulo text-2xl font-black text-[#1F6B45]/30">03</span>
                <h4 className="font-titulo text-base font-bold text-[#14221B] mt-2">
                  Cobro por hitos y contingencias
                </h4>
                <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                  Los fondos se liberan por fases verificadas (40% / 30% / 30%). Si el clima falla, el Fondo Solidario compensa.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Inicio;

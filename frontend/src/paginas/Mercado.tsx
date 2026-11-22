/**
 * Mercado.tsx — Pantalla principal del catálogo de preventa agrícola ("/mercado").
 * Integra llamadas reales a GET /ofertas, filtrado dinámico por cultivo,
 * ordenamiento, tarjeta de consejos según perfil y estados de carga, vacío y error.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Lightbulb,
  X,
  PlusCircle,
  ArrowUpDown,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Inbox,
  Sparkles,
  MapPin,
} from 'lucide-react';
import { obtenerOfertas, type Oferta } from '../api';
import { TarjetaOferta } from '../componentes/TarjetaOferta';
import { usarSesion } from '../sesion';

type CriterioOrden = 'entrega' | 'descuento' | 'costo';

export const Mercado: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { perfilActivo } = usarSesion();
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bannerExito, setBannerExito] = useState<string | null>(
    (location.state as { mensajeExito?: string })?.mensajeExito || null
  );

  // Filtros y ordenamiento
  const [cultivoSeleccionado, setCultivoSeleccionado] = useState<string>('todos');
  const [departamentoSeleccionado, setDepartamentoSeleccionado] = useState<string>('todos');
  const [criterioOrden, setCriterioOrden] = useState<CriterioOrden>('entrega');

  // Tarjeta de consejos cerrable
  const [mostrarConsejos, setMostrarConsejos] = useState(true);

  // Función para cargar ofertas desde el backend
  const cargarOfertas = async () => {
    setCargando(true);
    setError(null);
    try {
      const datos = await obtenerOfertas();
      // Filtrar únicamente ofertas con estado 'abierta'
      const abiertas = datos.filter((o) => o.estado === 'abierta');
      setOfertas(abiertas);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('No fue posible cargar las ofertas en este momento.');
      }
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarOfertas();
  }, []);

  // Obtener lista única de cultivos a partir de los datos reales de la API
  const cultivosDisponibles = useMemo(() => {
    const lista = ofertas.map((o) => o.cultivo.trim());
    return Array.from(new Set(lista));
  }, [ofertas]);

  // Departamentos construidos con las ofertas disponibles
  const departamentosDisponibles = useMemo(() => {
    const lista = ofertas
      .map((o) => o.departamento?.trim())
      .filter((d): d is string => Boolean(d && d.length > 0));
    return Array.from(new Set(lista)).sort();
  }, [ofertas]);

  // Filtrar y ordenar las ofertas
  const ofertasFiltradas = useMemo(() => {
    let resultado = [...ofertas];

    // Filtrar por cultivo
    if (cultivoSeleccionado !== 'todos') {
      resultado = resultado.filter(
        (o) => o.cultivo.toLowerCase() === cultivoSeleccionado.toLowerCase()
      );
    }

    // Filtrar por departamento
    if (departamentoSeleccionado !== 'todos') {
      resultado = resultado.filter(
        (o) => o.departamento?.toLowerCase() === departamentoSeleccionado.toLowerCase()
      );
    }

    // Ordenar
    resultado.sort((a, b) => {
      if (criterioOrden === 'entrega') {
        return new Date(a.fecha_entrega).getTime() - new Date(b.fecha_entrega).getTime();
      }
      if (criterioOrden === 'descuento') {
        return b.porcentaje_descuento - a.porcentaje_descuento;
      }
      if (criterioOrden === 'costo') {
        return a.costo_anual_equivalente - b.costo_anual_equivalente;
      }
      return 0;
    });

    return resultado;
  }, [ofertas, cultivoSeleccionado, departamentoSeleccionado, criterioOrden]);

  return (
    <div className="w-full bg-[#EEF4EF] min-h-[calc(100vh-80px)] pb-24 md:pb-12">
      {/* ── BANDA DE ENCABEZADO VERDE PROFUNDO (#0A2E1F) CON DEGRADADO Y HOJA DECORATIVA ── */}
      <section className="relative bg-gradient-to-r from-[#0A2E1F] via-[#0E3827] to-[#124530] text-white overflow-hidden py-7 sm:py-9 px-4 sm:px-6 lg:px-8 border-b border-[#0F3D2E]">
        {/* Hoja decorativa muy sutil */}
        <div
          aria-hidden="true"
          className="absolute right-0 top-0 bottom-0 w-64 sm:w-80 pointer-events-none overflow-hidden select-none opacity-[0.05]"
        >
          <svg viewBox="0 0 200 200" fill="currentColor" className="w-full h-full text-white">
            <path d="M100 20 C120 60, 180 80, 190 130 C198 170, 150 190, 110 185 C70 180, 20 150, 15 110 C10 60, 60 30, 100 20 Z" />
            <path d="M100 20 Q110 100 110 185" stroke="currentColor" strokeWidth="3" fill="none" />
            <path d="M105 80 Q140 70 170 85" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M107 120 Q140 110 160 135" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M103 95 Q70 90 45 105" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M105 135 Q75 130 55 150" stroke="currentColor" strokeWidth="2" fill="none" />
          </svg>
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md p-1.5 border border-white/20 items-center justify-center shrink-0 shadow-sm">
              <img src="/logo.png" alt="MinKa" className="w-full h-full object-contain filter drop-shadow-xs" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 text-[11px] font-semibold mb-2">
                <Sparkles className="w-3.5 h-3.5 text-[#FF7A18]" />
                <span>Cosechas verificables</span>
              </div>
              <h1 className="font-titulo text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                Mercado agrícola
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl">
                Explora cosechas bolivianas en preventa con entrega pactada y precio protegido.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-300/80 block">
                Disponibilidad
              </span>
              <span className="font-titulo text-sm sm:text-base font-bold text-white cifra-tabular">
                {ofertasFiltradas.length} {ofertasFiltradas.length === 1 ? 'oferta abierta' : 'ofertas abiertas'}
              </span>
            </div>

            {perfilActivo === 'productor' && (
              <button
                type="button"
                onClick={() => navigate('/publicar')}
                className="interaccion-tactil sombra-naranja-brillo hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Publicar oferta</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">
        
        {/* Banner de éxito (ej. al publicar oferta) */}
        {bannerExito && (
          <aside className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 sm:p-5 flex items-start justify-between gap-3 text-emerald-800 shadow-sm animate-fade-in">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold">{bannerExito}</span>
            </div>
            <button
              type="button"
              onClick={() => setBannerExito(null)}
              className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-100/70 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </aside>
        )}

        {/* ══════════════════════════════════════════════════════════
            TARJETA DE CONSEJOS CERRABLE (según el perfil activo)
            ══════════════════════════════════════════════════════════ */}
        {mostrarConsejos && (
          <aside
            aria-label="Consejos útiles"
            className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-white/95 border border-emerald-100/80 p-4 sm:p-5 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.08)] transition-all duration-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 flex items-center justify-center shrink-0 text-[#1F6B45]">
                  <Lightbulb className="w-5 h-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-[#0A2E1F] bg-emerald-200/60 px-2 py-0.5 rounded-md font-titulo">
                      Recomendaciones para {perfilActivo === 'productor' ? 'Productor' : 'Comprador'}
                    </span>
                    <span className="text-xs text-[#5B6B63]">
                      Buenas prácticas en MinKa
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-[#14221B] leading-relaxed max-w-4xl">
                    {perfilActivo === 'productor' ? (
                      <>
                        Publica con foto clara y ubicación; revisa el costo anual equivalente antes de publicar; sube evidencia nítida en cada tramo; reporta desastres desde Mis contratos con evidencia.
                      </>
                    ) : (
                      <>
                        Revisa fecha de entrega y ubicación; tu pago queda protegido y se libera en 3 tramos; aprueba un tramo solo después de ver la evidencia; si hay desastre natural recuperas los tramos no ejecutados.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={() => setMostrarConsejos(false)}
                aria-label="Cerrar consejos"
                className="interaccion-tactil shrink-0 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </aside>
        )}

        {/* ══════════════════════════════════════════════════════════
            BARRA DE FILTROS, ORDENAMIENTO Y ACCIÓN PRINCIPAL
            ══════════════════════════════════════════════════════════ */}
        <section className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          
          {/* Filtros: Departamento (select) y Chips de cultivo */}
          <div className="flex items-center gap-2.5 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap">
            {/* Filtro Departamento (Prompt 7) */}
            <div className="flex items-center gap-1.5 bg-white px-3.5 py-2 rounded-full border border-slate-200/80 shrink-0 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-[#1F6B45]" />
              <label htmlFor="filtro-depto" className="sr-only">Filtrar por departamento</label>
              <select
                id="filtro-depto"
                value={departamentoSeleccionado}
                onChange={(e) => setDepartamentoSeleccionado(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#14221B] focus:outline-none cursor-pointer pr-1"
              >
                <option value="todos">Todos los departamentos</option>
                {departamentosDisponibles.map((dep) => (
                  <option key={dep} value={dep}>{dep}</option>
                ))}
              </select>
            </div>

            <div className="w-px h-5 bg-slate-200 hidden sm:block shrink-0" />

            <button
              type="button"
              onClick={() => setCultivoSeleccionado('todos')}
              className={`interaccion-tactil shrink-0 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                cultivoSeleccionado === 'todos'
                  ? 'bg-[#0A2E1F] text-white shadow-sm'
                  : 'bg-white text-[#5B6B63] border border-slate-200/80 hover:bg-slate-50'
              }`}
            >
              Todos los cultivos
            </button>

            {cultivosDisponibles.map((cultivo) => {
              const activo = cultivoSeleccionado.toLowerCase() === cultivo.toLowerCase();
              return (
                <button
                  key={cultivo}
                  type="button"
                  onClick={() => setCultivoSeleccionado(cultivo)}
                  className={`interaccion-tactil shrink-0 px-4 py-2 rounded-full text-xs font-semibold cursor-pointer transition-all ${
                    activo
                      ? 'bg-[#0A2E1F] text-white shadow-sm'
                      : 'bg-white text-[#5B6B63] border border-slate-200/80 hover:bg-slate-50'
                  }`}
                >
                  {cultivo}
                </button>
              );
            })}
          </div>

          {/* Ordenamiento y Botón de Publicar */}
          <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0">
            
            {/* Selector de Orden */}
            <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-xl border border-slate-200/80 shadow-xs">
              <ArrowUpDown className="w-4 h-4 text-[#5B6B63]" />
              <label htmlFor="orden-select" className="text-xs font-medium text-[#5B6B63] uppercase tracking-wider">
                Orden:
              </label>
              <select
                id="orden-select"
                value={criterioOrden}
                onChange={(e) => setCriterioOrden(e.target.value as CriterioOrden)}
                className="bg-transparent text-xs font-semibold text-[#14221B] focus:outline-none cursor-pointer pr-1"
              >
                <option value="entrega">Próxima entrega</option>
                <option value="descuento">Mayor descuento</option>
                <option value="costo">Menor costo equivalente</option>
              </select>
            </div>

            {/* Botón naranja "Publicar oferta", visible solo para Productor */}
            {perfilActivo === 'productor' && (
              <button
                type="button"
                onClick={() => navigate('/publicar')}
                className="interaccion-tactil sombra-naranja-brillo flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs sm:text-sm transition-all cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Publicar oferta</span>
              </button>
            )}

          </div>
        </section>

        {/* ══════════════════════════════════════════════════════════
            ESTADOS: CARGA (ESQUELETOS), ERROR Y ESTADO VACÍO
            ══════════════════════════════════════════════════════════ */}
        
        {/* 1. Esqueletos de carga */}
        {cargando && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {[1, 2, 3].map((indice) => (
              <div
                key={indice}
                className="bg-white rounded-2xl overflow-hidden border border-slate-100 p-0 animate-pulse shadow-sm"
              >
                <div className="h-48 sm:h-52 bg-slate-200 w-full" />
                <div className="p-5 sm:p-6 flex flex-col gap-4">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-6 bg-slate-200 rounded w-2/3" />
                  <div className="h-16 bg-slate-100 rounded-xl" />
                  <div className="h-3 bg-slate-200 rounded w-full" />
                  <div className="h-10 bg-slate-200 rounded-xl w-full mt-2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 2. Estado de error */}
        {!cargando && error && (
          <div className="bg-white rounded-2xl p-8 sm:p-12 border border-rose-100 text-center flex flex-col items-center justify-center gap-4 max-w-lg mx-auto shadow-sm">
            <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-titulo text-lg text-[#14221B]">
                No fue posible cargar las ofertas
              </h3>
              <p className="text-xs sm:text-sm text-[#5B6B63] mt-1.5 leading-relaxed">
                {error}
              </p>
            </div>
            <button
              type="button"
              onClick={cargarOfertas}
              className="interaccion-tactil inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A2E1F] hover:bg-[#103D2E] text-white font-titulo text-xs font-bold transition-all cursor-pointer mt-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reintentar conexión</span>
            </button>
          </div>
        )}

        {/* 3. Estado vacío */}
        {!cargando && !error && ofertasFiltradas.length === 0 && (
          <div className="bg-white rounded-3xl p-10 sm:p-16 border border-slate-100 text-center flex flex-col items-center justify-center gap-4 max-w-lg mx-auto shadow-sm">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
              <Inbox className="w-8 h-8" />
            </div>
            <div>
              <h3 className="font-titulo text-xl text-[#14221B]">
                Aún no hay ofertas
              </h3>
              <p className="text-xs sm:text-sm text-[#5B6B63] mt-2 leading-relaxed">
                {cultivoSeleccionado !== 'todos'
                  ? `No se encontraron publicaciones disponibles para el cultivo "${cultivoSeleccionado}".`
                  : 'Próximamente los agricultores registrarán sus lotes de cosecha para la preventa.'}
              </p>
            </div>
            {cultivoSeleccionado !== 'todos' ? (
              <button
                type="button"
                onClick={() => setCultivoSeleccionado('todos')}
                className="interaccion-tactil text-xs font-semibold text-[#1F6B45] hover:underline cursor-pointer"
              >
                Ver todos los cultivos
              </button>
            ) : perfilActivo === 'productor' ? (
              <span className="text-xs text-[#5B6B63] bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Puedes publicar la primera oferta como productor</span>
              </span>
            ) : null}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            CUADRÍCULA DE TARJETAS DE OFERTA
            1 col móvil, 2 col tablet (md), 3 col PC (lg)
            ══════════════════════════════════════════════════════════ */}
        {!cargando && !error && ofertasFiltradas.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {ofertasFiltradas.map((oferta) => (
              <TarjetaOferta key={oferta.id} oferta={oferta} />
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

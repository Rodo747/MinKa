/**
 * PerfilProductor.tsx — Vista pública del perfil del productor ("/productor/:id").
 * Ruta protegida. Muestra:
 * - Cabecera: foto o iniciales, nombre, departamento, fecha de ingreso en MinKa,
 *   contratos cumplidos (verificados por plataforma) y botón de contacto por WhatsApp.
 * - Información declarada por el productor: biografía, cultivos habituales y años de experiencia.
 * - Cuadrícula con las ofertas abiertas publicadas por este productor (GET /ofertas?productor_id=).
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MapPin,
  Calendar,
  Award,
  MessageCircle,
  Sprout,
  Clock,
  AlertCircle,
  Loader2,
  Store,
} from 'lucide-react';
import {
  obtenerProductor,
  obtenerOfertas,
  urlArchivo,
  type PerfilProductor,
  type Oferta,
} from '../api';
import { TarjetaOferta, formatearMesYAño, formatearDecimal } from '../componentes/TarjetaOferta';
import { Estrellas } from '../componentes/Estrellas';
import { usarSesion } from '../sesion';

export const VistaPerfilProductor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = usarSesion();

  const [productor, setProductor] = useState<PerfilProductor | null>(null);
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!id || !token) return;
      setCargando(true);
      setError(null);
      try {
        const prodId = Number(id);
        const [datosProd, listaOfertas] = await Promise.all([
          obtenerProductor(prodId, token),
          obtenerOfertas(prodId),
        ]);
        setProductor(datosProd);
        // Filtrar solo las ofertas abiertas
        setOfertas(listaOfertas.filter((o) => o.estado === 'abierta'));
      } catch (err) {
        if (err instanceof Error) {
          setError(err.message);
        } else {
          setError('No fue posible cargar el perfil del productor.');
        }
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id, token]);

  if (cargando) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#EEF4EF]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-[#1F6B45] animate-spin" />
          <span className="text-xs text-[#5B6B63] font-medium">Cargando perfil del productor…</span>
        </div>
      </div>
    );
  }

  if (error || !productor) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-[#EEF4EF]">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 text-center flex flex-col items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-titulo text-xl text-[#14221B]">Productor no encontrado</h2>
          <p className="text-xs text-[#5B6B63] leading-relaxed">
            {error || 'El perfil solicitado no existe o no se encuentra disponible.'}
          </p>
          <button
            type="button"
            onClick={() => navigate('/mercado')}
            className="interaccion-tactil mt-2 px-5 py-2.5 rounded-xl bg-[#0A2E1F] text-white font-titulo font-bold text-xs cursor-pointer"
          >
            Volver al Mercado
          </button>
        </div>
      </div>
    );
  }

  const mensajeWhatsApp = encodeURIComponent(
    `Hola, vi tu perfil en MinKa y quisiera hacerte una consulta sobre tus cosechas.`
  );

  const fechaEnMinka = productor.en_minka_desde
    ? formatearMesYAño(productor.en_minka_desde)
    : 'recientemente';

  const tienePerfilIncompleto =
    !productor.biografia && !productor.cultivos && productor.anios_experiencia === null;

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

        <div className="relative z-10 max-w-[1100px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md p-1.5 border border-white/20 items-center justify-center shrink-0 shadow-sm mt-7">
              <img src="/logo.png" alt="MinKa" className="w-full h-full object-contain filter drop-shadow-xs" />
            </div>
            <div>
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="interaccion-tactil inline-flex items-center gap-2 text-xs font-semibold text-emerald-200/90 hover:text-white py-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer mb-2.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Volver</span>
              </button>
              <h1 className="font-titulo text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                {productor.nombre}
              </h1>
              <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl">
                {productor.departamento ? `Productor agrícola en ${productor.departamento}, Bolivia` : 'Productor en MinKa'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-300/80 block">
                Trayectoria
              </span>
              <span className="font-titulo text-xs sm:text-sm font-bold text-white">
                {productor.contratos_cumplidos} {productor.contratos_cumplidos === 1 ? 'cumplido' : 'cumplidos'}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl bg-white/10 text-emerald-200 border border-white/15 backdrop-blur-md">
              Perfil verificado
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8">

        {/* ══════════════════════════════════════════════════════════
            CABECERA PRINCIPAL DEL PRODUCTOR
            ══════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.06)] flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5">
            {/* Foto de perfil o avatar con iniciales */}
            {productor.foto_perfil ? (
              <img
                src={urlArchivo(productor.foto_perfil)}
                alt={productor.nombre}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-slate-100 shadow-sm shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-[#0A2E1F] text-white flex items-center justify-center font-titulo text-2xl sm:text-3xl font-bold shadow-sm shrink-0">
                {productor.nombre.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <h1 className="font-titulo text-2xl sm:text-3xl text-[#14221B] font-bold">
                {productor.nombre}
              </h1>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B6B63]">
                {productor.departamento && (
                  <span className="flex items-center gap-1 font-medium text-[#14221B]">
                    <MapPin className="w-3.5 h-3.5 text-[#1F6B45]" />
                    <span>{productor.departamento}, Bolivia</span>
                  </span>
                )}

                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-[#5B6B63]" />
                  <span>En MinKa desde {fechaEnMinka}</span>
                </span>
              </div>

              {/* Insignia de reputación y contratos cumplidos */}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {productor.calificacion_promedio !== null && productor.calificacion_promedio !== undefined ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 text-orange-950 text-xs font-bold border border-orange-200/70">
                    <span className="text-[#EA580C]">★</span>
                    <span>{formatearDecimal(productor.calificacion_promedio)}</span>
                    <span className="text-[#5B6B63] font-normal">
                      · {productor.resenas_cantidad} {productor.resenas_cantidad === 1 ? 'reseña' : 'reseñas'}
                    </span>
                  </span>
                ) : null}

                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#1F6B45] text-xs font-bold border border-emerald-200/70">
                  <Award className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{productor.contratos_cumplidos} contratos cumplidos</span>
                </span>
                <span className="text-[11px] text-[#5B6B63] hidden sm:inline">
                  (dato verificado por la plataforma)
                </span>
              </div>
            </div>
          </div>

          {/* Botón WhatsApp de contacto */}
          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            {productor.whatsapp ? (
              <a
                href={`https://wa.me/${productor.whatsapp}?text=${mensajeWhatsApp}`}
                target="_blank"
                rel="noopener noreferrer"
                className="interaccion-tactil inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-titulo font-bold text-xs sm:text-sm shadow-sm transition-all"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Consultar por WhatsApp</span>
              </a>
            ) : (
              <div className="text-xs text-[#5B6B63] bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-100 text-center">
                Este productor aún no agregó un contacto
              </div>
            )}
            <span className="text-[10px] text-[#5B6B63] text-center sm:text-right max-w-xs leading-tight">
              Acuerda los pagos solo dentro de MinKa: así tu dinero queda protegido.
            </span>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            INFORMACIÓN DECLARADA POR EL PRODUCTOR
            ══════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="font-titulo text-base font-bold text-[#14221B]">
              Sobre el productor
            </h2>
            <span className="text-[11px] font-semibold text-[#5B6B63] bg-slate-100 px-2.5 py-0.5 rounded-md">
              Información declarada por el productor
            </span>
          </div>

          {tienePerfilIncompleto ? (
            <div className="p-6 text-center text-xs text-[#5B6B63] italic bg-slate-50 rounded-2xl border border-slate-100">
              Este productor aún no completó su perfil público.
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {/* Biografía */}
              {productor.biografia ? (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45]">
                    Biografía
                  </span>
                  <p className="text-xs sm:text-sm text-[#14221B] leading-relaxed whitespace-pre-line">
                    {productor.biografia}
                  </p>
                </div>
              ) : null}

              {/* Cultivos y Años de experiencia en grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {productor.cultivos && (
                  <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center shrink-0">
                      <Sprout className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-[#5B6B63] uppercase">
                        Cultivos que produce
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-[#14221B] mt-0.5">
                        {productor.cultivos}
                      </span>
                    </div>
                  </div>
                )}

                {productor.anios_experiencia !== null && productor.anios_experiencia !== undefined && (
                  <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-[#5B6B63] uppercase">
                        Años de experiencia
                      </span>
                      <span className="text-xs sm:text-sm font-semibold text-[#14221B] mt-0.5">
                        {productor.anios_experiencia} años dedicados a la agricultura
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════
            RESEÑAS Y CALIFICACIONES (Estilo Airbnb - Prompt 8.5 B2)
            ══════════════════════════════════════════════════════════ */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <h2 className="font-titulo text-lg font-bold text-[#14221B]">
              Evaluaciones y reputación
            </h2>
            <span className="text-[11px] font-semibold text-[#1F6B45] bg-emerald-50 border border-emerald-200/60 px-3 py-1 rounded-full self-start sm:self-auto">
              Reseñas de compradores con contrato completado
            </span>
          </div>

          {/* Bloque resumen estilo Airbnb */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 p-5 sm:p-6 bg-[#EEF4EF]/60 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="font-cifras text-4xl sm:text-5xl font-black text-[#14221B] leading-none">
                {productor.calificacion_promedio !== null && productor.calificacion_promedio !== undefined
                  ? formatearDecimal(productor.calificacion_promedio)
                  : '—'}
              </div>
              <div className="flex flex-col gap-1">
                <Estrellas
                  valor={productor.calificacion_promedio || 0}
                  tamanio="md"
                  etiquetaAccesible="Promedio de estrellas"
                />
                <span className="text-xs text-[#5B6B63] font-medium">
                  {productor.resenas_cantidad || 0}{' '}
                  {(productor.resenas_cantidad || 0) === 1 ? 'reseña' : 'reseñas'} en total
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200/60">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45]">
                  Contratos cumplidos
                </span>
                <span className="font-cifras font-bold text-lg text-[#14221B] mt-0.5">
                  {productor.contratos_cumplidos} exitosos
                </span>
                <span className="text-[10px] text-[#5B6B63]">
                  Verificados en Stellar Testnet
                </span>
              </div>
            </div>
          </div>

          {/* Lista de reseñas o estado vacío */}
          {!productor.resenas || productor.resenas.length === 0 ? (
            <div className="p-8 text-center text-xs sm:text-sm text-[#5B6B63] bg-slate-50/70 rounded-2xl border border-dashed border-slate-200">
              Aún no tiene reseñas. Solo pueden dejarlas los compradores que completaron un contrato.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {productor.resenas.map((resena) => (
                <article
                  key={resena.id}
                  className="bg-[#F8FAFC] rounded-2xl p-5 border border-slate-100 flex flex-col gap-3 justify-between"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#0A2E1F] text-white flex items-center justify-center font-bold text-xs shrink-0">
                          {resena.comprador_nombre ? resena.comprador_nombre.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-titulo text-xs sm:text-sm font-bold text-[#14221B]">
                            {resena.comprador_nombre || 'Comprador MinKa'}
                          </span>
                          <span className="text-[11px] text-[#5B6B63]">
                            {formatearMesYAño(resena.fecha)}
                          </span>
                        </div>
                      </div>

                      <Estrellas valor={resena.estrellas} tamanio="sm" />
                    </div>

                    {resena.comentario && (
                      <p className="text-xs sm:text-sm text-[#14221B] leading-relaxed pt-1">
                        “{resena.comentario}”
                      </p>
                    )}
                  </div>

                  <div className="text-[10px] text-[#1F6B45] font-semibold flex items-center gap-1 opacity-80">
                    <span>✓ Compra completada en MinKa</span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* ══════════════════════════════════════════════════════════
            OFERTAS ABIERTAS DEL PRODUCTOR
            ══════════════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="font-titulo text-lg font-bold text-[#14221B]">
              Cosechas en preventa de este productor
            </h2>
            <span className="text-xs text-[#5B6B63]">
              {ofertas.length} oferta{ofertas.length === 1 ? '' : 's'} disponible{ofertas.length === 1 ? '' : 's'}
            </span>
          </div>

          {ofertas.length === 0 ? (
            <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 text-center flex flex-col items-center gap-3 shadow-sm">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <Store className="w-6 h-6" />
              </div>
              <h3 className="font-titulo text-base font-bold text-[#14221B]">
                Sin ofertas abiertas actualmente
              </h3>
              <p className="text-xs text-[#5B6B63] max-w-sm">
                Este productor no tiene cosechas en preventa activas en este momento.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ofertas.map((oferta) => (
                <TarjetaOferta key={oferta.id} oferta={oferta} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

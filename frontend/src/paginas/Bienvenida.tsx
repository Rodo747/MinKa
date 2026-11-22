/**
 * Bienvenida.tsx — Pantalla principal de bienvenida de MinKa ("/").
 * Diseñada siguiendo la referencia visual principal (hero verde profundo + secciones claras).
 * Incluye llamadas reales a GET /ofertas para mostrar hasta 3 ofertas reales.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Shield,
  Coins,
  Layers,
  HeartHandshake,
  CheckCircle2,
  Lock,
  LifeBuoy,
  Sprout,
} from 'lucide-react';
import { obtenerOfertas, type Oferta } from '../api';
import { TarjetaOferta } from '../componentes/TarjetaOferta';

/**
 * Componente de tarjeta métrica con efecto spotlight sutil (inspirado en React Bits).
 */
function TarjetaMetrica({
  titulo,
  subtitulo,
  icono: Icono,
}: {
  titulo: string;
  subtitulo: string;
  icono: React.ElementType;
}) {
  const tarjetaRef = useRef<HTMLDivElement>(null);
  const [posicionRaton, setPosicionRaton] = useState({ x: 0, y: 0 });
  const [estaEncima, setEstaEncima] = useState(false);

  const manejarMovimientoRaton = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!tarjetaRef.current) return;
    const rect = tarjetaRef.current.getBoundingClientRect();
    setPosicionRaton({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <div
      ref={tarjetaRef}
      onMouseMove={manejarMovimientoRaton}
      onMouseEnter={() => setEstaEncima(true)}
      onMouseLeave={() => setEstaEncima(false)}
      className="relative overflow-hidden rounded-2xl p-4 sm:p-5 text-left transition-all duration-300 vidrio-hero group hover:-translate-y-1"
    >
      {/* Destello sutil de luz (Spotlight) siguiendo el cursor */}
      {estaEncima && (
        <div
          className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-100"
          style={{
            background: `radial-gradient(180px circle at ${posicionRaton.x}px ${posicionRaton.y}px, rgba(255, 138, 61, 0.18), transparent 80%)`,
          }}
        />
      )}

      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-3 text-[#FF8A3D] group-hover:scale-105 transition-transform">
          <Icono className="w-5 h-5" />
        </div>
        <div>
          <span className="font-titulo text-base sm:text-lg text-white block leading-snug">
            {titulo}
          </span>
          <span className="text-xs text-emerald-200/80 mt-1 block font-medium leading-relaxed">
            {subtitulo}
          </span>
        </div>
      </div>
    </div>
  );
}

export const Bienvenida: React.FC = () => {
  const [ofertas, setOfertas] = useState<Oferta[]>([]);
  const [cargandoOfertas, setCargandoOfertas] = useState(true);

  useEffect(() => {
    let cancelado = false;
    async function cargarOfertasReales() {
      try {
        const datos = await obtenerOfertas();
        if (!cancelado) {
          // Filtrar solo las que estén abiertas y tomar hasta 3
          const abiertas = datos.filter((o) => o.estado === 'abierta');
          setOfertas(abiertas.slice(0, 3));
        }
      } catch {
        if (!cancelado) {
          setOfertas([]);
        }
      } finally {
        if (!cancelado) {
          setCargandoOfertas(false);
        }
      }
    }
    cargarOfertasReales();
    return () => {
      cancelado = true;
    };
  }, []);

  return (
    <div className="flex flex-col w-full pb-20 md:pb-0">
      {/* ══════════════════════════════════════════════════════════
          HERO SECTION — Verde profundo #0A2E1F con Sol Cálido
          ══════════════════════════════════════════════════════════ */}
      <section className="relative w-full bg-[#0A2E1F] text-white pt-12 pb-20 sm:pb-28 overflow-hidden shadow-[0_12px_32px_-8px_rgba(10,46,31,0.5)]">
        {/* Luces ambientales y destellos de fondo */}
        <div
          className="absolute -top-28 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(234, 88, 12, 0.24) 0%, rgba(31, 107, 69, 0.18) 50%, transparent 70%)',
            filter: 'blur(80px)',
          }}
        />
        <div
          className="absolute -left-20 top-1/3 w-[450px] h-[450px] rounded-full pointer-events-none"
          style={{
            background:
              'radial-gradient(circle, rgba(34, 197, 94, 0.12) 0%, transparent 70%)',
            filter: 'blur(90px)',
          }}
        />

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 relative z-10 flex flex-col items-center text-center">
          
          {/* Insignia superior */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-950/80 border border-emerald-500/25 text-emerald-200 text-xs font-semibold uppercase tracking-wider backdrop-blur-md mb-6 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#FF8A3D] animate-pulse shadow-[0_0_8px_#FF8A3D]" />
            <span>Protocolo de Preventa Agrícola · Stellar Soroban</span>
          </div>

          {/* Emblema MinKa Radiante */}
          <div className="relative flex flex-col items-center justify-center mb-6">
            <div className="relative w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center transition-transform hover:scale-105 duration-300">
              <img
                src="/logo.png"
                alt="Emblema MinKa"
                className="w-full h-full object-contain filter drop-shadow-[0_8px_24px_rgba(234,88,12,0.35)]"
              />
            </div>
            <div className="mt-3 flex flex-col items-center">
              <span className="font-titulo text-2xl sm:text-3xl font-extrabold tracking-[0.2em] text-white uppercase">
                MINKA
              </span>
              <span className="text-[10px] sm:text-xs font-medium tracking-widest text-emerald-300 uppercase mt-0.5">
                Conectamos oportunidades, cultivamos futuro
              </span>
            </div>
          </div>

          {/* Titular Principal y Subtítulo */}
          <h1 className="font-titulo text-3xl sm:text-5xl md:text-6xl text-white font-extrabold tracking-tight max-w-4xl mx-auto uppercase leading-tight drop-shadow-sm">
            CONECTAMOS OPORTUNIDADES, CULTIVAMOS FUTURO.
          </h1>

          <p className="mt-4 sm:mt-5 max-w-2xl text-slate-300 text-base sm:text-lg leading-relaxed font-normal">
            Vende tu cosecha antes de sembrar. Sin deudas.
          </p>

          {/* Botones Principales CTA hacia /entrar */}
          <div className="mt-8 flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto">
            <Link
              to="/entrar"
              className="interaccion-tactil sombra-naranja-brillo w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-titulo font-bold text-sm text-white bg-[#EA580C] hover:bg-[#FF7A18] transition-all cursor-pointer group"
            >
              <span>Comenzar ahora</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              to="/entrar"
              className="interaccion-tactil w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-titulo font-semibold text-sm text-slate-200 hover:text-white bg-white/10 hover:bg-white/15 border border-white/15 backdrop-blur-md transition-all shadow-sm cursor-pointer"
            >
              <span>Iniciar sesión</span>
            </Link>
          </div>

          {/* 4 Métricas Clave en tarjetas de vidrio translúcido (2x2 en celular, 4 en desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full max-w-4xl mt-12 sm:mt-16">
            <TarjetaMetrica
              titulo="Sin deuda"
              subtitulo="Venta anticipada, no préstamo"
              icono={Coins}
            />
            <TarjetaMetrica
              titulo="3 tramos"
              subtitulo="40% / 30% / 30%"
              icono={Layers}
            />
            <TarjetaMetrica
              titulo="Fondo Solidario"
              subtitulo="Respaldo ante desastres naturales"
              icono={LifeBuoy}
            />
            <TarjetaMetrica
              titulo="En segundos"
              subtitulo="Pagos confirmados en Stellar"
              icono={Shield}
            />
          </div>

        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          CONTENIDO CLARO (#F8FAFC)
          ══════════════════════════════════════════════════════════ */}
      <div className="max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-10 sm:py-14 flex flex-col gap-10 sm:gap-14">

        {/* ── SECCIÓN: ¿Cómo funciona MinKa? en 3 pasos ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 md:p-12 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] flex flex-col gap-8">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <span className="text-[11px] uppercase tracking-wider text-[#1F6B45] font-bold bg-[#FFF6E5] px-3 py-1 rounded-full border border-emerald-200/50">
                Paso a paso
              </span>
              <h2 className="font-titulo text-2xl sm:text-3xl text-[#14221B] mt-2">
                ¿Cómo funciona?
              </h2>
            </div>
            <p className="text-[#5B6B63] text-xs sm:text-sm max-w-md leading-relaxed">
              Mecanismo transparente para conectar productores y compradores con custodia programada en Stellar.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Paso 1 */}
            <div className="bg-[#F8FAFC] rounded-2xl p-6 flex flex-col justify-between border border-slate-100">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100/70 text-[#1F6B45] flex items-center justify-center">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <span className="font-titulo text-2xl font-bold text-[#EA580C]">
                    01
                  </span>
                </div>
                <h3 className="font-titulo text-base font-bold text-[#14221B] mb-2">
                  Publica o elige una oferta
                </h3>
                <p className="text-[#5B6B63] text-xs sm:text-sm leading-relaxed">
                  Productores y compradores acuerdan el volumen, precio de referencia con descuento y fecha de entrega antes de iniciar la siembra.
                </p>
              </div>
              <div className="mt-6 pt-3.5 border-t border-slate-200/60 flex items-center gap-2 text-xs font-semibold text-[#1F6B45]">
                <CheckCircle2 className="w-4 h-4 text-[#1F6B45]" />
                <span>Condiciones claras desde el inicio</span>
              </div>
            </div>

            {/* Paso 2 */}
            <div className="bg-[#FFFBF7] rounded-2xl p-6 flex flex-col justify-between border border-[#EA580C]/25 shadow-xs">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shadow-md">
                    <Lock className="w-5 h-5" />
                  </div>
                  <span className="font-titulo text-2xl font-bold text-[#EA580C]">
                    02
                  </span>
                </div>
                <h3 className="font-titulo text-base font-bold text-[#14221B] mb-2">
                  Tu pago queda protegido en 3 tramos (40/30/30)
                </h3>
                <p className="text-[#5B6B63] text-xs sm:text-sm leading-relaxed mb-4">
                  El monto total se resguarda en custodia y se libera según el progreso pactado:
                </p>

                {/* Desglose visual de los 3 tramos */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 text-xs">
                    <span className="font-bold text-[#14221B]">40% Anticipo</span>
                    <span className="text-[11px] text-[#1F6B45] font-semibold">Insumos y preparación</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-[#EA580C]/20 text-xs">
                    <span className="font-bold text-[#14221B]">30% Avance verificado</span>
                    <span className="text-[11px] text-[#EA580C] font-semibold">Evidencia de campo</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 text-xs">
                    <span className="font-bold text-[#14221B]">30% Entrega</span>
                    <span className="text-[11px] text-[#5B6B63] font-semibold">Cosecha recibida</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-3.5 border-t border-[#EA580C]/20 flex items-center gap-2 text-xs font-bold text-[#EA580C]">
                <Shield className="w-4 h-4 text-[#EA580C]" />
                <span>Custodia con contratos en Stellar</span>
              </div>
            </div>

            {/* Paso 3 */}
            <div className="bg-[#F8FAFC] rounded-2xl p-6 flex flex-col justify-between border border-slate-100">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#0A2E1F] text-white flex items-center justify-center">
                    <HeartHandshake className="w-5 h-5 text-emerald-300" />
                  </div>
                  <span className="font-titulo text-2xl font-bold text-[#EA580C]">
                    03
                  </span>
                </div>
                <h3 className="font-titulo text-base font-bold text-[#14221B] mb-2">
                  Fondo Solidario de Emergencia
                </h3>
                <p className="text-[#5B6B63] text-xs sm:text-sm leading-relaxed">
                  Si ocurre un desastre natural (helada, sequía o inundación), el comprador recupera los tramos pendientes y el productor recibe un auxilio para no quedar desamparado.
                </p>
              </div>
              <div className="mt-6 pt-3.5 border-t border-slate-200/60 flex items-center gap-2 text-xs font-semibold text-[#1F6B45]">
                <CheckCircle2 className="w-4 h-4 text-[#1F6B45]" />
                <span>Respaldo mutuo ante contingencias</span>
              </div>
            </div>

          </div>
        </section>

        {/* ── SECCIÓN: Cosechas listas para preventa (Datos reales de GET /ofertas) ── */}
        {!cargandoOfertas && ofertas.length > 0 && (
          <section className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] uppercase tracking-wider text-[#1F6B45] font-bold bg-[#FFF6E5] px-3 py-1 rounded-full border border-emerald-200/50">
                  Oportunidades abiertas
                </span>
                <h2 className="font-titulo text-2xl sm:text-3xl text-[#14221B] mt-2">
                  Cosechas listas para preventa
                </h2>
              </div>
              <Link
                to="/mercado"
                className="interaccion-tactil inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A2E1F] hover:bg-[#103D2E] text-white font-titulo text-xs font-bold transition-all shadow-sm self-start sm:self-auto cursor-pointer group"
              >
                <span>Ver ofertas</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {/* Cuadrícula de hasta 3 tarjetas reales */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ofertas.map((oferta) => (
                <TarjetaOferta key={oferta.id} oferta={oferta} />
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default Bienvenida;

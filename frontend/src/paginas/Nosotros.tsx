/**
 * Nosotros.tsx — Pantalla institucional de MinKa ("/nosotros").
 * Espacio amplio, tarjetas limpias, honestidad técnica y transparencia de arquitectura.
 */

import React from 'react';
import {
  Cpu,
  Lock,
  ExternalLink,
  Code2,
  HeartHandshake,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

// Si está vacía, no se muestra la línea de cargo para Mariel Fernandez Baldivieso
const CARGO_MARIEL = '';

export const Nosotros: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#F8FAFC] py-10 sm:py-16 px-4 sm:px-6 lg:px-8 animate-in fade-in duration-300">
      <div className="max-w-5xl mx-auto space-y-12">
        {/* ── ENCABEZADO Y PROPÓSITO ── */}
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[#1F6B45] text-xs font-semibold mb-4">
            <HeartHandshake className="w-4 h-4 text-[#1F6B45]" />
            <span>Sobre la plataforma MinKa</span>
          </div>

          <h1 className="font-titulo text-3xl sm:text-5xl font-black text-[#0A2E1F] tracking-tight">
            Cobra hoy, cosecha mañana.
          </h1>

          <p className="text-base sm:text-lg text-[#5B6B63] mt-4 leading-relaxed font-sans">
            MinKa es un protocolo de preventa agrícola que conecta directamente a productores
            con compradores a través de contratos inteligentes de custodia en Stellar,
            garantizando liquidez anticipada y cobertura solidaria ante contingencias climáticas.
          </p>

          <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-[#5B6B63] text-xs font-mono font-medium">
            <span>Versión:</span>
            <strong className="text-[#14221B]">v0.1 · Hackathon 2026 · Red de pruebas</strong>
          </div>
        </div>

        {/* ── MOTIVACIÓN ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
          <div className="max-w-3xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#EA580C]">
              El desafío que resolvemos
            </span>
            <h2 className="font-titulo text-2xl sm:text-3xl font-bold text-[#14221B] mt-1">
              ¿Por qué creamos MinKa?
            </h2>
            <p className="text-sm sm:text-base text-[#5B6B63] mt-3 leading-relaxed">
              En Bolivia y América Latina, el pequeño agricultor asume todos los riesgos productivos:
              necesita dinero hoy para semillas, combustible y jornales, pero cobra meses después de cosechar.
              El acceso al crédito formal es burocrático, costoso y escaso.
            </p>
            <p className="text-sm sm:text-base text-[#5B6B63] mt-3 leading-relaxed">
              Al mismo tiempo, los compradores y transformadores industriales no cuentan con un
              mecanismo seguro para reservar cosechas con anticipación sin correr el riesgo de perder su dinero
              si el clima o la logística fallan. MinKa alinea estos incentivos: el productor vende por adelantado
              con descuento financiero, el comprador asegura precio y calidad, y un fondo común absorbe el impacto de las pérdidas.
            </p>
          </div>
        </section>

        {/* ── TECNOLOGÍA Y PILARES ── */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Tarjeta Tecnología */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center mb-4">
                <Cpu className="w-5 h-5" />
              </div>
              <h3 className="font-titulo text-xl font-bold text-[#14221B]">
                Arquitectura tecnológica
              </h3>
              <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                Construido sobre infraestructura moderna de pagos y contratos inteligentes
                diseñada para transferencias rápidas, comisiones mínimas y liquidación verificable.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                {['Stellar Testnet', 'Trustless Work Escrow', 'USDC', 'FastAPI (Python)', 'React + Vite', 'Tailwind CSS'].map(
                  (tech) => (
                    <span
                      key={tech}
                      className="text-xs font-semibold px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 text-[#14221B]"
                    >
                      {tech}
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap gap-4 text-xs font-semibold">
              <a
                href="https://docs.trustlesswork.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#1F6B45] hover:text-[#0A2E1F] hover:underline"
              >
                <span>Trustless Work Docs</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <a
                href="https://viewer.trustlesswork.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#1F6B45] hover:text-[#0A2E1F] hover:underline"
              >
                <span>Visor de Trustless Work</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                disabled
                className="inline-flex items-center gap-1.5 text-slate-400 cursor-not-allowed"
                title="Próximamente disponible"
              >
                <span>Repositorio (Privado)</span>
                <Code2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Tarjeta Privacidad y Transparencia */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)] flex flex-col justify-between">
            <div>
              <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#EA580C] flex items-center justify-center mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-titulo text-xl font-bold text-[#14221B]">
                Privacidad y custodia honesta
              </h3>
              <p className="text-xs text-[#5B6B63] mt-2 leading-relaxed">
                Hablamos claro sobre cómo tratamos tus datos y cómo funciona esta versión de demostración:
              </p>

              <ul className="mt-4 space-y-2.5 text-xs text-[#5B6B63]">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Identidad mínima:</strong> Solo guardamos tu nombre y tu nombre de usuario para identificarte en el panel.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Contraseñas seguras:</strong> Las contraseñas se almacenan cifradas con algoritmos de hashing seguro (bcrypt).
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Red de pruebas:</strong> Hoy MinKa opera exclusivamente en la red de pruebas (Testnet) de Stellar con dinero simulado sin valor comercial.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <span>
                    <strong>Custodia demo:</strong> En esta versión de hackathon, la plataforma almacena y firma de forma asistida con las claves de prueba de las cuentas Stellar demo.
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── EQUIPO / DESARROLLADORES ── */}
        <section className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200/90 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.05)]">
          <div className="max-w-3xl mb-8">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45]">
              Quiénes están detrás
            </span>
            <h2 className="font-titulo text-2xl sm:text-3xl font-bold text-[#14221B] mt-1">
              Desarrolladores
            </h2>
            <p className="text-xs sm:text-sm text-[#5B6B63] mt-1">
              Equipo interdisciplinario enfocado en tecnología financiera y desarrollo rural para Bolivia.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Desarrollador 1: Rodolfo Melvin Soliz Barrientos */}
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center gap-4">
              {/* Espacio provisional para foto: para reemplazar por foto, coloca una etiqueta <img> dentro del contenedor */}
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#0A2E1F] font-titulo font-black text-xl flex items-center justify-center shrink-0 border-2 border-white shadow-xs">
                RS
              </div>
              <div>
                <h4 className="font-titulo text-base font-bold text-[#14221B]">
                  Rodolfo Melvin Soliz Barrientos
                </h4>
                <p className="text-xs text-[#1F6B45] font-semibold mt-0.5">
                  Arquitecto Líder de Interacción y Desarrollador
                </p>
              </div>
            </div>

            {/* Desarrolladora 2: Mariel Fernandez Baldivieso */}
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/80 flex items-center gap-4">
              {/* Espacio provisional para foto: para reemplazar por foto, coloca una etiqueta <img> dentro del contenedor */}
              <div className="w-16 h-16 rounded-full bg-orange-100 text-[#EA580C] font-titulo font-black text-xl flex items-center justify-center shrink-0 border-2 border-white shadow-xs">
                MF
              </div>
              <div>
                <h4 className="font-titulo text-base font-bold text-[#14221B]">
                  Mariel Fernandez Baldivieso
                </h4>
                {CARGO_MARIEL && (
                  <p className="text-xs text-[#5B6B63] font-semibold mt-0.5">
                    {CARGO_MARIEL}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default Nosotros;

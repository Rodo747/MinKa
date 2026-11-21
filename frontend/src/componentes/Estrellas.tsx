/**
 * Estrellas.tsx — Componente reutilizable de calificación por estrellas.
 * Cumple con Prompt 8.5:
 * - Modo lectura: Muestra 5 estrellas con relleno proporcional al valor decimal.
 * - Modo entrada: Seleccionable por toque o teclado, con área táctil >= 44 px y etiquetas accesibles.
 */

import React, { useState } from 'react';
import { Star } from 'lucide-react';

export interface EstrellasProps {
  valor: number;
  maximo?: number;
  interactivo?: boolean;
  alCambiar?: (nuevoValor: number) => void;
  tamanio?: 'sm' | 'md' | 'lg';
  etiquetaAccesible?: string;
  className?: string;
}

const TAMANIOS = {
  sm: { contenedor: 'w-4 h-4', estrella: 'w-3.5 h-3.5' },
  md: { contenedor: 'w-5 h-5', estrella: 'w-4.5 h-4.5' },
  lg: { contenedor: 'w-8 h-8', estrella: 'w-7 h-7' },
};

export const Estrellas: React.FC<EstrellasProps> = ({
  valor,
  maximo = 5,
  interactivo = false,
  alCambiar,
  tamanio = 'md',
  etiquetaAccesible = 'Calificación',
  className = '',
}) => {
  const [hoverValor, setHoverValor] = useState<number | null>(null);

  const configTamanio = TAMANIOS[tamanio] || TAMANIOS.md;
  const estrellas = Array.from({ length: maximo }, (_, i) => i + 1);

  if (interactivo) {
    const valorVisual = hoverValor ?? valor;

    return (
      <div
        role="radiogroup"
        aria-label={etiquetaAccesible}
        className={`inline-flex items-center gap-1 ${className}`}
        onMouseLeave={() => setHoverValor(null)}
      >
        {estrellas.map((estrella) => {
          const estaActiva = estrella <= valorVisual;
          const esSeleccionada = estrella === valor;

          return (
            <button
              key={estrella}
              type="button"
              role="radio"
              aria-checked={esSeleccionada}
              aria-label={`${estrella} de ${maximo} estrellas`}
              tabIndex={0}
              onClick={() => alCambiar?.(estrella)}
              onMouseEnter={() => setHoverValor(estrella)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  alCambiar?.(estrella);
                } else if (e.key === 'ArrowRight' && estrella < maximo) {
                  e.preventDefault();
                  alCambiar?.(estrella + 1);
                } else if (e.key === 'ArrowLeft' && estrella > 1) {
                  e.preventDefault();
                  alCambiar?.(estrella - 1);
                }
              }}
              className="interaccion-tactil min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl hover:bg-amber-50 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-[#EA580C] transition-all cursor-pointer group"
            >
              <div className={`${configTamanio.contenedor} flex items-center justify-center transition-transform group-active:scale-90 group-hover:scale-110`}>
                <Star
                  className={`${configTamanio.estrella} transition-colors ${
                    estaActiva
                      ? 'text-amber-400 fill-amber-400 drop-shadow-xs'
                      : 'text-slate-300 fill-slate-100 group-hover:text-amber-300'
                  }`}
                />
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  // ── MODO LECTURA: Relleno proporcional al valor decimal ──
  return (
    <div
      aria-label={`${etiquetaAccesible}: ${valor.toFixed(1)} de ${maximo} estrellas`}
      className={`inline-flex items-center gap-1 select-none ${className}`}
    >
      {estrellas.map((estrella) => {
        // Porcentaje de relleno de 0 a 100 % para cada estrella individual
        const diff = valor - (estrella - 1);
        const porcentajeLleno = Math.max(0, Math.min(100, Math.round(diff * 100)));

        return (
          <div
            key={estrella}
            className={`relative ${configTamanio.contenedor} flex items-center justify-center shrink-0`}
          >
            {/* Estrella base vacía / gris claro */}
            <Star className={`${configTamanio.estrella} text-slate-200 fill-slate-100`} />

            {/* Capa de relleno parcial dorada/ámbar */}
            {porcentajeLleno > 0 && (
              <div
                className="absolute inset-0 overflow-hidden flex items-center pointer-events-none"
                style={{ width: `${porcentajeLleno}%` }}
              >
                <Star className={`${configTamanio.estrella} text-amber-400 fill-amber-400 shrink-0`} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};


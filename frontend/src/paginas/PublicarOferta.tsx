/**
 * PublicarOferta.tsx — Formulario para que los productores publiquen preventas de cosecha ("/publicar").
 * Incluye validaciones en español, vista previa en tiempo real del precio final y costo anual equivalente (CAE),
 * replicando exactamente el cálculo del backend.
 */

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sprout,
  Calendar,
  MapPin,
  DollarSign,
  Percent,
  Scale,
  Sparkles,
  AlertCircle,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { publicarOferta, type CrearOfertaDatos } from '../api';
import { formatearUsdc, formatearCae } from '../componentes/TarjetaOferta';
import { usarSesion } from '../sesion';

/**
 * Cálculo del precio final y costo anual equivalente (CAE).
 * // debe coincidir con el backend (_calcular_precio_y_cae en main.py)
 */
function calcularPrecioYCAE(
  precioReferencia: number,
  porcentajeDescuento: number,
  fechaEntregaIso: string
): { precioFinal: number; cae: number } {
  const precioFinal = precioReferencia * (1 - porcentajeDescuento / 100);

  if (!fechaEntregaIso) {
    return { precioFinal: Math.max(0, precioFinal), cae: 0 };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const [año, mes, dia] = fechaEntregaIso.split('-').map(Number);
  const fechaObj = new Date(año, (mes || 1) - 1, dia || 1);
  fechaObj.setHours(0, 0, 0, 0);

  let diasHastaEntrega = Math.round((fechaObj.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24));
  if (diasHastaEntrega <= 0) {
    diasHastaEntrega = 1;
  }

  let cae = 0;
  if (precioFinal > 0) {
    cae = (Math.pow(precioReferencia / precioFinal, 365 / diasHastaEntrega) - 1) * 100;
  }

  return {
    precioFinal: Math.round(precioFinal * 1000000) / 1000000,
    cae: Math.round(cae * 100) / 100,
  };
}

export const PublicarOferta: React.FC = () => {
  const navigate = useNavigate();
  const { token, perfilActivo } = usarSesion();

  // Campos del formulario
  const [cultivo, setCultivo] = useState('');
  const [cantidadKg, setCantidadKg] = useState<string>('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [ubicacion, setUbicacion] = useState('');
  const [precioReferencia, setPrecioReferencia] = useState<string>('');
  const [descuento, setDescuento] = useState<string>('');

  // Estados de carga y error
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Cálculos en vivo
  const numReferencia = parseFloat(precioReferencia) || 0;
  const numDescuento = parseFloat(descuento) || 0;
  const numKg = parseFloat(cantidadKg) || 0;

  const { precioFinal, cae } = useMemo(() => {
    return calcularPrecioYCAE(numReferencia, numDescuento, fechaEntrega);
  }, [numReferencia, numDescuento, fechaEntrega]);

  // Si no es productor, mostrar aviso amigable
  if (perfilActivo !== 'productor') {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 text-center flex flex-col items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="font-titulo text-xl text-[#14221B]">Acceso exclusivo para productores</h2>
          <p className="text-xs text-[#5B6B63] leading-relaxed">
            Para publicar una oferta de cosecha debes tener activo el perfil de productor. Puedes cambiar de perfil desde el menú superior.
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

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorEnvio(null);

    // Validaciones en español
    if (!cultivo.trim()) {
      setErrorEnvio('Por favor, indica el nombre del cultivo.');
      return;
    }
    if (!numKg || numKg <= 0) {
      setErrorEnvio('La cantidad en kg debe ser un número mayor a cero.');
      return;
    }
    if (!fechaEntrega) {
      setErrorEnvio('Por favor, selecciona la fecha estimada de entrega de la cosecha.');
      return;
    }
    if (!ubicacion.trim()) {
      setErrorEnvio('Por favor, indica la ubicación o región de tu cultivo.');
      return;
    }
    if (!numReferencia || numReferencia <= 0) {
      setErrorEnvio('El precio de referencia debe ser mayor a cero.');
      return;
    }
    if (numDescuento < 0 || numDescuento >= 100) {
      setErrorEnvio('El porcentaje de descuento debe estar entre 0 y 99%.');
      return;
    }

    if (!token) {
      navigate('/entrar');
      return;
    }

    setEnviando(true);
    try {
      const datos: CrearOfertaDatos = {
        cultivo: cultivo.trim(),
        cantidad_kg: numKg,
        fecha_entrega: fechaEntrega,
        ubicacion: ubicacion.trim(),
        precio_referencia_usdc: numReferencia,
        porcentaje_descuento: numDescuento,
      };

      await publicarOferta(datos, token);
      navigate('/mercado', { state: { mensajeExito: '¡Tu oferta fue publicada exitosamente en el Mercado!' } });
    } catch (err) {
      if (err instanceof Error) {
        setErrorEnvio(err.message);
      } else {
        setErrorEnvio('No fue posible publicar la oferta. Revisa tu conexión.');
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="w-full bg-[#F8FAFC] min-h-[calc(100vh-80px)] pb-24 md:pb-12">
      <div className="max-w-[760px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        
        {/* Encabezado y botón volver */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/mercado')}
            className="interaccion-tactil inline-flex items-center gap-2 text-xs font-semibold text-[#5B6B63] hover:text-[#0A2E1F] py-2 px-3 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver al Mercado</span>
          </button>
          
          <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-emerald-50 text-[#1F6B45] border border-emerald-200/60">
            Perfil Productor
          </span>
        </div>

        {/* Tarjeta del Formulario */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.06)] flex flex-col gap-6">
          
          <div>
            <h1 className="font-titulo text-2xl sm:text-3xl text-[#14221B] font-bold">
              Publicar oferta de preventa
            </h1>
            <p className="text-xs sm:text-sm text-[#5B6B63] mt-1 leading-relaxed">
              Ofrece tu cosecha a compradores de todo el país. Recibe 40% de anticipo al instante para tus insumos.
            </p>
          </div>

          {errorEnvio && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorEnvio}</span>
            </div>
          )}

          <form onSubmit={manejarEnvio} className="flex flex-col gap-5">
            
            {/* Cultivo */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cultivo" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                <Sprout className="w-3.5 h-3.5 text-[#1F6B45]" />
                <span>Cultivo agrícola</span>
              </label>
              <input
                id="cultivo"
                type="text"
                placeholder="Ej.: Quinua Real, Café Especial, Papa Criolla"
                value={cultivo}
                onChange={(e) => setCultivo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                required
              />
            </div>

            {/* Cantidad en Kg */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="cantidad" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#1F6B45]" />
                <span>Cantidad total de cosecha (en kg)</span>
              </label>
              <input
                id="cantidad"
                type="number"
                step="any"
                min="0.1"
                placeholder="Ej.: 1200"
                value={cantidadKg}
                onChange={(e) => setCantidadKg(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                required
              />
              <span className="text-[11px] text-[#5B6B63]">
                Expresado en kilogramos (kg).
              </span>
            </div>

            {/* Fecha estimada de entrega */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fecha" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-[#1F6B45]" />
                <span>Fecha estimada de entrega de la cosecha</span>
              </label>
              <input
                id="fecha"
                type="date"
                value={fechaEntrega}
                onChange={(e) => setFechaEntrega(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                required
              />
            </div>

            {/* Ubicación */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="ubicacion" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#1F6B45]" />
                <span>Ubicación o región</span>
              </label>
              <input
                id="ubicacion"
                type="text"
                placeholder="Ej.: Altiplano (dato simulado)"
                value={ubicacion}
                onChange={(e) => setUbicacion(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                required
              />
              <span className="text-[11px] text-[#5B6B63]">
                Ej.: Altiplano (dato simulado)
              </span>
            </div>

            {/* Precios y Descuento en 2 columnas en sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              <div className="flex flex-col gap-1.5">
                <label htmlFor="precioRef" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[#1F6B45]" />
                  <span>Precio de referencia (USDC)</span>
                </label>
                <input
                  id="precioRef"
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="Ej.: 100.00"
                  value={precioReferencia}
                  onChange={(e) => setPrecioReferencia(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                  required
                />
                <span className="text-[11px] text-[#5B6B63]">
                  Valor total en mercado sin descuento.
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="descuento" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                  <Percent className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>Porcentaje de descuento (%)</span>
                </label>
                <input
                  id="descuento"
                  type="number"
                  step="any"
                  min="0"
                  max="99"
                  placeholder="Ej.: 10"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                  required
                />
                <span className="text-[11px] text-[#5B6B63]">
                  Incentivo para venta anticipada (0 a 99%).
                </span>
              </div>

            </div>

            {/* ══════════════════════════════════════════════════════════
                VISTA PREVIA EN VIVO (Cálculo idéntico al backend)
                ══════════════════════════════════════════════════════════ */}
            <div className="mt-2 bg-[#FFF6E5]/60 rounded-2xl p-5 border border-[#FF8A3D]/30 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#EA580C]" />
                <span className="font-titulo text-xs font-bold text-[#14221B] uppercase tracking-wider">
                  Vista previa financiera
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="flex flex-col">
                  <span className="text-[11px] text-[#5B6B63]">Precio final a pagar por el comprador:</span>
                  <span className="font-cifras font-bold text-xl text-[#EA580C] mt-0.5">
                    {numReferencia > 0 ? formatearUsdc(precioFinal) : '$0,00 USDC'}
                  </span>
                </div>

                <div className="flex flex-col">
                  <span className="text-[11px] text-[#5B6B63]">Costo anual equivalente (CAE):</span>
                  <span className="font-cifras font-bold text-xl text-[#1F6B45] mt-0.5">
                    {numReferencia > 0 ? formatearCae(cae) : '0,0 %'}
                  </span>
                </div>
              </div>

              <span className="text-[11px] text-[#5B6B63] border-t border-orange-200/50 pt-2 leading-relaxed">
                El CAE compara este descuento como una tasa financiera anualizada para que evalúes tu costo frente a un préstamo bancario.
              </span>
            </div>

            {/* Botón Publicar */}
            <button
              type="submit"
              disabled={enviando}
              className="interaccion-tactil sombra-naranja-brillo mt-3 w-full py-3.5 px-6 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] disabled:opacity-50 text-white font-titulo font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {enviando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Publicando oferta en el Mercado…</span>
                </>
              ) : (
                <span>Publicar oferta</span>
              )}
            </button>

          </form>

        </div>

      </div>
    </div>
  );
};

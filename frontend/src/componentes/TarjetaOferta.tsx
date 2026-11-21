/**
 * TarjetaOferta.tsx — Componente de presentación para cada oferta agrícola.
 * Cumple con el sistema de diseño MinKa, separadores bolivianos (ej. 1.200 kg, 8,4 %)
 * y precios en USDC.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, MapPin, ShieldCheck, Sprout, ArrowRight } from 'lucide-react';
import { type Oferta, urlArchivo } from '../api';

interface TarjetaOfertaProps {
  oferta: Oferta;
}

const MESES_ES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * Normaliza una cadena quitando tildes y mayúsculas para emparejar cultivos.
 */
export function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Retorna la ruta a la foto correspondiente si existe en /fotos/, o null para el marcador provisional.
 */
export function obtenerRutaFoto(cultivo: string): string | null {
  const norm = normalizarTexto(cultivo);
  if (norm.includes('quinua')) return '/fotos/quinua.jpg';
  if (norm.includes('cafe')) return '/fotos/cafe.jpg';
  if (norm.includes('sesamo')) return '/fotos/sesamo.jpg';
  if (norm.includes('maiz') || norm.includes('choclo')) return '/fotos/maiz.jpg';
  if (norm.includes('papa')) return '/fotos/papa.jpg';
  return null;
}

/**
 * Formatea una fecha ISO al formato "15 de mayo de 2027" (minúsculas en "de" y en el mes).
 */
export function formatearFecha(fechaIso: string): string {
  if (!fechaIso) return '';
  try {
    const soloFecha = fechaIso.split('T')[0];
    const [año, mes, dia] = soloFecha.split('-').map(Number);
    if (!año || !mes || !dia) return fechaIso;
    const mesNombre = MESES_ES[mes - 1] || '';
    return `${dia} de ${mesNombre} de ${año}`;
  } catch {
    return fechaIso;
  }
}

/**
 * Formatea una fecha al formato "{mes} de {año}", ej. "mayo de 2027".
 */
export function formatearMesYAño(fechaIso: string): string {
  if (!fechaIso) return '';
  try {
    const soloFecha = fechaIso.split('T')[0];
    const [año, mes] = soloFecha.split('-').map(Number);
    if (!año || !mes) return fechaIso;
    const mesNombre = MESES_ES[mes - 1] || '';
    return `${mesNombre} de ${año}`;
  } catch {
    return fechaIso;
  }
}

/**
 * Formatea cantidad en kg con separador de miles con punto (estilo boliviano, ej. "1.200 kg").
 */
export function formatearKg(cantidad: number): string {
  const formateado = Math.round(cantidad).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formateado} kg`;
}

/**
 * Formatea montos en USDC con dos decimales y coma (ej. "$38,25 USDC").
 */
export function formatearUsdc(monto: number): string {
  const partes = monto.toFixed(2).split('.');
  const enteros = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `$${enteros},${partes[1]} USDC`;
}

/**
 * Formatea el costo anual equivalente con un decimal y coma (ej. "8,4 %").
 */
export function formatearCae(cae: number): string {
  return `${cae.toFixed(1).replace('.', ',')} %`;
}

/**
 * Formatea un número decimal con coma (ej. 4,8).
 */
export function formatearDecimal(valor: number): string {
  return valor.toFixed(1).replace('.', ',');
}

export const TarjetaOferta: React.FC<TarjetaOfertaProps> = ({ oferta }) => {
  const navigate = useNavigate();
  const [errorCargaImagen, setErrorCargaImagen] = useState(false);

  // La portada es la primera foto de la oferta; si no tiene, la ilustrativa
  const tieneFotosReales = Array.isArray(oferta.fotos) && oferta.fotos.length > 0;
  const rutaFoto = tieneFotosReales && oferta.fotos ? urlArchivo(oferta.fotos[0]) : obtenerRutaFoto(oferta.cultivo);

  // Ubicación: "Provincia, Departamento" (para ofertas antiguas usa ubicacion)
  const ubicacionMostrar =
    oferta.provincia && oferta.departamento
      ? `${oferta.provincia}, ${oferta.departamento}`
      : oferta.ubicacion;

  const numCertificaciones = Array.isArray(oferta.certificaciones) ? oferta.certificaciones.length : 0;

  return (
    <article className="tarjeta-elevable flex flex-col bg-white rounded-2xl overflow-hidden border border-slate-100/90 group">
      {/* Contenedor de la Imagen del Cultivo */}
      <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-[#0A2E1F]/10">
        {rutaFoto && !errorCargaImagen ? (
          <img
            src={rutaFoto}
            alt={oferta.cultivo}
            onError={() => setErrorCargaImagen(true)}
            className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
        ) : (
          /* Marcador provisional si no hay foto */
          <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0A2E1F] via-[#103D2E] to-[#1F6B45] text-white p-6">
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mb-2">
              <Sprout className="w-6 h-6 text-[#8CD6A8]" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-200">
              {oferta.cultivo}
            </span>
          </div>
        )}

        {/* Degradado sobre la imagen para legibilidad de metadatos */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />

        {/* Insignia superior izquierda: Cantidad disponible en kg con separador de miles boliviano */}
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full shadow-sm">
          <span className="w-2 h-2 rounded-full bg-[#1F6B45]" />
          <span className="text-[11px] font-semibold text-[#0A2E1F] cifra-tabular">
            {formatearKg(oferta.cantidad_kg)} disponibles
          </span>
        </div>

        {/* Insignia superior derecha: Descuento de preventa */}
        <div className="absolute top-3 right-3 bg-[#EA580C] text-white px-2.5 py-0.5 rounded-full text-xs font-bold shadow-md">
          -{oferta.porcentaje_descuento}% anticipado
        </div>

        {/* Rótulo de foto ilustrativa solo si no tiene fotos reales */}
        {!tieneFotosReales && (
          <div className="absolute top-12 left-3 bg-black/50 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] text-white/90 font-medium drop-shadow-sm">
            Foto ilustrativa
          </div>
        )}

        {/* Metadatos inferiores: Fecha y Ubicación */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-medium gap-2">
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#FF8A3D]" />
            <span>{formatearFecha(oferta.fecha_entrega)}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg max-w-[58%]">
            <MapPin className="w-3.5 h-3.5 text-[#FF8A3D] shrink-0" />
            <span className="line-clamp-2 leading-tight text-[11px]">{ubicacionMostrar}</span>
          </div>
        </div>
      </div>

      {/* Cuerpo de la Tarjeta */}
      <div className="p-5 sm:p-6 flex flex-col flex-1 justify-between gap-5">
        <div>
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45] bg-[#FFF6E5] px-2.5 py-0.5 rounded-md">
                Cosecha en preventa
              </span>
              {numCertificaciones > 0 && (
                <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-md">
                  {numCertificaciones === 1 ? '1 certificación declarada' : `${numCertificaciones} certificaciones declaradas`}
                </span>
              )}
            </div>
            <span className="text-[11px] font-mono text-[#5B6B63]">
              #{oferta.id}
            </span>
          </div>

          <h3 className="font-titulo text-xl text-[#14221B] group-hover:text-[#1F6B45] transition-colors leading-snug">
            {oferta.cultivo}
          </h3>

          {/* Línea discreta "Por {productor_nombre}" con calificación */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1 text-xs">
            <span className="text-[#5B6B63] font-medium">
              Por {oferta.productor_nombre || 'Productor MinKa'}
            </span>
            <span className="text-[#5B6B63]/60">·</span>
            {oferta.productor_calificacion_promedio !== null && oferta.productor_calificacion_promedio !== undefined ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[#14221B]">
                <span className="text-[#EA580C] font-bold">★</span>
                <span>{formatearDecimal(oferta.productor_calificacion_promedio)}</span>
                <span className="text-[#5B6B63] font-normal">
                  · {oferta.productor_resenas_cantidad} {oferta.productor_resenas_cantidad === 1 ? 'reseña' : 'reseñas'}
                </span>
              </span>
            ) : (
              <span className="text-[#5B6B63]/70">Sin reseñas aún</span>
            )}
          </div>
        </div>

        {/* Caja de Precios en USDC y Costo Anual Equivalente con % y coma */}
        <div className="bg-[#EEF4EF]/60 rounded-xl p-3.5 flex items-center justify-between border border-slate-100">
          <div>
            <span className="text-[11px] text-[#5B6B63] line-through block cifra-tabular">
              Ref: {formatearUsdc(oferta.precio_referencia_usdc)}
            </span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="font-titulo text-2xl text-[#EA580C] font-extrabold cifra-tabular">
                {formatearUsdc(oferta.precio_final_usdc)}
              </span>
            </div>
          </div>

          <div className="text-right">
            <span className="text-[10px] font-medium text-[#5B6B63] block">
              Costo anual equivalente
            </span>
            <span className="text-xs font-bold text-[#1F6B45] bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-0.5 cifra-tabular border border-emerald-200/50">
              {formatearCae(oferta.costo_anual_equivalente)}
            </span>
          </div>
        </div>

        {/* Barra de 3 tramos (40% / 30% / 30%) neutra y minimalista en tonos de verde */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] text-[#5B6B63]">
            <div className="flex items-center gap-1.5 font-medium text-[#14221B]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#1F6B45]" />
              <span>Protección en 3 tramos</span>
            </div>
            <span className="text-[10px] text-[#5B6B63]">Stellar</span>
          </div>

          {/* Barra segmentada fija 40/30/30 en tonos de verde */}
          <div className="flex w-full gap-1.5 h-2">
            <div
              className="bg-[#10482E] rounded-full h-full"
              style={{ width: '40%' }}
              title="Anticipo: 40%"
            />
            <div
              className="bg-[#1F6B45] rounded-full h-full"
              style={{ width: '30%' }}
              title="Avance verificado: 30%"
            />
            <div
              className="bg-[#349666] rounded-full h-full"
              style={{ width: '30%' }}
              title="Entrega: 30%"
            />
          </div>

          <div className="flex justify-between text-[10px] text-[#5B6B63] px-0.5 pt-0.5">
            <span>Anticipo 40%</span>
            <span>Avance verificado 30%</span>
            <span>Entrega 30%</span>
          </div>
        </div>

        {/* Botón de acción */}
        <button
          type="button"
          onClick={() => navigate(`/oferta/${oferta.id}`)}
          className="interaccion-tactil w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-[#0A2E1F] text-[#14221B] hover:text-white font-titulo text-xs font-bold flex items-center justify-center gap-2 group-hover:bg-[#0A2E1F] group-hover:text-white transition-all cursor-pointer"
        >
          <span>Ver oferta</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </button>
      </div>
    </article>
  );
};

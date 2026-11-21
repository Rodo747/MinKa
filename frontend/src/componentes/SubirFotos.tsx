/**
 * SubirFotos.tsx — Componente reutilizable para selección y subida de imágenes.
 * Admite fotos desde galería o cámara (accept="image/*").
 * Redimensiona en el navegador mediante canvas (máx 1600 px ancho, calidad JPEG 0.8)
 * antes de subir a POST /subidas. Muestra cuadrícula de vistas previas, portada y botón de eliminar.
 */

import React, { useState, useRef } from 'react';
import { Camera, X, Star, Loader2, AlertCircle } from 'lucide-react';
import { subirArchivo, urlArchivo } from '../api';
import { usarSesion } from '../sesion';

export interface SubirFotosProps {
  fotos: string[];
  onChange: (fotos: string[]) => void;
  maximoFotos?: number;
  minimoRequerido?: number;
  textoAyuda?: string;
  modoPortada?: boolean;
}

/**
 * Redimensiona una imagen en memoria mediante canvas sin librerías externas.
 * Ajusta el ancho a un máximo de 1600 px manteniendo la proporción
 * y comprime a JPEG con calidad 0.8.
 */
function redimensionarImagen(archivo: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const lector = new FileReader();
    lector.onload = (evento) => {
      const img = new Image();
      img.onload = () => {
        let ancho = img.width;
        let alto = img.height;
        const maxAncho = 1600;

        if (ancho > maxAncho) {
          alto = Math.round((alto * maxAncho) / ancho);
          ancho = maxAncho;
        }

        const canvas = document.createElement('canvas');
        canvas.width = ancho;
        canvas.height = alto;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo inicializar el procesador de imágenes en el navegador.'));
          return;
        }

        ctx.drawImage(img, 0, 0, ancho, alto);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('No se pudo procesar la imagen seleccionada.'));
            }
          },
          'image/jpeg',
          0.8
        );
      };
      img.onerror = () => reject(new Error('No fue posible cargar el archivo de imagen seleccionado.'));
      img.src = evento.target?.result as string;
    };
    lector.onerror = () => reject(new Error('Error al leer el archivo en el dispositivo.'));
    lector.readAsDataURL(archivo);
  });
}

export const SubirFotos: React.FC<SubirFotosProps> = ({
  fotos,
  onChange,
  maximoFotos = 6,
  minimoRequerido = 0,
  textoAyuda,
  modoPortada = true,
}) => {
  const { token } = usarSesion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [progresoTexto, setProgresoTexto] = useState<string | null>(null);
  const [errorSubida, setErrorSubida] = useState<string | null>(null);

  const puedeAgregarMas = fotos.length < maximoFotos;

  const manejarSeleccion = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivos = e.target.files;
    if (!archivos || archivos.length === 0) return;

    if (!token) {
      setErrorSubida('Debes iniciar sesión para subir imágenes.');
      return;
    }

    const disponibles = maximoFotos - fotos.length;
    const aProcesar = Array.from(archivos).slice(0, disponibles);

    setSubiendo(true);
    setErrorSubida(null);

    const nuevasRutas: string[] = [];

    try {
      for (let i = 0; i < aProcesar.length; i++) {
        const archivo = aProcesar[i];
        setProgresoTexto(`Optimizando y subiendo imagen ${i + 1} de ${aProcesar.length}…`);

        // Redimensionar con canvas (máx 1600 px de ancho, JPEG 0.8)
        const blobRedimensionado = await redimensionarImagen(archivo);

        // Subir al endpoint POST /subidas
        const resultado = await subirArchivo(blobRedimensionado, token);
        nuevasRutas.push(resultado.ruta);
      }

      onChange([...fotos, ...nuevasRutas]);
    } catch (err) {
      if (err instanceof Error) {
        setErrorSubida(err.message);
      } else {
        setErrorSubida('Ocurrió un error al subir las imágenes.');
      }
    } finally {
      setSubiendo(false);
      setProgresoTexto(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }
  };

  const quitarFoto = (indice: number) => {
    const actualizadas = fotos.filter((_, i) => i !== indice);
    onChange(actualizadas);
  };

  const fijarComoPortada = (indice: number) => {
    if (indice === 0) return;
    const seleccionada = fotos[indice];
    const resto = fotos.filter((_, i) => i !== indice);
    onChange([seleccionada, ...resto]);
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Texto de ayuda o recomendación */}
      {textoAyuda && (
        <p className="text-xs text-[#5B6B63] leading-relaxed">
          {textoAyuda}
        </p>
      )}

      {/* Input oculto para cámara y galería */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple={maximoFotos > 1}
        onChange={manejarSeleccion}
        className="hidden"
        disabled={subiendo || !puedeAgregarMas}
      />

      {/* Mensaje de error si falla la subida */}
      {errorSubida && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorSubida}</span>
        </div>
      )}

      {/* Estado de progreso */}
      {subiendo && (
        <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2.5 text-xs text-[#1F6B45]">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span className="font-medium">{progresoTexto || 'Subiendo fotos…'}</span>
        </div>
      )}

      {/* Cuadrícula de fotos cargadas + botón agregar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {fotos.map((ruta, idx) => {
          const esPortada = modoPortada && idx === 0 && maximoFotos > 1;
          const urlCompleta = urlArchivo(ruta);

          return (
            <div
              key={`${ruta}-${idx}`}
              className="relative group rounded-2xl overflow-hidden aspect-4/3 bg-slate-100 border border-slate-200/90 shadow-2xs"
            >
              <img
                src={urlCompleta}
                alt={`Foto ${idx + 1}`}
                className="w-full h-full object-cover"
              />

              {/* Insignia Portada */}
              {esPortada && (
                <div className="absolute top-2 left-2 bg-[#0A2E1F] text-white text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center gap-1 shadow-xs">
                  <Star className="w-3 h-3 text-amber-300 fill-amber-300" />
                  <span>Portada</span>
                </div>
              )}

              {/* Botón Hacer Portada (si no es la primera) */}
              {modoPortada && !esPortada && maximoFotos > 1 && (
                <button
                  type="button"
                  onClick={() => fijarComoPortada(idx)}
                  className="interaccion-tactil absolute bottom-2 left-2 bg-white/95 text-[#14221B] hover:bg-[#0A2E1F] hover:text-white text-[10px] font-semibold px-2 py-1 rounded-md shadow-xs opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  title="Elegir esta foto como portada"
                >
                  Hacer portada
                </button>
              )}

              {/* Botón Quitar Foto */}
              <button
                type="button"
                onClick={() => quitarFoto(idx)}
                aria-label="Quitar foto"
                className="interaccion-tactil absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-red-600 text-white transition-colors cursor-pointer shadow-xs"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Botón / Área para agregar más fotos */}
        {puedeAgregarMas && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="interaccion-tactil rounded-2xl aspect-4/3 border-2 border-dashed border-slate-200 hover:border-[#1F6B45] bg-[#F8FAFC] hover:bg-emerald-50/40 text-[#5B6B63] hover:text-[#1F6B45] flex flex-col items-center justify-center gap-2 p-4 transition-all cursor-pointer disabled:opacity-50"
          >
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[#1F6B45] shadow-2xs">
              <Camera className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-center">
              {fotos.length === 0 ? 'Agregar fotos' : 'Agregar otra foto'}
            </span>
            <span className="text-[10px] text-slate-400">
              Galería o cámara
            </span>
          </button>
        )}
      </div>

      {/* Contador y requisito mínimo */}
      <div className="flex items-center justify-between text-[11px] text-[#5B6B63] pt-1">
        <span>
          {fotos.length} de {maximoFotos} foto{maximoFotos > 1 ? 's' : ''} cargada{fotos.length === 1 ? '' : 's'}
        </span>
        {minimoRequerido > 0 && fotos.length < minimoRequerido && (
          <span className="text-orange-600 font-semibold">
            Se requiere al menos {minimoRequerido} foto para publicar
          </span>
        )}
      </div>
    </div>
  );
};

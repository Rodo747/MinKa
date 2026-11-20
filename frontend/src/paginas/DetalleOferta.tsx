/**
 * DetalleOferta.tsx — Pantalla de detalle de oferta agrícola ("/oferta/:id").
 * Muestra información completa, desglose de tramos en Stellar y flujo de compra
 * en 2 pasos (crear contrato y fondear escrow) con confirmación y manejo de errores.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  ShieldCheck,
  Sprout,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Lock,
  Info,
  DollarSign,
  ChevronRight,
  TrendingDown,
} from 'lucide-react';
import {
  obtenerOfertaPorId,
  crearContrato,
  fondearContrato,
  type Oferta,
} from '../api';
import {
  obtenerRutaFoto,
  formatearFecha,
  formatearKg,
  formatearUsdc,
  formatearCae,
} from '../componentes/TarjetaOferta';
import { usarSesion } from '../sesion';

export const DetalleOferta: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario, token, perfilActivo } = usarSesion();

  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [errorImagen, setErrorImagen] = useState(false);

  // Estados del modal de compra
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pasoCompra, setPasoCompra] = useState<'confirmar' | 'creando' | 'fondeando' | 'exito'>('confirmar');
  const [errorCompra, setErrorCompra] = useState<string | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!id) return;
      setCargando(true);
      setErrorCarga(null);
      try {
        const datos = await obtenerOfertaPorId(Number(id));
        setOferta(datos);
      } catch (err) {
        if (err instanceof Error) {
          setErrorCarga(err.message);
        } else {
          setErrorCarga('No se pudo cargar la oferta solicitada.');
        }
      } finally {
        setCargando(false);
      }
    }
    cargar();
  }, [id]);

  if (cargando) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#F8FAFC]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#1F6B45] border-t-transparent animate-spin" />
          <span className="text-xs text-[#5B6B63] font-medium">Cargando detalles de la oferta…</span>
        </div>
      </div>
    );
  }

  if (errorCarga || !oferta) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-[#F8FAFC]">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 text-center flex flex-col items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-titulo text-xl text-[#14221B]">No pudimos encontrar la oferta</h2>
          <p className="text-xs text-[#5B6B63] leading-relaxed">{errorCarga || 'La oferta no existe o ha sido eliminada.'}</p>
          <button
            type="button"
            onClick={() => navigate('/mercado')}
            className="interaccion-tactil mt-2 px-5 py-2.5 rounded-xl bg-[#0A2E1F] text-white font-titulo font-bold text-xs"
          >
            Volver al Mercado
          </button>
        </div>
      </div>
    );
  }

  // Cálculos de tramos según backend (40% / 30% / 30%)
  const montoTotal = oferta.precio_final_usdc;
  const tramo1Monto = Math.round(montoTotal * 0.4 * 1000000) / 1000000;
  const tramo2Monto = Math.round(montoTotal * 0.3 * 1000000) / 1000000;
  const tramo3Monto = Math.round(montoTotal * 0.3 * 1000000) / 1000000;

  const esProductorDeEstaOferta = usuario?.id === oferta.productor_id;
  const esComprador = perfilActivo === 'comprador';
  const estaAbierta = oferta.estado === 'abierta';

  const rutaFoto = obtenerRutaFoto(oferta.cultivo);

  // Manejador del flujo de compra
  const handleConfirmarCompra = async () => {
    if (!token) {
      navigate('/entrar');
      return;
    }

    setErrorCompra(null);
    setPasoCompra('creando');

    try {
      // 1. Crear contrato en Stellar
      const resContrato = await crearContrato(oferta.id, montoTotal, token);
      const contratoId = resContrato.contrato.id;

      // 2. Fondear contrato en Stellar (libera anticipo automáticamente)
      setPasoCompra('fondeando');
      await fondearContrato(contratoId, token);

      setPasoCompra('exito');
      // Redirigir a Mi cuenta con el ID del contrato
      setTimeout(() => {
        navigate(`/mi-cuenta?contrato=${contratoId}`, { replace: true });
      }, 900);
    } catch (err) {
      setPasoCompra('confirmar');
      if (err instanceof Error) {
        setErrorCompra(err.message);
      } else {
        setErrorCompra('Ocurrió un error al procesar la compra en Stellar.');
      }
    }
  };

  return (
    <div className="w-full bg-[#F8FAFC] min-h-[calc(100vh-80px)] pb-24 md:pb-12">
      <div className="max-w-[1000px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        
        {/* Barra superior de regreso */}
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
            Oferta #{oferta.id}
          </span>
        </div>

        {/* Contenedor Principal (Grid en escritorio, columna en móvil) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* Columna Izquierda: Imagen y Resumen */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Foto o Marcador */}
            <div className="relative h-64 sm:h-80 w-full rounded-3xl overflow-hidden bg-[#0A2E1F]/10 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.06)]">
              {rutaFoto && !errorImagen ? (
                <img
                  src={rutaFoto}
                  alt={oferta.cultivo}
                  onError={() => setErrorImagen(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0A2E1F] via-[#103D2E] to-[#1F6B45] text-white p-6">
                  <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
                    <Sprout className="w-8 h-8 text-[#8CD6A8]" />
                  </div>
                  <span className="font-titulo text-xl text-white font-bold">{oferta.cultivo}</span>
                  <span className="text-xs text-emerald-200 mt-1">Cosecha garantizada</span>
                </div>
              )}

              {/* Insignia de descuento flotante */}
              <div className="absolute top-4 right-4 bg-[#EA580C] text-white font-titulo font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                <TrendingDown className="w-4 h-4" />
                <span>{oferta.porcentaje_descuento}% descuento</span>
              </div>
            </div>

            {/* Datos agrícolas clave */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-5">
              <div>
                <h1 className="font-titulo text-2xl sm:text-3xl text-[#14221B] font-bold">
                  {oferta.cultivo}
                </h1>
                <p className="text-xs sm:text-sm text-[#5B6B63] mt-1 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#1F6B45] shrink-0" />
                  <span>{oferta.ubicacion}</span>
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100">
                  <span className="text-[11px] font-semibold text-[#5B6B63] uppercase tracking-wider block">
                    Cantidad total
                  </span>
                  <span className="font-cifras font-bold text-lg sm:text-xl text-[#14221B] mt-1 block">
                    {formatearKg(oferta.cantidad_kg)}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100">
                  <span className="text-[11px] font-semibold text-[#5B6B63] uppercase tracking-wider block">
                    Fecha de entrega
                  </span>
                  <span className="font-medium text-xs sm:text-sm text-[#14221B] mt-1 block flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#1F6B45]" />
                    <span>{formatearFecha(oferta.fecha_entrega)}</span>
                  </span>
                </div>
              </div>

              {/* Bloque "Cómo se paga" con los 3 tramos de Stellar */}
              <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#1F6B45]" />
                    <h3 className="font-titulo text-sm font-bold text-[#14221B]">Cómo se paga</h3>
                  </div>
                  <span className="text-[10px] font-semibold text-[#5B6B63] uppercase bg-slate-100 px-2 py-0.5 rounded">
                    Escrow Stellar
                  </span>
                </div>

                <p className="text-xs text-[#5B6B63] leading-relaxed">
                  Tu pago queda protegido en un contrato en Stellar y se libera en 3 tramos contra verificación.
                </p>

                <div className="flex flex-col gap-2 mt-1">
                  {/* Tramo 1 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/60 border border-emerald-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#1F6B45] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                        1
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#14221B]">40% Anticipo para insumos</div>
                        <div className="text-[11px] text-[#5B6B63]">Liberación inmediata al fondear</div>
                      </div>
                    </div>
                    <span className="font-cifras font-bold text-xs text-[#14221B]">
                      {formatearUsdc(tramo1Monto)}
                    </span>
                  </div>

                  {/* Tramo 2 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-[#14221B] text-[11px] font-bold flex items-center justify-center shrink-0">
                        2
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#14221B]">30% Avance verificado</div>
                        <div className="text-[11px] text-[#5B6B63]">Requiere evidencia fotográfica</div>
                      </div>
                    </div>
                    <span className="font-cifras font-bold text-xs text-[#14221B]">
                      {formatearUsdc(tramo2Monto)}
                    </span>
                  </div>

                  {/* Tramo 3 */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-slate-200 text-[#14221B] text-[11px] font-bold flex items-center justify-center shrink-0">
                        3
                      </span>
                      <div>
                        <div className="text-xs font-bold text-[#14221B]">30% Entrega final</div>
                        <div className="text-[11px] text-[#5B6B63]">Contra recepción conforme</div>
                      </div>
                    </div>
                    <span className="font-cifras font-bold text-xs text-[#14221B]">
                      {formatearUsdc(tramo3Monto)}
                    </span>
                  </div>
                </div>
              </div>

            </div>

          </div>

          {/* Columna Derecha: Tarjeta de Precio y Acción de Compra */}
          <div className="lg:col-span-5 flex flex-col gap-4 sticky top-24">
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.06)] flex flex-col gap-6">
              
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#5B6B63] uppercase tracking-wider">
                  Precio de preventa
                </span>
                
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="font-cifras font-bold text-3xl sm:text-4xl text-[#14221B]">
                    {formatearUsdc(oferta.precio_final_usdc)}
                  </span>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs line-through text-slate-400 font-cifras">
                    Ref: {formatearUsdc(oferta.precio_referencia_usdc)}
                  </span>
                  <span className="text-[11px] font-bold text-[#EA580C] bg-[#FFF6E5] px-2 py-0.5 rounded">
                    Ahorras {oferta.porcentaje_descuento}%
                  </span>
                </div>
              </div>

              {/* Costo Anual Equivalente */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100/90 flex flex-col gap-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#5B6B63] font-medium">Costo anual equivalente</span>
                  <span className="font-cifras font-bold text-[#1F6B45]">
                    {formatearCae(oferta.costo_anual_equivalente)}
                  </span>
                </div>
                <span className="text-[10px] text-[#5B6B63] leading-snug">
                  Tasa anualizada que compensa el descuento frente a un crédito bancario tradicional.
                </span>
              </div>

              {/* Botón o Avisos según Perfil */}
              {esProductorDeEstaOferta ? (
                <div className="p-4 rounded-2xl bg-slate-100 text-center border border-slate-200">
                  <span className="text-xs font-bold text-[#5B6B63]">Esta es tu oferta</span>
                  <p className="text-[11px] text-[#5B6B63] mt-0.5">
                    No puedes comprar una cosecha publicada por ti mismo.
                  </p>
                </div>
              ) : !estaAbierta ? (
                <div className="p-4 rounded-2xl bg-amber-50 text-center border border-amber-200">
                  <span className="text-xs font-bold text-[#E0A100]">Oferta no disponible</span>
                  <p className="text-[11px] text-[#5B6B63] mt-0.5">
                    Esta oferta ya se encuentra fondeada o completada.
                  </p>
                </div>
              ) : esComprador ? (
                <button
                  type="button"
                  onClick={() => {
                    setErrorCompra(null);
                    setPasoCompra('confirmar');
                    setModalAbierto(true);
                  }}
                  className="interaccion-tactil sombra-naranja-brillo w-full py-3.5 px-6 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <DollarSign className="w-4 h-4" />
                  <span>Comprar cosecha</span>
                </button>
              ) : (
                <div className="p-4 rounded-2xl bg-[#FFF6E5] border border-[#FF8A3D]/30 flex items-start gap-3">
                  <Info className="w-4 h-4 text-[#EA580C] shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-[#14221B]">
                      Cambia a perfil comprador para comprar
                    </span>
                    <span className="text-[11px] text-[#5B6B63] leading-relaxed">
                      Tu perfil activo actual es productor. Usa el menú de usuario en la barra superior para cambiar a comprador.
                    </span>
                  </div>
                </div>
              )}

              {/* Respaldo Solidario */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 text-[11px] text-[#5B6B63]">
                <ShieldCheck className="w-4 h-4 text-[#1F6B45] shrink-0" />
                <span>Cubierto por el Fondo Solidario de Emergencia en caso de siniestro climático.</span>
              </div>

            </div>
          </div>

        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN DE COMPRA (Emil Kowalski microinteractions)
          ══════════════════════════════════════════════════════════ */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl flex flex-col gap-5 transition-transform duration-200">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-titulo text-lg font-bold text-[#14221B]">Confirmar compra</h3>
                  <span className="text-[11px] text-[#5B6B63]">Protegido por contrato inteligente</span>
                </div>
              </div>
            </div>

            {/* Aviso de error si falló */}
            {errorCompra && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorCompra}</span>
              </div>
            )}

            {/* Resumen de Montos */}
            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-slate-200/60">
                <span className="text-[#5B6B63]">Cultivo</span>
                <span className="font-bold text-[#14221B]">{oferta.cultivo} ({formatearKg(oferta.cantidad_kg)})</span>
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                <div className="flex items-center justify-between text-[#5B6B63]">
                  <span>Tramo 1 (Anticipo 40%)</span>
                  <span className="font-cifras font-medium">{formatearUsdc(tramo1Monto)}</span>
                </div>
                <div className="flex items-center justify-between text-[#5B6B63]">
                  <span>Tramo 2 (Avance 30%)</span>
                  <span className="font-cifras font-medium">{formatearUsdc(tramo2Monto)}</span>
                </div>
                <div className="flex items-center justify-between text-[#5B6B63]">
                  <span>Tramo 3 (Entrega 30%)</span>
                  <span className="font-cifras font-medium">{formatearUsdc(tramo3Monto)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <span className="font-titulo text-xs font-bold text-[#14221B]">Monto total protegido</span>
                <span className="font-cifras font-bold text-base text-[#EA580C]">
                  {formatearUsdc(montoTotal)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#5B6B63] leading-relaxed">
              Se creará tu contrato y tu pago quedará protegido en Stellar. El primer tramo (40%) se liberará automáticamente al productor para compra de insumos.
            </p>

            {/* Pasos de progreso durante la transacción */}
            {pasoCompra === 'creando' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-[#1F6B45] animate-spin shrink-0" />
                <span className="text-xs font-medium text-[#1F6B45]">Creando contrato de escrow en Stellar…</span>
              </div>
            )}

            {pasoCompra === 'fondeando' && (
              <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 flex items-center gap-3">
                <Loader2 className="w-5 h-5 text-[#EA580C] animate-spin shrink-0" />
                <span className="text-xs font-medium text-[#EA580C]">Protegiendo tu pago en Stellar…</span>
              </div>
            )}

            {pasoCompra === 'exito' && (
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span className="text-xs font-bold text-emerald-700">¡Contrato creado y fondeado con éxito!</span>
              </div>
            )}

            {/* Botones de acción */}
            {pasoCompra === 'confirmar' && (
              <div className="flex items-center gap-3 mt-1">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmarCompra}
                  className="interaccion-tactil sombra-naranja-brillo w-1/2 py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <span>Confirmar y pagar</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};


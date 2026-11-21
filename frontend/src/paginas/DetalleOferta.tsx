/**
 * DetalleOferta.tsx — Pantalla de detalle de oferta agrícola ("/oferta/:id").
 * Incluye:
 * - Galería de fotos (principal grande + miniaturas deslizables en celular).
 * - Toda la información técnica: descripción, variedad, superficie, fecha siembra,
 *   prácticas, forma/lugar de entrega y ubicación.
 * - Tarjeta "Productor" con foto, nombre, departamento, contratos cumplidos,
 *   botón "Ver perfil" y botón secundario "Consultar por WhatsApp".
 * - Flujo seguro de compra y pagos con contrato multi-release en Stellar.
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
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
  MessageCircle,
  User,
  Award,
  FileText,
  X,
  ExternalLink,
} from 'lucide-react';
import {
  obtenerOfertaPorId,
  crearContrato,
  fondearContrato,
  obtenerProductor,
  urlArchivo,
  type Oferta,
  type PerfilProductor,
  type Certificacion,
} from '../api';
import {
  obtenerRutaFoto,
  formatearFecha,
  formatearKg,
  formatearUsdc,
  formatearCae,
  formatearDecimal,
} from '../componentes/TarjetaOferta';
import { usarSesion } from '../sesion';

export const DetalleOferta: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { usuario, token, perfilActivo } = usarSesion();

  const [oferta, setOferta] = useState<Oferta | null>(null);
  const [productor, setProductor] = useState<PerfilProductor | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  // Galería de imágenes
  const [fotoActiva, setFotoActiva] = useState(0);

  // Estados del modal de compra
  const [modalAbierto, setModalAbierto] = useState(false);
  const [pasoCompra, setPasoCompra] = useState<'confirmar' | 'creando' | 'fondeando' | 'exito'>('confirmar');
  const [errorCompra, setErrorCompra] = useState<string | null>(null);
  const [certificadoParaVer, setCertificadoParaVer] = useState<Certificacion | null>(null);

  useEffect(() => {
    async function cargar() {
      if (!id) return;
      setCargando(true);
      setErrorCarga(null);
      try {
        const datos = await obtenerOfertaPorId(Number(id));
        setOferta(datos);

        if (token && datos.productor_id) {
          try {
            const perfilProd = await obtenerProductor(datos.productor_id, token);
            setProductor(perfilProd);
          } catch {
            // Se continúa con los datos embebidos en oferta
          }
        }
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
  }, [id, token]);

  if (cargando) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#EEF4EF]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#1F6B45] border-t-transparent animate-spin" />
          <span className="text-xs text-[#5B6B63] font-medium">Cargando detalles de la oferta…</span>
        </div>
      </div>
    );
  }

  if (errorCarga || !oferta) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center p-6 bg-[#EEF4EF]">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full border border-slate-200 text-center flex flex-col items-center gap-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="font-titulo text-xl text-[#14221B]">No pudimos encontrar la oferta</h2>
          <p className="text-xs text-[#5B6B63] leading-relaxed">{errorCarga || 'La oferta no existe o ha sido eliminada.'}</p>
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

  // Cálculos de tramos según backend (40% / 30% / 30%)
  const montoTotal = oferta.precio_final_usdc;
  const tramo1Monto = Math.round(montoTotal * 0.4 * 1000000) / 1000000;
  const tramo2Monto = Math.round(montoTotal * 0.3 * 1000000) / 1000000;
  const tramo3Monto = Math.round(montoTotal * 0.3 * 1000000) / 1000000;

  const esProductorDeEstaOferta = usuario?.id === oferta.productor_id;
  const esComprador = perfilActivo === 'comprador';
  const estaAbierta = oferta.estado === 'abierta';

  // Fotos reales o ilustrativa
  const fotosReales = Array.isArray(oferta.fotos) && oferta.fotos.length > 0 ? oferta.fotos : [];
  const tieneFotosReales = fotosReales.length > 0;
  const fotoPrincipal = tieneFotosReales
    ? urlArchivo(fotosReales[fotoActiva] || fotosReales[0])
    : obtenerRutaFoto(oferta.cultivo);

  // Datos del productor
  const nombreProductor = productor?.nombre || oferta.productor_nombre || 'Productor MinKa';
  const deptoProductor = productor?.departamento || oferta.departamento || '';
  const fotoPerfilProductor = productor?.foto_perfil || oferta.productor_foto;
  const contratosCumplidos = productor?.contratos_cumplidos ?? 0;
  const whatsappProductor = productor?.whatsapp || oferta.productor_whatsapp;

  // Mensaje para WhatsApp
  const mensajeWhatsApp = encodeURIComponent(
    `Hola, vi tu oferta de ${oferta.cultivo} en MinKa y quisiera hacerte una consulta.`
  );

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

        <div className="relative z-10 max-w-[1050px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <button
              type="button"
              onClick={() => navigate('/mercado')}
              className="interaccion-tactil inline-flex items-center gap-2 text-xs font-semibold text-emerald-200/90 hover:text-white py-1 px-2.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors cursor-pointer mb-2.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Volver al Mercado</span>
            </button>
            <h1 className="font-titulo text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
              {oferta.cultivo}
            </h1>
            <p className="text-xs sm:text-sm text-emerald-100/80 mt-1 max-w-xl">
              {oferta.provincia && oferta.departamento ? `${oferta.provincia}, ${oferta.departamento}` : oferta.ubicacion}
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 text-left sm:text-right">
              <span className="text-[10px] uppercase font-bold text-emerald-300/80 block">
                Precio preventa
              </span>
              <span className="font-titulo text-sm sm:text-base font-extrabold text-[#FF8A3D] cifra-tabular">
                {formatearUsdc(oferta.precio_final_usdc)}
              </span>
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-xl bg-white/10 text-emerald-200 border border-white/15 backdrop-blur-md">
              #{oferta.id}
            </span>
          </div>
        </div>
      </section>

      <div className="max-w-[1050px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* Contenedor Principal (Grid en escritorio, columna en móvil) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
          
          {/* Columna Izquierda: Galería e Información Completa */}
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* ══════════════════════════════════════════════════════════
                GALERÍA: FOTO PRINCIPAL + MINIATURAS (DESLIZABLE EN MÓVIL)
                ══════════════════════════════════════════════════════════ */}
            <div className="flex flex-col gap-2.5">
              <div className="relative h-64 sm:h-84 w-full rounded-3xl overflow-hidden bg-[#0A2E1F]/10 border border-slate-200/80 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.06)]">
                {fotoPrincipal ? (
                  <img
                    src={fotoPrincipal}
                    alt={oferta.cultivo}
                    className="w-full h-full object-cover transition-all duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-[#0A2E1F] via-[#103D2E] to-[#1F6B45] text-white p-6">
                    <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mb-3">
                      <Sprout className="w-8 h-8 text-[#8CD6A8]" />
                    </div>
                    <span className="font-titulo text-xl text-white font-bold">{oferta.cultivo}</span>
                    <span className="text-xs text-emerald-200 mt-1">Cosecha en preventa</span>
                  </div>
                )}

                {/* Insignia de descuento flotante */}
                <div className="absolute top-4 right-4 bg-[#EA580C] text-white font-titulo font-bold text-xs sm:text-sm px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4" />
                  <span>{oferta.porcentaje_descuento}% descuento</span>
                </div>

                {/* Rótulo de foto ilustrativa si no tiene fotos reales */}
                {!tieneFotosReales && (
                  <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-xs text-white text-[11px] font-medium px-3 py-1 rounded-full">
                    Foto ilustrativa
                  </div>
                )}
              </div>

              {/* Tira de miniaturas (deslizable horizontalmente en móvil) */}
              {tieneFotosReales && fotosReales.length > 1 && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
                  {fotosReales.map((ruta, idx) => (
                    <button
                      key={`${ruta}-${idx}`}
                      type="button"
                      onClick={() => setFotoActiva(idx)}
                      className={`interaccion-tactil shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        fotoActiva === idx
                          ? 'border-[#1F6B45] ring-2 ring-emerald-500/30 scale-102'
                          : 'border-slate-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img
                        src={urlArchivo(ruta)}
                        alt={`Miniatura ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════
                INFORMACIÓN AGRÍCOLA COMPLETA
                ══════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-6">
              
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-titulo text-2xl sm:text-3xl text-[#14221B] font-bold">
                    {oferta.cultivo}
                  </h1>
                  {oferta.variedad && (
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-[#1F6B45] border border-emerald-200/60">
                      Variedad: {oferta.variedad}
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-[#5B6B63] mt-1.5 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-[#1F6B45] shrink-0" />
                  <span className="font-medium text-[#14221B]">{oferta.ubicacion}</span>
                </p>

                {/* Línea discreta "Por {nombreProductor}" con calificación */}
                <div className="flex items-center gap-1.5 flex-wrap mt-2 text-xs">
                  <span className="text-[#5B6B63] font-medium">
                    Por {nombreProductor}
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

              {/* Descripción */}
              {oferta.descripcion && (
                <div className="bg-[#F8FAFC] rounded-2xl p-4 sm:p-5 border border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45] block mb-1.5">
                    Descripción del cultivo
                  </span>
                  <p className="text-xs sm:text-sm text-[#14221B] leading-relaxed whitespace-pre-line">
                    {oferta.descripcion}
                  </p>
                </div>
              )}

              {/* Ficha técnica en rejilla */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 pt-1">
                <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-slate-100">
                  <span className="text-[10px] font-bold text-[#5B6B63] uppercase block">
                    Cantidad total
                  </span>
                  <span className="font-cifras font-bold text-base sm:text-lg text-[#14221B] mt-0.5 block">
                    {formatearKg(oferta.cantidad_kg)}
                  </span>
                </div>

                <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-slate-100">
                  <span className="text-[10px] font-bold text-[#5B6B63] uppercase block">
                    Fecha de entrega
                  </span>
                  <span className="font-medium text-xs sm:text-sm text-[#14221B] mt-0.5 block truncate">
                    {formatearFecha(oferta.fecha_entrega)}
                  </span>
                </div>

                {oferta.superficie_ha && (
                  <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-slate-100">
                    <span className="text-[10px] font-bold text-[#5B6B63] uppercase block">
                      Superficie
                    </span>
                    <span className="font-cifras font-bold text-base sm:text-lg text-[#14221B] mt-0.5 block">
                      {oferta.superficie_ha} ha
                    </span>
                  </div>
                )}

                {oferta.fecha_siembra && (
                  <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-slate-100">
                    <span className="text-[10px] font-bold text-[#5B6B63] uppercase block">
                      Fecha de siembra
                    </span>
                    <span className="font-medium text-xs sm:text-sm text-[#14221B] mt-0.5 block truncate">
                      {formatearFecha(oferta.fecha_siembra)}
                    </span>
                  </div>
                )}

                <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-slate-100">
                  <span className="text-[10px] font-bold text-[#5B6B63] uppercase block">
                    Forma de entrega
                  </span>
                  <span className="font-semibold text-xs text-[#14221B] mt-0.5 block capitalize">
                    {oferta.forma_entrega === 'retiro_en_finca'
                      ? 'Retiro en finca'
                      : oferta.forma_entrega === 'entrega_en_ciudad'
                      ? 'Entrega en ciudad'
                      : 'A convenir'}
                  </span>
                </div>

                {oferta.lugar_entrega && (
                  <div className="bg-[#F8FAFC] rounded-xl p-3.5 border border-slate-100 col-span-2 sm:col-span-1">
                    <span className="text-[10px] font-bold text-[#5B6B63] uppercase block">
                      Punto acordado
                    </span>
                    <span className="font-medium text-xs text-[#14221B] mt-0.5 block truncate" title={oferta.lugar_entrega}>
                      {oferta.lugar_entrega}
                    </span>
                  </div>
                )}
              </div>

              {/* Prácticas de cultivo */}
              {oferta.practicas_cultivo && (
                <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#5B6B63]">
                    Prácticas de cultivo y manejo
                  </span>
                  <p className="text-xs text-[#14221B] leading-relaxed">
                    {oferta.practicas_cultivo}
                  </p>
                </div>
              )}

              {/* Certificaciones declaradas por el productor (Prompt 8.6 B2) */}
              {oferta.certificaciones && oferta.certificaciones.length > 0 && (
                <div className="flex flex-col gap-3 pt-3 border-t border-slate-100">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-[#1F6B45]" />
                      <h3 className="font-titulo text-sm font-bold text-[#14221B]">
                        Certificaciones declaradas por el productor
                      </h3>
                    </div>
                    <span className="text-[10px] text-[#5B6B63] font-medium bg-slate-100 px-2 py-0.5 rounded self-start sm:self-auto">
                      {oferta.certificaciones.length} {oferta.certificaciones.length === 1 ? 'declarada' : 'declaradas'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {oferta.certificaciones.map((cert, idx) => {
                      const nombreCert =
                        cert.tipo === 'otra'
                          ? cert.nombre_otra || 'Otra certificación'
                          : cert.tipo === 'organico'
                          ? 'Orgánico o ecológico'
                          : cert.tipo === 'comercio_justo'
                          ? 'Comercio justo'
                          : cert.tipo === 'buenas_practicas'
                          ? 'Buenas prácticas agrícolas'
                          : cert.tipo === 'sanitario'
                          ? 'Certificado sanitario'
                          : cert.tipo;

                      return (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-[#EEF4EF]/60 border border-slate-200/80 shadow-2xs flex flex-col justify-between gap-2.5"
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center shrink-0 mt-0.5">
                              <ShieldCheck className="w-4 h-4" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-[#14221B] truncate">
                                {nombreCert}
                              </span>
                              {cert.entidad && (
                                <span className="text-[11px] text-[#5B6B63] mt-0.5 truncate">
                                  Entidad: <span className="font-medium text-[#14221B]">{cert.entidad}</span>
                                </span>
                              )}
                            </div>
                          </div>

                          {cert.documento && (
                            <div className="pt-2 border-t border-slate-200/60 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setCertificadoParaVer(cert)}
                                className="interaccion-tactil inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B45] hover:text-[#0A2E1F] hover:underline cursor-pointer"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                <span>Ver certificado</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Nota fija honesta obligatoria */}
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-[#5B6B63] flex items-center gap-2">
                    <Info className="w-3.5 h-3.5 text-[#5B6B63] shrink-0" />
                    <span>Información declarada por el productor. MinKa aún no la verifica.</span>
                  </div>
                </div>
              )}

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
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#10482E] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
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
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/70">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#1F6B45] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
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
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/30 border border-emerald-100/50">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full bg-[#349666] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
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

          {/* Columna Derecha: Tarjeta de Precio + Tarjeta del Productor y Contacto */}
          <div className="lg:col-span-5 flex flex-col gap-5 sticky top-24">
            
            {/* TARJETA DE PRECIO Y COMPRA */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.06)] flex flex-col gap-6">
              
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#5B6B63] uppercase tracking-wider">
                  Precio de preventa
                </span>
                
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="font-cifras font-bold text-3xl sm:text-4xl text-[#EA580C]">
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

            {/* ══════════════════════════════════════════════════════════
                TARJETA DEL PRODUCTOR Y CONTACTO (Prompt 7 B5)
                ══════════════════════════════════════════════════════════ */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-4">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45]">
                Productor
              </span>

              <div className="flex items-center gap-3.5">
                {fotoPerfilProductor ? (
                  <img
                    src={urlArchivo(fotoPerfilProductor)}
                    alt={nombreProductor}
                    className="w-13 h-13 rounded-2xl object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-13 h-13 rounded-2xl bg-[#0A2E1F] text-white flex items-center justify-center font-titulo text-lg font-bold shrink-0">
                    {nombreProductor.charAt(0).toUpperCase()}
                  </div>
                )}

                <div className="flex flex-col min-w-0">
                  <span className="font-titulo text-base font-bold text-[#14221B] truncate">
                    {nombreProductor}
                  </span>
                  {deptoProductor && (
                    <span className="text-xs text-[#5B6B63] flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-[#1F6B45]" />
                      <span>{deptoProductor}</span>
                    </span>
                  )}
                  {/* Calificación con enlace a su perfil */}
                  <Link
                    to={`/productor/${oferta.productor_id}`}
                    className="inline-flex items-center gap-1 text-xs mt-0.5 hover:underline text-[#14221B]"
                  >
                    {oferta.productor_calificacion_promedio !== null && oferta.productor_calificacion_promedio !== undefined ? (
                      <span className="font-bold flex items-center gap-1">
                        <span className="text-amber-500">★</span>
                        <span>{formatearDecimal(oferta.productor_calificacion_promedio)}</span>
                        <span className="font-normal text-[#5B6B63]">
                          · {oferta.productor_resenas_cantidad} {oferta.productor_resenas_cantidad === 1 ? 'reseña' : 'reseñas'}
                        </span>
                      </span>
                    ) : (
                      <span className="text-[#5B6B63]">Sin reseñas aún</span>
                    )}
                  </Link>
                  <span className="text-[11px] text-[#1F6B45] font-semibold flex items-center gap-1 mt-0.5">
                    <Award className="w-3 h-3" />
                    <span>{contratosCumplidos} contrato{contratosCumplidos === 1 ? '' : 's'} cumplido{contratosCumplidos === 1 ? '' : 's'}</span>
                  </span>
                </div>
              </div>

              {/* Botón Ver perfil */}
              <button
                type="button"
                onClick={() => navigate(`/productor/${oferta.productor_id}`)}
                className="interaccion-tactil w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <User className="w-3.5 h-3.5" />
                <span>Ver perfil público</span>
              </button>

              {/* Botón secundario: WhatsApp */}
              {whatsappProductor ? (
                <a
                  href={`https://wa.me/${whatsappProductor}?text=${mensajeWhatsApp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="interaccion-tactil w-full py-2.5 px-4 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-[#1F6B45] border border-emerald-200/80 font-titulo font-bold text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-emerald-600" />
                  <span>Consultar por WhatsApp</span>
                </a>
              ) : (
                <div className="text-xs text-[#5B6B63] bg-slate-50 p-2.5 rounded-xl border border-slate-100 text-center">
                  Este productor aún no agregó un contacto
                </div>
              )}

              {/* Nota de seguridad obligatoria */}
              <p className="text-[11px] text-[#5B6B63] leading-relaxed text-center border-t border-slate-100 pt-3">
                Acuerda los pagos solo dentro de MinKa: así tu dinero queda protegido.
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL DE CONFIRMACIÓN DE COMPRA
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

      {/* Modal para visualizar el certificado (Prompt 8.6 B2) */}
      {certificadoParaVer && certificadoParaVer.documento && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-slate-100 shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-[#1F6B45]" />
                <h3 className="font-titulo text-base font-bold text-[#14221B]">
                  {certificadoParaVer.tipo === 'otra'
                    ? certificadoParaVer.nombre_otra || 'Certificado'
                    : certificadoParaVer.tipo === 'organico'
                    ? 'Orgánico o ecológico'
                    : certificadoParaVer.tipo === 'comercio_justo'
                    ? 'Comercio justo'
                    : certificadoParaVer.tipo === 'buenas_practicas'
                    ? 'Buenas prácticas agrícolas'
                    : certificadoParaVer.tipo === 'sanitario'
                    ? 'Certificado sanitario'
                    : 'Certificado'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setCertificadoParaVer(null)}
                className="interaccion-tactil w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-[#5B6B63] transition-colors cursor-pointer"
                aria-label="Cerrar vista de certificado"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {certificadoParaVer.entidad && (
              <span className="text-xs text-[#5B6B63]">
                Entidad declarada: <strong className="text-[#14221B]">{certificadoParaVer.entidad}</strong>
              </span>
            )}

            <div className="relative rounded-2xl overflow-hidden bg-slate-100 max-h-[60vh] flex items-center justify-center border border-slate-200">
              <img
                src={urlArchivo(certificadoParaVer.documento)}
                alt="Documento del certificado"
                className="max-h-[55vh] w-auto object-contain"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-[#5B6B63]">
                Documento aportado por el productor
              </span>
              <a
                href={urlArchivo(certificadoParaVer.documento)}
                target="_blank"
                rel="noopener noreferrer"
                className="interaccion-tactil inline-flex items-center gap-1.5 text-xs font-semibold text-[#1F6B45] hover:underline"
              >
                <span>Abrir en pestaña nueva</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

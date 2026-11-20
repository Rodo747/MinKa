/**
 * MiCuenta.tsx — Pantalla de gestión personal ("/mi-cuenta").
 * Contiene pestañas para Contratos, Saldo y Datos.
 * - Contratos: listado y línea de tiempo vertical de 3 tramos con evidencia y aprobación.
 * - Saldo: consulta de saldo Horizon, recarga de prueba, retiro de USDC y movimientos.
 * - Datos: información real de perfil, billetera Stellar e historial de cumplimiento.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  FileText,
  Wallet,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Upload,
  Check,
  AlertTriangle,
  ArrowLeft,
  Loader2,
  ChevronRight,
  Store,
  Clock,
  ShieldCheck,
  Calendar,
  Lock,
  Copy,
  ArrowDownLeft,
  ArrowUpRight,
  Send,
  Award,
  Sparkles,
} from 'lucide-react';
import {
  obtenerContratos,
  obtenerContratoPorId,
  subirEvidenciaTramo,
  aprobarTramo,
  reportarEmergencia,
  obtenerSaldo,
  obtenerMovimientos,
  recargarSaldo,
  retirarSaldo,
  type ContratoResumen,
  type DetalleContratoRespuesta,
  type Tramo,
  type SaldoCuenta,
  type MovimientoPago,
} from '../api';
import { formatearUsdc, formatearFecha } from '../componentes/TarjetaOferta';
import { usarSesion } from '../sesion';

type PestanaMiCuenta = 'contratos' | 'saldo' | 'datos';

const TIPOS_DESASTRE = [
  { id: 'helada', etiqueta: 'Helada' },
  { id: 'sequía', etiqueta: 'Sequía' },
  { id: 'inundación', etiqueta: 'Inundación' },
  { id: 'granizada', etiqueta: 'Granizada' },
  { id: 'vientos_fuertes', etiqueta: 'Vientos fuertes / Granizo' },
];

function abreviarDireccion(dir?: string): string {
  if (!dir) return '';
  if (dir.length <= 12) return dir;
  return `${dir.slice(0, 6)}...${dir.slice(-6)}`;
}

export const MiCuenta: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { usuario, token, perfilActivo } = usarSesion();

  const pestanaParam = searchParams.get('pestana');
  const contratoIdUrl = searchParams.get('contrato');

  // Si hay un contrato seleccionado o si pestana es 'contratos' o default, abre contratos.
  const pestanaActiva: PestanaMiCuenta = contratoIdUrl
    ? 'contratos'
    : pestanaParam === 'saldo' || pestanaParam === 'datos'
    ? pestanaParam
    : 'contratos';

  // Estados de la lista de contratos
  const [contratos, setContratos] = useState<ContratoResumen[]>([]);
  const [cargandoLista, setCargandoLista] = useState(true);
  const [errorLista, setErrorLista] = useState<string | null>(null);

  // Estados del detalle de contrato seleccionado
  const [detalle, setDetalle] = useState<DetalleContratoRespuesta | null>(null);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  // Estados de Saldo y Movimientos
  const [saldo, setSaldo] = useState<SaldoCuenta | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoPago[]>([]);
  const [cargandoSaldo, setCargandoSaldo] = useState(false);
  const [cargandoMovimientos, setCargandoMovimientos] = useState(false);

  // Operaciones de Saldo (Recargar y Retirar)
  const [cargandoRecarga, setCargandoRecarga] = useState(false);
  const [exitoRecarga, setExitoRecarga] = useState<{ hash: string; monto: number } | null>(null);
  const [errorRecarga, setErrorRecarga] = useState<string | null>(null);

  const [direccionRetiro, setDireccionRetiro] = useState('');
  const [montoRetiro, setMontoRetiro] = useState('');
  const [modalRetiroAbierto, setModalRetiroAbierto] = useState(false);
  const [cargandoRetiro, setCargandoRetiro] = useState(false);
  const [exitoRetiro, setExitoRetiro] = useState<{ hash: string; monto: number } | null>(null);
  const [errorRetiro, setErrorRetiro] = useState<string | null>(null);

  // Portapapeles
  const [copiadoDireccion, setCopiadoDireccion] = useState(false);

  // Modales y acciones operativas de contratos
  const [tramoParaEvidencia, setTramoParaEvidencia] = useState<Tramo | null>(null);
  const [urlEvidenciaInput, setUrlEvidenciaInput] = useState('');
  const [tramoParaAprobar, setTramoParaAprobar] = useState<Tramo | null>(null);
  const [modalEmergenciaAbierto, setModalEmergenciaAbierto] = useState(false);

  // Formulario de emergencia
  const [motivoEmergencia, setMotivoEmergencia] = useState(TIPOS_DESASTRE[0].id);
  const [descripcionEmergencia, setDescripcionEmergencia] = useState('');
  const [urlEvidenciaEmergencia, setUrlEvidenciaEmergencia] = useState('');
  const [montoEmergencia, setMontoEmergencia] = useState('');

  // Acciones en curso de contratos
  const [accionEnCurso, setAccionEnCurso] = useState(false);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);
  const [exitoAccion, setExitoAccion] = useState<string | null>(null);

  // Carga de la lista de contratos del perfil activo
  const cargarContratos = useCallback(async () => {
    if (!token) return;
    setCargandoLista(true);
    setErrorLista(null);
    try {
      const datos = await obtenerContratos(perfilActivo, token);
      setContratos(datos);
    } catch (err) {
      if (err instanceof Error) {
        setErrorLista(err.message);
      } else {
        setErrorLista('No se pudieron obtener los contratos.');
      }
    } finally {
      setCargandoLista(false);
    }
  }, [token, perfilActivo]);

  // Carga del detalle del contrato seleccionado
  const cargarDetalleContrato = useCallback(async (id: number) => {
    if (!token) return;
    setCargandoDetalle(true);
    setErrorDetalle(null);
    try {
      const res = await obtenerContratoPorId(id, token);
      setDetalle(res);
    } catch (err) {
      if (err instanceof Error) {
        setErrorDetalle(err.message);
      } else {
        setErrorDetalle('No se pudo cargar el detalle del contrato.');
      }
    } finally {
      setCargandoDetalle(false);
    }
  }, [token]);

  // Carga de saldo de la cuenta
  const cargarSaldoCuenta = useCallback(async () => {
    if (!token) return;
    setCargandoSaldo(true);
    try {
      const res = await obtenerSaldo(token);
      setSaldo(res);
    } catch {
      // Ignorar fallos transitorios
    } finally {
      setCargandoSaldo(false);
    }
  }, [token]);

  // Carga de movimientos de la cuenta
  const cargarMovimientosCuenta = useCallback(async () => {
    if (!token) return;
    setCargandoMovimientos(true);
    try {
      const res = await obtenerMovimientos(token);
      setMovimientos(res);
    } catch {
      // Ignorar fallos transitorios
    } finally {
      setCargandoMovimientos(false);
    }
  }, [token]);

  // Efecto inicial y recarga al reenfocar la ventana
  useEffect(() => {
    cargarContratos();
    cargarSaldoCuenta();
    cargarMovimientosCuenta();

    function alEnfocarVentana() {
      cargarContratos();
      cargarSaldoCuenta();
      cargarMovimientosCuenta();
      if (contratoIdUrl) {
        cargarDetalleContrato(Number(contratoIdUrl));
      }
    }

    window.addEventListener('focus', alEnfocarVentana);
    return () => window.removeEventListener('focus', alEnfocarVentana);
  }, [cargarContratos, contratoIdUrl, cargarDetalleContrato, cargarSaldoCuenta, cargarMovimientosCuenta]);

  // Cargar detalle si la URL tiene ?contrato=ID
  useEffect(() => {
    if (contratoIdUrl) {
      cargarDetalleContrato(Number(contratoIdUrl));
    } else {
      setDetalle(null);
    }
  }, [contratoIdUrl, cargarDetalleContrato]);

  // Copiar dirección Stellar
  const copiarTexto = (texto: string) => {
    navigator.clipboard.writeText(texto);
    setCopiadoDireccion(true);
    setTimeout(() => setCopiadoDireccion(false), 2000);
  };

  // Manejador de Recarga de Prueba (POST /cuenta/recargar)
  const handleRecargarPrueba = async () => {
    if (!token) return;
    setCargandoRecarga(true);
    setErrorRecarga(null);
    setExitoRecarga(null);
    try {
      const res = await recargarSaldo(token);
      setExitoRecarga({ hash: res.hash, monto: res.monto_usdc });
      await cargarSaldoCuenta();
      await cargarMovimientosCuenta();
    } catch (err) {
      if (err instanceof Error) {
        setErrorRecarga(err.message);
      } else {
        setErrorRecarga('No se pudo procesar la recarga de prueba.');
      }
    } finally {
      setCargandoRecarga(false);
    }
  };

  // Manejador de Retiro de Fondos (POST /cuenta/retirar)
  const handleConfirmarRetiro = async () => {
    if (!token) return;
    const montoNum = parseFloat(montoRetiro);
    if (!montoNum || montoNum <= 0) {
      setErrorRetiro('El monto debe ser mayor a cero.');
      return;
    }

    setCargandoRetiro(true);
    setErrorRetiro(null);
    try {
      const res = await retirarSaldo(direccionRetiro.trim(), montoNum, token);
      setExitoRetiro({ hash: res.hash, monto: res.monto_usdc });
      setModalRetiroAbierto(false);
      setDireccionRetiro('');
      setMontoRetiro('');
      await cargarSaldoCuenta();
      await cargarMovimientosCuenta();
    } catch (err) {
      if (err instanceof Error) {
        setErrorRetiro(err.message);
      } else {
        setErrorRetiro('Ocurrió un error al procesar el retiro en Stellar.');
      }
    } finally {
      setCargandoRetiro(false);
    }
  };

  // Manejo de subida de evidencia (Productor)
  const handleSubirEvidencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tramoParaEvidencia || !token) return;

    if (!urlEvidenciaInput.trim().startsWith('http://') && !urlEvidenciaInput.trim().startsWith('https://')) {
      setErrorAccion('Ingresa una URL válida (ej.: https://ejemplo.com/acta.jpg)');
      return;
    }

    setAccionEnCurso(true);
    setErrorAccion(null);
    try {
      await subirEvidenciaTramo(tramoParaEvidencia.id, urlEvidenciaInput.trim(), token);
      setExitoAccion('Evidencia registrada exitosamente en Stellar.');
      setTramoParaEvidencia(null);
      setUrlEvidenciaInput('');
      if (contratoIdUrl) {
        await cargarDetalleContrato(Number(contratoIdUrl));
      }
      await cargarContratos();
    } catch (err) {
      if (err instanceof Error) {
        setErrorAccion(err.message);
      } else {
        setErrorAccion('Error al subir evidencia a Stellar.');
      }
    } finally {
      setAccionEnCurso(false);
    }
  };

  // Manejo de aprobación de tramo (Comprador)
  const handleAprobarTramo = async () => {
    if (!tramoParaAprobar || !token) return;

    setAccionEnCurso(true);
    setErrorAccion(null);
    try {
      await aprobarTramo(tramoParaAprobar.id, token);
      setExitoAccion('Tramo aprobado y fondos liberados en Stellar.');
      setTramoParaAprobar(null);
      if (contratoIdUrl) {
        await cargarDetalleContrato(Number(contratoIdUrl));
      }
      await cargarContratos();
    } catch (err) {
      if (err instanceof Error) {
        setErrorAccion(err.message);
      } else {
        setErrorAccion('Error al aprobar el tramo en Stellar.');
      }
    } finally {
      setAccionEnCurso(false);
    }
  };

  // Manejo de reporte de emergencia (Productor)
  const handleReportarEmergencia = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detalle || !token) return;

    if (!urlEvidenciaEmergencia.trim().startsWith('http://') && !urlEvidenciaEmergencia.trim().startsWith('https://')) {
      setErrorAccion('Ingresa una URL válida para la evidencia de emergencia.');
      return;
    }

    const montoNum = parseFloat(montoEmergencia) || detalle.contrato.monto_total_usdc;
    if (montoNum <= 0) {
      setErrorAccion('El monto solicitado debe ser mayor a cero.');
      return;
    }

    setAccionEnCurso(true);
    setErrorAccion(null);
    try {
      const motivoCompleto = descripcionEmergencia.trim()
        ? `${motivoEmergencia}: ${descripcionEmergencia.trim()}`
        : motivoEmergencia;

      await reportarEmergencia(
        {
          contrato_id: detalle.contrato.id,
          motivo: motivoCompleto,
          url_evidencia: urlEvidenciaEmergencia.trim(),
          monto_solicitado_usdc: montoNum,
        },
        token
      );

      setExitoAccion('Emergencia reportada. Contrato puesto en disputa para revisión.');
      setModalEmergenciaAbierto(false);
      setDescripcionEmergencia('');
      setUrlEvidenciaEmergencia('');
      if (contratoIdUrl) {
        await cargarDetalleContrato(Number(contratoIdUrl));
      }
      await cargarContratos();
    } catch (err) {
      if (err instanceof Error) {
        setErrorAccion(err.message);
      } else {
        setErrorAccion('Error al reportar emergencia.');
      }
    } finally {
      setAccionEnCurso(false);
    }
  };

  // Etiquetas de estado de contrato
  const obtenerEtiquetaEstado = (estado: string) => {
    switch (estado) {
      case 'activo':
        return { texto: 'Activo', clases: 'bg-emerald-50 text-[#1F6B45] border-emerald-200' };
      case 'pendiente_fondeo':
        return { texto: 'Pendiente de fondeo', clases: 'bg-amber-50 text-[#E0A100] border-amber-200' };
      case 'en_disputa':
        return { texto: 'En disputa', clases: 'bg-orange-50 text-[#EA580C] border-orange-200' };
      case 'completado':
        return { texto: 'Completado', clases: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'resuelto_emergencia':
        return { texto: 'Resuelto por emergencia', clases: 'bg-purple-50 text-purple-700 border-purple-200' };
      default:
        return { texto: estado, clases: 'bg-slate-50 text-slate-700 border-slate-200' };
    }
  };

  // Etiquetas de estado de tramo
  const obtenerEtiquetaTramo = (t: Tramo) => {
    if (t.estado === 'liberado') {
      if (t.numero_tramo === 1) {
        return { texto: 'Cobrado hoy', clases: 'bg-emerald-50 text-[#1F6B45] border-emerald-200' };
      }
      return { texto: 'Liberado', clases: 'bg-emerald-50 text-[#1F6B45] border-emerald-200' };
    }
    if (t.estado === 'en_revision') {
      return { texto: 'En revisión', clases: 'bg-amber-50 text-[#E0A100] border-amber-200' };
    }
    if (t.estado === 'reembolsado') {
      return { texto: 'Reembolsado al comprador', clases: 'bg-purple-50 text-purple-700 border-purple-200' };
    }
    return { texto: 'Pendiente', clases: 'bg-slate-50 text-[#5B6B63] border-slate-200' };
  };

  const direccionStellarUsuario = usuario?.direccion_stellar || saldo?.direccion || '';

  return (
    <div className="w-full bg-[#F8FAFC] min-h-[calc(100vh-80px)] pb-24 md:pb-12">
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        
        {/* ══════════════════════════════════════════════════════════
            ENCABEZADO DE USUARIO Y PESTAÑAS
            ══════════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#0A2E1F] text-white flex items-center justify-center font-titulo text-lg font-bold shadow-sm">
              {usuario?.nombre?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <h1 className="font-titulo text-xl sm:text-2xl text-[#14221B] font-bold">
                {usuario?.nombre || 'Mi cuenta'}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-[#5B6B63]">
                  @{usuario?.nombre_usuario || 'usuario'}
                </span>
                <span className="text-[10px] text-slate-300">•</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45] bg-emerald-50 px-2 py-0.5 rounded-md">
                  Perfil: {perfilActivo === 'productor' ? 'Productor' : 'Comprador'}
                </span>
              </div>
            </div>
          </div>

          {/* Pestañas Internas */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-2xl shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSearchParams({ pestana: 'contratos' })}
              className={`interaccion-tactil px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                pestanaActiva === 'contratos'
                  ? 'bg-white text-[#14221B] shadow-sm'
                  : 'text-[#5B6B63] hover:text-[#14221B]'
              }`}
            >
              Contratos
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchParams({ pestana: 'saldo' });
                cargarSaldoCuenta();
                cargarMovimientosCuenta();
              }}
              className={`interaccion-tactil px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                pestanaActiva === 'saldo'
                  ? 'bg-white text-[#14221B] shadow-sm'
                  : 'text-[#5B6B63] hover:text-[#14221B]'
              }`}
            >
              Saldo
            </button>
            <button
              type="button"
              onClick={() => setSearchParams({ pestana: 'datos' })}
              className={`interaccion-tactil px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                pestanaActiva === 'datos'
                  ? 'bg-white text-[#14221B] shadow-sm'
                  : 'text-[#5B6B63] hover:text-[#14221B]'
              }`}
            >
              Datos
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════
            PESTAÑA: SALDO (B1)
            ══════════════════════════════════════════════════════════ */}
        {pestanaActiva === 'saldo' && (
          <div className="flex flex-col gap-6">
            
            {/* Tarjeta de Saldo Principal */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#5B6B63] uppercase tracking-wider">
                  Saldo disponible en Stellar
                </span>
                <div className="flex items-baseline gap-3 mt-1">
                  <span className="font-cifras font-bold text-4xl sm:text-5xl text-[#14221B]">
                    {formatearUsdc(saldo?.saldo_usdc || 0)}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[#5B6B63] mt-2">
                  <span className="font-mono bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-lg">
                    {abreviarDireccion(direccionStellarUsuario)}
                  </span>
                  <button
                    type="button"
                    onClick={() => copiarTexto(direccionStellarUsuario)}
                    className="interaccion-tactil inline-flex items-center gap-1 text-[#1F6B45] hover:underline font-semibold cursor-pointer"
                  >
                    {copiadoDireccion ? (
                      <span className="text-emerald-600 font-bold">¡Copiado!</span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar dirección</span>
                      </>
                    )}
                  </button>
                  <span className="text-slate-300">•</span>
                  <span className="text-[11px] text-slate-400">
                    {(saldo?.saldo_xlm || 0).toFixed(2)} XLM (comisiones de red)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    cargarSaldoCuenta();
                    cargarMovimientosCuenta();
                  }}
                  disabled={cargandoSaldo}
                  className="interaccion-tactil px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#14221B] hover:bg-slate-50 flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <RefreshCw className={`w-4 h-4 text-[#1F6B45] ${cargandoSaldo ? 'animate-spin' : ''}`} />
                  <span>Actualizar saldo</span>
                </button>
              </div>
            </div>

            {/* Avisos de Recarga */}
            {exitoRecarga && (
              <aside className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Se recargaron {exitoRecarga.monto} USDC de prueba en tu cuenta con éxito.</span>
                </div>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${exitoRecarga.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline flex items-center gap-1 shrink-0"
                >
                  <span>Ver en Stellar Expert</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </aside>
            )}

            {errorRecarga && (
              <aside className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{errorRecarga}</span>
              </aside>
            )}

            {/* Avisos de Retiro */}
            {exitoRetiro && (
              <aside className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Retiro de {exitoRetiro.monto} USDC ejecutado correctamente.</span>
                </div>
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${exitoRetiro.hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline flex items-center gap-1 shrink-0"
                >
                  <span>Ver en Stellar Expert</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </aside>
            )}

            {/* Paneles de Depositar y Retirar */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* PANEL DEPOSITAR */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col justify-between gap-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                      <ArrowDownLeft className="w-4 h-4" />
                    </div>
                    <h3 className="font-titulo text-base font-bold text-[#14221B]">
                      Depositar USDC
                    </h3>
                  </div>

                  <p className="text-xs text-[#5B6B63] leading-relaxed">
                    Envía USDC de la red de pruebas a esta dirección desde cualquier billetera Stellar:
                  </p>

                  <div className="bg-[#F8FAFC] p-3 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-[#14221B] break-all select-all">
                      {direccionStellarUsuario || 'Cargando dirección...'}
                    </span>
                    <button
                      type="button"
                      onClick={() => copiarTexto(direccionStellarUsuario)}
                      className="interaccion-tactil shrink-0 p-2 rounded-lg bg-white border border-slate-200 text-[#1F6B45] hover:bg-slate-50 cursor-pointer shadow-2xs"
                      title="Copiar dirección completa"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Botón de Recarga de Prueba */}
                <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#5B6B63]">¿Sin saldo de prueba?</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#EA580C] bg-[#FFF6E5] px-2 py-0.5 rounded">
                      Red de pruebas
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleRecargarPrueba}
                    disabled={cargandoRecarga}
                    className="interaccion-tactil w-full py-2.5 px-4 rounded-xl bg-[#0A2E1F] hover:bg-[#1F6B45] text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {cargandoRecarga ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Confirmando en Stellar…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-emerald-300" />
                        <span>Recargar saldo de prueba (1 USDC)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* PANEL RETIRAR */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col justify-between gap-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4" />
                    </div>
                    <h3 className="font-titulo text-base font-bold text-[#14221B]">
                      Retirar USDC
                    </h3>
                  </div>

                  {errorRetiro && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                      {errorRetiro}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-bold text-[#14221B]">Dirección de destino Stellar</label>
                      <input
                        type="text"
                        placeholder="G..."
                        value={direccionRetiro}
                        onChange={(e) => setDireccionRetiro(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs font-mono text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[11px] font-bold text-[#14221B]">Monto a retirar (USDC)</label>
                        <button
                          type="button"
                          onClick={() => setMontoRetiro(String(saldo?.saldo_usdc || 0))}
                          className="text-[10px] font-bold text-[#1F6B45] hover:underline cursor-pointer"
                        >
                          Máximo ({formatearUsdc(saldo?.saldo_usdc || 0)})
                        </button>
                      </div>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        placeholder="0.00"
                        value={montoRetiro}
                        onChange={(e) => setMontoRetiro(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs font-cifras text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setErrorRetiro(null);
                        const m = parseFloat(montoRetiro);
                        if (!direccionRetiro.trim()) {
                          setErrorRetiro('Ingresa la dirección Stellar de destino.');
                          return;
                        }
                        if (!m || m <= 0) {
                          setErrorRetiro('Ingresa un monto mayor a cero.');
                          return;
                        }
                        if (m > (saldo?.saldo_usdc || 0)) {
                          setErrorRetiro('El monto supera tu saldo disponible.');
                          return;
                        }
                        setModalRetiroAbierto(true);
                      }}
                      className="interaccion-tactil sombra-naranja-brillo mt-1 w-full py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Retirar fondos</span>
                    </button>
                  </div>
                </div>

                {/* Tarjeta deshabilitada: Retiro a Bolivianos */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200/60 opacity-70">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-[#5B6B63]">Retiro a bolivianos (BOB)</span>
                    <span className="text-[10px] text-slate-400">Transferencia bancaria local instantánea</span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-200/80 px-2 py-0.5 rounded">
                    Próximamente
                  </span>
                </div>
              </div>

            </div>

            {/* LISTA DE MOVIMIENTOS RECIENTES */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#1F6B45]" />
                  <h3 className="font-titulo text-base font-bold text-[#14221B]">
                    Últimos pagos en USDC
                  </h3>
                </div>

                <span className="text-[11px] text-[#5B6B63]">Registro en Horizon</span>
              </div>

              {cargandoMovimientos && (
                <div className="p-8 text-center flex flex-col items-center gap-2">
                  <Loader2 className="w-6 h-6 text-[#1F6B45] animate-spin" />
                  <span className="text-xs text-[#5B6B63]">Consultando pagos en Stellar Horizon…</span>
                </div>
              )}

              {!cargandoMovimientos && movimientos.length === 0 && (
                <div className="p-8 text-center flex flex-col items-center gap-2 border border-dashed border-slate-200 rounded-2xl">
                  <Wallet className="w-8 h-8 text-slate-300" />
                  <span className="text-xs text-[#5B6B63] font-medium">No hay movimientos registrados aún en esta cuenta.</span>
                </div>
              )}

              {!cargandoMovimientos && movimientos.length > 0 && (
                <div className="flex flex-col divide-y divide-slate-100">
                  {movimientos.map((m, idx) => {
                    const esRecibido = m.tipo === 'recibido';
                    return (
                      <div key={`${m.hash}-${idx}`} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            esRecibido ? 'bg-emerald-50 text-[#1F6B45]' : 'bg-orange-50 text-[#EA580C]'
                          }`}>
                            {esRecibido ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                          </div>

                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-[#14221B]">
                                {esRecibido ? 'Pago recibido' : 'Pago enviado'}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.2 rounded ${
                                esRecibido ? 'bg-emerald-50 text-[#1F6B45]' : 'bg-slate-100 text-[#5B6B63]'
                              }`}>
                                {m.tipo}
                              </span>
                            </div>
                            <span className="text-[11px] text-[#5B6B63]">
                              Contraparte: <span className="font-mono text-[#14221B]">{abreviarDireccion(m.contraparte)}</span> • {formatearFecha(m.fecha.split('T')[0])}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pl-11 sm:pl-0">
                          <span className={`font-cifras font-bold text-sm ${esRecibido ? 'text-[#1F6B45]' : 'text-[#14221B]'}`}>
                            {esRecibido ? '+' : '-'}{formatearUsdc(m.monto_usdc)}
                          </span>

                          <a
                            href={`https://stellar.expert/explorer/testnet/tx/${m.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1F6B45] hover:underline"
                          >
                            <span>Ver en Stellar Expert</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            PESTAÑA: DATOS (B2)
            ══════════════════════════════════════════════════════════ */}
        {pestanaActiva === 'datos' && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.06)] flex flex-col gap-6">
            <div>
              <h2 className="font-titulo text-xl sm:text-2xl text-[#14221B] font-bold">
                Datos de la Cuenta
              </h2>
              <p className="text-xs sm:text-sm text-[#5B6B63] mt-1 leading-relaxed">
                Información de tu identidad y billetera verificada en la red Stellar.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#5B6B63] uppercase">Nombre completo</span>
                <span className="font-titulo font-bold text-base text-[#14221B]">{usuario?.nombre || '—'}</span>
              </div>

              <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#5B6B63] uppercase">Nombre de usuario</span>
                <span className="font-mono text-sm font-bold text-[#14221B]">@{usuario?.nombre_usuario || '—'}</span>
              </div>

              <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#5B6B63] uppercase">Perfil activo</span>
                <span className="font-bold text-sm text-[#1F6B45]">
                  {perfilActivo === 'productor' ? 'Productor' : 'Comprador'}
                </span>
              </div>

              <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#5B6B63] uppercase">Perfil por defecto</span>
                <span className="font-bold text-sm text-[#14221B]">
                  {usuario?.perfil_por_defecto === 'comprador' ? 'Comprador' : 'Productor'}
                </span>
              </div>

            </div>

            {/* Dirección Stellar completa con Copiar */}
            <div className="bg-[#F8FAFC] rounded-2xl p-5 border border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#14221B]">Dirección pública en Stellar (Billetera)</span>
                <button
                  type="button"
                  onClick={() => copiarTexto(direccionStellarUsuario)}
                  className="interaccion-tactil inline-flex items-center gap-1.5 text-xs font-bold text-[#1F6B45] hover:underline cursor-pointer"
                >
                  {copiadoDireccion ? (
                    <span className="text-emerald-600">¡Copiado!</span>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copiar</span>
                    </>
                  )}
                </button>
              </div>

              <div className="font-mono text-xs text-[#14221B] break-all bg-white p-3 rounded-xl border border-slate-200 select-all">
                {direccionStellarUsuario || 'No disponible'}
              </div>

              <span className="text-[11px] text-[#5B6B63]">
                Esta es tu dirección pública en la red Stellar Testnet. Tus contratos y pagos se liquidan directamente en esta billetera.
              </span>
            </div>

            {/* Historial de Cumplimiento */}
            <div className="bg-gradient-to-r from-emerald-50/80 via-teal-50/50 to-white rounded-2xl p-6 border border-emerald-100 flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#1F6B45] text-white flex items-center justify-center shrink-0 shadow-sm">
                <Award className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-titulo text-2xl font-bold text-[#14221B]">
                    {usuario?.contratos_cumplidos ?? 0}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1F6B45]">
                    Contratos cumplidos
                  </span>
                </div>
                <p className="text-xs text-[#5B6B63] leading-relaxed">
                  Cada contrato completado suma a tu historial en MinKa, fortaleciendo tu reputación agrícola verificable.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            PESTAÑA: CONTRATOS (VISTA DE LISTA O VISTA DETALLE)
            ══════════════════════════════════════════════════════════ */}
        {pestanaActiva === 'contratos' && (
          <>
            {!contratoIdUrl ? (
              <div className="flex flex-col gap-4">
                
                {/* Barra de acción de la lista */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#1F6B45]" />
                    <h2 className="font-titulo text-base sm:text-lg text-[#14221B] font-bold">
                      {perfilActivo === 'productor' ? 'Mis ventas en preventa' : 'Mis compras protegidas'}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={cargarContratos}
                    disabled={cargandoLista}
                    className="interaccion-tactil inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#5B6B63] hover:text-[#0A2E1F] hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cargandoLista ? 'animate-spin text-[#1F6B45]' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                </div>

                {/* Error de lista */}
                {errorLista && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{errorLista}</span>
                  </div>
                )}

                {/* Esqueleto de carga */}
                {cargandoLista && (
                  <div className="flex flex-col gap-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="bg-white rounded-2xl p-5 border border-slate-100 animate-pulse flex flex-col gap-3">
                        <div className="h-5 bg-slate-200 rounded w-1/4" />
                        <div className="h-4 bg-slate-200 rounded w-1/2" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Estado vacío */}
                {!cargandoLista && contratos.length === 0 && (
                  <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 text-center flex flex-col items-center gap-4 shadow-sm">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 text-[#5B6B63] flex items-center justify-center">
                      <FileText className="w-7 h-7" />
                    </div>
                    <div>
                      <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                        No tienes contratos como {perfilActivo === 'productor' ? 'Productor' : 'Comprador'}
                      </h3>
                      <p className="text-xs text-[#5B6B63] mt-1 max-w-sm mx-auto">
                        {perfilActivo === 'productor'
                          ? 'Aún no se ha fondeado ninguna de tus ofertas de cosecha.'
                          : 'Aún no has comprado ninguna preventa en el catálogo.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/mercado')}
                      className="interaccion-tactil sombra-naranja-brillo mt-2 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs flex items-center gap-2 cursor-pointer"
                    >
                      <Store className="w-4 h-4" />
                      <span>Explorar Mercado</span>
                    </button>
                  </div>
                )}

                {/* Listado de tarjetas de contrato */}
                {!cargandoLista && contratos.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {contratos.map((c) => {
                      const { texto, clases } = obtenerEtiquetaEstado(c.estado);
                      return (
                        <article
                          key={c.id}
                          onClick={() => setSearchParams({ contrato: String(c.id) })}
                          className="interaccion-tactil bg-white rounded-2xl p-5 sm:p-6 border border-slate-100 hover:border-slate-300/80 shadow-[0_4px_16px_-4px_rgba(10,46,31,0.04)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer transition-all group"
                        >
                          <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2.5">
                              <span className="font-titulo text-base sm:text-lg font-bold text-[#14221B] group-hover:text-[#1F6B45] transition-colors">
                                {c.cultivo}
                              </span>
                              <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${clases}`}>
                                {texto}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#5B6B63]">
                              <span>Contrato #{c.id}</span>
                              {c.fecha_entrega && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3.5 h-3.5 text-[#1F6B45]" />
                                  <span>Entrega: {formatearFecha(c.fecha_entrega)}</span>
                                </span>
                              )}
                              {c.tramo_actual && (
                                <span className="text-[#14221B] font-medium bg-slate-100 px-2 py-0.5 rounded">
                                  {c.tramo_actual}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-4 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
                            <div className="flex flex-col sm:text-right">
                              <span className="text-[10px] font-semibold text-[#5B6B63] uppercase">Monto protegido</span>
                              <span className="font-cifras font-bold text-base text-[#14221B]">
                                {formatearUsdc(c.monto_total_usdc)}
                              </span>
                            </div>

                            <div className="w-8 h-8 rounded-full bg-slate-100 group-hover:bg-[#0A2E1F] group-hover:text-white flex items-center justify-center transition-colors">
                              <ChevronRight className="w-4 h-4 text-[#5B6B63] group-hover:text-white" />
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}

              </div>
            ) : (
              /* VISTA DETALLE DEL CONTRATO SELECCIONADO */
              <div className="flex flex-col gap-6">
                
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setSearchParams({ pestana: 'contratos' })}
                    className="interaccion-tactil inline-flex items-center gap-2 text-xs font-semibold text-[#5B6B63] hover:text-[#0A2E1F] py-2 px-3 rounded-lg hover:bg-slate-200/50 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Volver a la lista de contratos</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => cargarDetalleContrato(Number(contratoIdUrl))}
                    disabled={cargandoDetalle}
                    className="interaccion-tactil inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-[#5B6B63] hover:text-[#0A2E1F] hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${cargandoDetalle ? 'animate-spin text-[#1F6B45]' : ''}`} />
                    <span>Actualizar</span>
                  </button>
                </div>

                {exitoAccion && (
                  <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-between gap-3 text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{exitoAccion}</span>
                    </div>
                    <button type="button" onClick={() => setExitoAccion(null)} className="font-bold">×</button>
                  </div>
                )}

                {errorAccion && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-center justify-between gap-3 text-xs text-red-700">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{errorAccion}</span>
                    </div>
                    <button type="button" onClick={() => setErrorAccion(null)} className="font-bold">×</button>
                  </div>
                )}

                {errorDetalle && (
                  <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{errorDetalle}</span>
                  </div>
                )}

                {cargandoDetalle && !detalle && (
                  <div className="bg-white rounded-3xl p-12 text-center flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-[#1F6B45] animate-spin" />
                    <span className="text-xs text-[#5B6B63]">Cargando estado del contrato en Stellar…</span>
                  </div>
                )}

                {detalle && (
                  <div className="flex flex-col gap-6">
                    
                    {detalle.contrato.estado === 'en_disputa' && (
                      <aside className="p-5 rounded-2xl bg-amber-50 border border-amber-300 flex items-start gap-3.5 text-amber-900 shadow-xs">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1">
                          <span className="text-xs sm:text-sm font-bold">
                            Emergencia reportada: la plataforma está revisando la evidencia
                          </span>
                          <span className="text-xs text-amber-800 leading-relaxed">
                            Los desembolsos automáticos han sido congelados. El equipo arbitral de MinKa está verificando el reporte climático para proceder a la resolución.
                          </span>
                          {detalle.reporte_emergencia && (
                            <div className="mt-2 text-xs bg-white/70 p-2.5 rounded-xl border border-amber-200">
                              <span className="font-semibold">Motivo:</span> {detalle.reporte_emergencia.motivo}
                            </div>
                          )}
                        </div>
                      </aside>
                    )}

                    {detalle.contrato.estado === 'resuelto_emergencia' && (
                      <aside className="p-5 rounded-2xl bg-purple-50 border border-purple-200 flex items-start gap-3.5 text-purple-900 shadow-xs">
                        <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col gap-1.5">
                          <span className="text-xs sm:text-sm font-bold">
                            Contrato resuelto por emergencia climática
                          </span>
                          <p className="text-xs text-purple-800 leading-relaxed">
                            El siniestro fue validado. Los tramos no liberados fueron reembolsados directamente al comprador en Stellar, y el productor recibió el auxilio correspondiente desde el Fondo Solidario de Emergencia.
                          </p>
                          {detalle.reporte_emergencia?.enlace_stellar_expert && (
                            <a
                              href={detalle.reporte_emergencia.enlace_stellar_expert}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-700 hover:text-purple-900 underline mt-1"
                            >
                              <span>Ver desembolso del Fondo Solidario en Stellar Expert</span>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                      </aside>
                    )}

                    <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.06)] flex flex-col gap-6">
                      
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                        <div>
                          <div className="flex items-center gap-3">
                            <h2 className="font-titulo text-2xl font-bold text-[#14221B]">
                              {detalle.contrato.cultivo}
                            </h2>
                            <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full border ${obtenerEtiquetaEstado(detalle.contrato.estado).clases}`}>
                              {obtenerEtiquetaEstado(detalle.contrato.estado).texto}
                            </span>
                          </div>
                          <span className="text-xs text-[#5B6B63] mt-1 block">
                            Contrato #{detalle.contrato.id} • Creado el {formatearFecha(detalle.contrato.fecha_creacion.split('T')[0])}
                          </span>
                        </div>

                        <div className="flex flex-col sm:text-right">
                          <span className="text-[11px] font-semibold text-[#5B6B63] uppercase">Monto total</span>
                          <span className="font-cifras font-bold text-2xl text-[#14221B]">
                            {formatearUsdc(detalle.contrato.monto_total_usdc)}
                          </span>
                        </div>
                      </div>

                      {detalle.contrato.enlace_trustless_work && (
                        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-100 text-xs text-[#5B6B63]">
                          <div className="flex items-center gap-2">
                            <Lock className="w-4 h-4 text-[#1F6B45]" />
                            <span>Escrow en Stellar:</span>
                            <span className="font-mono text-[11px] text-[#14221B]">
                              {detalle.contrato.id_contrato_escrow}
                            </span>
                          </div>
                          <a
                            href={detalle.contrato.enlace_trustless_work}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-semibold text-[#1F6B45] hover:underline"
                          >
                            <span>Trustless Work</span>
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      )}

                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <h3 className="font-titulo text-base font-bold text-[#14221B] flex items-center gap-2">
                            <Clock className="w-4 h-4 text-[#1F6B45]" />
                            <span>Tramos del Escrow</span>
                          </h3>
                          
                          {perfilActivo === 'productor' && detalle.contrato.estado === 'activo' && (
                            <button
                              type="button"
                              onClick={() => {
                                setErrorAccion(null);
                                setModalEmergenciaAbierto(true);
                              }}
                              className="interaccion-tactil px-3.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 font-titulo font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                            >
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              <span>Reportar emergencia</span>
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-4 relative pl-4 sm:pl-6 before:absolute before:left-2 sm:before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
                          {detalle.tramos.map((tramo) => {
                            const { texto: textoTramo, clases: clasesTramo } = obtenerEtiquetaTramo(tramo);
                            const esTramoLiberado = tramo.estado === 'liberado';
                            const puedeSubirEvidencia =
                              perfilActivo === 'productor' &&
                              tramo.estado === 'pendiente' &&
                              detalle.contrato.estado === 'activo';
                            const puedeAprobar =
                              perfilActivo === 'comprador' &&
                              tramo.estado === 'en_revision' &&
                              detalle.contrato.estado === 'activo';

                            return (
                              <div
                                key={tramo.id}
                                className="relative bg-[#F8FAFC] rounded-2xl p-4 sm:p-5 border border-slate-200/80 flex flex-col gap-3 shadow-2xs"
                              >
                                <div
                                  className={`absolute -left-[23px] sm:-left-[31px] top-5 w-4 h-4 rounded-full border-2 border-white shadow-xs ${
                                    esTramoLiberado
                                      ? 'bg-[#1F6B45]'
                                      : tramo.estado === 'en_revision'
                                      ? 'bg-[#E0A100]'
                                      : 'bg-slate-300'
                                  }`}
                                />

                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="font-titulo text-sm sm:text-base font-bold text-[#14221B]">
                                      Tramo {tramo.numero_tramo}: {tramo.titulo}
                                    </span>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${clasesTramo}`}>
                                      {textoTramo}
                                    </span>
                                  </div>

                                  <span className="font-cifras font-bold text-sm text-[#14221B]">
                                    {formatearUsdc(tramo.monto_usdc)}
                                  </span>
                                </div>

                                {tramo.url_evidencia && (
                                  <div className="text-xs text-[#5B6B63] flex items-center gap-2 bg-white p-2.5 rounded-xl border border-slate-100">
                                    <span className="font-semibold text-[#14221B]">Evidencia:</span>
                                    {tramo.url_evidencia.startsWith('http') ? (
                                      <a
                                        href={tramo.url_evidencia}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-[#1F6B45] hover:underline flex items-center gap-1 font-mono text-[11px] truncate max-w-[280px] sm:max-w-md"
                                      >
                                        <span>{tramo.url_evidencia}</span>
                                        <ExternalLink className="w-3 h-3 shrink-0" />
                                      </a>
                                    ) : (
                                      <span className="italic text-slate-600">{tramo.url_evidencia}</span>
                                    )}
                                  </div>
                                )}

                                {tramo.hash_transaccion && (
                                  <div className="flex items-center justify-between pt-1 text-[11px]">
                                    <span className="text-[#5B6B63]">Transacción en Stellar:</span>
                                    <a
                                      href={`https://stellar.expert/explorer/testnet/tx/${tramo.hash_transaccion}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 font-semibold text-[#1F6B45] hover:underline"
                                    >
                                      <span>Ver en Stellar Expert</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  </div>
                                )}

                                {puedeSubirEvidencia && (
                                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setErrorAccion(null);
                                        setUrlEvidenciaInput('');
                                        setTramoParaEvidencia(tramo);
                                      }}
                                      className="interaccion-tactil px-4 py-2 rounded-xl bg-[#0A2E1F] hover:bg-[#1F6B45] text-white font-titulo font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                                    >
                                      <Upload className="w-3.5 h-3.5" />
                                      <span>Subir evidencia de avance</span>
                                    </button>
                                  </div>
                                )}

                                {puedeAprobar && (
                                  <div className="pt-2 border-t border-slate-200/60 flex items-center justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setErrorAccion(null);
                                        setTramoParaAprobar(tramo);
                                      }}
                                      className="interaccion-tactil sombra-naranja-brillo px-4 py-2 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                      <span>Aprobar tramo y liberar fondos</span>
                                    </button>
                                  </div>
                                )}

                              </div>
                            );
                          })}
                        </div>
                      </div>

                    </div>
                  </div>
                )}

              </div>
            )}
          </>
        )}

      </div>

      {/* ══════════════════════════════════════════════════════════
          MODAL: CONFIRMACIÓN DE RETIRO (Saldo)
          ══════════════════════════════════════════════════════════ */}
      {modalRetiroAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity duration-200">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                  Confirmar retiro
                </h3>
                <span className="text-[11px] text-[#5B6B63]">
                  Transferencia irreversible en Stellar
                </span>
              </div>
            </div>

            {errorRetiro && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {errorRetiro}
              </div>
            )}

            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex flex-col gap-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5B6B63]">Monto a retirar:</span>
                <span className="font-cifras font-bold text-lg text-[#EA580C]">
                  {formatearUsdc(parseFloat(montoRetiro) || 0)}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 text-xs pt-2 border-t border-slate-200/60">
                <span className="text-[#5B6B63]">Dirección de destino:</span>
                <span className="font-mono text-xs font-semibold text-[#14221B] break-all">
                  {abreviarDireccion(direccionRetiro)}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>Esta acción no se puede deshacer. Los fondos serán transferidos permanentemente a la billetera indicada.</span>
            </div>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={cargandoRetiro}
                onClick={() => setModalRetiroAbierto(false)}
                className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={cargandoRetiro}
                onClick={handleConfirmarRetiro}
                className="interaccion-tactil sombra-naranja-brillo w-1/2 py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {cargandoRetiro ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando en Stellar…</span>
                  </>
                ) : (
                  <span>Confirmar retiro</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          MODALES DE CONTRATOS: SUBIR EVIDENCIA, APROBAR, EMERGENCIA
          ══════════════════════════════════════════════════════════ */}
      {tramoParaEvidencia && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                  Subir evidencia de avance
                </h3>
                <span className="text-[11px] text-[#5B6B63]">
                  Tramo {tramoParaEvidencia.numero_tramo}: {tramoParaEvidencia.titulo}
                </span>
              </div>
            </div>

            {errorAccion && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {errorAccion}
              </div>
            )}

            <form onSubmit={handleSubirEvidencia} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#14221B]">
                  Enlace web a fotografía o acta de avance
                </label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/foto-cultivo.jpg"
                  value={urlEvidenciaInput}
                  onChange={(e) => setUrlEvidenciaInput(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={accionEnCurso}
                  onClick={() => setTramoParaEvidencia(null)}
                  className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={accionEnCurso}
                  className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-[#0A2E1F] hover:bg-[#1F6B45] text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {accionEnCurso ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirmando en Stellar…</span>
                    </>
                  ) : (
                    <span>Registrar avance</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {tramoParaAprobar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-slate-100 shadow-2xl flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
                <Check className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                  Aprobar y liberar fondos
                </h3>
                <span className="text-[11px] text-[#5B6B63]">
                  Tramo {tramoParaAprobar.numero_tramo}: {tramoParaAprobar.titulo}
                </span>
              </div>
            </div>

            <div className="bg-[#F8FAFC] rounded-2xl p-4 border border-slate-100 flex flex-col gap-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#5B6B63]">Monto a liberar al productor:</span>
                <span className="font-cifras font-bold text-base text-[#14221B]">
                  {formatearUsdc(tramoParaAprobar.monto_usdc)}
                </span>
              </div>
            </div>

            <p className="text-xs text-[#5B6B63] leading-relaxed">
              Al confirmar, los fondos retenidos en el contrato de Stellar para este tramo se transferirán irrevocablemente a la billetera del productor.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <button
                type="button"
                disabled={accionEnCurso}
                onClick={() => setTramoParaAprobar(null)}
                className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={accionEnCurso}
                onClick={handleAprobarTramo}
                className="interaccion-tactil sombra-naranja-brillo w-1/2 py-2.5 px-4 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                {accionEnCurso ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Confirmando en Stellar…</span>
                  </>
                ) : (
                  <span>Aprobar y liberar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {modalEmergenciaAbierto && detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs transition-opacity">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full border border-slate-100 shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-titulo text-lg font-bold text-[#14221B]">
                  Reportar emergencia climática
                </h3>
                <span className="text-[11px] text-[#5B6B63]">
                  Activa la cobertura del Fondo Solidario de Emergencia
                </span>
              </div>
            </div>

            <form onSubmit={handleReportarEmergencia} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#14221B]">Tipo de desastre natural</label>
                <select
                  value={motivoEmergencia}
                  onChange={(e) => setMotivoEmergencia(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white cursor-pointer"
                >
                  {TIPOS_DESASTRE.map((d) => (
                    <option key={d.id} value={d.id}>{d.etiqueta}</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#14221B]">Descripción del daño sufrido</label>
                <textarea
                  rows={3}
                  placeholder="Detalla cómo afectó el evento climático a tu cosecha"
                  value={descripcionEmergencia}
                  onChange={(e) => setDescripcionEmergencia(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#14221B]">Enlace a evidencia pública</label>
                <input
                  type="url"
                  placeholder="https://ejemplo.com/evidencia.jpg"
                  value={urlEvidenciaEmergencia}
                  onChange={(e) => setUrlEvidenciaEmergencia(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-[#14221B]">Monto solicitado al Fondo (USDC)</label>
                <input
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder={`Monto total: ${detalle.contrato.monto_total_usdc}`}
                  value={montoEmergencia}
                  onChange={(e) => setMontoEmergencia(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={accionEnCurso}
                  onClick={() => setModalEmergenciaAbierto(false)}
                  className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={accionEnCurso}
                  className="interaccion-tactil w-1/2 py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-titulo font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
                >
                  {accionEnCurso ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Confirmando en Stellar…</span>
                    </>
                  ) : (
                    <span>Enviar reporte</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

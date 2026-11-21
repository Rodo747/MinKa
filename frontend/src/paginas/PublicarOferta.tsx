/**
 * PublicarOferta.tsx — Formulario ampliado para publicar ofertas de preventa agrícola ("/publicar").
 * Reorganizado en 5 secciones tipo tarjeta en una sola columna:
 * 1) "Tu cultivo": cultivo, variedad, descripción con contador.
 * 2) "Producción": superficie en ha, fecha de siembra, prácticas de cultivo.
 * 3) "Ubicación y entrega": departamento, provincia dependiente, comunidad, fecha entrega, forma y lugar de entrega.
 * 4) "Fotos": SubirFotos (1 a 6 fotos, mín 1).
 * 5) "Precio": cantidad kg, precio referencia, descuento y vista previa en vivo (precio final y CAE).
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
  Camera,
  Layers,
  Truck,
} from 'lucide-react';
import { publicarOferta, type CrearOfertaDatos } from '../api';
import { formatearUsdc, formatearCae } from '../componentes/TarjetaOferta';
import { SubirFotos } from '../componentes/SubirFotos';
import { DEPARTAMENTOS_BOLIVIA, obtenerProvinciasPorDepartamento } from '../lugares';
import { usarSesion } from '../sesion';

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

  // 1. Tu cultivo
  const [cultivo, setCultivo] = useState('');
  const [variedad, setVariedad] = useState('');
  const [descripcion, setDescripcion] = useState('');

  // 2. Producción
  const [superficieHa, setSuperficieHa] = useState('');
  const [fechaSiembra, setFechaSiembra] = useState('');
  const [practicasCultivo, setPracticasCultivo] = useState('');

  // 3. Ubicación y entrega
  const [departamento, setDepartamento] = useState(DEPARTAMENTOS_BOLIVIA[6] || 'Potosí'); // Default Potosí
  const [provincia, setProvincia] = useState('');
  const [comunidad, setComunidad] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [formaEntrega, setFormaEntrega] = useState<'retiro_en_finca' | 'entrega_en_ciudad' | 'a_convenir'>('a_convenir');
  const [lugarEntrega, setLugarEntrega] = useState('');

  // 4. Fotos (mínimo 1, máximo 6)
  const [fotos, setFotos] = useState<string[]>([]);

  // 5. Precio
  const [cantidadKg, setCantidadKg] = useState<string>('');
  const [precioReferencia, setPrecioReferencia] = useState<string>('');
  const [descuento, setDescuento] = useState<string>('');

  // Estados de carga y error
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);

  // Lista de provincias dependiente del departamento
  const provinciasDisponibles = useMemo(() => {
    return obtenerProvinciasPorDepartamento(departamento);
  }, [departamento]);

  // Si cambia el departamento y la provincia actual no pertenece, reiniciar provincia
  const manejarCambioDepartamento = (nuevoDepto: string) => {
    setDepartamento(nuevoDepto);
    const nuevasProvincias = obtenerProvinciasPorDepartamento(nuevoDepto);
    if (!nuevasProvincias.includes(provincia)) {
      setProvincia(nuevasProvincias[0] || '');
    }
  };

  // Inicializar provincia al montar si está vacía
  React.useEffect(() => {
    if (!provincia && provinciasDisponibles.length > 0) {
      setProvincia(provinciasDisponibles[0]);
    }
  }, [provinciasDisponibles, provincia]);

  // Cálculos financieros en vivo
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
      setErrorEnvio('Por favor, indica el nombre del cultivo agrícola.');
      return;
    }
    if (!descripcion.trim()) {
      setErrorEnvio('Por favor, agrega una descripción para tu oferta.');
      return;
    }
    if (descripcion.trim().length > 1000) {
      setErrorEnvio('La descripción no puede superar los 1000 caracteres.');
      return;
    }
    if (!departamento.trim()) {
      setErrorEnvio('Por favor, selecciona un departamento.');
      return;
    }
    if (!provincia.trim()) {
      setErrorEnvio('Por favor, selecciona la provincia.');
      return;
    }
    if (!fechaEntrega) {
      setErrorEnvio('Por favor, selecciona la fecha estimada de entrega.');
      return;
    }
    if (fotos.length < 1) {
      setErrorEnvio('Debes subir al menos 1 foto real de tu cultivo o terreno para publicar.');
      return;
    }
    if (!numKg || numKg <= 0) {
      setErrorEnvio('La cantidad en kg debe ser un número mayor a cero.');
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
        variedad: variedad.trim() || undefined,
        descripcion: descripcion.trim(),
        superficie_ha: superficieHa ? parseFloat(superficieHa) : undefined,
        fecha_siembra: fechaSiembra || undefined,
        practicas_cultivo: practicasCultivo.trim() || undefined,
        departamento: departamento.trim(),
        provincia: provincia.trim(),
        comunidad: comunidad.trim() || undefined,
        fecha_entrega: fechaEntrega,
        forma_entrega: formaEntrega,
        lugar_entrega: lugarEntrega.trim() || undefined,
        fotos: fotos,
        cantidad_kg: numKg,
        precio_referencia_usdc: numReferencia,
        porcentaje_descuento: numDescuento,
      };

      await publicarOferta(datos, token);
      navigate('/mercado', { state: { mensajeExito: '¡Tu oferta fue publicada exitosamente con sus fotos y detalles en el Mercado!' } });
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

        {/* Título de la página */}
        <div>
          <h1 className="font-titulo text-2xl sm:text-3xl text-[#14221B] font-bold">
            Publicar oferta de cosecha
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6B63] mt-1 leading-relaxed">
            Publica tu lote agrícola con fotos reales y detalles verificables. Recibe el 40% de anticipo al instante al fondearse el contrato.
          </p>
        </div>

        {errorEnvio && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-200 flex items-start gap-3 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorEnvio}</span>
          </div>
        )}

        <form onSubmit={manejarEnvio} className="flex flex-col gap-6">

          {/* ══════════════════════════════════════════════════════════
              SECCIÓN 1: TU CULTIVO
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <Sprout className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-titulo text-base font-bold text-[#14221B]">1. Tu cultivo</h2>
                <span className="text-[11px] text-[#5B6B63]">Identificación del producto agrícola</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Cultivo */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="cultivo" className="text-xs font-bold text-[#14221B]">
                  Nombre del cultivo *
                </label>
                <input
                  id="cultivo"
                  type="text"
                  placeholder="Ej.: Quinua Real, Café Especial, Sésamo, Papa Criolla"
                  value={cultivo}
                  onChange={(e) => setCultivo(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                  required
                />
              </div>

              {/* Variedad (opcional) */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="variedad" className="text-xs font-bold text-[#14221B] flex items-center justify-between">
                  <span>Variedad específica</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <input
                  id="variedad"
                  type="text"
                  placeholder="Ej.: Blanca Real, Típica, Catuai, Huaycha"
                  value={variedad}
                  onChange={(e) => setVariedad(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                />
              </div>

              {/* Descripción */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label htmlFor="descripcion" className="text-xs font-bold text-[#14221B]">
                    Descripción de la oferta *
                  </label>
                  <span className={`text-[10px] font-mono ${descripcion.length > 900 ? 'text-orange-600 font-bold' : 'text-slate-400'}`}>
                    {descripcion.length}/1000
                  </span>
                </div>
                <textarea
                  id="descripcion"
                  rows={4}
                  maxLength={1000}
                  placeholder="Describe la calidad de tu cosecha, el estado del terreno, el método de cultivo y cualquier detalle que genere confianza al comprador."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors leading-relaxed"
                  required
                />
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECCIÓN 2: PRODUCCIÓN
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-titulo text-base font-bold text-[#14221B]">2. Producción</h2>
                <span className="text-[11px] text-[#5B6B63]">Detalles del terreno y ciclo agrícola</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Superficie ha */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="superficie" className="text-xs font-bold text-[#14221B] flex items-center justify-between">
                  <span>Superficie cultivada (hectáreas)</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <input
                  id="superficie"
                  type="number"
                  step="any"
                  min="0.01"
                  placeholder="Ej.: 2.5"
                  value={superficieHa}
                  onChange={(e) => setSuperficieHa(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                />
              </div>

              {/* Fecha de siembra */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fechaSiembra" className="text-xs font-bold text-[#14221B] flex items-center justify-between">
                  <span>Fecha de siembra</span>
                  <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
                </label>
                <input
                  id="fechaSiembra"
                  type="date"
                  value={fechaSiembra}
                  onChange={(e) => setFechaSiembra(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                />
              </div>
            </div>

            {/* Prácticas de cultivo */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="practicas" className="text-xs font-bold text-[#14221B] flex items-center justify-between">
                <span>Prácticas de cultivo y manejo</span>
                <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
              </label>
              <textarea
                id="practicas"
                rows={2}
                placeholder="Ej.: Cultivo orgánico sin agroquímicos, riego por goteo, abono natural de camélido, cosecha manual."
                value={practicasCultivo}
                onChange={(e) => setPracticasCultivo(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECCIÓN 3: UBICACIÓN Y ENTREGA
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-titulo text-base font-bold text-[#14221B]">3. Ubicación y entrega</h2>
                <span className="text-[11px] text-[#5B6B63]">Dónde se produce y cómo se recibe la cosecha</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Departamento */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="departamento" className="text-xs font-bold text-[#14221B]">
                  Departamento *
                </label>
                <select
                  id="departamento"
                  value={departamento}
                  onChange={(e) => manejarCambioDepartamento(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors cursor-pointer"
                  required
                >
                  {DEPARTAMENTOS_BOLIVIA.map((dep) => (
                    <option key={dep} value={dep}>{dep}</option>
                  ))}
                </select>
              </div>

              {/* Provincia dependiente */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="provincia" className="text-xs font-bold text-[#14221B]">
                  Provincia *
                </label>
                <select
                  id="provincia"
                  value={provincia}
                  onChange={(e) => setProvincia(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors cursor-pointer"
                  required
                >
                  {provinciasDisponibles.map((prov) => (
                    <option key={prov} value={prov}>{prov}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Comunidad o Municipio */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="comunidad" className="text-xs font-bold text-[#14221B] flex items-center justify-between">
                <span>Comunidad, localidad o municipio</span>
                <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
              </label>
              <input
                id="comunidad"
                type="text"
                placeholder="Ej.: Llica, Comunidad Tambo, Caranavi Central"
                value={comunidad}
                onChange={(e) => setComunidad(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Fecha estimada de entrega */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="fechaEntrega" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#1F6B45]" />
                  <span>Fecha estimada de entrega *</span>
                </label>
                <input
                  id="fechaEntrega"
                  type="date"
                  value={fechaEntrega}
                  onChange={(e) => setFechaEntrega(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                  required
                />
              </div>

              {/* Forma de entrega */}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="formaEntrega" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-[#1F6B45]" />
                  <span>Forma de entrega *</span>
                </label>
                <select
                  id="formaEntrega"
                  value={formaEntrega}
                  onChange={(e) => setFormaEntrega(e.target.value as 'retiro_en_finca' | 'entrega_en_ciudad' | 'a_convenir')}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors cursor-pointer"
                  required
                >
                  <option value="a_convenir">A convenir con el comprador</option>
                  <option value="retiro_en_finca">Retiro directo en finca / predio</option>
                  <option value="entrega_en_ciudad">Entrega en ciudad o centro de acopio</option>
                </select>
              </div>
            </div>

            {/* Lugar de entrega (opcional) */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="lugarEntrega" className="text-xs font-bold text-[#14221B] flex items-center justify-between">
                <span>Detalle o punto de entrega</span>
                <span className="text-[10px] text-slate-400 font-normal">Opcional</span>
              </label>
              <input
                id="lugarEntrega"
                type="text"
                placeholder="Ej.: Terminal de buses de Oruro, Almacén central de El Alto"
                value={lugarEntrega}
                onChange={(e) => setLugarEntrega(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
              />
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECCIÓN 4: FOTOS
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-[#1F6B45] flex items-center justify-center">
                <Camera className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-titulo text-base font-bold text-[#14221B]">4. Fotos de la cosecha</h2>
                <span className="text-[11px] text-[#5B6B63]">Entre 1 y 6 fotografías reales</span>
              </div>
            </div>

            <SubirFotos
              fotos={fotos}
              onChange={setFotos}
              maximoFotos={6}
              minimoRequerido={1}
              modoPortada={true}
              textoAyuda="Muestra tu terreno, tu cultivo y cosechas anteriores. Las fotos reales generan confianza."
            />
          </div>

          {/* ══════════════════════════════════════════════════════════
              SECCIÓN 5: PRECIO Y CONDICIONES FINANCIERAS
              ══════════════════════════════════════════════════════════ */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-100 shadow-[0_4px_20px_-4px_rgba(10,46,31,0.04)] flex flex-col gap-5">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#EA580C] flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h2 className="font-titulo text-base font-bold text-[#14221B]">5. Precio y condiciones</h2>
                <span className="text-[11px] text-[#5B6B63]">Volumen, valor de referencia y descuento anticipado</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="cantidad" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                <Scale className="w-3.5 h-3.5 text-[#1F6B45]" />
                <span>Cantidad total de cosecha (kg) *</span>
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
                Expresado en kilogramos netos.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="precioRef" className="text-xs font-bold text-[#14221B] flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-[#1F6B45]" />
                  <span>Precio de referencia (USDC) *</span>
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
                  <span>Porcentaje de descuento (%) *</span>
                </label>
                <input
                  id="descuento"
                  type="number"
                  step="any"
                  min="0"
                  max="99"
                  placeholder="Ej.: 15"
                  value={descuento}
                  onChange={(e) => setDescuento(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs sm:text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white transition-colors"
                  required
                />
                <span className="text-[11px] text-[#5B6B63]">
                  Incentivo para preventa (0 a 99%).
                </span>
              </div>
            </div>

            {/* Vista previa en vivo del cálculo idéntico al backend */}
            <div className="bg-[#FFF6E5]/60 rounded-2xl p-5 border border-[#FF8A3D]/30 flex flex-col gap-3">
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
                El CAE compara este descuento como una tasa financiera anualizada para que evalúes tu costo frente a un préstamo bancario tradicional.
              </span>
            </div>
          </div>

          {/* Botón Publicar */}
          <button
            type="submit"
            disabled={enviando}
            className="interaccion-tactil sombra-naranja-brillo w-full py-4 px-6 rounded-2xl bg-[#EA580C] hover:bg-[#FF7A18] disabled:opacity-50 text-white font-titulo font-bold text-sm flex items-center justify-center gap-2 cursor-pointer transition-all shadow-md"
          >
            {enviando ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Publicando oferta en el Mercado…</span>
              </>
            ) : (
              <span>Publicar oferta</span>
            )}
          </button>

        </form>

      </div>
    </div>
  );
};

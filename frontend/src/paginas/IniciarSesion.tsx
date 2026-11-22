/**
 * IniciarSesion.tsx — Pantalla de inicio de sesión de MinKa ("/entrar").
 * Diseñada con fondo verde profundo #0A2E1F y tarjeta blanca centrada.
 * Microinteracciones táctliles según Emil Kowalski y validación amigable en español.
 */

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, User, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { usarSesion } from '../sesion';

export const IniciarSesion: React.FC = () => {
  const { entrar } = usarSesion();
  const navigate = useNavigate();

  const [nombreUsuario, setNombreUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [mostrarClave, setMostrarClave] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);

  const manejarEnvio = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombreUsuario.trim() || !clave.trim()) {
      setErrorMensaje('Por favor, ingresa tu usuario y contraseña.');
      return;
    }

    setCargando(true);
    setErrorMensaje(null);

    try {
      await entrar(nombreUsuario.trim(), clave);
      // Redirigir al inicio tras iniciar sesión con éxito
      navigate('/inicio');
    } catch (err) {
      if (err instanceof Error) {
        setErrorMensaje(err.message);
      } else {
        setErrorMensaje('Ocurrió un error al iniciar sesión. Intenta nuevamente.');
      }
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="relative min-h-[calc(100vh-80px)] w-full flex items-center justify-center p-4 sm:p-6 bg-[#0A2E1F] overflow-hidden">
      {/* Luces y degradados ambientales de fondo (estilo Hero) */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full pointer-events-none"
        style={{
          background:
            'radial-gradient(circle, rgba(234, 88, 12, 0.20) 0%, rgba(31, 107, 69, 0.16) 45%, transparent 70%)',
          filter: 'blur(80px)',
        }}
      />
      <div
        className="absolute -right-20 bottom-10 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.10) 0%, transparent 70%)',
          filter: 'blur(90px)',
        }}
      />

      {/* Siluetas sutiles de hojas ancestrales en el fondo */}
      <div className="absolute top-8 left-6 w-64 h-72 opacity-[0.05] pointer-events-none">
        <svg className="w-full h-full text-emerald-300 fill-current" viewBox="0 0 200 300">
          <path d="M 0,150 C 60,30 180,50 190,150 C 190,260 70,290 0,150 Z" />
        </svg>
      </div>

      {/* Tarjeta Blanca Centrada */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-6 sm:p-10 shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)] border border-white/20">
        
        {/* Encabezado con Logo y Título */}
        <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
          <Link to="/" className="group focus:outline-none mb-3">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-[#0A2E1F] flex items-center justify-center shadow-xl transition-transform duration-300 group-hover:scale-105 p-3 border border-emerald-900/40">
              <img src="/logo.png" alt="MinKa" className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(234,88,12,0.3)]" />
            </div>
          </Link>

          <span className="text-[10px] sm:text-xs font-bold text-[#1F6B45] uppercase tracking-widest bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 mb-1.5">
            Acceso a la plataforma
          </span>

          <h1 className="font-titulo text-2xl sm:text-3xl text-[#14221B] font-extrabold tracking-tight">
            Iniciar sesión
          </h1>
          <p className="text-xs sm:text-sm text-[#5B6B63] mt-1">
            Ingresa con tu cuenta de MinKa en Stellar
          </p>
        </div>

        {/* Mensaje de Error Amable */}
        {errorMensaje && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200/80 flex items-start gap-2.5 text-xs text-rose-800 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-medium">{errorMensaje}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
          
          {/* Campo Usuario */}
          <div className="flex flex-col gap-1.5 text-left">
            <label
              htmlFor="campo-usuario"
              className="text-xs font-semibold text-[#14221B] flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-[#1F6B45]" />
              <span>Usuario</span>
            </label>
            <div className="relative">
              <input
                id="campo-usuario"
                type="text"
                autoComplete="username"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                placeholder="Nombre de usuario"
                disabled={cargando}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white focus:ring-2 focus:ring-[#1F6B45]/20 transition-all"
              />
            </div>
          </div>

          {/* Campo Contraseña con Mostrar/Ocultar */}
          <div className="flex flex-col gap-1.5 text-left">
            <label
              htmlFor="campo-clave"
              className="text-xs font-semibold text-[#14221B] flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-[#1F6B45]" />
              <span>Contraseña</span>
            </label>
            <div className="relative">
              <input
                id="campo-clave"
                type={mostrarClave ? 'text' : 'password'}
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                placeholder="••••••••"
                disabled={cargando}
                className="w-full pl-3.5 pr-10 py-2.5 rounded-xl bg-[#F8FAFC] border border-slate-200 text-sm text-[#14221B] placeholder-slate-400 focus:outline-none focus:border-[#1F6B45] focus:bg-white focus:ring-2 focus:ring-[#1F6B45]/20 transition-all"
              />
              <button
                type="button"
                onClick={() => setMostrarClave(!mostrarClave)}
                aria-label={mostrarClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="interaccion-tactil absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
              >
                {mostrarClave ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Botón Principal "Entrar" */}
          <button
            type="submit"
            disabled={cargando}
            className="interaccion-tactil sombra-naranja-brillo mt-2 w-full py-3 px-5 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {cargando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Iniciando sesión...</span>
              </>
            ) : (
              <>
                <span>Entrar</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        {/* Pie de la tarjeta: Registro deshabilitado */}
        <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col items-center gap-1.5 text-center">
          <span className="text-xs text-[#5B6B63]">
            ¿No tienes cuenta?
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled
              className="text-xs font-semibold text-slate-400 cursor-not-allowed underline decoration-dotted"
            >
              Crear cuenta
            </button>
            <span className="text-[10px] font-semibold text-[#1F6B45] bg-[#FFF6E5] px-2 py-0.5 rounded-md border border-amber-200/60">
              Próximamente
            </span>
          </div>
        </div>

      </div>
    </div>
  );
};


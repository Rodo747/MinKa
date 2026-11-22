/**
 * Navegacion.tsx — Componente de navegación global de MinKa.
 * Muestra el botón "Iniciar sesión" si no hay sesión activa, o la etiqueta de perfil
 * y el avatar con inicial si el usuario está autenticado.
 */

import React, { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate, useLocation, Link } from 'react-router-dom';
import {
  Home,
  Store,
  User,
  ShieldCheck,
  Info,
  ArrowRightLeft,
  LogOut,
  ChevronDown,
  LogIn,
} from 'lucide-react';
import { usarSesion } from '../sesion';

export const Navegacion: React.FC = () => {
  const { usuario, token, perfilActivo, cambiarPerfil, salir } = usarSesion();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const estaAutenticado = Boolean(token && usuario);

  // Cerrar el menú del avatar al hacer clic fuera
  useEffect(() => {
    function manejarClicFuera(evento: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(evento.target as Node)) {
        setMenuAbierto(false);
      }
    }
    document.addEventListener('mousedown', manejarClicFuera);
    return () => document.removeEventListener('mousedown', manejarClicFuera);
  }, []);

  // Cerrar menú al cambiar de ruta
  useEffect(() => {
    setMenuAbierto(false);
  }, [location.pathname]);

  const pestanas = [
    { ruta: '/inicio', etiqueta: 'Inicio', icono: Home },
    { ruta: '/mercado', etiqueta: 'Mercado', icono: Store },
    { ruta: '/mi-cuenta', etiqueta: 'Mi cuenta', icono: User },
    { ruta: '/respaldo', etiqueta: 'Respaldo', icono: ShieldCheck },
    { ruta: '/nosotros', etiqueta: 'Nosotros', icono: Info },
  ];

  // Obtener inicial para el avatar
  const inicialUsuario = usuario?.nombre ? usuario.nombre.charAt(0).toUpperCase() : 'U';

  // Ocultar completamente la barra en la ruta /demo
  if (location.pathname === '/demo' || location.pathname.startsWith('/demo/')) {
    return null;
  }

  return (
    <>
      {/* ── BARRA SUPERIOR (Escritorio y Móvil) ── */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#0A2E1F]/95 backdrop-blur-md border-b border-[#0F3D2E] shadow-[0_4px_20px_-2px_rgba(10,46,31,0.45)]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 sm:h-20 flex items-center justify-between gap-4">
          
          {/* Logo MinKa */}
          <NavLink
            to="/"
            className="flex items-center gap-2.5 sm:gap-3.5 group focus:outline-none shrink-0"
          >
            <img
              src="/logo.png"
              alt="MinKa"
              className="h-9 sm:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105 filter drop-shadow-xs"
            />
            <div className="flex flex-col">
              <span className="font-titulo text-xl sm:text-2xl text-white tracking-tight leading-none">
                MinKa
              </span>
              <span className="text-[9px] sm:text-[10px] text-emerald-400 font-semibold uppercase tracking-widest mt-0.5 sm:mt-1">
                Agro-Fintech
              </span>
            </div>
          </NavLink>

          {/* Pestañas de Navegación (Solo Escritorio / Tablet md+) */}
          <nav className="hidden md:flex items-center gap-4 lg:gap-8 h-full">
            {pestanas.map((pestana) => {
              const estaActiva = location.pathname === pestana.ruta;
              return (
                <NavLink
                  key={pestana.ruta}
                  to={pestana.ruta}
                  className={`relative h-full flex items-center text-xs lg:text-sm font-semibold transition-colors whitespace-nowrap ${
                    estaActiva
                      ? 'text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <span>{pestana.etiqueta}</span>
                  {estaActiva && (
                    <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#EA580C] rounded-full shadow-[0_0_12px_#EA580C]" />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Acciones Derecha (Red de pruebas, Perfil y Avatar / Iniciar Sesión) */}
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            
            {/* Insignia Red de pruebas */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/25 backdrop-blur-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_#34d399]" />
              <span className="text-[10px] sm:text-xs font-medium text-emerald-200">
                Red de pruebas
              </span>
            </div>

            {/* Si NO está autenticado: mostrar botón Iniciar sesión y ocultar etiqueta de perfil */}
            {!estaAutenticado ? (
              <Link
                to="/entrar"
                className="interaccion-tactil inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold border border-white/20 backdrop-blur-md transition-all cursor-pointer shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 text-[#FF8A3D]" />
                <span>Iniciar sesión</span>
              </Link>
            ) : (
              /* Si ESTÁ autenticado: mostrar etiqueta de perfil y avatar con inicial */
              <>
                {/* Etiqueta Perfil Activo (Solo Escritorio lg+) */}
                <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-emerald-100 font-medium">
                  <span>Perfil:</span>
                  <strong className="text-white font-semibold">
                    {perfilActivo === 'productor' ? 'Productor' : 'Comprador'}
                  </strong>
                </div>

                {/* Avatar y Menú Desplegable con Inicial */}
                <div className="relative" ref={menuRef}>
                  <button
                    type="button"
                    onClick={() => setMenuAbierto(!menuAbierto)}
                    aria-expanded={menuAbierto}
                    aria-label="Menú de usuario"
                    className="interaccion-tactil flex items-center gap-1.5 p-1 sm:p-1.5 rounded-full bg-emerald-900/80 hover:bg-emerald-800 border border-emerald-400/30 text-white shadow-inner focus:outline-none cursor-pointer"
                  >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#1F6B45] text-white font-titulo font-bold text-xs sm:text-sm flex items-center justify-center shadow-xs">
                      {inicialUsuario}
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-emerald-300 transition-transform duration-200 ${
                        menuAbierto ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Menú Desplegable */}
                  {menuAbierto && (
                    <div className="menu-desplegable absolute right-0 top-full mt-2 w-60 rounded-2xl bg-white shadow-2xl border border-slate-100 py-2 z-50 text-left">
                      <div className="px-4 py-2.5 border-b border-slate-100">
                        <span className="text-[10px] font-bold text-[#5B6B63] uppercase tracking-wider block">
                          Sesión activa
                        </span>
                        <span className="text-sm font-titulo font-bold text-[#14221B] block truncate">
                          {usuario?.nombre || usuario?.nombre_usuario}
                        </span>
                        <span className="text-xs text-[#1F6B45] font-semibold mt-0.5 block">
                          Perfil activo: {perfilActivo === 'productor' ? 'Productor' : 'Comprador'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false);
                          navigate('/mi-cuenta');
                        }}
                        className="interaccion-tactil w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#14221B] hover:bg-slate-50 transition-colors text-left cursor-pointer"
                      >
                        <User className="w-4 h-4 text-[#5B6B63]" />
                        <span>Mi perfil</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          cambiarPerfil();
                          setMenuAbierto(false);
                        }}
                        className="interaccion-tactil w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-[#14221B] hover:bg-slate-50 transition-colors text-left cursor-pointer"
                      >
                        <ArrowRightLeft className="w-4 h-4 text-[#EA580C]" />
                        <span>
                          Cambiar a {perfilActivo === 'productor' ? 'Comprador' : 'Productor'}
                        </span>
                      </button>

                      <div className="my-1 border-t border-slate-100" />

                      <button
                        type="button"
                        onClick={() => {
                          setMenuAbierto(false);
                          salir();
                          window.location.href = '/';
                        }}
                        className="interaccion-tactil w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 text-rose-500" />
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}

          </div>

        </div>
      </header>

      {/* ── BARRA INFERIOR FIJA (Solo Celular < md) ── */}
      <nav
        aria-label="Navegación móvil"
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A2E1F]/95 backdrop-blur-lg border-t border-[#0F3D2E] area-segura-inferior shadow-[0_-4px_20px_-2px_rgba(10,46,31,0.35)]"
      >
        <div className="flex items-center justify-around px-2 py-1.5">
          {pestanas.map((pestana) => {
            const Icono = pestana.icono;
            const estaActiva = location.pathname === pestana.ruta;
            return (
              <NavLink
                key={pestana.ruta}
                to={pestana.ruta}
                className={`interaccion-tactil min-w-[56px] min-h-[44px] flex flex-col items-center justify-center gap-1 py-1 px-2 rounded-xl transition-colors ${
                  estaActiva
                    ? 'text-[#EA580C]'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Icono className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">
                  {pestana.etiqueta}
                </span>
                {estaActiva && (
                  <span className="w-1 h-1 rounded-full bg-[#EA580C] mt-0.5" />
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
};

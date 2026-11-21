/**
 * App.tsx — Enrutador principal de MinKa y protección de rutas.
 * Protege todas las rutas excepto "/" y "/entrar", redirigiendo a "/entrar".
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { Hammer, ArrowLeft, Store } from 'lucide-react';
import { ProveedorSesion, usarSesion } from './sesion';
import { Navegacion } from './componentes/Navegacion';
import { Bienvenida } from './paginas/Bienvenida';
import { Mercado } from './paginas/Mercado';
import { IniciarSesion } from './paginas/IniciarSesion';
import { DetalleOferta } from './paginas/DetalleOferta';
import { PublicarOferta } from './paginas/PublicarOferta';
import { MiCuenta } from './paginas/MiCuenta';
import { VistaPerfilProductor } from './paginas/PerfilProductor';
import { Respaldo } from './paginas/Respaldo';
import { Inicio } from './paginas/Inicio';
import { Nosotros } from './paginas/Nosotros';
import { Demo } from './paginas/Demo';

/**
 * Componente que protege rutas privadas redirigiendo a /entrar si no hay sesión.
 */
function RutaProtegida({ children }: { children: React.ReactNode }) {
  const { token, usuario, cargando } = usarSesion();
  const location = useLocation();

  if (cargando) {
    return (
      <div className="w-full min-h-[calc(100vh-80px)] flex items-center justify-center bg-[#F8FAFC]">
        <div className="w-8 h-8 rounded-full border-2 border-[#1F6B45] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!token || !usuario) {
    return <Navigate to="/entrar" state={{ desde: location }} replace />;
  }

  return <>{children}</>;
}

/**
 * Vista limpia y coherente para las secciones que aún no se han construido.
 */
function SeccionEnConstruccion({ nombreSeccion }: { nombreSeccion: string }) {
  const location = useLocation();

  return (
    <div className="w-full min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-6 text-center">
      <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 shadow-[0_10px_30px_-4px_rgba(10,46,31,0.06)] max-w-md w-full flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-[#FFF6E5] text-[#EA580C] flex items-center justify-center shadow-xs">
          <Hammer className="w-7 h-7" />
        </div>

        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#1F6B45] bg-emerald-50 px-2.5 py-1 rounded-md">
            Ruta: {location.pathname}
          </span>
          <h2 className="font-titulo text-2xl text-[#14221B] mt-2">
            {nombreSeccion}
          </h2>
          <p className="text-xs sm:text-sm text-[#5B6B63] mt-2 leading-relaxed">
            Esta sección está en construcción. Próximamente estará disponible en la plataforma de MinKa.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full mt-2">
          <Link
            to="/mercado"
            className="interaccion-tactil sombra-naranja-brillo w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-[#FF7A18] text-white font-titulo font-bold text-xs transition-all"
          >
            <Store className="w-4 h-4" />
            <span>Explorar Mercado</span>
          </Link>
          <Link
            to="/"
            className="interaccion-tactil w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#14221B] font-titulo font-semibold text-xs transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Bienvenida</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function ContenidoApp() {
  const location = useLocation();
  const esDemo = location.pathname === '/demo';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#14221B]">
      {/* Barra de navegación superior e inferior fija (oculta en /demo) */}
      {!esDemo && <Navegacion />}

      {/* Contenedor principal sin padding en /demo */}
      <main className={esDemo ? 'flex-1' : 'flex-1 pt-16 sm:pt-20'}>
        <Routes>
          {/* Rutas Públicas */}
          <Route path="/" element={<Bienvenida />} />
          <Route path="/entrar" element={<IniciarSesion />} />
          <Route path="/respaldo" element={<Respaldo />} />
          <Route path="/nosotros" element={<Nosotros />} />
          <Route path="/demo" element={<Demo />} />

          {/* Rutas Protegidas */}
          <Route
            path="/inicio"
            element={
              <RutaProtegida>
                <Inicio />
              </RutaProtegida>
            }
          />
          <Route
            path="/mercado"
            element={
              <RutaProtegida>
                <Mercado />
              </RutaProtegida>
            }
          />
          <Route
            path="/oferta/:id"
            element={
              <RutaProtegida>
                <DetalleOferta />
              </RutaProtegida>
            }
          />
          <Route
            path="/publicar"
            element={
              <RutaProtegida>
                <PublicarOferta />
              </RutaProtegida>
            }
          />
          <Route
            path="/mi-cuenta"
            element={
              <RutaProtegida>
                <MiCuenta />
              </RutaProtegida>
            }
          />
          <Route
            path="/productor/:id"
            element={
              <RutaProtegida>
                <VistaPerfilProductor />
              </RutaProtegida>
            }
          />

          {/* Ruta por defecto */}
          <Route
            path="*"
            element={<SeccionEnConstruccion nombreSeccion="Página no encontrada" />}
          />
        </Routes>
      </main>
    </div>
  );
}

export const App: React.FC = () => {
  return (
    <ProveedorSesion>
      <BrowserRouter>
        <ContenidoApp />
      </BrowserRouter>
    </ProveedorSesion>
  );
};

export default App;

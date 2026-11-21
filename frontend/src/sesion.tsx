/**
 * sesion.tsx — Contexto de autenticación y sesión de usuario en MinKa.
 * Almacena el token JWT y el perfil activo en localStorage (con try/catch),
 * y valida el token al cargar la aplicación mediante GET /auth/yo.
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { entrar as apiEntrar, yo as apiYo, type UsuarioAuth } from './api';

export type RolPerfil = 'productor' | 'comprador';

const CLAVE_LOCALSTORAGE_TOKEN = 'minka_token';
const CLAVE_LOCALSTORAGE_PERFIL = 'minka_perfil_activo';

interface ContextoSesionTipo {
  usuario: UsuarioAuth | null;
  perfilActivo: RolPerfil;
  token: string | null;
  cargando: boolean;
  entrar: (usuario: string, clave: string) => Promise<void>;
  salir: () => void;
  cambiarPerfil: () => void;
  refrescarUsuario: () => Promise<void>;
}

const ContextoSesion = createContext<ContextoSesionTipo | undefined>(undefined);

function leerTokenAlmacenado(): string | null {
  try {
    return localStorage.getItem(CLAVE_LOCALSTORAGE_TOKEN);
  } catch {
    return null;
  }
}

function leerPerfilAlmacenado(): RolPerfil | null {
  try {
    const val = localStorage.getItem(CLAVE_LOCALSTORAGE_PERFIL);
    if (val === 'productor' || val === 'comprador') {
      return val;
    }
    return null;
  } catch {
    return null;
  }
}

function guardarEnAlmacenamiento(token: string | null, perfil: RolPerfil | null) {
  try {
    if (token) {
      localStorage.setItem(CLAVE_LOCALSTORAGE_TOKEN, token);
    } else {
      localStorage.removeItem(CLAVE_LOCALSTORAGE_TOKEN);
    }

    if (perfil) {
      localStorage.setItem(CLAVE_LOCALSTORAGE_PERFIL, perfil);
    } else {
      localStorage.removeItem(CLAVE_LOCALSTORAGE_PERFIL);
    }
  } catch {
    // Si el almacenamiento local no está disponible, continuar sin fallar
  }
}

export function ProveedorSesion({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(leerTokenAlmacenado);
  const [usuario, setUsuario] = useState<UsuarioAuth | null>(null);
  const [perfilActivo, setPerfilActivo] = useState<RolPerfil>(() => leerPerfilAlmacenado() || 'productor');
  const [cargando, setCargando] = useState<boolean>(true);

  // Al montar la aplicación, validar el token existente con GET /auth/yo
  useEffect(() => {
    let cancelado = false;

    async function validarSesionInicial() {
      const tokenGuardado = leerTokenAlmacenado();
      if (!tokenGuardado) {
        setCargando(false);
        return;
      }

      try {
        const datosUsuario = await apiYo(tokenGuardado);
        if (!cancelado) {
          setUsuario(datosUsuario);
          setToken(tokenGuardado);
          // Si no había perfil previo guardado, usar el perfil por defecto
          const perfilGuardado = leerPerfilAlmacenado();
          const perfilFinal = perfilGuardado || datosUsuario.perfil_por_defecto;
          setPerfilActivo(perfilFinal);
          guardarEnAlmacenamiento(tokenGuardado, perfilFinal);
        }
      } catch {
        // Token vencido o inválido: cerrar sesión
        if (!cancelado) {
          setToken(null);
          setUsuario(null);
          guardarEnAlmacenamiento(null, null);
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    }

    validarSesionInicial();

    return () => {
      cancelado = true;
    };
  }, []);

  const entrar = async (nombreUsuario: string, clave: string): Promise<void> => {
    const respuesta = await apiEntrar(nombreUsuario, clave);
    setToken(respuesta.token);
    setUsuario(respuesta.usuario);
    const perfilInicial = respuesta.usuario.perfil_por_defecto;
    setPerfilActivo(perfilInicial);
    guardarEnAlmacenamiento(respuesta.token, perfilInicial);
  };

  const salir = (): void => {
    setToken(null);
    setUsuario(null);
    guardarEnAlmacenamiento(null, null);
  };

  const cambiarPerfil = (): void => {
    setPerfilActivo((previo) => {
      const nuevo: RolPerfil = previo === 'productor' ? 'comprador' : 'productor';
      guardarEnAlmacenamiento(token, nuevo);
      return nuevo;
    });
  };

  const refrescarUsuario = async (): Promise<void> => {
    if (!token) return;
    try {
      const datosActualizados = await apiYo(token);
      setUsuario(datosActualizados);
    } catch {
      // Ignorar fallos temporales
    }
  };

  return (
    <ContextoSesion.Provider
      value={{
        usuario,
        perfilActivo,
        token,
        cargando,
        entrar,
        salir,
        cambiarPerfil,
        refrescarUsuario,
      }}
    >
      {children}
    </ContextoSesion.Provider>
  );
}

export function usarSesion(): ContextoSesionTipo {
  const contexto = useContext(ContextoSesion);
  if (!contexto) {
    throw new Error('usarSesion debe ser utilizado dentro de un ProveedorSesion');
  }
  return contexto;
}

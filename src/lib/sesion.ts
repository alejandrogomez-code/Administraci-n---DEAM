'use client';

/**
 * Datos de sesión del usuario (rol, nombre) y contadores de la barra lateral.
 * Se cargan UNA vez y quedan en memoria mientras la app está abierta, así
 * cambiar de sección no vuelve a consultar ni muestra pantallas de "Cargando...".
 */
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cargarAgenda, resumirAgenda, type Resumen } from '@/lib/agenda';

export type Sesion = { id: string; email: string; nombre: string; rol: string | null };

let sesion: Sesion | null = null;
let sesionPromesa: Promise<Sesion | null> | null = null;
let resumen: Resumen | null = null;
let resumenPromesa: Promise<Resumen | null> | null = null;
let resumenAt = 0;
const subs = new Set<() => void>();
const emitir = () => subs.forEach((f) => f());

const CLAVE = 'deam.sesion';

function leerGuardada(): Sesion | null {
  try { const s = sessionStorage.getItem(CLAVE); return s ? JSON.parse(s) : null; } catch { return null; }
}

async function cargarSesion(): Promise<Sesion | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('nombre, rol').eq('id', user.id).single();
  const s: Sesion = { id: user.id, email: user.email ?? '', nombre: (data as any)?.nombre || user.email || '', rol: (data as any)?.rol ?? null };
  try { sessionStorage.setItem(CLAVE, JSON.stringify(s)); } catch {}
  return s;
}

export function useSesion(): Sesion | null {
  const [, forzar] = useState(0);
  useEffect(() => {
    const f = () => forzar((n) => n + 1);
    subs.add(f);
    if (!sesion) {
      const guardada = leerGuardada();
      if (guardada) { sesion = guardada; emitir(); }
    }
    if (!sesionPromesa) {
      sesionPromesa = cargarSesion().then((s) => { sesion = s; emitir(); return s; });
    }
    return () => { subs.delete(f); };
  }, []);
  return sesion;
}

export function limpiarSesion() {
  sesion = null; sesionPromesa = null; resumen = null; resumenPromesa = null;
  try { sessionStorage.removeItem(CLAVE); } catch {}
}

/** Contadores de vencidos por módulo. Se refrescan cada 2 minutos como máximo. */
export function useResumen(habilitado: boolean): Resumen | null {
  const [, forzar] = useState(0);
  useEffect(() => {
    if (!habilitado) return;
    const f = () => forzar((n) => n + 1);
    subs.add(f);
    if (!resumenPromesa || Date.now() - resumenAt > 120_000) refrescarResumen();
    return () => { subs.delete(f); };
  }, [habilitado]);
  return habilitado ? resumen : null;
}

export function refrescarResumen() {
  resumenAt = Date.now();
  resumenPromesa = cargarAgenda(createClient())
    .then((items) => { resumen = resumirAgenda(items); emitir(); return resumen; })
    .catch(() => null);
  return resumenPromesa;
}

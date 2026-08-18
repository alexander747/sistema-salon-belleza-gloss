import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Guard del contrato CSS global: las clases `.mobileBottomSheet*` son las que
 * los batches R2–R5 aplicarán a los modales para el bottom-sheet ≤600px.
 * Si alguien las borra o renombra, este test lo detecta (el CSS no es
 * testeable vía jsdom, así que esta es la red de seguridad mínima).
 */
const globalsCss = readFileSync(join(process.cwd(), 'src/globals.css'), 'utf-8');

describe('utilidad bottom-sheet global (globals.css)', () => {
  it('define .mobileBottomSheet para el overlay', () => {
    expect(globalsCss).toContain('.mobileBottomSheet');
  });

  it('define .mobileBottomSheetContent para el panel', () => {
    expect(globalsCss).toContain('.mobileBottomSheetContent');
  });

  it('aplica el bottom-sheet SOLO ≤600px (media query)', () => {
    const mqIndex = globalsCss.indexOf('@media (max-width: 600px)');
    expect(mqIndex).toBeGreaterThan(-1);
    const nextMq = globalsCss.indexOf('@media', mqIndex + 1);
    const mobileBlock =
      nextMq === -1 ? globalsCss.slice(mqIndex) : globalsCss.slice(mqIndex, nextMq);

    expect(mobileBlock).toContain('.mobileBottomSheet');
    expect(mobileBlock).toContain('align-items: flex-end');
    expect(mobileBlock).toContain('max-width: 100% !important');
    expect(mobileBlock).toContain('max-height: 92vh');
  });
});

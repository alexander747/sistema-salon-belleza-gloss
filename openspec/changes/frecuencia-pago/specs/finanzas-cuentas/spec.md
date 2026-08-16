# Delta for finanzas-cuentas

## ADDED Requirements

### Requirement: Badge "Al día" en sub-vista Pagar

La sub-vista Pagar del tab Cuentas MUST mostrar un badge "Al día" (verde) en la fila de cada empleada con `pendienteActual === 0`, y MUST ordenar esas filas después de las que tienen pendiente.

#### Scenario: Empleada al día con historial

- GIVEN `GET /finanzas/cuentas/pagar` retorna María (pendienteActual=298000) y Sofía (pendienteActual=0, liquidadoAcumulado=200000)
- WHEN se renderiza la sub-vista Pagar
- THEN la fila de Sofía muestra el badge "Al día" y aparece después de la fila de María

#### Scenario: Sin badge cuando hay pendiente

- GIVEN fila con `pendienteActual=298000`
- WHEN se renderiza la sub-vista Pagar
- THEN la fila NO muestra badge "Al día"

#### Scenario: Todas al día

- GIVEN `GET /finanzas/cuentas/pagar` retorna solo empleadas con `pendienteActual=0`
- WHEN se renderiza la sub-vista Pagar
- THEN todas las filas muestran badge "Al día" en orden por empleadaId

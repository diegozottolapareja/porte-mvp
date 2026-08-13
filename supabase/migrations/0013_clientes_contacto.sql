-- ─── PORTE — Paso 13: datos de contacto de Cliente ────────────────────────
-- Agrega email/teléfono principal y secundario. `contacto`/`telefono` quedan
-- deprecados (sin dato real que migrar más allá de `telefono` → `telefono_principal`
-- — `contacto` nunca tuvo semántica clara y en producción está vacío o con
-- datos de prueba, así que no se reinterpreta, solo se deja de usar).

alter table clientes
  add column email_principal text,
  add column email_secundario text,
  add column telefono_principal text,
  add column telefono_secundario text;

update clientes set telefono_principal = nullif(trim(telefono), '') where telefono is not null;

-- Regla: todo cliente debe tener email_principal y/o telefono_principal.
-- Trigger en vez de CHECK constraint (y con lógica de "no empeorar"): un
-- CHECK de tabla se revalida en cada UPDATE incluyendo filas ya existentes,
-- y los clientes de demo actuales no tienen contacto cargado — eso bloquearía
-- cualquier edición futura sobre ellos (soft-delete incluido). Este trigger
-- exige la regla en INSERT siempre, y en UPDATE solo si el cliente ya la
-- cumplía antes del cambio (no permite "romper" un contacto válido, pero
-- tampoco bloquea editar un cliente legacy que ya estaba incompleto).
create or replace function fn_validar_contacto_cliente()
returns trigger as $$
begin
  if new.email_principal is null and new.telefono_principal is null then
    if TG_OP = 'INSERT' then
      raise exception 'CONTACTO_PRINCIPAL_REQUERIDO: el cliente debe tener al menos un email principal o un teléfono principal';
    elsif TG_OP = 'UPDATE' and (old.email_principal is not null or old.telefono_principal is not null) then
      raise exception 'CONTACTO_PRINCIPAL_REQUERIDO: el cliente debe tener al menos un email principal o un teléfono principal';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_validar_contacto_cliente
  before insert or update on clientes
  for each row
  execute function fn_validar_contacto_cliente();

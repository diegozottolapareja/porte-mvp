-- ─── PORTE — Paso 15: el trigger de contacto de Cliente también rechaza strings vacíos ──
-- 0013 ya está aplicada en la base real, así que esto reemplaza la función del
-- trigger (CREATE OR REPLACE, misma firma y mismo trigger) en vez de editar la
-- migración histórica. La regla de negocio no cambia: emailPrincipal y/o
-- telefonoPrincipal siguen siendo obligatorios, con el mismo "no empeorar"
-- para clientes legacy (ver comentario de 0013). El único cambio es que ahora
-- ' ' y '' cuentan como vacío, igual que ya hace fn_validar_condiciones_comerciales
-- (0012) para los campos de la venta.

create or replace function fn_validar_contacto_cliente()
returns trigger as $$
begin
  if (new.email_principal is null or trim(new.email_principal) = '')
     and (new.telefono_principal is null or trim(new.telefono_principal) = '') then
    if TG_OP = 'INSERT' then
      raise exception 'CONTACTO_PRINCIPAL_REQUERIDO: el cliente debe tener al menos un email principal o un teléfono principal';
    elsif TG_OP = 'UPDATE'
      and ((old.email_principal is not null and trim(old.email_principal) <> '')
        or (old.telefono_principal is not null and trim(old.telefono_principal) <> '')) then
      raise exception 'CONTACTO_PRINCIPAL_REQUERIDO: el cliente debe tener al menos un email principal o un teléfono principal';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

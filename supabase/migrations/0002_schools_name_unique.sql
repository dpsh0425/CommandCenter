alter table schools add constraint schools_owner_name_unique unique (owner_id, name);

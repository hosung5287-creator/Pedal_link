SELECT json_build_object(
 'tables', (SELECT json_agg(t ORDER BY t->>'name') FROM (
   SELECT json_build_object('name', c.relname, 'rows', c.reltuples::bigint,
     'cols', (SELECT json_agg(json_build_object('name', a.attname,
                'type', CASE WHEN t.typname IN ('int8') THEN 'bigint' WHEN t.typname IN ('int4','int2') THEN 'int'
                             WHEN t.typname = 'float8' THEN 'double' WHEN t.typname = 'bool' THEN 'bool'
                             WHEN t.typname IN ('timestamp','timestamptz') THEN 'timestamp' WHEN t.typname = 'geometry' THEN 'geometry'
                             WHEN t.typname = 'text' THEN 'text' WHEN t.typname IN ('varchar','bpchar') THEN 'varchar' ELSE t.typname END,
                'notnull', a.attnotnull) ORDER BY a.attnum)
              FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
              WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped),
     'pk', (SELECT json_agg(a.attname) FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
            WHERE i.indrelid = c.oid AND i.indisprimary)) t
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname <> 'spatial_ref_sys') x),
 'fks', (SELECT json_agg(json_build_object('from', cl.relname, 'col', a.attname, 'to', rc.relname) ORDER BY cl.relname, a.attname)
   FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid JOIN pg_class rc ON rc.oid = co.confrelid
   JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = co.conkey[1]
   JOIN pg_namespace n ON n.oid = cl.relnamespace
   WHERE co.contype = 'f' AND n.nspname = 'public')
);

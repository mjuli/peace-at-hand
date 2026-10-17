CREATE OR REPLACE FUNCTION public.record_practice(p_id uuid, p_tipo text, p_minutes integer, p_completed timestamptz, p_count_check boolean DEFAULT false) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); existing public.sessions%ROWTYPE; n integer; ph integer := 3; num integer; counts boolean;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
 IF p_tipo NOT IN ('jornada','livre','manual') OR p_minutes < 1 OR p_minutes > 120 THEN RAISE EXCEPTION 'Invalid practice'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 0));
 SELECT * INTO existing FROM public.sessions WHERE id = p_id AND user_id = uid;
 IF FOUND THEN RETURN jsonb_build_object('sessionId', existing.id, 'next', CASE WHEN existing.check_numero IS NULL THEN NULL ELSE jsonb_build_object('phase',existing.fase,'number',existing.check_numero) END); END IF;
 counts := p_tipo = 'jornada' OR (p_tipo = 'manual' AND p_count_check);
 IF counts THEN
 SELECT count(*) INTO n FROM public.checks WHERE user_id = uid AND reset_at IS NULL;
 WHILE ph <= 30 AND n >= ph LOOP n := n - ph; ph := ph + 1; END LOOP;
 IF ph <= 30 THEN num := n + 1; END IF;
 END IF;
 INSERT INTO public.sessions(id,user_id,tipo,duracao_min,planned_minutes,extra_seconds,concluida_em,fase,check_numero) VALUES (p_id,uid,p_tipo,p_minutes,p_minutes,0,p_completed, CASE WHEN num IS NOT NULL THEN ph WHEN p_tipo = 'jornada' THEN 30 ELSE NULL END,num);
 IF num IS NOT NULL THEN INSERT INTO public.checks(user_id,fase,check_numero,session_id) VALUES(uid,ph,num,p_id); END IF;
 RETURN jsonb_build_object('sessionId',p_id,'next',CASE WHEN num IS NULL THEN NULL ELSE jsonb_build_object('phase',ph,'number',num) END);
END $$;
REVOKE ALL ON FUNCTION public.record_practice(uuid,text,integer,timestamptz,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_practice(uuid,text,integer,timestamptz,boolean) TO authenticated;
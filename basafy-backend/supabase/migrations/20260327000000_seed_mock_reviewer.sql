-- ─── SEED: Mock reviewer data for reviewer@basafy.app ────────────────────────
-- 100 applications, 30 with follow-up emails/events, spread over 90 days.

DO $$
DECLARE
  v_uid uuid;
  r01 uuid := 'aa000001-0000-0000-0000-000000000001';
  r02 uuid := 'aa000001-0000-0000-0000-000000000002';
  r03 uuid := 'aa000001-0000-0000-0000-000000000003';
  r04 uuid := 'aa000001-0000-0000-0000-000000000004';
  r05 uuid := 'aa000001-0000-0000-0000-000000000005';
  r06 uuid := 'aa000001-0000-0000-0000-000000000006';
  r07 uuid := 'aa000001-0000-0000-0000-000000000007';
  r08 uuid := 'aa000001-0000-0000-0000-000000000008';
  o01 uuid := 'bb000001-0000-0000-0000-000000000001';
  o02 uuid := 'bb000001-0000-0000-0000-000000000002';
  o03 uuid := 'bb000001-0000-0000-0000-000000000003';
  o04 uuid := 'bb000001-0000-0000-0000-000000000004';
  o05 uuid := 'bb000001-0000-0000-0000-000000000005';
  i01 uuid := 'cc000001-0000-0000-0000-000000000001';
  i02 uuid := 'cc000001-0000-0000-0000-000000000002';
  i03 uuid := 'cc000001-0000-0000-0000-000000000003';
  i04 uuid := 'cc000001-0000-0000-0000-000000000004';
  i05 uuid := 'cc000001-0000-0000-0000-000000000005';
  i06 uuid := 'cc000001-0000-0000-0000-000000000006';
  i07 uuid := 'cc000001-0000-0000-0000-000000000007';
  i08 uuid := 'cc000001-0000-0000-0000-000000000008';
  i09 uuid := 'cc000001-0000-0000-0000-000000000009';
  i10 uuid := 'cc000001-0000-0000-0000-000000000010';
  s01 uuid := 'dd000001-0000-0000-0000-000000000001';
  s02 uuid := 'dd000001-0000-0000-0000-000000000002';
  s03 uuid := 'dd000001-0000-0000-0000-000000000003';
  s04 uuid := 'dd000001-0000-0000-0000-000000000004';
  s05 uuid := 'dd000001-0000-0000-0000-000000000005';
  s06 uuid := 'dd000001-0000-0000-0000-000000000006';
  s07 uuid := 'dd000001-0000-0000-0000-000000000007';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = 'reviewer@basafy.app';
  IF v_uid IS NULL THEN RAISE EXCEPTION 'User reviewer@basafy.app not found'; END IF;

  UPDATE auth.users
     SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('is_mock', true)
   WHERE id = v_uid;

  DELETE FROM notifications    WHERE user_id = v_uid;
  DELETE FROM events           WHERE user_id = v_uid;
  DELETE FROM tasks            WHERE user_id = v_uid;
  DELETE FROM job_email_events WHERE user_id = v_uid;
  DELETE FROM mock_gmail_messages WHERE user_id = v_uid;
  DELETE FROM applications     WHERE user_id = v_uid;

  -- ══════════════════════════════════════════════════════════════════════════
  -- 1. APPLICATIONS
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO applications (id, user_id, company, role, role_title, status, source_type,
    gmail_message_id, gmail_thread_id, applied_at, is_hidden, is_starred, canonical_key)
  VALUES
  -- Rejected (8)
  (r01,v_uid,'Vortex Systems','Senior Software Engineer','Senior Software Engineer','rejected','gmail','msg_r01_init','thd_r01',now()-'82 days'::interval,false,false,'vortexsystems_seniorswe'),
  (r02,v_uid,'Nimbus Labs','Data Engineer','Data Engineer','rejected','gmail','msg_r02_init','thd_r02',now()-'75 days'::interval,false,false,'nimbuslabs_dataengineer'),
  (r03,v_uid,'Coderift','Backend Engineer','Backend Engineer','rejected','gmail','msg_r03_init','thd_r03',now()-'70 days'::interval,false,false,'coderift_backendengineer'),
  (r04,v_uid,'Stratum AI','ML Engineer','Machine Learning Engineer','rejected','gmail','msg_r04_init','thd_r04',now()-'65 days'::interval,false,false,'stratumai_mlengineer'),
  (r05,v_uid,'Pixelforge','Frontend Engineer','Senior Frontend Engineer','rejected','gmail','msg_r05_init','thd_r05',now()-'60 days'::interval,false,false,'pixelforge_frontendengineer'),
  (r06,v_uid,'Orbitnode','Platform Engineer','Platform Engineer II','rejected','gmail','msg_r06_init','thd_r06',now()-'55 days'::interval,false,false,'orbitnode_platformengineer'),
  (r07,v_uid,'Datafusion Co','Senior Data Engineer','Senior Data Engineer','rejected','gmail','msg_r07_init','thd_r07',now()-'50 days'::interval,false,false,'datafusionco_seniordataengineer'),
  (r08,v_uid,'Syncline Tech','Software Engineer II','Software Engineer II','rejected','gmail','msg_r08_init','thd_r08',now()-'45 days'::interval,false,false,'synclinetech_swe2'),
  -- Offers (5)
  (o01,v_uid,'Luminary IO','Senior Software Engineer','Senior Software Engineer','offer','gmail','msg_o01_init','thd_o01',now()-'80 days'::interval,false,true,'luminaryio_seniorswe'),
  (o02,v_uid,'Archway Systems','Staff Engineer','Staff Software Engineer','offer','gmail','msg_o02_init','thd_o02',now()-'72 days'::interval,false,true,'archwaysystems_staffengineer'),
  (o03,v_uid,'Novastream','Data Engineer','Data Engineer','offer','gmail','msg_o03_init','thd_o03',now()-'68 days'::interval,false,false,'novastream_dataengineer'),
  (o04,v_uid,'Clearpath Analytics','Senior Data Engineer','Senior Data Engineer','offer','gmail','msg_o04_init','thd_o04',now()-'58 days'::interval,false,true,'clearpathanalytics_seniordataengineer'),
  (o05,v_uid,'Ironclad Labs','Backend Engineer','Senior Backend Engineer','offer','gmail','msg_o05_init','thd_o05',now()-'40 days'::interval,false,false,'ironclad_backendengineer'),
  -- Interviewing (10)
  (i01,v_uid,'Stackwave','Software Engineer','Software Engineer','interview','gmail','msg_i01_init','thd_i01',now()-'28 days'::interval,false,false,'stackwave_swe'),
  (i02,v_uid,'Meridian Cloud','Senior Software Engineer','Senior Software Engineer','interview','gmail','msg_i02_init','thd_i02',now()-'22 days'::interval,false,false,'meridiancloud_seniorswe'),
  (i03,v_uid,'Pulsedata','Data Engineer','Data Engineer','interview','gmail','msg_i03_init','thd_i03',now()-'20 days'::interval,false,true,'pulsedata_dataengineer'),
  (i04,v_uid,'Terraform Digital','Platform Engineer','Senior Platform Engineer','interview','gmail','msg_i04_init','thd_i04',now()-'18 days'::interval,false,false,'terraformdigital_platformengineer'),
  (i05,v_uid,'Cloudrift Analytics','Senior Data Engineer','Senior Data Engineer','interview','gmail','msg_i05_init','thd_i05',now()-'15 days'::interval,false,false,'cloudrift_seniordataengineer'),
  (i06,v_uid,'Basepoint Tech','Backend Engineer','Backend Engineer','interview','gmail','msg_i06_init','thd_i06',now()-'14 days'::interval,false,false,'basepointtech_backendengineer'),
  (i07,v_uid,'Quantum IO','ML Engineer','Machine Learning Engineer','interview','gmail','msg_i07_init','thd_i07',now()-'12 days'::interval,false,false,'quantumio_mlengineer'),
  (i08,v_uid,'Flowstate Systems','Software Engineer','Software Engineer','interview','gmail','msg_i08_init','thd_i08',now()-'10 days'::interval,false,false,'flowstatesystems_swe'),
  (i09,v_uid,'Apexline','Senior Backend Engineer','Senior Backend Engineer','interview','gmail','msg_i09_init','thd_i09',now()-'8 days'::interval,false,false,'apexline_seniorbackendengineer'),
  (i10,v_uid,'Dataseam','Data Engineer','Data Engineer','interview','gmail','msg_i10_init','thd_i10',now()-'5 days'::interval,false,true,'dataseam_dataengineer'),
  -- Assessment (7)
  (s01,v_uid,'Bridgewater Tech','Software Engineer','Software Engineer','assessment','gmail','msg_s01_init','thd_s01',now()-'32 days'::interval,false,false,'bridgewatertech_swe'),
  (s02,v_uid,'Axiom Labs','Data Engineer','Data Engineer','assessment','gmail','msg_s02_init','thd_s02',now()-'25 days'::interval,false,false,'axiomlabs_dataengineer'),
  (s03,v_uid,'Synapse Systems','Backend Engineer','Backend Engineer','assessment','gmail','msg_s03_init','thd_s03',now()-'21 days'::interval,false,false,'synapsesystems_backendengineer'),
  (s04,v_uid,'Gridlock IO','Platform Engineer','Senior Platform Engineer','assessment','gmail','msg_s04_init','thd_s04',now()-'16 days'::interval,false,false,'gridlockio_platformengineer'),
  (s05,v_uid,'Helix Analytics','Senior Data Engineer','Senior Data Engineer','assessment','gmail','msg_s05_init','thd_s05',now()-'11 days'::interval,false,false,'helixanalytics_seniordataengineer'),
  (s06,v_uid,'Ironside Tech','Software Engineer','Software Engineer','assessment','gmail','msg_s06_init','thd_s06',now()-'7 days'::interval,false,false,'ironsidetech_swe'),
  (s07,v_uid,'Nexusflow','ML Engineer','Machine Learning Engineer','assessment','gmail','msg_s07_init','thd_s07',now()-'4 days'::interval,false,false,'nexusflow_mlengineer'),
  -- Applied only (70)
  (gen_random_uuid(),v_uid,'Driftline','Software Engineer','Software Engineer','applied','gmail','msg_p01','thd_p01',now()-'89 days'::interval,false,false,'driftline_swe'),
  (gen_random_uuid(),v_uid,'Kraken Data','Data Engineer','Data Engineer','applied','gmail','msg_p02','thd_p02',now()-'87 days'::interval,false,false,'krakendata_de'),
  (gen_random_uuid(),v_uid,'Torrent Systems','Backend Engineer','Backend Engineer','applied','gmail','msg_p03','thd_p03',now()-'86 days'::interval,false,false,'torrentsystems_be'),
  (gen_random_uuid(),v_uid,'Vaultline','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p04','thd_p04',now()-'85 days'::interval,false,false,'vaultline_seniorswe'),
  (gen_random_uuid(),v_uid,'Spark Infra','Platform Engineer','Platform Engineer','applied','gmail','msg_p05','thd_p05',now()-'84 days'::interval,false,false,'sparkinfra_platformengineer'),
  (gen_random_uuid(),v_uid,'Cipher IO','ML Engineer','ML Engineer','applied','gmail','msg_p06','thd_p06',now()-'83 days'::interval,false,false,'cipherio_mlengineer'),
  (gen_random_uuid(),v_uid,'Logstream','Data Engineer','Data Engineer','applied','gmail','msg_p07','thd_p07',now()-'82 days'::interval,false,false,'logstream_de'),
  (gen_random_uuid(),v_uid,'Redshift Labs','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p08','thd_p08',now()-'81 days'::interval,false,false,'redshiftlabs_senioride'),
  (gen_random_uuid(),v_uid,'Edgepoint','Software Engineer','Software Engineer','applied','gmail','msg_p09','thd_p09',now()-'80 days'::interval,false,false,'edgepoint_swe'),
  (gen_random_uuid(),v_uid,'Coldstart','Backend Engineer','Backend Engineer','applied','gmail','msg_p10','thd_p10',now()-'79 days'::interval,false,false,'coldstart_be'),
  (gen_random_uuid(),v_uid,'Pantera Analytics','Data Engineer','Data Engineer','applied','gmail','msg_p11','thd_p11',now()-'78 days'::interval,false,false,'panteraanalytics_de'),
  (gen_random_uuid(),v_uid,'Frostline Tech','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p12','thd_p12',now()-'77 days'::interval,false,false,'frostlinetech_seniorswe'),
  (gen_random_uuid(),v_uid,'Switchboard AI','ML Engineer','ML Engineer','applied','gmail','msg_p13','thd_p13',now()-'76 days'::interval,false,false,'switchboardai_mlengineer'),
  (gen_random_uuid(),v_uid,'Lattice Cloud','Platform Engineer','Platform Engineer','applied','gmail','msg_p14','thd_p14',now()-'74 days'::interval,false,false,'latticecloud_platformengineer'),
  (gen_random_uuid(),v_uid,'Borealis Systems','Software Engineer','Software Engineer','applied','gmail','msg_p15','thd_p15',now()-'73 days'::interval,false,false,'borealis_swe'),
  (gen_random_uuid(),v_uid,'Corenet','Backend Engineer','Backend Engineer','applied','gmail','msg_p16','thd_p16',now()-'72 days'::interval,false,false,'corenet_be'),
  (gen_random_uuid(),v_uid,'Patchwork Labs','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p17','thd_p17',now()-'71 days'::interval,false,false,'patchworklabs_seniorde'),
  (gen_random_uuid(),v_uid,'Comet Data','Data Engineer','Data Engineer','applied','gmail','msg_p18','thd_p18',now()-'70 days'::interval,false,false,'cometdata_de'),
  (gen_random_uuid(),v_uid,'Rootline','Software Engineer','Software Engineer','applied','gmail','msg_p19','thd_p19',now()-'69 days'::interval,false,false,'rootline_swe'),
  (gen_random_uuid(),v_uid,'Pathfinder Tech','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p20','thd_p20',now()-'68 days'::interval,false,false,'pathfindertech_seniorswe'),
  (gen_random_uuid(),v_uid,'Silo Systems','Platform Engineer','Platform Engineer','applied','gmail','msg_p21','thd_p21',now()-'67 days'::interval,false,false,'silosystems_platformengineer'),
  (gen_random_uuid(),v_uid,'Windfall AI','ML Engineer','ML Engineer','applied','gmail','msg_p22','thd_p22',now()-'66 days'::interval,false,false,'windfallai_mlengineer'),
  (gen_random_uuid(),v_uid,'Snapstack','Backend Engineer','Backend Engineer','applied','gmail','msg_p23','thd_p23',now()-'64 days'::interval,false,false,'snapstack_be'),
  (gen_random_uuid(),v_uid,'Prism Data','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p24','thd_p24',now()-'63 days'::interval,false,false,'prismdata_seniorde'),
  (gen_random_uuid(),v_uid,'Carbonite Labs','Software Engineer','Software Engineer','applied','gmail','msg_p25','thd_p25',now()-'62 days'::interval,false,false,'carbornitelabs_swe'),
  (gen_random_uuid(),v_uid,'Pulsar Engineering','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p26','thd_p26',now()-'61 days'::interval,false,false,'pulsarengineering_seniorswe'),
  (gen_random_uuid(),v_uid,'Anchor Systems','Data Engineer','Data Engineer','applied','gmail','msg_p27','thd_p27',now()-'59 days'::interval,false,false,'anchorsystems_de'),
  (gen_random_uuid(),v_uid,'Tangent IO','Backend Engineer','Backend Engineer','applied','gmail','msg_p28','thd_p28',now()-'57 days'::interval,false,false,'tangentio_be'),
  (gen_random_uuid(),v_uid,'Wavefront Labs','Platform Engineer','Platform Engineer','applied','gmail','msg_p29','thd_p29',now()-'56 days'::interval,false,false,'wavefrontlabs_platformengineer'),
  (gen_random_uuid(),v_uid,'Sundial Cloud','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p30','thd_p30',now()-'54 days'::interval,false,false,'sundialcloud_seniorde'),
  (gen_random_uuid(),v_uid,'Blockstream Data','Data Engineer','Data Engineer','applied','gmail','msg_p31','thd_p31',now()-'53 days'::interval,false,false,'blockstreamdata_de'),
  (gen_random_uuid(),v_uid,'Crux Systems','Software Engineer','Software Engineer','applied','gmail','msg_p32','thd_p32',now()-'52 days'::interval,false,false,'cruxsystems_swe'),
  (gen_random_uuid(),v_uid,'Dawntech','ML Engineer','ML Engineer','applied','gmail','msg_p33','thd_p33',now()-'51 days'::interval,false,false,'dawntech_mlengineer'),
  (gen_random_uuid(),v_uid,'Cobalt Infra','Platform Engineer','Platform Engineer','applied','gmail','msg_p34','thd_p34',now()-'49 days'::interval,false,false,'cobaltinfra_platformengineer'),
  (gen_random_uuid(),v_uid,'Rimfire Analytics','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p35','thd_p35',now()-'48 days'::interval,false,false,'rimfireanalytics_seniorde'),
  (gen_random_uuid(),v_uid,'Pinnacle IO','Backend Engineer','Backend Engineer','applied','gmail','msg_p36','thd_p36',now()-'47 days'::interval,false,false,'pinnacleio_be'),
  (gen_random_uuid(),v_uid,'Echosphere','Software Engineer','Software Engineer','applied','gmail','msg_p37','thd_p37',now()-'46 days'::interval,false,false,'echosphere_swe'),
  (gen_random_uuid(),v_uid,'Folio Systems','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p38','thd_p38',now()-'44 days'::interval,false,false,'foliosystems_seniorswe'),
  (gen_random_uuid(),v_uid,'Glyph Data','Data Engineer','Data Engineer','applied','gmail','msg_p39','thd_p39',now()-'43 days'::interval,false,false,'glyphdata_de'),
  (gen_random_uuid(),v_uid,'Halo Labs','ML Engineer','ML Engineer','applied','gmail','msg_p40','thd_p40',now()-'42 days'::interval,false,false,'halolabs_mlengineer'),
  (gen_random_uuid(),v_uid,'Ingress Tech','Platform Engineer','Platform Engineer','applied','gmail','msg_p41','thd_p41',now()-'41 days'::interval,false,false,'ingresstech_platformengineer'),
  (gen_random_uuid(),v_uid,'Jolt Systems','Backend Engineer','Backend Engineer','applied','gmail','msg_p42','thd_p42',now()-'39 days'::interval,false,false,'joltsystems_be'),
  (gen_random_uuid(),v_uid,'Keystone Cloud','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p43','thd_p43',now()-'38 days'::interval,false,false,'keystonecloud_seniorde'),
  (gen_random_uuid(),v_uid,'Lodestar IO','Software Engineer','Software Engineer','applied','gmail','msg_p44','thd_p44',now()-'37 days'::interval,false,false,'lodestar_swe'),
  (gen_random_uuid(),v_uid,'Mantis Labs','Data Engineer','Data Engineer','applied','gmail','msg_p45','thd_p45',now()-'36 days'::interval,false,false,'mantislabs_de'),
  (gen_random_uuid(),v_uid,'Nomad Systems','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p46','thd_p46',now()-'35 days'::interval,false,false,'nomadsystems_seniorswe'),
  (gen_random_uuid(),v_uid,'Offaxis Tech','ML Engineer','ML Engineer','applied','gmail','msg_p47','thd_p47',now()-'34 days'::interval,false,false,'offaxistech_mlengineer'),
  (gen_random_uuid(),v_uid,'Pivot Analytics','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p48','thd_p48',now()-'33 days'::interval,false,false,'pivotanalytics_seniorde'),
  (gen_random_uuid(),v_uid,'Quasar Cloud','Platform Engineer','Platform Engineer','applied','gmail','msg_p49','thd_p49',now()-'31 days'::interval,false,false,'quasarcloud_platformengineer'),
  (gen_random_uuid(),v_uid,'Relay Systems','Backend Engineer','Backend Engineer','applied','gmail','msg_p50','thd_p50',now()-'30 days'::interval,false,false,'relaysystems_be'),
  (gen_random_uuid(),v_uid,'Seraph Data','Data Engineer','Data Engineer','applied','gmail','msg_p51','thd_p51',now()-'29 days'::interval,false,false,'seraphdata_de'),
  (gen_random_uuid(),v_uid,'Trident IO','Software Engineer','Software Engineer','applied','gmail','msg_p52','thd_p52',now()-'27 days'::interval,false,false,'tridentio_swe'),
  (gen_random_uuid(),v_uid,'Uplift Labs','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p53','thd_p53',now()-'26 days'::interval,false,false,'upliftlabs_seniorswe'),
  (gen_random_uuid(),v_uid,'Vector Systems','ML Engineer','ML Engineer','applied','gmail','msg_p54','thd_p54',now()-'24 days'::interval,false,false,'vectorsystems_mlengineer'),
  (gen_random_uuid(),v_uid,'Windmill Analytics','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p55','thd_p55',now()-'23 days'::interval,false,false,'windmillanalytics_seniorde'),
  (gen_random_uuid(),v_uid,'Xenon Cloud','Platform Engineer','Platform Engineer','applied','gmail','msg_p56','thd_p56',now()-'19 days'::interval,false,false,'xenoncloud_platformengineer'),
  (gen_random_uuid(),v_uid,'Yoke Systems','Backend Engineer','Backend Engineer','applied','gmail','msg_p57','thd_p57',now()-'17 days'::interval,false,false,'yokesystems_be'),
  (gen_random_uuid(),v_uid,'Zenith Data','Data Engineer','Data Engineer','applied','gmail','msg_p58','thd_p58',now()-'13 days'::interval,false,false,'zenithdata_de'),
  (gen_random_uuid(),v_uid,'Aporion Labs','Software Engineer','Software Engineer','applied','gmail','msg_p59','thd_p59',now()-'9 days'::interval,false,false,'aporionlabs_swe'),
  (gen_random_uuid(),v_uid,'Brindlewood','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p60','thd_p60',now()-'6 days'::interval,false,false,'brindlewood_seniorswe'),
  (gen_random_uuid(),v_uid,'Cobweb Systems','ML Engineer','ML Engineer','applied','gmail','msg_p61','thd_p61',now()-'3 days'::interval,false,false,'cobwebsystems_mlengineer'),
  (gen_random_uuid(),v_uid,'Duplexio','Backend Engineer','Backend Engineer','applied','gmail','msg_p62','thd_p62',now()-'2 days'::interval,false,false,'duplexio_be'),
  (gen_random_uuid(),v_uid,'Ember Analytics','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p63','thd_p63',now()-'1 day'::interval,false,false,'emberanalytics_seniorde'),
  (gen_random_uuid(),v_uid,'Formant Cloud','Platform Engineer','Platform Engineer','applied','gmail','msg_p64','thd_p64',now()-'88 days'::interval,false,false,'formantcloud_platformengineer'),
  (gen_random_uuid(),v_uid,'Gridline Systems','Software Engineer','Software Engineer','applied','gmail','msg_p65','thd_p65',now()-'76 days'::interval,false,false,'gridlinesystems_swe'),
  (gen_random_uuid(),v_uid,'Harbour Data','Data Engineer','Data Engineer','applied','gmail','msg_p66','thd_p66',now()-'43 days'::interval,false,false,'harbourdata_de'),
  (gen_random_uuid(),v_uid,'Inkwell Labs','Senior Software Engineer','Senior Software Engineer','applied','gmail','msg_p67','thd_p67',now()-'38 days'::interval,false,false,'inkwelllabs_seniorswe'),
  (gen_random_uuid(),v_uid,'Jetsam Tech','ML Engineer','ML Engineer','applied','gmail','msg_p68','thd_p68',now()-'25 days'::interval,false,false,'jetsamtech_mlengineer'),
  (gen_random_uuid(),v_uid,'Kestrel IO','Backend Engineer','Backend Engineer','applied','gmail','msg_p69','thd_p69',now()-'16 days'::interval,false,false,'kestrelio_be'),
  (gen_random_uuid(),v_uid,'Lantern Analytics','Senior Data Engineer','Senior Data Engineer','applied','gmail','msg_p70','thd_p70',now()-'7 days'::interval,false,false,'lanternanalytics_seniorde')
  ON CONFLICT DO NOTHING;


  -- ══════════════════════════════════════════════════════════════════════════
  -- 2. JOB_EMAIL_EVENTS — initial application confirmations
  --    Actual columns: user_id, gmail_message_id, gmail_thread_id, raw_from,
  --                    received_at, event_type, parsed_company, parsed_role,
  --                    parsed_status, confidence, application_id
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO job_email_events (
    user_id, gmail_message_id, gmail_thread_id, raw_from,
    received_at, event_type, parsed_company, parsed_role,
    parsed_status, confidence, application_id
  ) VALUES
  -- Rejected — initial
  (v_uid,'msg_r01_init','thd_r01','careers@vortexsystems.io',now()-'82 days'::interval,'applied','Vortex Systems','Senior Software Engineer','applied',0.92,r01),
  (v_uid,'msg_r02_init','thd_r02','no-reply@greenhouse.io',now()-'75 days'::interval,'applied','Nimbus Labs','Data Engineer','applied',0.90,r02),
  (v_uid,'msg_r03_init','thd_r03','hello@coderift.dev',now()-'70 days'::interval,'applied','Coderift','Backend Engineer','applied',0.88,r03),
  (v_uid,'msg_r04_init','thd_r04','talent@stratumai.co',now()-'65 days'::interval,'applied','Stratum AI','ML Engineer','applied',0.91,r04),
  (v_uid,'msg_r05_init','thd_r05','jobs@pixelforge.com',now()-'60 days'::interval,'applied','Pixelforge','Frontend Engineer','applied',0.89,r05),
  (v_uid,'msg_r06_init','thd_r06','noreply@lever.co',now()-'55 days'::interval,'applied','Orbitnode','Platform Engineer','applied',0.87,r06),
  (v_uid,'msg_r07_init','thd_r07','recruiter@datafusionco.com',now()-'50 days'::interval,'applied','Datafusion Co','Senior Data Engineer','applied',0.93,r07),
  (v_uid,'msg_r08_init','thd_r08','careers@syncline.tech',now()-'45 days'::interval,'applied','Syncline Tech','Software Engineer II','applied',0.90,r08),
  -- Offers — initial
  (v_uid,'msg_o01_init','thd_o01','no-reply@luminaryio.com',now()-'80 days'::interval,'applied','Luminary IO','Senior Software Engineer','applied',0.93,o01),
  (v_uid,'msg_o02_init','thd_o02','talent@archwaysystems.io',now()-'72 days'::interval,'applied','Archway Systems','Staff Engineer','applied',0.91,o02),
  (v_uid,'msg_o03_init','thd_o03','jobs@novastream.ai',now()-'68 days'::interval,'applied','Novastream','Data Engineer','applied',0.89,o03),
  (v_uid,'msg_o04_init','thd_o04','noreply@greenhouse.io',now()-'58 days'::interval,'applied','Clearpath Analytics','Senior Data Engineer','applied',0.92,o04),
  (v_uid,'msg_o05_init','thd_o05','recruiter@ironclad.io',now()-'40 days'::interval,'applied','Ironclad Labs','Backend Engineer','applied',0.88,o05),
  -- Interviewing — initial
  (v_uid,'msg_i01_init','thd_i01','careers@stackwave.dev',now()-'28 days'::interval,'applied','Stackwave','Software Engineer','applied',0.90,i01),
  (v_uid,'msg_i02_init','thd_i02','noreply@lever.co',now()-'22 days'::interval,'applied','Meridian Cloud','Senior Software Engineer','applied',0.91,i02),
  (v_uid,'msg_i03_init','thd_i03','hello@pulsedata.io',now()-'20 days'::interval,'applied','Pulsedata','Data Engineer','applied',0.93,i03),
  (v_uid,'msg_i04_init','thd_i04','jobs@terraformdigital.com',now()-'18 days'::interval,'applied','Terraform Digital','Platform Engineer','applied',0.88,i04),
  (v_uid,'msg_i05_init','thd_i05','talent@cloudrift.io',now()-'15 days'::interval,'applied','Cloudrift Analytics','Senior Data Engineer','applied',0.90,i05),
  (v_uid,'msg_i06_init','thd_i06','no-reply@greenhouse.io',now()-'14 days'::interval,'applied','Basepoint Tech','Backend Engineer','applied',0.89,i06),
  (v_uid,'msg_i07_init','thd_i07','careers@quantumio.ai',now()-'12 days'::interval,'applied','Quantum IO','ML Engineer','applied',0.92,i07),
  (v_uid,'msg_i08_init','thd_i08','recruiter@flowstate.systems',now()-'10 days'::interval,'applied','Flowstate Systems','Software Engineer','applied',0.87,i08),
  (v_uid,'msg_i09_init','thd_i09','talent@apexline.tech',now()-'8 days'::interval,'applied','Apexline','Senior Backend Engineer','applied',0.91,i09),
  (v_uid,'msg_i10_init','thd_i10','hello@dataseam.co',now()-'5 days'::interval,'applied','Dataseam','Data Engineer','applied',0.90,i10),
  -- Assessment — initial
  (v_uid,'msg_s01_init','thd_s01','noreply@greenhouse.io',now()-'32 days'::interval,'applied','Bridgewater Tech','Software Engineer','applied',0.88,s01),
  (v_uid,'msg_s02_init','thd_s02','careers@axiomlabs.io',now()-'25 days'::interval,'applied','Axiom Labs','Data Engineer','applied',0.91,s02),
  (v_uid,'msg_s03_init','thd_s03','jobs@synapsesystems.dev',now()-'21 days'::interval,'applied','Synapse Systems','Backend Engineer','applied',0.89,s03),
  (v_uid,'msg_s04_init','thd_s04','talent@gridlockio.com',now()-'16 days'::interval,'applied','Gridlock IO','Platform Engineer','applied',0.90,s04),
  (v_uid,'msg_s05_init','thd_s05','recruiter@helixanalytics.io',now()-'11 days'::interval,'applied','Helix Analytics','Senior Data Engineer','applied',0.93,s05),
  (v_uid,'msg_s06_init','thd_s06','no-reply@lever.co',now()-'7 days'::interval,'applied','Ironside Tech','Software Engineer','applied',0.87,s06),
  (v_uid,'msg_s07_init','thd_s07','careers@nexusflow.ai',now()-'4 days'::interval,'applied','Nexusflow','ML Engineer','applied',0.92,s07)
  ON CONFLICT (user_id, gmail_message_id) DO NOTHING;


  -- ══════════════════════════════════════════════════════════════════════════
  -- 3. JOB_EMAIL_EVENTS — follow-up emails for 30 apps
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO job_email_events (
    user_id, gmail_message_id, gmail_thread_id, raw_from,
    received_at, event_type, parsed_company, parsed_role,
    parsed_status, confidence, application_id
  ) VALUES
  -- r01 Vortex Systems: phone screen → technical → rejected
  (v_uid,'msg_r01_screen','thd_r01','careers@vortexsystems.io',now()-'79 days'::interval,'interview_invite','Vortex Systems','Senior Software Engineer','interview',0.91,r01),
  (v_uid,'msg_r01_tech','thd_r01','careers@vortexsystems.io',now()-'76 days'::interval,'interview_invite','Vortex Systems','Senior Software Engineer','interview',0.90,r01),
  (v_uid,'msg_r01_rej','thd_r01','careers@vortexsystems.io',now()-'73 days'::interval,'rejection','Vortex Systems','Senior Software Engineer','rejected',0.95,r01),
  -- r02 Nimbus Labs: recruiter call → rejected
  (v_uid,'msg_r02_call','thd_r02','no-reply@greenhouse.io',now()-'72 days'::interval,'interview_invite','Nimbus Labs','Data Engineer','interview',0.88,r02),
  (v_uid,'msg_r02_rej','thd_r02','no-reply@greenhouse.io',now()-'68 days'::interval,'rejection','Nimbus Labs','Data Engineer','rejected',0.94,r02),
  -- r03 Coderift: assessment → interview → rejected
  (v_uid,'msg_r03_assess','thd_r03','hello@coderift.dev',now()-'67 days'::interval,'assessment','Coderift','Backend Engineer','assessment',0.92,r03),
  (v_uid,'msg_r03_interview','thd_r03','hello@coderift.dev',now()-'62 days'::interval,'interview_invite','Coderift','Backend Engineer','interview',0.90,r03),
  (v_uid,'msg_r03_rej','thd_r03','hello@coderift.dev',now()-'58 days'::interval,'rejection','Coderift','Backend Engineer','rejected',0.96,r03),
  -- r04 Stratum AI: interview → rejected
  (v_uid,'msg_r04_interview','thd_r04','talent@stratumai.co',now()-'62 days'::interval,'interview_invite','Stratum AI','ML Engineer','interview',0.91,r04),
  (v_uid,'msg_r04_rej','thd_r04','talent@stratumai.co',now()-'58 days'::interval,'rejection','Stratum AI','ML Engineer','rejected',0.94,r04),
  -- r05 Pixelforge: rejected directly
  (v_uid,'msg_r05_rej','thd_r05','jobs@pixelforge.com',now()-'56 days'::interval,'rejection','Pixelforge','Frontend Engineer','rejected',0.93,r05),
  -- r06 Orbitnode: phone screen → rejected
  (v_uid,'msg_r06_screen','thd_r06','noreply@lever.co',now()-'52 days'::interval,'interview_invite','Orbitnode','Platform Engineer','interview',0.89,r06),
  (v_uid,'msg_r06_rej','thd_r06','noreply@lever.co',now()-'48 days'::interval,'rejection','Orbitnode','Platform Engineer','rejected',0.93,r06),
  -- r07 Datafusion Co: screen → tech1 → tech2 → rejected
  (v_uid,'msg_r07_screen','thd_r07','recruiter@datafusionco.com',now()-'47 days'::interval,'interview_invite','Datafusion Co','Senior Data Engineer','interview',0.90,r07),
  (v_uid,'msg_r07_tech1','thd_r07','recruiter@datafusionco.com',now()-'44 days'::interval,'interview_invite','Datafusion Co','Senior Data Engineer','interview',0.91,r07),
  (v_uid,'msg_r07_tech2','thd_r07','recruiter@datafusionco.com',now()-'41 days'::interval,'interview_invite','Datafusion Co','Senior Data Engineer','interview',0.90,r07),
  (v_uid,'msg_r07_rej','thd_r07','recruiter@datafusionco.com',now()-'37 days'::interval,'rejection','Datafusion Co','Senior Data Engineer','rejected',0.96,r07),
  -- r08 Syncline Tech: rejected directly
  (v_uid,'msg_r08_rej','thd_r08','careers@syncline.tech',now()-'40 days'::interval,'rejection','Syncline Tech','Software Engineer II','rejected',0.92,r08),
  -- o01 Luminary IO: screen → tech → final → offer
  (v_uid,'msg_o01_screen','thd_o01','no-reply@luminaryio.com',now()-'77 days'::interval,'interview_invite','Luminary IO','Senior Software Engineer','interview',0.91,o01),
  (v_uid,'msg_o01_tech','thd_o01','no-reply@luminaryio.com',now()-'73 days'::interval,'interview_invite','Luminary IO','Senior Software Engineer','interview',0.92,o01),
  (v_uid,'msg_o01_final','thd_o01','no-reply@luminaryio.com',now()-'69 days'::interval,'interview_invite','Luminary IO','Senior Software Engineer','interview',0.93,o01),
  (v_uid,'msg_o01_offer','thd_o01','no-reply@luminaryio.com',now()-'65 days'::interval,'offer','Luminary IO','Senior Software Engineer','offer',0.97,o01),
  -- o02 Archway Systems: screen → technical panel → offer
  (v_uid,'msg_o02_screen','thd_o02','talent@archwaysystems.io',now()-'69 days'::interval,'interview_invite','Archway Systems','Staff Engineer','interview',0.90,o02),
  (v_uid,'msg_o02_tech','thd_o02','talent@archwaysystems.io',now()-'65 days'::interval,'interview_invite','Archway Systems','Staff Engineer','interview',0.91,o02),
  (v_uid,'msg_o02_offer','thd_o02','talent@archwaysystems.io',now()-'61 days'::interval,'offer','Archway Systems','Staff Engineer','offer',0.97,o02),
  -- o03 Novastream: phone → take-home → offer
  (v_uid,'msg_o03_call','thd_o03','jobs@novastream.ai',now()-'65 days'::interval,'interview_invite','Novastream','Data Engineer','interview',0.89,o03),
  (v_uid,'msg_o03_assess','thd_o03','jobs@novastream.ai',now()-'62 days'::interval,'assessment','Novastream','Data Engineer','assessment',0.91,o03),
  (v_uid,'msg_o03_offer','thd_o03','jobs@novastream.ai',now()-'56 days'::interval,'offer','Novastream','Data Engineer','offer',0.96,o03),
  -- o04 Clearpath Analytics: screen → tech → final → offer
  (v_uid,'msg_o04_screen','thd_o04','noreply@greenhouse.io',now()-'55 days'::interval,'interview_invite','Clearpath Analytics','Senior Data Engineer','interview',0.90,o04),
  (v_uid,'msg_o04_tech','thd_o04','noreply@greenhouse.io',now()-'51 days'::interval,'interview_invite','Clearpath Analytics','Senior Data Engineer','interview',0.91,o04),
  (v_uid,'msg_o04_final','thd_o04','noreply@greenhouse.io',now()-'46 days'::interval,'interview_invite','Clearpath Analytics','Senior Data Engineer','interview',0.92,o04),
  (v_uid,'msg_o04_offer','thd_o04','noreply@greenhouse.io',now()-'41 days'::interval,'offer','Clearpath Analytics','Senior Data Engineer','offer',0.97,o04),
  -- o05 Ironclad Labs: screen → tech → offer
  (v_uid,'msg_o05_screen','thd_o05','recruiter@ironclad.io',now()-'37 days'::interval,'interview_invite','Ironclad Labs','Backend Engineer','interview',0.90,o05),
  (v_uid,'msg_o05_tech','thd_o05','recruiter@ironclad.io',now()-'33 days'::interval,'interview_invite','Ironclad Labs','Backend Engineer','interview',0.91,o05),
  (v_uid,'msg_o05_offer','thd_o05','recruiter@ironclad.io',now()-'28 days'::interval,'offer','Ironclad Labs','Backend Engineer','offer',0.97,o05),
  -- i01 Stackwave: screen → technical
  (v_uid,'msg_i01_screen','thd_i01','careers@stackwave.dev',now()-'25 days'::interval,'interview_invite','Stackwave','Software Engineer','interview',0.89,i01),
  (v_uid,'msg_i01_tech','thd_i01','careers@stackwave.dev',now()-'21 days'::interval,'interview_invite','Stackwave','Software Engineer','interview',0.91,i01),
  -- i02 Meridian Cloud: screen
  (v_uid,'msg_i02_screen','thd_i02','noreply@lever.co',now()-'19 days'::interval,'interview_invite','Meridian Cloud','Senior Software Engineer','interview',0.90,i02),
  -- i03 Pulsedata: phone → technical
  (v_uid,'msg_i03_screen','thd_i03','hello@pulsedata.io',now()-'17 days'::interval,'interview_invite','Pulsedata','Data Engineer','interview',0.90,i03),
  (v_uid,'msg_i03_tech','thd_i03','hello@pulsedata.io',now()-'13 days'::interval,'interview_invite','Pulsedata','Data Engineer','interview',0.92,i03),
  -- i04 Terraform Digital: screen
  (v_uid,'msg_i04_screen','thd_i04','jobs@terraformdigital.com',now()-'15 days'::interval,'interview_invite','Terraform Digital','Platform Engineer','interview',0.89,i04),
  -- i05 Cloudrift: screen → technical
  (v_uid,'msg_i05_screen','thd_i05','talent@cloudrift.io',now()-'12 days'::interval,'interview_invite','Cloudrift Analytics','Senior Data Engineer','interview',0.90,i05),
  (v_uid,'msg_i05_tech','thd_i05','talent@cloudrift.io',now()-'8 days'::interval,'interview_invite','Cloudrift Analytics','Senior Data Engineer','interview',0.91,i05),
  -- i06 Basepoint Tech: screen
  (v_uid,'msg_i06_screen','thd_i06','no-reply@greenhouse.io',now()-'11 days'::interval,'interview_invite','Basepoint Tech','Backend Engineer','interview',0.89,i06),
  -- i07 Quantum IO: screen
  (v_uid,'msg_i07_screen','thd_i07','careers@quantumio.ai',now()-'9 days'::interval,'interview_invite','Quantum IO','ML Engineer','interview',0.91,i07),
  -- i08 Flowstate: screen
  (v_uid,'msg_i08_screen','thd_i08','recruiter@flowstate.systems',now()-'7 days'::interval,'interview_invite','Flowstate Systems','Software Engineer','interview',0.88,i08),
  -- i09 Apexline: direct technical (upcoming)
  (v_uid,'msg_i09_tech','thd_i09','talent@apexline.tech',now()-'5 days'::interval,'interview_invite','Apexline','Senior Backend Engineer','interview',0.92,i09),
  -- i10 Dataseam: screen (upcoming)
  (v_uid,'msg_i10_screen','thd_i10','hello@dataseam.co',now()-'2 days'::interval,'interview_invite','Dataseam','Data Engineer','interview',0.91,i10),
  -- s01 Bridgewater Tech: assessment
  (v_uid,'msg_s01_assess','thd_s01','noreply@greenhouse.io',now()-'28 days'::interval,'assessment','Bridgewater Tech','Software Engineer','assessment',0.91,s01),
  -- s02 Axiom Labs: screen → assessment
  (v_uid,'msg_s02_screen','thd_s02','careers@axiomlabs.io',now()-'22 days'::interval,'interview_invite','Axiom Labs','Data Engineer','interview',0.88,s02),
  (v_uid,'msg_s02_assess','thd_s02','careers@axiomlabs.io',now()-'19 days'::interval,'assessment','Axiom Labs','Data Engineer','assessment',0.92,s02),
  -- s03 Synapse Systems: assessment
  (v_uid,'msg_s03_assess','thd_s03','jobs@synapsesystems.dev',now()-'18 days'::interval,'assessment','Synapse Systems','Backend Engineer','assessment',0.91,s03),
  -- s04 Gridlock IO: assessment
  (v_uid,'msg_s04_assess','thd_s04','talent@gridlockio.com',now()-'13 days'::interval,'assessment','Gridlock IO','Platform Engineer','assessment',0.90,s04),
  -- s05 Helix Analytics: screen → assessment
  (v_uid,'msg_s05_screen','thd_s05','recruiter@helixanalytics.io',now()-'8 days'::interval,'interview_invite','Helix Analytics','Senior Data Engineer','interview',0.90,s05),
  (v_uid,'msg_s05_assess','thd_s05','recruiter@helixanalytics.io',now()-'5 days'::interval,'assessment','Helix Analytics','Senior Data Engineer','assessment',0.92,s05),
  -- s06 Ironside Tech: assessment
  (v_uid,'msg_s06_assess','thd_s06','no-reply@lever.co',now()-'5 days'::interval,'assessment','Ironside Tech','Software Engineer','assessment',0.90,s06),
  -- s07 Nexusflow: assessment
  (v_uid,'msg_s07_assess','thd_s07','careers@nexusflow.ai',now()-'2 days'::interval,'assessment','Nexusflow','ML Engineer','assessment',0.93,s07)
  ON CONFLICT (user_id, gmail_message_id) DO NOTHING;


  -- ══════════════════════════════════════════════════════════════════════════
  -- 4. CALENDAR EVENTS
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO events (user_id, application_id, event_type, title, meeting_link, start_at, end_at, source_type) VALUES
  -- Past interviews
  (v_uid,r01,'interview','Phone screen – Vortex Systems','https://meet.google.com/abc-vrtx-01',now()-'79 days'::interval+'10:00'::interval,now()-'79 days'::interval+'10:30'::interval,'gmail'),
  (v_uid,r01,'interview','Technical interview – Vortex Systems','https://zoom.us/j/vortex-tech-01',now()-'76 days'::interval+'14:00'::interval,now()-'76 days'::interval+'15:00'::interval,'gmail'),
  (v_uid,r03,'interview','Technical interview – Coderift','https://meet.google.com/abc-cdrf-01',now()-'62 days'::interval+'11:00'::interval,now()-'62 days'::interval+'12:30'::interval,'gmail'),
  (v_uid,r04,'interview','ML interview – Stratum AI','https://zoom.us/j/stratum-ml-01',now()-'62 days'::interval+'15:00'::interval,now()-'62 days'::interval+'15:45'::interval,'gmail'),
  (v_uid,r06,'interview','Phone screen – Orbitnode','https://meet.google.com/abc-orbt-01',now()-'52 days'::interval+'09:00'::interval,now()-'52 days'::interval+'09:25'::interval,'gmail'),
  (v_uid,r07,'interview','Technical Round 1 – Datafusion Co','https://zoom.us/j/datafusion-r1',now()-'44 days'::interval+'13:00'::interval,now()-'44 days'::interval+'14:00'::interval,'gmail'),
  (v_uid,r07,'interview','Final Round – Datafusion Co','https://meet.google.com/abc-dtfs-02',now()-'41 days'::interval+'10:00'::interval,now()-'41 days'::interval+'12:00'::interval,'gmail'),
  (v_uid,o01,'interview','Recruiter screen – Luminary IO','https://zoom.us/j/luminary-s01',now()-'77 days'::interval+'11:00'::interval,now()-'77 days'::interval+'11:30'::interval,'gmail'),
  (v_uid,o01,'interview','Technical interview – Luminary IO','https://meet.google.com/abc-lmny-02',now()-'73 days'::interval+'14:00'::interval,now()-'73 days'::interval+'15:30'::interval,'gmail'),
  (v_uid,o01,'interview','Final interview – Luminary IO','https://zoom.us/j/luminary-f01',now()-'69 days'::interval+'10:00'::interval,now()-'69 days'::interval+'11:00'::interval,'gmail'),
  (v_uid,o02,'interview','Technical panel – Archway Systems','https://meet.google.com/abc-arch-01',now()-'65 days'::interval+'13:00'::interval,now()-'65 days'::interval+'15:00'::interval,'gmail'),
  (v_uid,o04,'interview','Technical interview – Clearpath','https://zoom.us/j/clearpath-t01',now()-'51 days'::interval+'10:00'::interval,now()-'51 days'::interval+'11:15'::interval,'gmail'),
  (v_uid,o04,'interview','Final interview – Clearpath Analytics','https://meet.google.com/abc-clrp-02',now()-'46 days'::interval+'14:00'::interval,now()-'46 days'::interval+'14:45'::interval,'gmail'),
  (v_uid,o05,'interview','Technical interview – Ironclad Labs','https://meet.google.com/abc-irnc-01',now()-'33 days'::interval+'13:00'::interval,now()-'33 days'::interval+'15:00'::interval,'gmail'),
  (v_uid,i01,'interview','Recruiter intro – Stackwave','https://zoom.us/j/stackwave-s01',now()-'25 days'::interval+'10:00'::interval,now()-'25 days'::interval+'10:20'::interval,'gmail'),
  (v_uid,i01,'interview','Technical interview – Stackwave','https://meet.google.com/abc-stkw-02',now()-'21 days'::interval+'14:00'::interval,now()-'21 days'::interval+'15:15'::interval,'gmail'),
  (v_uid,i02,'interview','Recruiter call – Meridian Cloud','https://zoom.us/j/meridian-s01',now()-'19 days'::interval+'11:00'::interval,now()-'19 days'::interval+'11:30'::interval,'gmail'),
  (v_uid,i03,'interview','Phone screen – Pulsedata','https://meet.google.com/abc-plsd-01',now()-'17 days'::interval+'09:00'::interval,now()-'17 days'::interval+'09:25'::interval,'gmail'),
  (v_uid,i03,'interview','Technical interview – Pulsedata','https://zoom.us/j/pulsedata-t01',now()-'13 days'::interval+'13:00'::interval,now()-'13 days'::interval+'14:30'::interval,'gmail'),
  (v_uid,i04,'interview','Recruiter call – Terraform Digital','https://meet.google.com/abc-trfm-01',now()-'15 days'::interval+'10:00'::interval,now()-'15 days'::interval+'10:30'::interval,'gmail'),
  (v_uid,i05,'interview','Recruiter screen – Cloudrift','https://zoom.us/j/cloudrift-s01',now()-'12 days'::interval+'14:00'::interval,now()-'12 days'::interval+'14:30'::interval,'gmail'),
  (v_uid,i05,'interview','Technical interview – Cloudrift','https://meet.google.com/abc-cldr-02',now()-'8 days'::interval+'10:00'::interval,now()-'8 days'::interval+'11:30'::interval,'gmail'),
  (v_uid,i06,'interview','Phone screen – Basepoint Tech','https://zoom.us/j/basepoint-s01',now()-'11 days'::interval+'09:00'::interval,now()-'11 days'::interval+'09:20'::interval,'gmail'),
  (v_uid,i07,'interview','ML intro call – Quantum IO','https://meet.google.com/abc-qntm-01',now()-'9 days'::interval+'15:00'::interval,now()-'9 days'::interval+'15:30'::interval,'gmail'),
  (v_uid,i08,'interview','Recruiter screen – Flowstate Systems','https://zoom.us/j/flowstate-s01',now()-'7 days'::interval+'11:00'::interval,now()-'7 days'::interval+'11:20'::interval,'gmail'),
  -- Upcoming interviews
  (v_uid,i09,'interview','Technical interview – Apexline','https://meet.google.com/abc-apex-01',now()+'2 days'::interval+'13:00'::interval,now()+'2 days'::interval+'14:30'::interval,'gmail'),
  (v_uid,i10,'interview','Intro call – Dataseam','https://zoom.us/j/dataseam-s01',now()+'1 day'::interval+'10:00'::interval,now()+'1 day'::interval+'10:25'::interval,'gmail'),
  -- Assessment deadlines
  (v_uid,s05,'assessment','Take-home due – Helix Analytics',NULL,now()+'0 days'::interval+'23:59'::interval,NULL,'gmail'),
  (v_uid,s06,'assessment','Codility test – Ironside Tech',NULL,now()+'2 days'::interval+'23:59'::interval,NULL,'gmail'),
  (v_uid,s07,'assessment','ML take-home due – Nexusflow',NULL,now()+'3 days'::interval+'23:59'::interval,NULL,'gmail');


  -- ══════════════════════════════════════════════════════════════════════════
  -- 5. TASKS
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO tasks (user_id, application_id, title, description, due_at, status, origin, priority) VALUES
  (v_uid,i09,'Prep for Apexline technical interview','Review API design, concurrency patterns, and prepare a project deep-dive. Interview in 2 days.',now()+'2 days'::interval,'open','gmail','high'),
  (v_uid,i10,'Prep for Dataseam intro call','Research their data platform, review pipeline design questions, prep questions for the team.',now()+'1 day'::interval,'open','gmail','high'),
  (v_uid,i07,'Prep for Quantum IO ML interview','Review LLM fine-tuning, inference optimization (quantization, batching), and past project examples.',now()+'3 days'::interval,'open','gmail','high'),
  (v_uid,s05,'Submit Helix Analytics take-home','Real-time patient event log pipeline. Due TODAY. Push to GitHub and email the submission link.',now()+'0 days'::interval+'23:59'::interval,'open','gmail','high'),
  (v_uid,s06,'Complete Ironside Tech Codility test','3 algorithm questions, 90 minutes. Start and complete before deadline in 2 days.',now()+'2 days'::interval,'open','gmail','high'),
  (v_uid,s07,'Submit Nexusflow ML take-home','Time-series forecasting model + write-up. Push to GitHub. Due in 3 days.',now()+'3 days'::interval,'open','gmail','high'),
  (v_uid,i02,'Follow up with Meridian Cloud','3 days since recruiter call with no next steps. Send a polite check-in.',now()+'1 day'::interval,'open','manual','medium'),
  (v_uid,i04,'Follow up with Terraform Digital','Recruiter call was 3 days ago — technical round invite outstanding.',now()+'2 days'::interval,'open','manual','medium'),
  (v_uid,i06,'Follow up with Basepoint Tech','Phone screen was 4 days ago. Nudge the recruiter.',now()+'1 day'::interval,'open','manual','medium'),
  (v_uid,o01,'Decide on Luminary IO offer','Offer expires soon. Compare with Archway and Clearpath. Review equity terms carefully.',now()+'2 days'::interval,'open','manual','high'),
  (v_uid,o02,'Review Archway Systems offer details','Read the full offer letter. Check vesting schedule, non-compete clause, and bonus structure.',now()+'3 days'::interval,'open','manual','high'),
  (v_uid,o04,'Negotiate Clearpath Analytics offer','Target $180k base + $10k signing. Draft negotiation email today.',now()+'1 day'::interval,'open','manual','high'),
  (v_uid,i05,'Research Cloudrift before final round','Read engineering blog, look up interviewers on LinkedIn, prep multi-source ingestion system design.',now()+'0 days'::interval,'open','manual','medium'),
  (v_uid,i08,'Prep for Flowstate next steps','Review their observability stack and product, prep standard SWE interview topics.',now()+'4 days'::interval,'open','manual','low');


  -- ══════════════════════════════════════════════════════════════════════════
  -- 6. NOTIFICATIONS
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO notifications (user_id, type, subtype, title, body, entity_type, entity_id, is_read, channel, priority, created_at) VALUES
  -- Rejections (read)
  (v_uid,'update','rejection','Update – Vortex Systems','Vortex Systems decided to move forward with another candidate for Senior Software Engineer.','application',r01,true,'in_app','normal',now()-'73 days'::interval),
  (v_uid,'update','rejection','Update – Nimbus Labs','Nimbus Labs will not be moving forward with your Data Engineer application.','application',r02,true,'in_app','normal',now()-'68 days'::interval),
  (v_uid,'update','rejection','Update – Coderift','Coderift went with another candidate. Strong feedback on your system design though.','application',r03,true,'in_app','normal',now()-'58 days'::interval),
  (v_uid,'update','rejection','Update – Stratum AI','Stratum AI cited lack of TPU/JAX experience. Tough but fair.','application',r04,true,'in_app','normal',now()-'58 days'::interval),
  (v_uid,'update','rejection','Update – Datafusion Co','After 3 rounds, Datafusion Co went with another candidate. Very close decision.','application',r07,true,'in_app','normal',now()-'37 days'::interval),
  -- Offers (unread — big news)
  (v_uid,'update','offer','Offer received – Luminary IO','$185k base + 0.15% equity. Senior Software Engineer. Check your email for the offer letter.','application',o01,false,'in_app','high',now()-'65 days'::interval),
  (v_uid,'update','offer','Offer received – Archway Systems','$210k base + $80k RSU. Staff Software Engineer. Review the attached offer letter.','application',o02,false,'in_app','high',now()-'61 days'::interval),
  (v_uid,'update','offer','Offer received – Novastream','$160k + $40k options for Data Engineer. They loved your take-home solution.','application',o03,false,'in_app','high',now()-'56 days'::interval),
  (v_uid,'update','offer','Offer received – Clearpath Analytics','$175k base + $60k equity for Senior Data Engineer. Decision needed within one week.','application',o04,false,'in_app','high',now()-'41 days'::interval),
  (v_uid,'update','offer','Offer received – Ironclad Labs','$192k base + $70k RSU for Senior Backend Engineer. Expires Friday.','application',o05,false,'in_app','high',now()-'28 days'::interval),
  -- Interview invites (mix)
  (v_uid,'update','interview_invite','Interview invite – Stackwave','Technical interview scheduled for Software Engineer. Check your calendar.','application',i01,true,'in_app','normal',now()-'21 days'::interval),
  (v_uid,'update','interview_invite','Interview invite – Pulsedata','Technical interview scheduled for Data Engineer. Confirm your slot.','application',i03,true,'in_app','normal',now()-'13 days'::interval),
  (v_uid,'update','interview_invite','Interview invite – Cloudrift Analytics','Technical interview for Senior Data Engineer. Prepare system design questions.','application',i05,false,'in_app','normal',now()-'8 days'::interval),
  (v_uid,'update','interview_invite','Interview invite – Apexline','Skipping phone screen — straight to 90-min technical. In 2 days!','application',i09,false,'in_app','high',now()-'5 days'::interval),
  (v_uid,'update','interview_invite','Interview invite – Dataseam','Intro call with Head of Data Engineering. Confirm availability ASAP.','application',i10,false,'in_app','normal',now()-'2 days'::interval),
  -- Assessments
  (v_uid,'update','assessment','Assessment sent – Bridgewater Tech','Coding take-home for Software Engineer. Due in 5 days.','application',s01,true,'in_app','normal',now()-'28 days'::interval),
  (v_uid,'update','assessment','Assessment sent – Axiom Labs','HackerRank: 4 hours, SQL + Python + pipeline design. Start within 72 hours.','application',s02,true,'in_app','normal',now()-'19 days'::interval),
  (v_uid,'update','assessment','Assessment sent – Helix Analytics','Real-time patient pipeline take-home. Due TODAY.','application',s05,false,'in_app','high',now()-'5 days'::interval),
  (v_uid,'update','assessment','Assessment sent – Nexusflow','Time-series forecasting ML take-home. Due in 3 days.','application',s07,false,'in_app','high',now()-'2 days'::interval);


  -- ══════════════════════════════════════════════════════════════════════════
  -- 7. MOCK GMAIL MESSAGES + GMAIL STATE
  -- ══════════════════════════════════════════════════════════════════════════
  INSERT INTO mock_gmail_messages (
    user_id,
    gmail_message_id,
    gmail_thread_id,
    internet_message_id,
    subject,
    from_address,
    snippet,
    body_text,
    received_at,
    created_at
  )
  WITH initial_messages AS (
    SELECT
      a.id AS application_id,
      a.gmail_message_id,
      a.gmail_thread_id,
      a.applied_at AS received_at,
      a.company,
      coalesce(a.role_title, a.role) AS role_title,
      coalesce(
        (
          SELECT je.raw_from
            FROM job_email_events je
           WHERE je.user_id = v_uid
             AND je.gmail_message_id = a.gmail_message_id
           LIMIT 1
        ),
        CASE mod(row_number() OVER (ORDER BY a.applied_at, a.company), 6)
          WHEN 0 THEN 'careers@' || lower(regexp_replace(a.company, '[^a-zA-Z0-9]+', '', 'g')) || '.io'
          WHEN 1 THEN 'no-reply@greenhouse.io'
          WHEN 2 THEN 'jobs@' || lower(regexp_replace(a.company, '[^a-zA-Z0-9]+', '', 'g')) || '.dev'
          WHEN 3 THEN 'talent@' || lower(regexp_replace(a.company, '[^a-zA-Z0-9]+', '', 'g')) || '.ai'
          WHEN 4 THEN 'noreply@lever.co'
          ELSE 'recruiting@' || lower(regexp_replace(a.company, '[^a-zA-Z0-9]+', '', 'g')) || '.cloud'
        END
      ) AS from_address
    FROM applications a
    WHERE a.user_id = v_uid
  ),
  followup_messages AS (
    SELECT
      je.application_id,
      je.gmail_message_id,
      je.gmail_thread_id,
      je.received_at,
      coalesce(a.company, je.parsed_company) AS company,
      coalesce(a.role_title, a.role, je.parsed_role) AS role_title,
      je.raw_from AS from_address,
      je.event_type
    FROM job_email_events je
    JOIN applications a
      ON a.id = je.application_id
    WHERE je.user_id = v_uid
      AND je.gmail_message_id <> a.gmail_message_id
  ),
  all_messages AS (
    SELECT
      im.gmail_message_id,
      im.gmail_thread_id,
      '<' || im.gmail_message_id || '@mock.basafy.app>' AS internet_message_id,
      'Application received — ' || im.role_title || ' at ' || im.company AS subject,
      im.from_address,
      'We''ve received your application for ' || im.role_title || ' and shared it with the hiring team.' AS snippet,
      'Hi there,' || E'\n\n' ||
      'Thanks for applying to the ' || im.role_title || ' role at ' || im.company || '. We have received your application and shared it with the hiring team for review.' || E'\n\n' ||
      'Application summary' || E'\n' ||
      '- Role: ' || im.role_title || E'\n' ||
      '- Company: ' || im.company || E'\n' ||
      '- Thread reference: ' || im.gmail_thread_id || E'\n' ||
      '- Submitted: ' || to_char(im.received_at, 'Mon DD, YYYY HH12:MI AM TZ') || E'\n\n' ||
      'If your background is a match for the team, we will follow up with next steps. We appreciate the time you spent applying.' || E'\n\n' ||
      'Best,' || E'\n' ||
      im.company || ' Recruiting' AS body_text,
      im.received_at
    FROM initial_messages im

    UNION ALL

    SELECT
      fm.gmail_message_id,
      fm.gmail_thread_id,
      '<' || fm.gmail_message_id || '@mock.basafy.app>' AS internet_message_id,
      CASE
        WHEN fm.event_type = 'offer' THEN 'Offer for ' || fm.role_title || ' at ' || fm.company
        WHEN fm.event_type = 'rejection' THEN 'Update on your application at ' || fm.company
        WHEN fm.event_type = 'assessment' THEN 'Assessment request: ' || fm.role_title || ' at ' || fm.company
        ELSE 'Interview invitation: ' || fm.role_title || ' at ' || fm.company
      END AS subject,
      fm.from_address,
      CASE
        WHEN fm.event_type = 'offer' THEN 'We''re excited to move forward with an offer and have attached the details for review.'
        WHEN fm.event_type = 'rejection' THEN 'Thank you again for your time. We''ve decided to move forward with another candidate.'
        WHEN fm.event_type = 'assessment' THEN 'The next step is an assessment so the team can evaluate your technical approach.'
        WHEN fm.gmail_message_id LIKE '%screen%' OR fm.gmail_message_id LIKE '%call%' THEN 'We''d like to schedule a recruiter conversation as the next step in the process.'
        WHEN fm.gmail_message_id LIKE '%tech%' THEN 'We''d like to invite you to a technical interview with members of the engineering team.'
        WHEN fm.gmail_message_id LIKE '%final%' THEN 'You''re moving to the final round with hiring leadership and cross-functional partners.'
        ELSE 'We''d like to move you to the next interview stage and coordinate availability.'
      END AS snippet,
      CASE
        WHEN fm.event_type = 'offer' THEN
          'Hi Reviewer,' || E'\n\n' ||
          'We''re excited to share that the team at ' || fm.company || ' would like to move forward with an offer for the ' || fm.role_title || ' role.' || E'\n\n' ||
          'You should find the full offer packet attached, including compensation details, equity information, and target start date. Please review everything carefully and send back any questions you''d like to discuss with the recruiter or hiring manager.' || E'\n\n' ||
          'We appreciated the depth of your interview conversations and the clarity of your technical thinking throughout the process.' || E'\n\n' ||
          'Best,' || E'\n' ||
          fm.company || ' Recruiting'
        WHEN fm.event_type = 'rejection' THEN
          'Hi Reviewer,' || E'\n\n' ||
          'Thank you again for the time you invested in the interview process for the ' || fm.role_title || ' role at ' || fm.company || '.' || E'\n\n' ||
          'After completing our review, we have decided to move forward with another candidate whose background is more closely aligned with the immediate needs of the team. We know these decisions are not easy, and we appreciate the thoughtfulness you brought to each conversation.' || E'\n\n' ||
          'We will keep your profile on file should another role open up that is a stronger fit.' || E'\n\n' ||
          'Best,' || E'\n' ||
          fm.company || ' Recruiting'
        WHEN fm.event_type = 'assessment' THEN
          'Hi Reviewer,' || E'\n\n' ||
          'Thanks again for your interest in the ' || fm.role_title || ' role at ' || fm.company || '. The next step in our process is a technical assessment.' || E'\n\n' ||
          'Please complete the exercise and reply to this thread once you have submitted it. We''ll review the solution for code quality, communication, and the tradeoffs you make along the way.' || E'\n\n' ||
          'If anything about the prompt is unclear, send questions before you begin so the team can clarify expectations.' || E'\n\n' ||
          'Best,' || E'\n' ||
          fm.company || ' Recruiting'
        ELSE
          'Hi Reviewer,' || E'\n\n' ||
          'We enjoyed learning more about your background and would like to move you forward for the ' || fm.role_title || ' role at ' || fm.company || '.' || E'\n\n' ||
          CASE
            WHEN fm.gmail_message_id LIKE '%screen%' OR fm.gmail_message_id LIKE '%call%' THEN
              'This next step is a recruiter conversation focused on your recent experience, what you''re looking for in your next role, and any logistical questions about the search.'
            WHEN fm.gmail_message_id LIKE '%tech%' THEN
              'This round will focus on hands-on technical depth, including implementation choices, debugging instincts, and how you approach system tradeoffs in production environments.'
            WHEN fm.gmail_message_id LIKE '%final%' THEN
              'This final conversation is intended to cover collaboration style, project ownership, and how you would operate with cross-functional stakeholders.'
            ELSE
              'The next step will help the team evaluate your technical approach and how you communicate decisions under real-world constraints.'
          END || E'\n\n' ||
          'Please reply with a few windows of availability and we''ll lock in the schedule.' || E'\n\n' ||
          'Best,' || E'\n' ||
          fm.company || ' Recruiting'
      END AS body_text,
      fm.received_at
    FROM followup_messages fm
  )
  SELECT
    v_uid,
    am.gmail_message_id,
    am.gmail_thread_id,
    am.internet_message_id,
    am.subject,
    am.from_address,
    am.snippet,
    am.body_text,
    am.received_at,
    am.received_at
  FROM all_messages am
  ORDER BY am.received_at ASC
  ON CONFLICT (user_id, gmail_message_id) DO UPDATE
     SET gmail_thread_id = excluded.gmail_thread_id,
         internet_message_id = excluded.internet_message_id,
         subject = excluded.subject,
         from_address = excluded.from_address,
         snippet = excluded.snippet,
         body_text = excluded.body_text,
         received_at = excluded.received_at,
         created_at = excluded.created_at;

  INSERT INTO gmail_connections (
    user_id,
    email,
    provider,
    refresh_token,
    access_token,
    token_scopes,
    access_token_expires_at,
    last_synced_at,
    backfill_started_at,
    backfill_completed_at,
    backfill_processed_count,
    backfill_total_estimate,
    backfill_page_token
  )
  VALUES (
    v_uid,
    'reviewer@basafy.app',
    'google',
    'mock-refresh-token',
    'mock-access-token',
    ARRAY['https://www.googleapis.com/auth/gmail.readonly']::text[],
    now() + interval '1 hour',
    now(),
    now() - interval '2 minutes',
    now(),
    (SELECT count(*) FROM mock_gmail_messages WHERE user_id = v_uid),
    (SELECT count(*) FROM mock_gmail_messages WHERE user_id = v_uid),
    NULL
  )
  ON CONFLICT (user_id, provider) DO UPDATE
     SET email = excluded.email,
         refresh_token = excluded.refresh_token,
         access_token = excluded.access_token,
         token_scopes = excluded.token_scopes,
         access_token_expires_at = excluded.access_token_expires_at,
         last_synced_at = excluded.last_synced_at,
         backfill_started_at = excluded.backfill_started_at,
         backfill_completed_at = excluded.backfill_completed_at,
         backfill_processed_count = excluded.backfill_processed_count,
         backfill_total_estimate = excluded.backfill_total_estimate,
         backfill_page_token = excluded.backfill_page_token;

  INSERT INTO gmail_sync_state (
    user_id,
    connection_id,
    initial_import_status,
    initial_import_progress,
    last_phase1_result_count,
    last_deep_result_count,
    last_sync_summary
  )
  SELECT
    v_uid,
    gc.id,
    'deep_done',
    100,
    100,
    (SELECT count(*) FROM mock_gmail_messages WHERE user_id = v_uid),
    'Seeded 100 reviewer demo applications, 58 follow-up emails, calendar events, tasks, notifications, and a matching mock Gmail inbox.'
  FROM gmail_connections gc
  WHERE gc.user_id = v_uid
    AND gc.provider = 'google'
  ON CONFLICT (user_id) DO UPDATE
     SET connection_id = excluded.connection_id,
         initial_import_status = excluded.initial_import_status,
         initial_import_progress = excluded.initial_import_progress,
         last_phase1_result_count = excluded.last_phase1_result_count,
         last_deep_result_count = excluded.last_deep_result_count,
         last_sync_summary = excluded.last_sync_summary,
         updated_at = now();

END $$;

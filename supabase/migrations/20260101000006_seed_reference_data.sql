-- ===========================================================================
-- SAT-7 Promo - 006: reference data seed
--
-- PIPELINE STAGES are the load-bearing seed: promo_requests.stage_id is a
-- NOT NULL FK into this table, so it must be populated first.
--
-- CHANNELS here are reasonable defaults for a Lebanese broadcaster. They are
-- ordinary rows - rename, add or archive them in Settings > Channels.
-- ===========================================================================

insert into public.pipeline_stages (key, name, description, position, color, is_terminal, is_cancelled)
values
  ('new',        'New',        'Request submitted and awaiting review.',          1, 'blue',   false, false),
  ('review',     'Review',     'Manager reviewing scope, feasibility, priority.',2, 'violet', false, false),
  ('planning',   'Planning',   'Shots, crew and schedule being planned.',         3, 'indigo', false, false),
  ('assigned',   'Assigned',   'Accepted and allocated to a producer.',           4, 'cyan',   false, false),
  ('production', 'Production', 'Shifts are being shot.',                        5, 'amber',  false, false),
  ('editing',    'Editing',    'Post-production and graphics.',                  6, 'orange', false, false),
  ('approval',   'Approval',   'Awaiting sign-off from the requester.',          7, 'lime',   false, false),
  ('completed',  'Completed',  'Delivered and approved.',                       8, 'emerald',true,  false),
  ('cancelled',  'Cancelled',  'Request withdrawn.',                            9, 'rose',   true,  true)
on conflict (key) do nothing;

insert into public.channels (name, code, category, color, sort_order, description)
values
  ('SAT-7 Arabic',   'SAT7-AR', 'Broadcast', 'brand',  1, 'Main Arabic broadcast service.'),
  ('SAT-7 English',  'SAT7-EN', 'Broadcast', 'cyan',   2, 'English-language broadcast service.'),
  ('SAT-7 French',   'SAT7-FR', 'Broadcast', 'violet', 3, 'French-language broadcast service.'),
  ('SAT-7 Kids',     'SAT7-KD', 'Broadcast', 'amber',  4, 'Children and family programming block.'),
  ('SAT-7 Movies',   'SAT7-MV', 'Broadcast', 'rose',   5, 'Movie and cinema strand.'),
  ('SAT-7 Drama',    'SAT7-DR', 'Broadcast', 'indigo', 6, 'Drama series strand.'),
  ('SAT-7 Documentaries', 'SAT7-DOC', 'Broadcast', 'lime', 7, 'Documentary strand.'),
  ('SAT-7 News',     'SAT7-NW', 'Broadcast', 'red',    8, 'News and current affairs service.'),
  ('SAT-7 Religious','SAT7-RL', 'Broadcast', 'emerald',9, 'Religious programming block.'),
  ('SAT-7 Sports',   'SAT7-SP', 'Broadcast', 'orange', 10,'Sports and live events coverage.'),
  ('SAT-7 Digital',  'SAT7-DG', 'Digital',   'blue',   11,'Website and mobile platforms.'),
  ('SAT-7 Social',   'SAT7-SO', 'Digital',   'pink',   12,'Social and community channels.'),
  ('SAT-7 Radio',    'SAT7-RD', 'Radio',     'teal',   13,'Satellite radio services.'),
  ('SAT-7 Events',   'SAT7-EV', 'Live',      'red',    14,'Live events, exhibitions and public screenings.')
on conflict (name) do nothing;

insert into public.promo_goals (name, description, category, color, sort_order)
values
  ('Promote a new program',        'First-time awareness for a newly launched show.',        'Awareness',  'brand',  1),
  ('Promote a new season',         'Drive tune-in for an upcoming season premiere.',         'Awareness',  'cyan',   2),
  ('Promote a special episode',    'Single high-value episode or finale.',                   'Awareness',  'violet', 3),
  ('Promote an event',             'Concert, festival, public screening or live event.',     'Events',     'amber',  4),
  ('Promote a campaign',           'Cross-platform brand or seasonal campaign.',             'Campaign',   'rose',   5),
  ('Increase program awareness',   'Sustained lift in unaided awareness for a program.',     'Awareness',  'indigo', 6),
  ('Increase audience engagement', 'Grow interaction, shares and community activity.',       'Engagement', 'emerald',7),
  ('Announce schedule changes',    'Communicate programming schedule adjustments.',          'Information','lime',   8),
  ('Promote a movie release',      'Cinema release or movie strand premiere.',               'Awareness',  'orange', 9),
  ('Promote a sports event',       'Live sports fixtures and tournaments.',                  'Events',     'red',    10),
  ('Relaunch / refresh',           'Rebuild interest in an existing program.',               'Campaign',   'teal',   11)
on conflict (name) do nothing;

insert into public.promo_types (name, description, sort_order)
values
  ('Trailer',         'Short teaser for an upcoming program or film.',   1),
  ('Teaser',          'Very short clip used for social and bumpers.',   2),
  ('Key Art',         'Still / graphic creative for print and social.', 3),
  ('Promo Spot',      'Full on-air promo.',                             4),
  ('On-Air Ident',    'Channel ident or bumper.',                       5),
  ('Digital Campaign','Cross-platform social and digital campaign.',     6),
  ('Live Promo',      'Live event, sweep or on-location promo.',        7),
  ('Post-Production','Editing, graphics and finishing package.',        8)
on conflict (name) do nothing;
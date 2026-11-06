# Builds the COVERAGE_MOVES table in public/rpg/game.js from the main games' learnsets (PokeAPI).
#   1. Export the game's species and moves to <dir>/game.json ({species:[{id,name,types,atk,spa}], moves:{NAME:{type,power,cost,cat,hits}}}).
#   2. Download each species' learnset to <dir>/raw/<id>.json from
#      https://raw.githubusercontent.com/PokeAPI/api-data/master/data/api/v2/pokemon/<id>/index.json
#   3. python3 -I scripts/coverage-moves.py <dir>   -> <dir>/coverage.json, pasted in as COVERAGE_MOVES.
import json, sys
D = sys.argv[1]
g = json.load(open(f'{D}/game.json'))
moves = g['moves']
byslug = {n.lower().replace(' ', '-'): n for n in moves}
out, report = {}, {}
for s in g['species']:
    try: d = json.load(open(f"{D}/raw/{s['id']}.json"))
    except Exception: continue
    learn = set()
    for m in d.get('moves', []):
        slug = m['move']['name']
        if slug not in byslug: continue
        if any(v['move_learn_method']['name'] in ('machine', 'tutor', 'level-up') for v in m['version_group_details']): learn.add(byslug[slug])
    pref = 'spec' if s['spa'] >= s['atk'] else 'phys'
    GENERIC = {'HYPER BEAM', 'THRASH', 'OUTRAGE', 'ROLLOUT', 'IRON TAIL', 'SOLAR BEAM', 'BODY SLAM', 'HEADBUTT', 'DOUBLE HIT', 'PETAL DANCE', 'SNORE', 'FURY SWIPES', 'DOUBLE KICK', 'DUAL CHOP', 'DUAL WINGBEAT', 'WATER SHURIKEN', 'ICICLE SPEAR', 'BULLET SEED', 'ROCK BLAST', 'BONE RUSH', 'VOLT TACKLE', 'KNOCK OFF', 'FEINT ATTACK', 'MUD SHOT', 'ROCK TOMB', 'WING ATTACK'}
    # The classic TM coverage, most iconic first (a small tiebreak by position).
    ICONIC = ['THUNDERBOLT', 'ICE BEAM', 'FLAMETHROWER', 'PSYCHIC', 'SHADOW BALL', 'EARTH POWER', 'ENERGY BALL', 'SLUDGE BOMB', 'DARK PULSE', 'DRAGON PULSE',
              'FLASH CANNON', 'MOONBLAST', 'STONE EDGE', 'CRUNCH', 'IRON HEAD', 'BRICK BREAK', 'PLAY ROUGH', 'X-SCISSOR', 'POISON JAB', 'WATERFALL', 'ZEN HEADBUTT', 'DIG', 'AIR SLASH', 'BUG BUZZ', 'POWER GEM']
    WORKHORSE = {'THUNDERBOLT', 'ICE BEAM', 'FLAMETHROWER', 'PSYCHIC', 'SHADOW BALL', 'ENERGY BALL', 'SLUDGE BOMB', 'DARK PULSE', 'DRAGON PULSE', 'FLASH CANNON',
                 'EARTH POWER', 'POWER GEM', 'AIR SLASH', 'BUG BUZZ', 'MOONBLAST', 'STONE EDGE', 'CRUNCH', 'IRON HEAD', 'X-SCISSOR', 'POISON JAB', 'PLAY ROUGH',
                 'BRICK BREAK', 'ZEN HEADBUTT', 'WATERFALL', 'DRAGON CLAW', 'FIRE FANG', 'DIG', 'GUNK SHOT', 'MEGAHORN', 'BRAVE BIRD', 'THUNDER', 'BLIZZARD', 'FIRE BLAST', 'HYDRO PUMP', 'SURF', 'WATER PULSE', 'SPARK', 'SEED BOMB', 'HEX', 'EXTRASENSORY', 'AURORA BEAM', 'ANCIENT POWER'}
    cands = []
    for n in learn:
        mv = moves[n]
        if (mv.get('cost') or 0) < 2 or not mv.get('power') or mv['type'] in s['types'] or n in GENERIC: continue
        rank = ICONIC.index(n) if n in ICONIC else None
        score = mv['power'] * mv['hits'] * (1.0 if mv['cat'] == pref else 0.7) + (45 - rank * 0.5 if rank is not None else 25 if n in WORKHORSE else 0) - 12 * (mv['cost'] - 2)
        cands.append((score, n, mv['type']))
    cands.sort(reverse=True)
    pick, types, big = [], set(), 0
    for sc, n, t in cands:
        if t in types or (moves[n]['cost'] >= 3 and big): continue
        pick.append(n); types.add(t); big += moves[n]['cost'] >= 3
        if len(pick) == 3: break
    pick.sort(key=lambda n: (moves[n]['cost'], moves[n]['power']))
    if pick: out[s['name']] = [[lv, n] for lv, n in zip((35, 42, 49), pick)]
json.dump(out, open(f'{D}/coverage.json', 'w'), separators=(',', ':'))
print(len(out), 'species with coverage of', len(g['species']))
for n in ['MEWTWO', 'ALAKAZAM', 'GENGAR', 'GYARADOS', 'STARMIE', 'MACHAMP', 'TYRANITAR', 'DRAGONITE', 'CHARIZARD', 'VENUSAUR', 'PRIMEAPE', 'AMPHAROS', 'LAPRAS', 'ESPEON', 'SNORLAX', 'NIDOKING', 'PIKACHU', 'ARCANINE']:
    print(f'  {n:10}', out.get(n))

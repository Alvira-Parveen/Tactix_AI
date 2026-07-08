import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { getMatchDataset } from "@/lib/match-data";

type Team = "home" | "away";
type Formation = "4-3-3" | "4-2-3-1" | "3-5-2" | "5-3-2" | "4-4-2";

const FORMATIONS: Formation[] = ["4-3-3", "4-2-3-1", "3-5-2", "5-3-2", "4-4-2"];

// Formation bias: [attackDelta, defenseDelta, widthDelta] in relative units (-1..1)
const FORMATION_TRAITS: Record<Formation, { atk: number; def: number; width: number; label: string }> = {
  "4-3-3": { atk: 0.35, def: -0.05, width: 0.4, label: "Wide attacking press" },
  "4-2-3-1": { atk: 0.2, def: 0.15, width: 0.1, label: "Balanced with a 10" },
  "3-5-2": { atk: 0.15, def: 0.05, width: 0.35, label: "Wing-back overloads" },
  "5-3-2": { atk: -0.2, def: 0.45, width: -0.15, label: "Low-block counter" },
  "4-4-2": { atk: 0.05, def: 0.15, width: -0.05, label: "Compact two banks" },
};

export const Route = createFileRoute("/sim/$matchId")({
  loader: ({ params }) => {
    const dataset = getMatchDataset(params.matchId);
    if (!dataset) throw notFound();
    return dataset;
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Simulator — TACTIX AI" }, { name: "robots", content: "noindex" }] };
    }
    const { match } = loaderData;
    const title = `Tactical Simulator · ${match.home.name} vs ${match.away.name} — TACTIX AI`;
    const description = `Run what-if tactical scenarios for ${match.home.name} vs ${match.away.name}: change formations, press intensity, and tempo to see projected xG and win probability shifts.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
      ],
    };
  },
  component: SimulatorDashboard,
  notFoundComponent: SimNotFound,
  errorComponent: SimError,
});

function SimulatorDashboard() {
  const dataset = Route.useLoaderData();
  const { match, winProbability: baseWP } = dataset;

  const [homeForm, setHomeForm] = useState<Formation>("4-3-3");
  const [awayForm, setAwayForm] = useState<Formation>("4-2-3-1");
  const [homePress, setHomePress] = useState(60); // 0..100
  const [awayPress, setAwayPress] = useState(50);
  const [homeTempo, setHomeTempo] = useState(55); // 0..100
  const [awayTempo, setAwayTempo] = useState(50);
  // Depth levers
  const [homeRedCard, setHomeRedCard] = useState(false);
  const [awayRedCard, setAwayRedCard] = useState(false);
  const [homeEarlySub, setHomeEarlySub] = useState(false); // impact sub on ~55'
  const [awayEarlySub, setAwayEarlySub] = useState(false);
  const [homeLowBlock, setHomeLowBlock] = useState(false);
  const [awayLowBlock, setAwayLowBlock] = useState(false);

  const sim = useMemo(() => {
    const h = FORMATION_TRAITS[homeForm];
    const a = FORMATION_TRAITS[awayForm];

    // Attacking score (0..2 scale roughly). Higher press+tempo boosts attack but leaks defense.
    let homeAtk = 1 + h.atk + (homePress - 50) / 200 + (homeTempo - 50) / 250;
    let awayAtk = 1 + a.atk + (awayPress - 50) / 200 + (awayTempo - 50) / 250;
    let homeDef = 1 + h.def - (homePress - 50) / 300 - (homeTempo - 50) / 400;
    let awayDef = 1 + a.def - (awayPress - 50) / 300 - (awayTempo - 50) / 400;

    // Depth levers.
    // Red card: -35% attack, -20% defense on the sending side (10 vs 11 for ~35 min).
    if (homeRedCard) { homeAtk *= 0.65; homeDef *= 0.8; awayAtk *= 1.1; }
    if (awayRedCard) { awayAtk *= 0.65; awayDef *= 0.8; homeAtk *= 1.1; }
    // Low-block toggle: +25% own defense, -15% own attack.
    if (homeLowBlock) { homeDef *= 1.25; homeAtk *= 0.85; }
    if (awayLowBlock) { awayDef *= 1.25; awayAtk *= 0.85; }
    // Early impact sub (bring an attacking sub on ~55'): +8% attack.
    if (homeEarlySub) homeAtk *= 1.08;
    if (awayEarlySub) awayAtk *= 1.08;

    // Projected xG = own attack vs opponent defense, base ~1.3 xG per team.
    const homeXG = Math.max(0.15, 1.35 * (homeAtk / Math.max(0.3, awayDef)));
    const awayXG = Math.max(0.15, 1.15 * (awayAtk / Math.max(0.3, homeDef)));

    // Win prob via a soft margin around xG diff, anchored to base.
    const diff = homeXG - awayXG;
    const homeShift = Math.tanh(diff * 0.9) * 25; // ±25pp swing at most
    const drawPull = Math.max(-8, -Math.abs(diff) * 6);
    const home = clamp(baseWP.home + homeShift, 3, 95);
    const away = clamp(baseWP.away - homeShift, 3, 95);
    const drawRaw = clamp(baseWP.draw + drawPull, 3, 95);
    const total = home + away + drawRaw;
    const normHome = Math.round((home / total) * 100);
    const normAway = Math.round((away / total) * 100);
    const normDraw = 100 - normHome - normAway;

    // Territory / possession estimate
    const territory = clamp(50 + (homeTempo - awayTempo) * 0.3 + (homePress - awayPress) * 0.2, 20, 80);

    return {
      homeXG: round2(homeXG),
      awayXG: round2(awayXG),
      xgDelta: round2(homeXG - awayXG),
      wp: { home: normHome, draw: normDraw, away: normAway },
      territory: Math.round(territory),
      // Deltas vs base for chip labels
      dHome: normHome - baseWP.home,
      dAway: normAway - baseWP.away,
    };
  }, [homeForm, awayForm, homePress, awayPress, homeTempo, awayTempo, baseWP, homeRedCard, awayRedCard, homeLowBlock, awayLowBlock, homeEarlySub, awayEarlySub]);

  const narrative = buildNarrative({
    homeName: match.home.name,
    awayName: match.away.name,
    homeForm,
    awayForm,
    homePress,
    awayPress,
    homeTempo,
    awayTempo,
    homeXG: sim.homeXG,
    awayXG: sim.awayXG,
    territory: sim.territory,
  });

  const askPrompt = `Simulate a scenario where ${match.home.name} play ${homeForm} at press intensity ${homePress}/100 and tempo ${homeTempo}/100, while ${match.away.name} play ${awayForm} at press ${awayPress}/100 and tempo ${awayTempo}/100. What's the likely tactical outcome and key battle zones?`;

  return (
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/30">
      <header className="border-b border-border bg-surface/40 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-3 px-6 py-4">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Tactical Simulator · {match.stage}
            </div>
            <h1 className="text-xl font-bold tracking-tight">
              {match.home.name} <span className="text-muted">vs</span> {match.away.name}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/match/$matchId"
              params={{ matchId: match.id }}
              className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
            >
              ← Live Dashboard
            </Link>
            <Link
              to="/intel/$matchId"
              params={{ matchId: match.id }}
              className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground"
            >
              Intel
            </Link>
            <Link
              to="/"
              className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
            >
              Match Hub
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] grid-cols-12 gap-6 p-6">
        {/* Controls */}
        <section className="col-span-12 grid gap-4 md:grid-cols-2 lg:col-span-7">
          <TeamPanel
            team="home"
            teamName={match.home.name}
            teamCode={match.home.code}
            formation={homeForm}
            setFormation={setHomeForm}
            press={homePress}
            setPress={setHomePress}
            tempo={homeTempo}
            setTempo={setHomeTempo}
            redCard={homeRedCard}
            setRedCard={setHomeRedCard}
            lowBlock={homeLowBlock}
            setLowBlock={setHomeLowBlock}
            earlySub={homeEarlySub}
            setEarlySub={setHomeEarlySub}
          />
          <TeamPanel
            team="away"
            teamName={match.away.name}
            teamCode={match.away.code}
            formation={awayForm}
            setFormation={setAwayForm}
            press={awayPress}
            setPress={setAwayPress}
            tempo={awayTempo}
            setTempo={setAwayTempo}
            redCard={awayRedCard}
            setRedCard={setAwayRedCard}
            lowBlock={awayLowBlock}
            setLowBlock={setAwayLowBlock}
            earlySub={awayEarlySub}
            setEarlySub={setAwayEarlySub}
          />

          <div className="md:col-span-2 rounded border border-border bg-surface/40 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-[10px] uppercase tracking-widest text-primary">Model Narrative</div>
              <button
                type="button"
                onClick={() => {
                  setHomeForm("4-3-3");
                  setAwayForm("4-2-3-1");
                  setHomePress(60);
                  setAwayPress(50);
                  setHomeTempo(55);
                  setAwayTempo(50);
                  setHomeRedCard(false); setAwayRedCard(false);
                  setHomeLowBlock(false); setAwayLowBlock(false);
                  setHomeEarlySub(false); setAwayEarlySub(false);
                }}
                className="rounded border border-border bg-background/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-muted transition-colors hover:border-primary/40 hover:text-primary"
              >
                ↺ Reset
              </button>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{narrative}</p>
            <Link
              to="/match/$matchId"
              params={{ matchId: match.id }}
              search={{ ask: askPrompt }}
              className="mt-3 inline-flex items-center gap-1 rounded border border-primary/40 bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-primary transition-colors hover:bg-primary/20"
            >
              <span>▸</span> Ask AI to break down this scenario
            </Link>
          </div>
        </section>

        {/* Outputs */}
        <aside className="col-span-12 lg:col-span-5">
          <div className="rounded border border-border bg-surface/40 p-4">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-primary">Projected Outcome</div>

            <div className="mb-4 grid grid-cols-3 gap-2 text-center">
              <StatBox label={`${match.home.code} xG`} value={sim.homeXG.toFixed(2)} tone="primary" />
              <StatBox label="xG Δ" value={(sim.xgDelta > 0 ? "+" : "") + sim.xgDelta.toFixed(2)} tone={sim.xgDelta > 0 ? "primary" : sim.xgDelta < 0 ? "danger" : "muted"} />
              <StatBox label={`${match.away.code} xG`} value={sim.awayXG.toFixed(2)} tone="primary" />
            </div>

            <div className="mb-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
              <span>Win probability</span>
              <span>vs base</span>
            </div>
            <WPBar codeH={match.home.code} codeA={match.away.code} wp={sim.wp} dHome={sim.dHome} dAway={sim.dAway} />

            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted">
                <span>Territory</span>
                <span>
                  {match.home.code} {sim.territory}% · {100 - sim.territory}% {match.away.code}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded border border-border bg-background/40">
                <div className="h-full bg-primary/60" style={{ width: `${sim.territory}%` }} />
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}
function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function TeamPanel({
  team,
  teamName,
  teamCode,
  formation,
  setFormation,
  press,
  setPress,
  tempo,
  setTempo,
  redCard,
  setRedCard,
  lowBlock,
  setLowBlock,
  earlySub,
  setEarlySub,
}: {
  team: Team;
  teamName: string;
  teamCode: string;
  formation: Formation;
  setFormation: (f: Formation) => void;
  press: number;
  setPress: (n: number) => void;
  tempo: number;
  setTempo: (n: number) => void;
  redCard: boolean;
  setRedCard: (b: boolean) => void;
  lowBlock: boolean;
  setLowBlock: (b: boolean) => void;
  earlySub: boolean;
  setEarlySub: (b: boolean) => void;
}) {
  const trait = FORMATION_TRAITS[formation];
  return (
    <div className="rounded border border-border bg-surface/40 p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-widest text-primary">{teamName}</div>
        <div className="font-mono text-[10px] uppercase tracking-widest text-muted">{team === "home" ? "HOME" : "AWAY"} · {teamCode}</div>
      </div>

      <div className="mb-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted">Formation</div>
        <div className="flex flex-wrap gap-1.5">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormation(f)}
              className={`rounded border px-2 py-1 font-mono text-[11px] transition-colors ${
                f === formation
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-border bg-background/40 text-muted hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="mt-1 font-mono text-[10px] text-muted">{trait.label}</div>
      </div>

      <Slider label="Press intensity" value={press} onChange={setPress} lo="Low block" hi="Gegenpress" />
      <Slider label="Tempo" value={tempo} onChange={setTempo} lo="Slow" hi="Vertical" />

      <div className="mt-3 flex flex-wrap gap-1.5">
        <Toggle active={redCard} onClick={() => setRedCard(!redCard)} tone="danger" label={redCard ? "Playing 10 vs 11" : "Red card"} hint="−35% attack, −20% defence" />
        <Toggle active={lowBlock} onClick={() => setLowBlock(!lowBlock)} tone="primary" label="Low block" hint="+25% defence, −15% attack" />
        <Toggle active={earlySub} onClick={() => setEarlySub(!earlySub)} tone="primary" label="Earlier impact sub" hint="+8% attack from 55'" />
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  tone,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  tone: "primary" | "danger";
  label: string;
  hint: string;
}) {
  const activeCls = tone === "danger"
    ? "border-danger/60 bg-danger/15 text-danger"
    : "border-primary/60 bg-primary/15 text-primary";
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={`rounded border px-2 py-1 text-left font-mono text-[10px] uppercase tracking-wider transition-colors ${
        active ? activeCls : "border-border bg-background/40 text-muted hover:text-foreground"
      }`}
    >
      {active ? "● " : "○ "}
      {label}
    </button>
  );
}


function Slider({
  label,
  value,
  onChange,
  lo,
  hi,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  lo: string;
  hi: string;
}) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{label}</span>
        <span className="font-mono text-[10px] text-foreground/80">{value}</span>
      </div>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-primary"
      />
      <div className="mt-0.5 flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  );
}

function StatBox({ label, value, tone }: { label: string; value: string; tone: "primary" | "danger" | "muted" }) {
  const cls =
    tone === "primary"
      ? "border-primary/40 bg-primary/10 text-primary"
      : tone === "danger"
        ? "border-danger/40 bg-danger/10 text-danger"
        : "border-border bg-background/40 text-muted";
  return (
    <div className={`rounded border p-2 ${cls}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-80">{label}</div>
      <div className="mt-0.5 font-mono text-lg font-bold">{value}</div>
    </div>
  );
}

function WPBar({
  codeH,
  codeA,
  wp,
  dHome,
  dAway,
}: {
  codeH: string;
  codeA: string;
  wp: { home: number; draw: number; away: number };
  dHome: number;
  dAway: number;
}) {
  const chip = (d: number) => {
    if (d === 0) return { txt: "±0", cls: "text-muted" };
    if (d > 0) return { txt: `+${d}`, cls: "text-primary" };
    return { txt: `${d}`, cls: "text-danger" };
  };
  const hChip = chip(dHome);
  const aChip = chip(dAway);
  return (
    <>
      <div className="flex h-4 overflow-hidden rounded border border-border bg-background/40">
        <div className="bg-primary/60" style={{ width: `${wp.home}%` }} title={`${codeH} ${wp.home}%`} />
        <div className="bg-muted/40" style={{ width: `${wp.draw}%` }} title={`Draw ${wp.draw}%`} />
        <div className="bg-danger/50" style={{ width: `${wp.away}%` }} title={`${codeA} ${wp.away}%`} />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] uppercase tracking-wider">
        <span className="text-primary">
          {codeH} {wp.home}% <span className={hChip.cls}>({hChip.txt})</span>
        </span>
        <span className="text-muted">Draw {wp.draw}%</span>
        <span className="text-danger">
          <span className={aChip.cls}>({aChip.txt})</span> {wp.away}% {codeA}
        </span>
      </div>
    </>
  );
}

function buildNarrative(o: {
  homeName: string;
  awayName: string;
  homeForm: Formation;
  awayForm: Formation;
  homePress: number;
  awayPress: number;
  homeTempo: number;
  awayTempo: number;
  homeXG: number;
  awayXG: number;
  territory: number;
}) {
  const pressGap = o.homePress - o.awayPress;
  const tempoGap = o.homeTempo - o.awayTempo;
  const dominant = o.homeXG > o.awayXG + 0.2 ? o.homeName : o.awayXG > o.homeXG + 0.2 ? o.awayName : null;

  const parts: string[] = [];
  parts.push(
    dominant
      ? `Model projects ${dominant} to control the shot picture (xG ${o.homeXG.toFixed(2)}–${o.awayXG.toFixed(2)}).`
      : `Balanced tie on projected xG (${o.homeXG.toFixed(2)}–${o.awayXG.toFixed(2)}).`,
  );
  if (Math.abs(pressGap) > 15) {
    parts.push(
      pressGap > 0
        ? `${o.homeName}'s higher press (${o.homePress}) squeezes ${o.awayName}'s build-up — expect ${o.homeForm} to force turnovers in the middle third.`
        : `${o.awayName} press harder (${o.awayPress}) and can catch ${o.homeName} in the ${o.homeForm} between the lines.`,
    );
  }
  if (Math.abs(tempoGap) > 15) {
    parts.push(
      tempoGap > 0
        ? `Vertical tempo from ${o.homeName} (${o.homeTempo}) should generate ${o.territory > 55 ? "sustained pressure" : "more transitions"}.`
        : `${o.awayName}'s faster tempo (${o.awayTempo}) skews the game into transitions.`,
    );
  }
  if (parts.length === 1) {
    parts.push(`Territory splits ${o.territory}%–${100 - o.territory}% — a chess match with narrow margins.`);
  }
  return parts.join(" ");
}

function SimNotFound() {
  const { matchId } = Route.useParams();
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 font-sans text-foreground">
      <div className="max-w-md text-center">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-danger">Simulator unavailable</div>
        <h1 className="mb-2 text-2xl font-bold">No fixture "{matchId}"</h1>
        <p className="mb-6 text-sm text-muted">Can't run scenarios on a match that isn't in the model.</p>
        <Link to="/" className="inline-block rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20">
          ← Back to Match Hub
        </Link>
      </div>
    </div>
  );
}

function SimError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="grid min-h-screen place-items-center bg-background p-6 font-sans text-foreground">
      <div className="max-w-md">
        <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-danger">Simulator engine error</div>
        <h1 className="mb-2 text-2xl font-bold">Scenario failed to compile</h1>
        <pre className="mb-6 overflow-x-auto rounded border border-danger/30 bg-danger/5 p-3 font-mono text-[11px] text-danger/90">
          {error.message}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={async () => {
              await router.invalidate();
              reset();
            }}
            className="rounded border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-primary hover:bg-primary/20"
          >
            ↻ Retry
          </button>
          <Link to="/" className="rounded border border-border bg-surface/60 px-3 py-1.5 font-mono text-[10px] uppercase tracking-wider text-muted hover:text-foreground">
            ← Match Hub
          </Link>
        </div>
      </div>
    </div>
  );
}

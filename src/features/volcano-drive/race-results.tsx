'use dom';

type RaceResultsProps = {
  best: number;
  dom?: import('expo/dom').DOMProps;
  level: number;
  onRestart: () => Promise<void>;
  score: number;
};

export default function RaceResults({ best, level, onRestart, score }: RaceResultsProps) {
  return (
    <main className="screen">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; margin: 0; background: transparent; }
        body { overflow: hidden; font-family: ui-rounded, system-ui, -apple-system, sans-serif; color: #fff; }
        button { font: inherit; -webkit-tap-highlight-color: transparent; }
        .screen {
          width: 100%; height: 100%; padding: 42px 22px max(28px, env(safe-area-inset-bottom));
          display: flex; flex-direction: column; justify-content: flex-end; gap: 18px;
          background:
            radial-gradient(circle at 50% 72%, rgba(255,54,18,.14), transparent 34%),
            linear-gradient(180deg, transparent 0%, rgba(10,4,7,.28) 24%, rgba(10,4,7,.97) 66%);
          animation: shade .42s ease-out both;
        }
        .eyebrow { text-align: center; color: #ff8c36; font-size: 10px; font-weight: 900; letter-spacing: 2px; animation: rise .38s .18s both; }
        .title { text-align: center; animation: slam .5s cubic-bezier(.2,1.5,.3,1) both; }
        h1 { margin: 0; font-size: 38px; line-height: .95; letter-spacing: -1.5px; text-shadow: 0 10px 34px rgba(255,57,16,.3); }
        .sub { margin-top: 10px; color: rgba(255,255,255,.48); font-size: 11px; font-weight: 700; letter-spacing: 1.2px; }
        .scores {
          display: grid; grid-template-columns: 1fr 1fr; overflow: hidden;
          background: linear-gradient(145deg, rgba(255,255,255,.11), rgba(255,255,255,.045));
          border: 1px solid rgba(255,255,255,.12); border-radius: 24px;
          box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 20px 55px rgba(0,0,0,.32);
          animation: rise .48s .12s both;
        }
        .score { position: relative; padding: 20px; }
        .score + .score { border-left: 1px solid rgba(255,255,255,.09); text-align: right; }
        label { display: block; color: rgba(255,255,255,.46); font-size: 9px; font-weight: 900; letter-spacing: 1.7px; }
        strong { display: block; margin-top: 5px; font-size: 34px; line-height: 1; letter-spacing: -1.5px; font-variant-numeric: tabular-nums; }
        .again {
          position: relative; width: 100%; overflow: hidden; border: 0; border-radius: 19px; padding: 18px;
          color: #16120a; background: linear-gradient(180deg, #ffeb19, #ffd600);
          font-weight: 950; font-size: 16px; letter-spacing: .5px;
          box-shadow: 0 13px 42px rgba(255,214,0,.28), inset 0 1px 0 rgba(255,255,255,.62);
          animation: rise .48s .22s both, breathe 1.7s 1s ease-in-out infinite;
          transition: transform .12s ease, filter .12s ease;
        }
        .again::after { content: ''; position: absolute; inset: -40% auto -40% -32%; width: 24%; transform: rotate(16deg); background: rgba(255,255,255,.55); filter: blur(8px); animation: shine 2.6s 1.2s infinite; }
        .again:active { transform: scale(.975); filter: brightness(.94); }
        .home { text-align: center; color: rgba(255,255,255,.38); font-size: 10px; font-weight: 900; letter-spacing: 1.6px; animation: rise .4s .3s both; }
        @keyframes shade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slam { 0% { opacity: 0; transform: scale(1.7) rotate(-3deg); filter: blur(8px); } 65% { transform: scale(.94) rotate(1deg); } 100% { opacity: 1; transform: scale(1); filter: blur(0); } }
        @keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes breathe { 50% { box-shadow: 0 15px 52px rgba(255,214,0,.38), inset 0 1px 0 rgba(255,255,255,.72); } }
        @keyframes shine { 0%, 55% { left: -32%; } 100% { left: 125%; } }
      `}</style>
      <div className="eyebrow">LEVEL {level} · RUN ENDED</div>
      <section className="title">
        <h1>CRASHED!</h1>
        <div className="sub">free drive — the volcano</div>
      </section>
      <section className="scores">
        <div className="score">
          <label>SCORE</label>
          <strong>${score}</strong>
        </div>
        <div className="score">
          <label>BEST</label>
          <strong>${best}</strong>
        </div>
      </section>
      <button className="again" onClick={() => onRestart()} type="button">
        DRIVE AGAIN
      </button>
      <div className="home">⌂ &nbsp; NATIVE LAB</div>
    </main>
  );
}

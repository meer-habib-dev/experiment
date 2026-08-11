'use dom';

type TowerResultsProps = {
  dom?: import('expo/dom').DOMProps;
  fallen: number;
  moves: number;
  onRestart: () => Promise<void>;
  score: number;
};

export default function TowerResults({ fallen, moves, onRestart, score }: TowerResultsProps) {
  const rank = score >= 1600 ? 'MASTER BUILDER' : score >= 900 ? 'STEADY HAND' : 'BOLD ROOKIE';

  return (
    <main className="screen">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; margin: 0; background: transparent; }
        body { overflow: hidden; color: #fff9ec; font-family: ui-rounded, system-ui, -apple-system, sans-serif; }
        button { font: inherit; -webkit-tap-highlight-color: transparent; }
        .screen {
          width: 100%; height: 100%; padding: 42px 20px max(30px, env(safe-area-inset-bottom));
          display: flex; flex-direction: column; justify-content: flex-end; gap: 15px;
          background: radial-gradient(circle at 50% 50%, rgba(255,116,48,.06), transparent 34%), linear-gradient(180deg, transparent 3%, rgba(5,4,3,.2) 32%, rgba(5,4,3,.98) 72%);
          animation: curtain .4s ease-out both;
        }
        .eyebrow { color: #ffae62; text-align: center; font-size: 10px; font-weight: 950; letter-spacing: 2.4px; animation: rise .4s .14s both; }
        .title { text-align: center; animation: drop .55s cubic-bezier(.2,1.45,.35,1) both; }
        h1 { margin: 0; font-size: clamp(42px, 12vw, 58px); line-height: .86; letter-spacing: -3px; text-shadow: 0 14px 48px rgba(255,91,32,.35); }
        .rank { margin-top: 11px; color: rgba(255,255,255,.47); font: 800 10px ui-monospace, monospace; letter-spacing: 2px; }
        .score { text-align: center; padding: 18px; border-radius: 25px; border: 1px solid rgba(255,211,154,.16); background: linear-gradient(145deg, rgba(255,197,125,.13), rgba(255,255,255,.035)); box-shadow: inset 0 1px rgba(255,255,255,.08), 0 22px 55px rgba(0,0,0,.3); animation: rise .46s .1s both; }
        .score label, .stat label { display: block; color: rgba(255,255,255,.4); font-size: 9px; font-weight: 900; letter-spacing: 1.8px; }
        .score strong { display: block; margin-top: 3px; color: #ffc876; font-size: 46px; line-height: 1; font-variant-numeric: tabular-nums; }
        .stats { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; animation: rise .46s .18s both; }
        .stat { padding: 15px 17px; border-radius: 18px; background: rgba(255,255,255,.055); border: 1px solid rgba(255,255,255,.08); }
        .stat:last-child { text-align: right; }
        .stat strong { display: block; margin-top: 4px; font-size: 23px; font-variant-numeric: tabular-nums; }
        .again { position: relative; overflow: hidden; width: 100%; border: 0; border-radius: 19px; padding: 17px; color: #251307; background: linear-gradient(180deg, #ffd995, #ffad55); box-shadow: 0 14px 42px rgba(255,128,46,.24), inset 0 1px rgba(255,255,255,.7); font-size: 15px; font-weight: 950; letter-spacing: .5px; animation: rise .46s .26s both; transition: transform .12s; }
        .again:active { transform: scale(.975); }
        .again::after { content: ''; position: absolute; inset: -50% auto -50% -35%; width: 24%; background: rgba(255,255,255,.55); filter: blur(8px); transform: rotate(18deg); animation: shine 2.8s 1.1s infinite; }
        .tech { text-align: center; color: rgba(255,255,255,.25); font: 800 9px ui-monospace, monospace; letter-spacing: 1.45px; animation: rise .4s .32s both; }
        @keyframes curtain { from { opacity: 0; } to { opacity: 1; } }
        @keyframes drop { 0% { opacity: 0; transform: translateY(-70px) rotate(-2deg) scale(1.25); filter: blur(10px); } 70% { transform: translateY(3px) rotate(.5deg) scale(.97); } 100% { opacity: 1; transform: none; filter: none; } }
        @keyframes rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
        @keyframes shine { 0%, 58% { left: -35%; } 100% { left: 125%; } }
      `}</style>
      <div className="eyebrow">STRUCTURAL FAILURE</div>
      <section className="title">
        <h1>TIMBER!</h1>
        <div className="rank">{rank}</div>
      </section>
      <section className="score">
        <label>FINAL SCORE</label>
        <strong>{score.toLocaleString()}</strong>
      </section>
      <section className="stats">
        <div className="stat"><label>BLOCKS PULLED</label><strong>{moves}</strong></div>
        <div className="stat"><label>FALLEN</label><strong>{fallen} / 54</strong></div>
      </section>
      <button className="again" onClick={() => onRestart()} type="button">REBUILD TOWER</button>
      <div className="tech">THREE.JS · WEBGPU · CANNON · SKIA · EXPO DOM</div>
    </main>
  );
}


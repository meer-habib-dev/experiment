'use dom';

import { useEffect, useMemo, useState } from 'react';

import type { ArenaSeat } from '@/features/halo-arena/arena-world';

type ArenaCheckoutProps = {
  dom?: import('expo/dom').DOMProps;
  onClose: () => Promise<void>;
  onConfirm: () => Promise<void>;
  seats: ArenaSeat[];
  total: number;
};

const money = (value: number) => `$${value.toLocaleString()}`;

export default function ArenaCheckout({
  onClose,
  onConfirm,
  seats,
  total,
}: ArenaCheckoutProps) {
  const [tickets] = useState(seats);
  const [heldTotal] = useState(total);
  const [seconds, setSeconds] = useState(8 * 60);
  const [state, setState] = useState<'ready' | 'processing' | 'confirmed'>('ready');
  const sectionSummary = useMemo(
    () => [...new Set(tickets.map((seat) => seat.section))].join(' · '),
    [tickets],
  );

  useEffect(() => {
    if (state !== 'ready') return;
    const timer = window.setInterval(() => setSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  const confirm = async () => {
    if (state !== 'ready') return;
    setState('processing');
    await onConfirm();
    setState('confirmed');
  };

  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <main className="screen">
      <style>{`
        * { box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; margin: 0; background: transparent; }
        body { overflow: hidden; color: #f3fbf9; font-family: ui-rounded, system-ui, -apple-system, sans-serif; }
        button { color: inherit; font: inherit; -webkit-tap-highlight-color: transparent; }
        .screen {
          width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: flex-end;
          padding: max(52px, env(safe-area-inset-top)) 12px max(12px, env(safe-area-inset-bottom));
          background: linear-gradient(180deg, rgba(2,8,13,.24), rgba(2,8,13,.72) 38%, rgba(2,8,13,.96));
          animation: veil .25s ease-out both;
        }
        .close {
          position: absolute; right: 16px; top: max(18px, env(safe-area-inset-top)); width: 42px; height: 42px;
          border: 1px solid rgba(255,255,255,.15); border-radius: 50%; background: rgba(7,16,21,.74);
          backdrop-filter: blur(18px); font-size: 20px; font-weight: 500; transition: transform .12s, opacity .12s;
        }
        .close:active { transform: scale(.92); opacity: .65; }
        .sheet {
          position: relative; overflow: hidden; width: 100%; max-width: 580px; margin: 0 auto; padding: 7px;
          border: 1px solid rgba(207,255,244,.14); border-radius: 32px;
          background: linear-gradient(145deg, rgba(28,43,51,.93), rgba(8,18,25,.96));
          box-shadow: 0 30px 90px rgba(0,0,0,.55), inset 0 1px rgba(255,255,255,.1);
          animation: rise .46s cubic-bezier(.2,.9,.25,1) both;
        }
        .sheet::before {
          content: ''; position: absolute; width: 230px; height: 230px; left: -80px; top: -110px;
          border-radius: 50%; background: rgba(70,255,220,.12); filter: blur(45px); pointer-events: none;
        }
        .ticket { position: relative; padding: 21px 18px 17px; border-radius: 25px; background: rgba(255,255,255,.045); }
        .topline { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
        .eyebrow { color: #8ff7e7; font: 850 9px ui-monospace, monospace; letter-spacing: 1.8px; }
        h1 { margin: 5px 0 0; font-size: 29px; line-height: 1; letter-spacing: -1.2px; }
        .hold { flex: 0 0 auto; padding: 8px 10px; border: 1px solid rgba(217,255,54,.22); border-radius: 12px; background: rgba(217,255,54,.08); text-align: right; }
        .hold label { display: block; color: rgba(255,255,255,.38); font: 800 7px ui-monospace, monospace; letter-spacing: 1px; }
        .hold strong { display: block; margin-top: 2px; color: #d8ff36; font: 900 16px ui-monospace, monospace; font-variant-numeric: tabular-nums; }
        .event { display: grid; grid-template-columns: 1fr auto; gap: 18px; margin-top: 21px; padding-top: 17px; border-top: 1px solid rgba(255,255,255,.08); }
        .event p { margin: 3px 0 0; color: rgba(255,255,255,.48); font-size: 12px; line-height: 1.35; }
        .date { text-align: right; }
        .date strong { display: block; font-size: 20px; }
        .date span { color: rgba(255,255,255,.42); font-size: 10px; font-weight: 800; letter-spacing: .8px; }
        .seats { display: flex; gap: 7px; overflow-x: auto; margin: 16px -3px 0; padding: 3px; scrollbar-width: none; }
        .seats::-webkit-scrollbar { display: none; }
        .seat { flex: 0 0 auto; min-width: 82px; padding: 11px 12px; border: 1px solid rgba(143,247,231,.13); border-radius: 15px; background: rgba(1,8,12,.3); }
        .seat span { display: block; color: rgba(255,255,255,.4); font: 750 8px ui-monospace, monospace; letter-spacing: .8px; }
        .seat strong { display: block; margin-top: 4px; color: #cffff5; font-size: 16px; }
        .seat em { display: block; margin-top: 3px; color: rgba(255,255,255,.38); font-size: 9px; font-style: normal; }
        .summary { display: grid; gap: 9px; padding: 16px 18px 7px; }
        .line { display: flex; justify-content: space-between; color: rgba(255,255,255,.5); font-size: 12px; }
        .line strong { color: rgba(255,255,255,.78); font-variant-numeric: tabular-nums; }
        .line.total { margin-top: 2px; padding-top: 13px; border-top: 1px solid rgba(255,255,255,.08); color: #fff; font-size: 14px; font-weight: 850; }
        .line.total strong { color: #d8ff36; font-size: 25px; line-height: .8; }
        .confirm {
          position: relative; overflow: hidden; width: 100%; margin-top: 6px; padding: 17px; border: 0; border-radius: 20px;
          background: linear-gradient(180deg, #e4ff62, #c7f02e); color: #0d190f; box-shadow: 0 16px 44px rgba(193,242,46,.18);
          font-size: 14px; font-weight: 950; letter-spacing: .2px; transition: transform .13s, filter .13s;
        }
        .confirm:active { transform: scale(.98); filter: brightness(.88); }
        .confirm:disabled { opacity: .72; }
        .confirm::after { content: ''; position: absolute; inset: -50% auto -50% -30%; width: 20%; background: rgba(255,255,255,.6); filter: blur(8px); transform: rotate(17deg); animation: shine 2.7s 1.1s infinite; }
        .fineprint { padding: 10px 16px 12px; color: rgba(255,255,255,.24); text-align: center; font: 700 8px ui-monospace, monospace; letter-spacing: .8px; }
        .confirmed { padding: 26px 18px 18px; text-align: center; }
        .check { display: grid; place-items: center; width: 72px; height: 72px; margin: 0 auto 18px; border-radius: 24px; background: #d8ff36; color: #10200d; box-shadow: 0 18px 50px rgba(202,255,54,.22); font-size: 35px; font-weight: 950; animation: pop .55s cubic-bezier(.2,1.5,.35,1) both; }
        .confirmed h1 { font-size: 37px; }
        .confirmed p { max-width: 330px; margin: 10px auto 20px; color: rgba(255,255,255,.5); font-size: 13px; line-height: 1.5; }
        .pass { overflow: hidden; padding: 17px; border: 1px solid rgba(216,255,54,.19); border-radius: 20px; background: linear-gradient(135deg, rgba(216,255,54,.11), rgba(89,244,226,.05)); text-align: left; }
        .passrow { display: flex; justify-content: space-between; align-items: flex-end; gap: 15px; }
        .pass label { color: rgba(255,255,255,.4); font: 800 8px ui-monospace, monospace; letter-spacing: 1.2px; }
        .pass strong { display: block; margin-top: 4px; color: #d8ff36; font-size: 25px; }
        .barcode { height: 34px; margin-top: 16px; opacity: .75; background: repeating-linear-gradient(90deg, #eaffd8 0 2px, transparent 2px 5px, #eaffd8 5px 6px, transparent 6px 10px); }
        .done { background: linear-gradient(180deg, #b9fff4, #77e8d8); }
        @keyframes veil { from { opacity: 0; } to { opacity: 1; } }
        @keyframes rise { from { opacity: 0; transform: translateY(70px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes pop { from { opacity: 0; transform: scale(.4) rotate(-14deg); } to { opacity: 1; transform: none; } }
        @keyframes shine { 0%, 58% { left: -30%; } 100% { left: 130%; } }
      `}</style>

      <button aria-label="Close checkout" className="close" onClick={() => onClose()} type="button">×</button>
      <section className="sheet">
        {state === 'confirmed' ? (
          <div className="confirmed">
            <div className="check">✓</div>
            <div className="eyebrow">BOOKING CONFIRMED</div>
            <h1>You’re in.</h1>
            <p>Your seats are locked for the Aurora Final. The live arena map now shows them as reserved.</p>
            <div className="pass">
              <div className="passrow">
                <div><label>SECTIONS</label><strong>{sectionSummary}</strong></div>
                <div><label>GATE</label><strong>NORTH 04</strong></div>
              </div>
              <div className="barcode" />
            </div>
            <button className="confirm done" onClick={() => onClose()} type="button">EXPLORE THE ARENA</button>
          </div>
        ) : (
          <>
            <div className="ticket">
              <div className="topline">
                <div><div className="eyebrow">NOVA PARK · DHAKA</div><h1>Aurora Final</h1></div>
                <div className="hold"><label>SEATS HELD</label><strong>{time}</strong></div>
              </div>
              <div className="event">
                <div><div className="eyebrow">CHAMPIONSHIP NIGHT</div><p>Doors 18:30 · Kickoff 20:00<br />360° live seat map</p></div>
                <div className="date"><strong>SEP 14</strong><span>SATURDAY</span></div>
              </div>
              <div className="seats">
                {tickets.map((seat) => (
                  <div className="seat" key={seat.id}>
                    <span>SECTION {seat.section}</span><strong>{seat.row}{seat.seat}</strong><em>{seat.tier} · {money(seat.price)}</em>
                  </div>
                ))}
              </div>
            </div>
            <div className="summary">
              <div className="line"><span>{tickets.length} × reserved seat</span><strong>{money(heldTotal)}</strong></div>
              <div className="line"><span>Service & venue</span><strong>{money(tickets.length * 9)}</strong></div>
              <div className="line total"><span>Total</span><strong>{money(heldTotal + tickets.length * 9)}</strong></div>
            </div>
            <button className="confirm" disabled={state === 'processing'} onClick={confirm} type="button">
              {state === 'processing' ? 'LOCKING YOUR VIEW…' : `CONFIRM ${tickets.length} SEAT${tickets.length === 1 ? '' : 'S'}`}
            </button>
            <div className="fineprint">SECURE HOLD · FREE CANCELLATION FOR 24 HOURS · EXPO DOM</div>
          </>
        )}
      </section>
    </main>
  );
}

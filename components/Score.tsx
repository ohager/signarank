import React from 'react';

interface ScoreProps {
  score: number,
  rank: number
}

const Score = ({score, rank}: ScoreProps) => (
  <div className="flex gap-12 justify-center my-10 max-sm:gap-8">
    <div className="text-center">
      <div className="text-[3rem] font-extrabold leading-none text-[var(--gold)]" style={{fontFamily: "'Cinzel', serif", textShadow: '0 0 40px rgba(197,164,78,0.3)'}}>
        {score}
      </div>
      <div className="text-[0.6rem] tracking-[0.2em] uppercase text-[var(--text-faint)] mt-1" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
        Score
      </div>
    </div>
    <div className="text-center">
      <div className="text-[3rem] font-extrabold leading-none text-[var(--frost)]" style={{fontFamily: "'Cinzel', serif", textShadow: '0 0 40px rgba(126,200,227,0.3)'}}>
        #{rank}
        {rank === 1 && ' 🏆'}
        {rank === 2 && ' 🥈'}
        {rank === 3 && ' 🥉'}
      </div>
      <div className="text-[0.6rem] tracking-[0.2em] uppercase text-[var(--text-faint)] mt-1" style={{fontFamily: "'IBM Plex Mono', monospace"}}>
        Rank
      </div>
    </div>
  </div>
)
export default Score;

import React from 'react';

interface ScoreProps {
  score: number,
  rank: number
}

const Score = ({
  score, rank
}: ScoreProps) => (
  <div className="grid grid-cols-[48%_48%] text-center gap-y-[30px] gap-x-[6%] justify-items-center box-content my-[60px] [&_h3]:m-0 [&_h3]:text-[55px] [&_h5]:m-0 [&_h5]:text-2xl [&_h5]:text-white [&_h5]:opacity-50">
    <div>
      <h3>{score}</h3>
      <h5>Score</h5>
    </div>
    <div>
      <h3>
        {rank}
        {rank === 1 && '🏆'}
        {rank === 2 && '🥈'}
        {rank === 3 && '🥉'}
      </h3>
      <h5>Rank</h5>
    </div>
  </div>
)
export default Score;
